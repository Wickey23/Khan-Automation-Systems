import { AiProvider, type Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { twiml as Twiml } from "twilio";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { verifyTwilioRequest } from "../../middleware/webhook-security";
import { reserveDemoAttemptOrReject, getDemoState, isGuidedDemoEnabled, isPaidSubscriptionActive } from "../billing/demo-access.service";
import { upsertDemoOverCapLead } from "../billing/demo-lead-fallback.service";
import { sendThrottledUpgradeSms } from "../billing/demo-upgrade-sms.service";
import { registerWebhookReplay } from "../ops/webhook-replay.service";
import { transitionCallState } from "./call-state.service";
import { upsertCallerProfileOnInbound } from "./caller-profile.service";
import { buildRoutingDecisionJson, computeRoutingDecision, type RoutingResultType } from "./routing.service";

export const voiceRouter = Router();
const twilioVoiceSchema = z.object({
  CallSid: z.string().min(1),
  From: z.string().optional(),
  To: z.string().optional()
});

function parseDuration(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePhoneE164(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function safeParseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

async function writeDemoAudit(orgId: string, action: string, metadata: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: {
      orgId,
      actorUserId: "guided-demo",
      actorRole: "SYSTEM",
      action,
      metadataJson: JSON.stringify(metadata)
    }
  });
}

async function updateCallLogFromVoicePayload(payload: Record<string, unknown>, orgId?: string) {
  const callSid = String(payload.CallSid || "").trim();
  if (!callSid) return;

  const recordingUrl = String(payload.RecordingUrl || "").trim() || null;
  const transcript = String(payload.TranscriptionText || "").trim() || null;
  const durationSec = parseDuration(payload.CallDuration ?? payload.RecordingDuration);
  const callStatus = String(payload.CallStatus || "").toLowerCase();
  const endedAt = callStatus === "completed" || durationSec !== null ? new Date() : undefined;

  const data: {
    recordingUrl?: string | null;
    transcript?: string | null;
    durationSec?: number | null;
    endedAt?: Date;
  } = {};

  if (recordingUrl !== null) data.recordingUrl = recordingUrl;
  if (transcript !== null) data.transcript = transcript;
  if (durationSec !== null) data.durationSec = durationSec;
  if (endedAt) data.endedAt = endedAt;

  if (!Object.keys(data).length) return;

  const existing = await prisma.callLog.findFirst({
    where: { providerCallId: callSid },
    orderBy: { createdAt: "desc" }
  });

  if (existing) {
    await prisma.callLog.update({ where: { id: existing.id }, data });
    return;
  }

  if (!orgId) return;
  await prisma.callLog.create({
    data: {
      orgId,
      providerCallId: callSid,
      fromNumber: String(payload.From || "unknown"),
      toNumber: String(payload.To || "unknown"),
      outcome: "MESSAGE_TAKEN",
      ...data
    }
  });
}

voiceRouter.post("/", verifyTwilioRequest, async (req, res) => {
  const response = new Twiml.VoiceResponse();
  try {
    const parsedPayload = twilioVoiceSchema.safeParse(req.body || {});
    if (!parsedPayload.success) {
      await prisma.auditLog.create({
        data: {
          actorUserId: "twilio-voice",
          actorRole: "SYSTEM",
          action: "TWILIO_WEBHOOK_SCHEMA_IGNORED",
          metadataJson: JSON.stringify({ requestId: req.requestId || null, endpoint: "/api/twilio/voice" })
        }
      });
      return res.type("text/xml").send(response.toString());
    }
    const inboundSid = String(req.body.CallSid || "").trim();
    if (inboundSid) {
      const replay = await registerWebhookReplay(prisma, {
        provider: "TWILIO",
        eventKey: `voice:${inboundSid}:inbound`,
        outcome: "INBOUND"
      });
      if (replay.duplicate) {
        await prisma.auditLog.create({
          data: {
            actorUserId: "twilio-voice",
            actorRole: "SYSTEM",
            action: "WEBHOOK_REPLAY_BLOCKED",
            metadataJson: JSON.stringify({ provider: "TWILIO", eventKey: `voice:${inboundSid}:inbound` })
          }
        });
        return res.type("text/xml").send(response.toString());
      }
    }

    const fromNumber = (req.body.From as string | undefined) || "unknown";
    const toNumber = (req.body.To as string | undefined) || "unknown";
    const normalizedTo = normalizePhoneE164(toNumber);
    const last10 = normalizedTo.replace(/\D/g, "").slice(-10);
    const callSid = String(req.body.CallSid || "").trim();
    let orgPhone = await prisma.phoneNumber.findFirst({
      where: {
        status: { not: "RELEASED" },
        OR: [
          { e164Number: toNumber },
          ...(normalizedTo ? [{ e164Number: normalizedTo }] : []),
          ...(last10.length === 10 ? [{ e164Number: { endsWith: last10 } }] : [])
        ]
      },
      include: {
        organization: {
          include: {
            aiAgentConfigs: { orderBy: { updatedAt: "desc" }, take: 1 },
            businessSettings: true
          }
        }
      }
    });

    // Fallback for legacy formatted numbers (e.g. "+1 516 350 5753").
    if (!orgPhone && normalizedTo) {
      const activeNumbers = await prisma.phoneNumber.findMany({
        where: { status: { not: "RELEASED" } },
        include: {
          organization: {
            include: {
              aiAgentConfigs: { orderBy: { updatedAt: "desc" }, take: 1 },
              businessSettings: true
            }
          }
        },
        take: 500
      });
      orgPhone =
        activeNumbers.find((row) => normalizePhoneE164(row.e164Number) === normalizedTo) ||
        (last10.length === 10
          ? activeNumbers.find((row) => normalizePhoneE164(row.e164Number).replace(/\D/g, "").endsWith(last10))
          : null) ||
        null;
    }

    if (!orgPhone?.organization) {
      response.say("This line is not configured yet.");
      response.hangup();
      return res.type("text/xml").send(response.toString());
    }

    // Idempotent for Twilio retries.
    let callLogId: string | null = null;
    if (callSid) {
      const upserted = await prisma.callLog.upsert({
        where: { orgId_providerCallId: { orgId: orgPhone.orgId, providerCallId: callSid } },
        update: {
          fromNumber,
          toNumber,
          aiProvider: orgPhone.organization.live ? AiProvider.VAPI : undefined
        },
        create: {
          orgId: orgPhone.orgId,
          providerCallId: callSid,
          fromNumber,
          toNumber,
          aiProvider: orgPhone.organization.live ? AiProvider.VAPI : undefined,
          outcome: "MESSAGE_TAKEN"
        }
      });
      callLogId = upserted.id;
    } else {
      const created = await prisma.callLog.create({
        data: {
          orgId: orgPhone.orgId,
          providerCallId: null,
          fromNumber,
          toNumber,
          aiProvider: orgPhone.organization.live ? AiProvider.VAPI : undefined,
          outcome: "MESSAGE_TAKEN"
        }
      });
      callLogId = created.id;
    }

    const org = orgPhone.organization;
    const ai = org.aiAgentConfigs[0];
    const routingEnabled = env.ROUTING_ENGINE_ENABLED === "true";
    if (routingEnabled && callLogId) {
      await transitionCallState({
        prisma,
        callLogId,
        toState: "RINGING",
        metadata: { source: "twilio-voice-inbound" }
      });
      await upsertCallerProfileOnInbound({
        prisma,
        orgId: orgPhone.orgId,
        callerNumber: fromNumber
      });
    }

    let forcedRoute: RoutingResultType | null = null;
    if (routingEnabled) {
      const [callerProfile, callVolumeLast5m] = await Promise.all([
        prisma.callerProfile.findUnique({
          where: { orgId_phoneNumber: { orgId: orgPhone.orgId, phoneNumber: normalizePhoneE164(fromNumber) } },
          select: { totalCalls: true, lastCallAt: true, flaggedVIP: true }
        }),
        prisma.callLog.count({
          where: { orgId: orgPhone.orgId, startedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } }
        })
      ]);
      const decision = computeRoutingDecision({
        org,
        phone: orgPhone,
        aiConfig: ai || null,
        settings: org.businessSettings,
        callerProfile,
        callerNumber: fromNumber,
        callVolumeLast5m
      });
      forcedRoute = decision.route;
      if (callLogId) {
        await prisma.callLog.update({
          where: { id: callLogId },
          data: { routingDecisionJson: buildRoutingDecisionJson(decision) as Prisma.InputJsonValue }
        });
      }
    }

    const canUseVapiNow =
      ai?.provider === "VAPI" &&
      Boolean(ai?.vapiPhoneNumberId) &&
      (org.status === "LIVE" || org.status === "TESTING" || org.live);
    if (canUseVapiNow && (forcedRoute === null || forcedRoute === "ROUTE_TO_VAPI")) {
      const guidedDemoEnabled = isGuidedDemoEnabled();
      const paidActive = isPaidSubscriptionActive(org.subscriptionStatus);
      if (guidedDemoEnabled && !paidActive) {
        if (!callSid) {
          await writeDemoAudit(orgPhone.orgId, "DEMO_PROVIDER_CALL_ID_MISSING", {
            reason: "provider_call_id_missing",
            fromNumber,
            toNumber
          });
          response.say(`Thanks for calling ${org.name}. We could not process this demo call. Please try again shortly.`);
          response.hangup();
          return res.type("text/xml").send(response.toString());
        }

        const beforeReserve = await getDemoState({
          prisma,
          orgId: orgPhone.orgId,
          subscriptionStatus: org.subscriptionStatus,
          allowStart: false
        });

        const reserve = await reserveDemoAttemptOrReject({
          prisma,
          orgId: orgPhone.orgId,
          providerCallId: callSid,
          callerPhone: fromNumber
        });
        if (!reserve.allowed) {
          const lead = await upsertDemoOverCapLead({
            prismaClient: prisma,
            orgId: orgPhone.orgId,
            callerPhone: fromNumber,
            businessName: org.name
          });
          if (lead && callLogId) {
            await prisma.callLog.update({
              where: { id: callLogId },
              data: { leadId: lead.id }
            });
          }

          await writeDemoAudit(orgPhone.orgId, "DEMO_CALL_CAP_REACHED", {
            reason: reserve.reason,
            fromNumber,
            toNumber,
            demoState: reserve.demo.state,
            callsUsed: reserve.demo.callsUsed,
            callCap: reserve.demo.callCap
          });

          await sendThrottledUpgradeSms({
            prismaClient: prisma,
            orgId: orgPhone.orgId,
            callerPhone: fromNumber,
            businessName: org.name
          });

          const summary =
            reserve.reason === "EXPIRED"
              ? `Your guided demo has ended for ${org.name}. Upgrade in Billing to continue AI call handling.`
              : `You've reached the guided demo call limit for ${org.name}. Upgrade in Billing to continue AI call handling.`;
          response.say(summary);
          response.hangup();
          return res.type("text/xml").send(response.toString());
        }

        if (beforeReserve.state === "ACTIVE" && beforeReserve.windowEndsAt === null) {
          await writeDemoAudit(orgPhone.orgId, "DEMO_WINDOW_STARTED", {
            providerCallId: callSid,
            fromNumber,
            toNumber,
            windowEndsAt: reserve.demo.windowEndsAt
          });
        }
      }

      if (ai.vapiPhoneNumberId) {
        if (routingEnabled && callLogId) {
          await transitionCallState({
            prisma,
            callLogId,
            toState: "CONNECTED",
            metadata: { source: "twilio-bridge-vapi" }
          });
          await transitionCallState({
            prisma,
            callLogId,
            toState: "AI_ACTIVE",
            metadata: { source: "twilio-bridge-vapi" }
          });
        }
        const dial = response.dial({ answerOnBridge: true });
        dial.number(ai.vapiPhoneNumberId);
        return res.type("text/xml").send(response.toString());
      }

      response.say("AI assistant is configured but no Vapi phone bridge is set. Taking a message instead.");
    }

    const mode = org.businessSettings?.afterHoursMode || "TAKE_MESSAGE";
    const encodedOrgId = encodeURIComponent(orgPhone.orgId);
    const recordingCallbackUrl = `${env.API_BASE_URL}/api/twilio/voice/recording?orgId=${encodedOrgId}`;
    const completionUrl = `${env.API_BASE_URL}/api/twilio/voice/complete?orgId=${encodedOrgId}`;

    const shouldVoicemail = routingEnabled
      ? forcedRoute === "ROUTE_TO_VOICEMAIL" ||
        forcedRoute === "ROUTE_TO_SANDBOX" ||
        forcedRoute === "ROUTE_TO_FALLBACK_SMS"
      : mode === "VOICEMAIL" || mode === "TAKE_MESSAGE";

    if (shouldVoicemail) {
      response.say(`Thanks for calling ${org.name}. Please leave a brief message after the beep.`);
      response.record({
        maxLength: 120,
        playBeep: true,
        trim: "trim-silence",
        transcribe: true,
        action: completionUrl,
        method: "POST",
        recordingStatusCallback: recordingCallbackUrl,
        recordingStatusCallbackMethod: "POST",
        transcribeCallback: recordingCallbackUrl
      });
      response.say("No recording received. Goodbye.");
      response.hangup();
      return res.type("text/xml").send(response.toString());
    }

    response.say("Please hold while we transfer your call.");
    const transferList = safeParseStringArray(org.businessSettings?.transferNumbersJson);
    const first = transferList[0] || null;
    if (first) {
      if (routingEnabled && callLogId) {
        await transitionCallState({
          prisma,
          callLogId,
          toState: "TRANSFERRED",
          metadata: { source: "twilio-transfer" }
        });
      }
      response.dial(first.trim());
      return res.type("text/xml").send(response.toString());
    }

    // Legacy fallback only when no transfer destination exists and routing is disabled.
    response.say("No transfer destination configured. Goodbye.");
    response.hangup();
    return res.type("text/xml").send(response.toString());
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[twilio-voice] inbound handler failed", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    response.say("Sorry, we are having technical difficulties. Please try again shortly.");
    response.hangup();
    return res.type("text/xml").send(response.toString());
  }
});

voiceRouter.post("/recording", verifyTwilioRequest, async (req, res) => {
  const callSid = String((req.body as Record<string, unknown>).CallSid || "").trim();
  if (callSid) {
    const replay = await registerWebhookReplay(prisma, {
      provider: "TWILIO",
      eventKey: `voice:${callSid}:recording`,
      outcome: "RECORDING"
    });
    if (replay.duplicate) {
      await prisma.auditLog.create({
        data: {
          actorUserId: "twilio-voice",
          actorRole: "SYSTEM",
          action: "WEBHOOK_REPLAY_BLOCKED",
          metadataJson: JSON.stringify({ provider: "TWILIO", eventKey: `voice:${callSid}:recording` })
        }
      });
      return res.json({ ok: true, ignored: true });
    }
  }
  const orgId = typeof req.query.orgId === "string" ? req.query.orgId : undefined;
  await updateCallLogFromVoicePayload(req.body as Record<string, unknown>, orgId);
  return res.json({ ok: true });
});

voiceRouter.post("/complete", verifyTwilioRequest, async (req, res) => {
  const callSid = String((req.body as Record<string, unknown>).CallSid || "").trim();
  if (callSid) {
    const replay = await registerWebhookReplay(prisma, {
      provider: "TWILIO",
      eventKey: `voice:${callSid}:complete`,
      outcome: "COMPLETE"
    });
    if (replay.duplicate) {
      await prisma.auditLog.create({
        data: {
          actorUserId: "twilio-voice",
          actorRole: "SYSTEM",
          action: "WEBHOOK_REPLAY_BLOCKED",
          metadataJson: JSON.stringify({ provider: "TWILIO", eventKey: `voice:${callSid}:complete` })
        }
      });
      const duplicateResponse = new Twiml.VoiceResponse();
      return res.type("text/xml").send(duplicateResponse.toString());
    }
  }
  const orgId = typeof req.query.orgId === "string" ? req.query.orgId : undefined;
  await updateCallLogFromVoicePayload(req.body as Record<string, unknown>, orgId);
  if (env.ROUTING_ENGINE_ENABLED === "true") {
    if (callSid) {
      const row = await prisma.callLog.findFirst({
        where: { providerCallId: callSid },
        orderBy: { createdAt: "desc" },
        select: { id: true }
      });
      if (row) {
        await transitionCallState({
          prisma,
          callLogId: row.id,
          toState: "COMPLETED",
          metadata: { source: "twilio-voice-complete" }
        });
      }
    }
  }
  const response = new Twiml.VoiceResponse();
  response.say("Thank you. Your message has been saved and our team will follow up shortly.");
  response.hangup();
  return res.type("text/xml").send(response.toString());
});
