import { AiProvider } from "@prisma/client";
import { Router } from "express";
import { twiml as Twiml } from "twilio";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { verifyTwilioRequest } from "../../middleware/webhook-security";

export const voiceRouter = Router();

function parseDuration(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
    const fromNumber = (req.body.From as string | undefined) || "unknown";
    const toNumber = (req.body.To as string | undefined) || "unknown";
    const callSid = String(req.body.CallSid || "").trim();
    const orgPhone = await prisma.phoneNumber.findFirst({
      where: { e164Number: toNumber, status: { not: "RELEASED" } },
      include: {
        organization: {
          include: {
            aiAgentConfigs: { orderBy: { updatedAt: "desc" }, take: 1 },
            businessSettings: true
          }
        }
      }
    });

    if (!orgPhone?.organization) {
      response.say("This line is not configured yet.");
      response.hangup();
      return res.type("text/xml").send(response.toString());
    }

    // Idempotent for Twilio retries.
    if (callSid) {
      await prisma.callLog.upsert({
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
    } else {
      await prisma.callLog.create({
        data: {
          orgId: orgPhone.orgId,
          providerCallId: null,
          fromNumber,
          toNumber,
          aiProvider: orgPhone.organization.live ? AiProvider.VAPI : undefined,
          outcome: "MESSAGE_TAKEN"
        }
      });
    }

    const org = orgPhone.organization;
    const ai = org.aiAgentConfigs[0];
    if (org.status === "LIVE" && org.live && ai?.provider === "VAPI") {
      if (ai.vapiPhoneNumberId) {
        response.say(`Connecting you to ${org.name}'s AI receptionist.`);
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

    if (mode === "VOICEMAIL" || mode === "TAKE_MESSAGE") {
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
      response.dial(first.trim());
    } else {
      response.say("No transfer destination configured. Goodbye.");
      response.hangup();
    }

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
  const orgId = typeof req.query.orgId === "string" ? req.query.orgId : undefined;
  await updateCallLogFromVoicePayload(req.body as Record<string, unknown>, orgId);
  return res.json({ ok: true });
});

voiceRouter.post("/complete", verifyTwilioRequest, async (req, res) => {
  const orgId = typeof req.query.orgId === "string" ? req.query.orgId : undefined;
  await updateCallLogFromVoicePayload(req.body as Record<string, unknown>, orgId);
  const response = new Twiml.VoiceResponse();
  response.say("Thank you. Your message has been saved and our team will follow up shortly.");
  response.hangup();
  return res.type("text/xml").send(response.toString());
});
