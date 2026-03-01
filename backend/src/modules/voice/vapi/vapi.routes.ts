import { AiProvider } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { verifyVapiToolSecret } from "../../../middleware/webhook-security";

export const vapiRouter = Router();

vapiRouter.post("/webhook", verifyVapiToolSecret, async (req, res) => {
  const callSid = String(req.body?.callSid || req.body?.providerCallId || "").trim();
  const summary = String(req.body?.summary || "").trim() || null;
  const transcript = String(req.body?.transcript || "").trim() || null;
  const recordingUrl = String(req.body?.recordingUrl || "").trim() || null;
  const outcomeRaw = String(req.body?.outcome || "").trim().toUpperCase();
  const outcome = ["APPOINTMENT_REQUEST", "MESSAGE_TAKEN", "TRANSFERRED", "MISSED", "SPAM"].includes(outcomeRaw)
    ? outcomeRaw
    : undefined;
  const appointmentRequested = Boolean(req.body?.appointmentRequested);
  const leadId = String(req.body?.leadId || "").trim() || null;

  if (!callSid) return res.status(400).json({ ok: false, message: "callSid is required." });

  const log = await prisma.callLog.findFirst({
    where: { providerCallId: callSid },
    orderBy: { createdAt: "desc" }
  });
  if (!log) return res.status(404).json({ ok: false, message: "Call log not found." });

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
