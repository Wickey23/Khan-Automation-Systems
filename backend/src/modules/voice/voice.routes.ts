import { AiProvider, type Prisma } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { twiml as Twiml } from "twilio";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { verifyTwilioRequest } from "../../middleware/webhook-security";
import { reserveDemoAttemptOrReject, getDemoState, isGuidedDemoEnabled, isPaidSubscriptionActive } from "../billing/demo-access.service";
import { upsertDemoOverCapLead } from "../billing/demo-lead-fallback.service";
import { sendThrottledUpgradeSms } from "../billing/demo-upgrade-sms.service";
import { registerWebhookReplay } from "../ops/webhook-replay.service";
import { transitionCallState } from "./call-state.service";
import { normalizePhoneE164, upsertCallerProfileOnInbound } from "./caller-profile.service";
import { buildRoutingDecisionJson, computeRoutingDecision, type RoutingResultType } from "./routing.service";
import { resolveBusinessVoiceRouting } from "./business-voice-routing.service";
import { createInboundTwilioCall, markCallMissedReason, updateTwilioCallStatus } from "./call-log.service";
import { normalizePhoneForLookup } from "./phone-number-normalizer";
import { parseTwilioDuration, twilioInboundVoiceSchema, twilioVoiceStatusSchema } from "./twilio-voice-parser";
import { twilioMediaStatusCallbackSchema } from "./media-stream/voice-media-stream-parser";
import { mapTrackStrategyToTwilioTrack } from "./media-stream/voice-media-stream-constants";
import { logVoiceMediaStreamEvent } from "./media-stream/voice-media-stream-logger";
import {
  createVoiceMediaStreamToken
} from "./media-stream/voice-media-stream-security";
import {
  reconcileOpenVoiceMediaStreamsForCall,
  updateVoiceMediaStreamStatusFromCallback
} from "./media-stream/voice-media-stream-session.service";
import { scheduleTranscriptFinalizeForCall } from "./transcription/transcription-session.service";
import {
  buildMissingForwardingFallbackTwiml,
  buildPassiveForwardDialTwiml,
  buildSystemErrorFallbackTwiml,
  buildUnresolvedNumberFallbackTwiml
} from "./twilio-voice-twiml-builder";
import { isVoiceRoutingMode } from "./voice-routing-mode";

export const voiceRouter = Router();

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

function getVoiceBaseUrl() {
  return String(env.TWILIO_WEBHOOK_BASE_URL || env.API_BASE_URL).replace(/\/$/, "");
}

function getVoiceStatusCallbackUrl() {
  return String(env.TWILIO_STATUS_CALLBACK_URL || `${getVoiceBaseUrl()}/api/twilio/voice/status`).trim();
}

function getVoiceStreamStatusCallbackUrl() {
  return String(
    env.TWILIO_MEDIA_STREAM_STATUS_CALLBACK_URL || `${getVoiceBaseUrl()}/api/twilio/voice/stream-status`
  ).trim();
}

function getVoiceMediaStreamUrl() {
  const base = String(env.TWILIO_MEDIA_STREAM_BASE_URL || "").trim().replace(/\/$/, "");
  const path = String(env.TWILIO_MEDIA_STREAM_PATH || "/ws/twilio/voice-media").trim();
  if (!base) return null;
  if (!base.startsWith("wss://")) return null;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function logUnresolvedInboundVoiceEvent(payload: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: {
      actorUserId: "twilio-voice",
      actorRole: "SYSTEM",
      action: "PASSIVE_VOICE_UNRESOLVED_NUMBER",
      metadataJson: JSON.stringify({
        callSid: String(payload.CallSid || "").trim() || null,
        accountSid: String(payload.AccountSid || "").trim() || null,
        fromNumber: String(payload.From || "").trim() || null,
        toNumber: String(payload.To || "").trim() || null,
        payload
      })
    }
  });
}

function maybeBuildPassiveMediaStreamConfig(input: {
  orgId: string;
  callLogId: string;
  providerCallId: string;
  voiceMediaStreamingEnabled: boolean;
  voiceMediaTrackStrategy?: string | null;
}): {
  url: string;
  name: string;
  track: "both_tracks";
  statusCallbackUrl: string;
  customParameters: Array<{ name: string; value: string }>;
} | null {
  if (!input.voiceMediaStreamingEnabled) return null;
  const streamUrl = getVoiceMediaStreamUrl();
  if (!streamUrl || !env.TWILIO_MEDIA_STREAM_TOKEN_SECRET) {
    logVoiceMediaStreamEvent({
      endpoint: "/api/twilio/voice/incoming",
      eventType: "MEDIA_STREAM_TWIML_OMITTED",
      status: "WARN",
      orgId: input.orgId,
      callLogId: input.callLogId,
      providerCallId: input.providerCallId,
      reason: !streamUrl ? "missing_stream_url" : "missing_stream_token_secret"
    });
    return null;
  }

  const trackStrategy = input.voiceMediaTrackStrategy === "BOTH_TRACKS" ? "BOTH_TRACKS" : "BOTH_TRACKS";
  return {
    url: streamUrl,
    name: `call-${input.providerCallId}`,
    track: mapTrackStrategyToTwilioTrack(trackStrategy) as "both_tracks",
    statusCallbackUrl: getVoiceStreamStatusCallbackUrl(),
    customParameters: [
      { name: "callSid", value: input.providerCallId },
      { name: "orgId", value: input.orgId },
      { name: "callLogId", value: input.callLogId },
      {
        name: "token",
        value: createVoiceMediaStreamToken({
          orgId: input.orgId,
          callLogId: input.callLogId,
          providerCallId: input.providerCallId
        })
      },
      { name: "routingMode", value: "PASSIVE_FORWARDING" },
      { name: "version", value: "1" },
      { name: "streamName", value: `call-${input.providerCallId}` }
    ]
  };
}

async function updateCallLogFromVoicePayload(payload: Record<string, unknown>, orgId?: string) {
  const callSid = String(payload.CallSid || "").trim();
  if (!callSid) return;

  const recordingUrl = String(payload.RecordingUrl || "").trim() || null;
  const transcript = String(payload.TranscriptionText || "").trim() || null;
  const durationSec = parseTwilioDuration(payload.CallDuration ?? payload.RecordingDuration);
  const callStatus = String(payload.CallStatus || "").toLowerCase();
  const endedAt = callStatus === "completed" || durationSec !== null ? new Date() : undefined;

  const data: {
    recordingUrl?: string | null;
    transcript?: string | null;
    durationSec?: number | null;
    endedAt?: Date;
    outcome?: "ABANDONED";
    unansweredTransfer?: boolean;
  } = {};

  if (recordingUrl !== null) data.recordingUrl = recordingUrl;
  if (transcript !== null) data.transcript = transcript;
  if (durationSec !== null) data.durationSec = durationSec;
  if (endedAt) data.endedAt = endedAt;

  const existing = await prisma.callLog.findFirst({
    where: { providerCallId: callSid },
    orderBy: { createdAt: "desc" }
  });

  if (existing && ["busy", "no-answer", "failed", "timeout"].includes(callStatus)) {
    data.outcome = "ABANDONED";
    data.unansweredTransfer = Boolean(existing.transferredAt);
  }

  if (!Object.keys(data).length) return;

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

async function handleAiFirstInboundVoice(req: Request, res: Response) {
  const response = new Twiml.VoiceResponse();
  try {
    const parsedPayload = twilioInboundVoiceSchema.safeParse(req.body || {});
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
}

voiceRouter.post("/", verifyTwilioRequest, async (req, res) => handleAiFirstInboundVoice(req, res));

voiceRouter.post("/incoming", verifyTwilioRequest, async (req, res) => {
  const parsedPayload = twilioInboundVoiceSchema.safeParse(req.body || {});
  if (!parsedPayload.success) {
    const fallback = buildSystemErrorFallbackTwiml();
    return res.type("text/xml").send(fallback.toString());
  }

  const callSid = String(parsedPayload.data.CallSid || "").trim();
  if (callSid) {
    const replay = await registerWebhookReplay(prisma, {
      provider: "TWILIO",
      eventKey: `voice:${callSid}:incoming`,
      outcome: "INCOMING"
    });
    if (replay.duplicate) {
      const duplicateResponse = new Twiml.VoiceResponse();
      return res.type("text/xml").send(duplicateResponse.toString());
    }
  }

  try {
    const fromNumber = String(parsedPayload.data.From || "unknown");
    const toNumber = String(parsedPayload.data.To || "unknown");
    const resolved = await resolveBusinessVoiceRouting({
      prisma,
      calledNumber: toNumber,
      defaultRingTimeoutSeconds: Number(env.DEFAULT_VOICE_RING_TIMEOUT_SECONDS || "20")
    });

    if (!resolved) {
      await logUnresolvedInboundVoiceEvent(req.body as Record<string, unknown>);
      const fallback = buildUnresolvedNumberFallbackTwiml();
      return res.type("text/xml").send(fallback.toString());
    }

    const mode = isVoiceRoutingMode(resolved.voiceRoutingMode) ? resolved.voiceRoutingMode : "AI_FIRST";
    if (mode === "AI_FIRST") {
      return handleAiFirstInboundVoice(req, res);
    }

    const callLog = await createInboundTwilioCall({
      prisma,
      orgId: resolved.orgId,
      callSid,
      parentCallSid: parsedPayload.data.ParentCallSid || null,
      accountSid: parsedPayload.data.AccountSid || null,
      fromNumber,
      toNumber,
      callStatus: parsedPayload.data.CallStatus || "initiated",
      direction: parsedPayload.data.Direction || "inbound",
      forwardedToNumber: resolved.forwardingNumber || null,
      source: "twilio",
      rawPayload: req.body as Record<string, unknown>
    });

    if (!resolved.passiveForwardingValid) {
      await markCallMissedReason({
        prisma,
        callLogId: callLog.id,
        missedReason: "NO_FORWARDING_NUMBER"
      });
      const fallback = buildMissingForwardingFallbackTwiml();
      return res.type("text/xml").send(fallback.toString());
    }

    await prisma.callLog.update({
      where: { id: callLog.id },
      data: {
        transferredAt: new Date(),
        transferTarget: resolved.forwardingNumber
      }
    });

    const twiml = buildPassiveForwardDialTwiml({
      forwardingNumber: normalizePhoneForLookup(resolved.forwardingNumber).normalized || resolved.forwardingNumber,
      statusCallbackUrl: getVoiceStatusCallbackUrl(),
      timeoutSeconds: resolved.ringTimeoutSeconds,
      stream: maybeBuildPassiveMediaStreamConfig({
        orgId: resolved.orgId,
        callLogId: callLog.id,
        providerCallId: callSid,
        voiceMediaStreamingEnabled: Boolean(resolved.businessSettings?.voiceMediaStreamingEnabled),
        voiceMediaTrackStrategy: resolved.businessSettings?.voiceMediaTrackStrategy || "BOTH_TRACKS"
      })
    });
    return res.type("text/xml").send(twiml.toString());
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[twilio-voice] passive incoming handler failed", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    const fallback = buildSystemErrorFallbackTwiml();
    return res.type("text/xml").send(fallback.toString());
  }
});

voiceRouter.post("/status", verifyTwilioRequest, async (req, res) => {
  const parsed = twilioVoiceStatusSchema.safeParse(req.body || {});
  if (!parsed.success) return res.json({ ok: true, ignored: true });
  try {
    const updated = await updateTwilioCallStatus({
      prisma,
      callSid: String(parsed.data.CallSid || "").trim(),
      parentCallSid: String(parsed.data.ParentCallSid || "").trim() || null,
      payload: req.body as Record<string, unknown>
    });
    const finalStatus = String(parsed.data.DialCallStatus || parsed.data.CallStatus || "").toLowerCase();
    if (updated && ["completed", "busy", "no-answer", "failed", "canceled"].includes(finalStatus)) {
      await reconcileOpenVoiceMediaStreamsForCall({
        prisma,
        callLogId: updated.id,
        stopReason: `call_${finalStatus}`
      });
      scheduleTranscriptFinalizeForCall(updated.id, `call_${finalStatus}`);
    }
    return res.json({ ok: true, updated: Boolean(updated) });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[twilio-voice] status handler failed", {
      message: error instanceof Error ? error.message : "Unknown error",
      callSid: String((req.body as Record<string, unknown>).CallSid || "")
    });
    return res.status(500).json({ ok: false, message: "Failed to process voice status callback." });
  }
});

voiceRouter.post("/stream-status", verifyTwilioRequest, async (req, res) => {
  const parsed = twilioMediaStatusCallbackSchema.safeParse(req.body || {});
  if (!parsed.success) return res.json({ ok: true, ignored: true });

  try {
    let updated = await updateVoiceMediaStreamStatusFromCallback({
      prisma,
      streamSid: parsed.data.StreamSid,
      callbackPayload: req.body as Prisma.JsonObject,
      streamEvent: parsed.data.StreamEvent,
      stopReason: parsed.data.StreamError || null
    });

    if (!updated) {
      const call = await prisma.callLog.findFirst({
        where: { providerCallId: String(parsed.data.CallSid || "").trim() },
        orderBy: { createdAt: "desc" },
        select: { id: true, orgId: true, providerCallId: true }
      });

      if (call) {
        updated = await prisma.callMediaStreamSession.create({
          data: {
            callLogId: call.id,
            orgId: call.orgId,
            provider: "twilio",
            streamSid: parsed.data.StreamSid,
            callSid: call.providerCallId || parsed.data.CallSid,
            streamName: parsed.data.StreamName || null,
            trackStrategy: "BOTH_TRACKS",
            streamStatus:
              parsed.data.StreamEvent === "stream-started"
                ? "STARTED"
                : parsed.data.StreamEvent === "stream-stopped"
                  ? "STOPPED"
                  : "ERROR",
            streamMetadata: req.body as Prisma.JsonObject,
            stopReason: parsed.data.StreamError || null,
            mediaEndedAt:
              parsed.data.StreamEvent === "stream-stopped" || parsed.data.StreamEvent === "stream-error"
                ? new Date()
                : null
          }
        });
        await prisma.callLog.update({
          where: { id: call.id },
          data: { hasMediaStream: true, latestStreamStatus: updated.streamStatus }
        });
      }
    }

    logVoiceMediaStreamEvent({
      endpoint: "/api/twilio/voice/stream-status",
      eventType: "MEDIA_STREAM_STATUS_CALLBACK",
      status: "OK",
      orgId: updated?.orgId || null,
      callLogId: updated?.callLogId || null,
      providerCallId: parsed.data.CallSid,
      streamSid: parsed.data.StreamSid,
      streamStatus: updated?.streamStatus || null
    });

    return res.json({ ok: true, updated: Boolean(updated) });
  } catch (error) {
    logVoiceMediaStreamEvent({
      endpoint: "/api/twilio/voice/stream-status",
      eventType: "MEDIA_STREAM_STATUS_CALLBACK",
      status: "ERROR",
      providerCallId: String(req.body?.CallSid || "").trim() || null,
      streamSid: String(req.body?.StreamSid || "").trim() || null,
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return res.status(500).json({ ok: false, message: "Failed to process stream status callback." });
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
