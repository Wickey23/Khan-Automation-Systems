import { AiProvider } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { verifyVapiToolSecret } from "../../../middleware/webhook-security";

export const vapiRouter = Router();

function pickString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeToE164(input: string) {
  if (!input) return "";
  const normalized = input.replace(/[^\d+]/g, "");
  if (!normalized) return "";
  if (normalized.startsWith("+")) return normalized;
  if (normalized.length === 10) return `+1${normalized}`;
  if (normalized.length === 11 && normalized.startsWith("1")) return `+${normalized}`;
  return `+${normalized}`;
}

function asObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function parseNumeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeOutcome(value: string) {
  const upper = value.trim().toUpperCase();
  if (["APPOINTMENT_REQUEST", "MESSAGE_TAKEN", "TRANSFERRED", "MISSED", "SPAM"].includes(upper)) {
    return upper as "APPOINTMENT_REQUEST" | "MESSAGE_TAKEN" | "TRANSFERRED" | "MISSED" | "SPAM";
  }
  return null;
}

vapiRouter.post("/webhook", verifyVapiToolSecret, async (req, res) => {
  const body = asObject(req.body);
  const call = asObject(body.call);
  const callTransport = asObject(call.transport);
  const customer = asObject(body.customer);
  const phoneNumber = asObject(body.phoneNumber);
  const analysis = asObject(body.analysis);
  const artifact = asObject(body.artifact);
  const eventType = pickString(body.type, body.event, body.messageType).toLowerCase() || "unknown";

  const callSid = pickString(
    body.callSid,
    body.providerCallId,
    body.callId,
    call.providerCallId,
    call.phoneCallProviderCallId,
    callTransport.providerCallId,
    call.id,
    call.sid,
    call.callSid
  );
  const summary = pickString(body.summary, analysis.summary) || null;
  const transcript = pickString(body.transcript, artifact.transcript) || null;
  const recordingUrl = pickString(body.recordingUrl, artifact.recordingUrl) || null;
  const outcome = normalizeOutcome(pickString(body.outcome, analysis.outcome, call.outcome));
  const appointmentRequested = toBoolean(body.appointmentRequested ?? analysis.appointmentRequested);
  const leadId = pickString(body.leadId, analysis.leadId) || null;
  const callStatus = pickString(body.status, call.status).toLowerCase();
  const endedByStatus = ["ended", "completed", "failed", "canceled", "cancelled", "busy", "no-answer", "timeout"].includes(callStatus);
  const successEvaluation = parseNumeric(analysis.successEvaluation ?? analysis.score ?? body.successEvaluation);
  const structuredData = asObject(analysis.structuredData);

  if (!callSid) return res.status(400).json({ ok: false, message: "callSid/providerCallId is required." });

  const fromNumber = normalizeToE164(
    pickString(
      body.fromNumber,
      body.from,
      customer.number,
      call.customerNumber
    )
  ) || "unknown";
  const toNumber = normalizeToE164(
    pickString(
      body.toNumber,
      body.to,
      phoneNumber.number,
      call.phoneNumber,
      call.to
    )
  ) || "unknown";

  const orgIdFromPayload = pickString(body.orgId, call.orgId);

  let log = await prisma.callLog.findFirst({
    where: { providerCallId: callSid },
    orderBy: { createdAt: "desc" }
  });

  if (!log) {
    let resolvedOrgId = orgIdFromPayload;
    if (!resolvedOrgId && toNumber !== "unknown") {
      const phone = await prisma.phoneNumber.findFirst({
        where: { e164Number: toNumber, status: { not: "RELEASED" } },
        select: { orgId: true }
      });
      resolvedOrgId = phone?.orgId || "";
    }

    if (!resolvedOrgId) {
      return res.status(404).json({ ok: false, message: "Unable to resolve org for call webhook." });
    }

    log = await prisma.callLog.create({
      data: {
        orgId: resolvedOrgId,
        providerCallId: callSid,
        fromNumber,
        toNumber,
        aiProvider: AiProvider.VAPI,
        outcome: "MESSAGE_TAKEN"
      }
    });
  }

  const updateData: Record<string, unknown> = {
    aiProvider: AiProvider.VAPI
  };

  if (summary !== null) updateData.aiSummary = summary;
  if (transcript !== null) updateData.transcript = transcript;
  if (recordingUrl !== null) updateData.recordingUrl = recordingUrl;
  if (leadId !== null) updateData.leadId = leadId;
  if (appointmentRequested !== null) updateData.appointmentRequested = appointmentRequested;
  if (outcome) updateData.outcome = outcome;
  if (eventType === "end-of-call-report" || endedByStatus) updateData.endedAt = new Date();

  await prisma.callLog.update({
    where: { id: log.id },
    data: updateData
  });

  await prisma.auditLog.create({
    data: {
      orgId: log.orgId,
      actorUserId: "vapi-webhook",
      actorRole: "SYSTEM",
      action: "VAPI_WEBHOOK_EVENT",
      metadataJson: JSON.stringify({
        eventType,
        callSid,
        status: callStatus || null,
        successEvaluation,
        structuredData,
        toolCallList: body.toolCallList || body.toolCalls || null
      })
    }
  });

  return res.json({ ok: true, data: { eventType, callSid } });
});
