import { Router } from "express";
import { twiml as Twiml } from "twilio";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";

export const voiceRouter = Router();

function parseDuration(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function updateCallLogFromVoicePayload(payload: Record<string, unknown>, orgId?: string) {
  const callSid = String(payload.CallSid || "").trim();
  if (!callSid) return;

  const recordingUrl = String(payload.RecordingUrl || "").trim() || null;
  const transcript = String(payload.TranscriptionText || "").trim() || null;
  const durationSec = parseDuration(payload.CallDuration ?? payload.RecordingDuration);
  const callStatus = String(payload.CallStatus || "").toLowerCase();
  const endedAt =
    callStatus === "completed" || durationSec !== null ? new Date() : undefined;

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
    await prisma.callLog.update({
      where: { id: existing.id },
      data
    });
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

voiceRouter.post("/", async (req, res) => {
  const response = new Twiml.VoiceResponse();
  const fromNumber = (req.body.From as string | undefined) || "unknown";
  const toNumber = (req.body.To as string | undefined) || "unknown";
  const orgPhone = await prisma.phoneNumber.findFirst({
    where: { e164Number: toNumber, status: { not: "RELEASED" } },
    include: { organization: true }
  });

  if (!orgPhone?.organization) {
    response.say("This line is not configured yet.");
    response.hangup();
    return res.type("text/xml").send(response.toString());
  }

  await prisma.callLog.create({
    data: {
      orgId: orgPhone.orgId,
      providerCallId: (req.body.CallSid as string | undefined) || null,
      fromNumber,
      toNumber,
      outcome: "MESSAGE_TAKEN"
    }
  });

  const encodedOrgId = encodeURIComponent(orgPhone.orgId);
  const recordingCallbackUrl = `${env.API_BASE_URL}/api/twilio/voice/recording?orgId=${encodedOrgId}`;
  const completionUrl = `${env.API_BASE_URL}/api/twilio/voice/complete?orgId=${encodedOrgId}`;

  response.say(`Thanks for calling ${orgPhone.organization.name}. Please leave a brief message after the beep.`);
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
});

voiceRouter.post("/recording", async (req, res) => {
  const orgId = typeof req.query.orgId === "string" ? req.query.orgId : undefined;
  await updateCallLogFromVoicePayload(req.body as Record<string, unknown>, orgId);
  return res.json({ ok: true });
});

voiceRouter.post("/complete", async (req, res) => {
  const orgId = typeof req.query.orgId === "string" ? req.query.orgId : undefined;
  await updateCallLogFromVoicePayload(req.body as Record<string, unknown>, orgId);
  const response = new Twiml.VoiceResponse();
  response.say("Thank you. Your message has been saved and our team will follow up shortly.");
  response.hangup();
  return res.type("text/xml").send(response.toString());
});
