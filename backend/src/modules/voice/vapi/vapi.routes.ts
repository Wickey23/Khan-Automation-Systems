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

vapiRouter.post("/webhook", verifyVapiToolSecret, async (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const call = (body.call || {}) as Record<string, unknown>;
  const customer = (body.customer || {}) as Record<string, unknown>;
  const phoneNumber = (body.phoneNumber || {}) as Record<string, unknown>;

  const callSid = pickString(
    body.callSid,
    body.providerCallId,
    body.callId,
    call.id,
    call.sid,
    call.callSid
  );
  const summary = String(req.body?.summary || "").trim() || null;
  const transcript = String(req.body?.transcript || "").trim() || null;
  const recordingUrl = String(req.body?.recordingUrl || "").trim() || null;
  const outcomeRaw = String(req.body?.outcome || "").trim().toUpperCase();
  const outcome = ["APPOINTMENT_REQUEST", "MESSAGE_TAKEN", "TRANSFERRED", "MISSED", "SPAM"].includes(outcomeRaw)
    ? outcomeRaw
    : undefined;
  const appointmentRequested = Boolean(req.body?.appointmentRequested);
  const leadId = String(req.body?.leadId || "").trim() || null;

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

  await prisma.callLog.update({
    where: { id: log.id },
    data: {
      aiProvider: AiProvider.VAPI,
      aiSummary: summary,
      transcript,
      recordingUrl,
      appointmentRequested,
      leadId,
      endedAt: new Date(),
      outcome: outcome as any
    }
  });

  return res.json({ ok: true });
});
