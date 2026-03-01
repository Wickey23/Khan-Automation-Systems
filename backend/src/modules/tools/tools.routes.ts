import { LeadSource } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { verifyVapiToolSecret } from "../../middleware/webhook-security";

export const toolsRouter = Router();

toolsRouter.use(verifyVapiToolSecret);

toolsRouter.post("/create-lead-from-call", async (req, res) => {
  const orgId = String(req.body?.orgId || "").trim();
  const name = String(req.body?.name || "Unknown Caller").trim();
  const phone = String(req.body?.phone || "unknown").trim();
  const message = String(req.body?.message || "").trim();
  const callId = String(req.body?.callId || "").trim() || null;

  if (!orgId) return res.status(400).json({ ok: false, message: "orgId is required." });

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return res.status(404).json({ ok: false, message: "Organization not found." });

  const lead = await prisma.lead.create({
    data: {
      orgId,
      name,
      business: org.name,
      email: `${phone.replace(/\D/g, "") || "unknown"}@no-email.local`,
      phone,
      message,
      source: LeadSource.PHONE_CALL
    }
  });

  if (callId) {
    await prisma.callLog.updateMany({
      where: {
        orgId,
        OR: [{ id: callId }, { providerCallId: callId }]
      },
      data: { leadId: lead.id }
    });
  }

  return res.json({ ok: true, data: { leadId: lead.id } });
});

toolsRouter.post("/send-sms", async (req, res) => {
  // MVP stub: persist audit event only.
  const orgId = String(req.body?.orgId || "").trim() || null;
  await prisma.auditLog.create({
    data: {
      orgId,
      actorUserId: "vapi-tool",
      actorRole: "SYSTEM",
      action: "TOOL_SEND_SMS",
      metadataJson: JSON.stringify(req.body || {})
    }
  });
  return res.json({ ok: true, data: { queued: true } });
});

toolsRouter.post("/notify-manager", async (req, res) => {
  const orgId = String(req.body?.orgId || "").trim() || null;
  await prisma.auditLog.create({
    data: {
      orgId,
      actorUserId: "vapi-tool",
      actorRole: "SYSTEM",
      action: "TOOL_NOTIFY_MANAGER",
      metadataJson: JSON.stringify(req.body || {})
    }
  });
  return res.json({ ok: true });
});

toolsRouter.post("/request-appointment", async (req, res) => {
  const orgId = String(req.body?.orgId || "").trim();
  const callId = String(req.body?.callId || "").trim() || null;
  if (!orgId) return res.status(400).json({ ok: false, message: "orgId is required." });
  if (callId) {
    await prisma.callLog.updateMany({
      where: {
        orgId,
        OR: [{ id: callId }, { providerCallId: callId }]
      },
      data: { appointmentRequested: true, outcome: "APPOINTMENT_REQUEST" }
    });
  }
  return res.json({ ok: true, data: { appointmentRequested: true } });
});

toolsRouter.post("/transfer-call", async (req, res) => {
  const transferTo = String(req.body?.transferTo || "").trim();
  if (!transferTo) return res.status(400).json({ ok: false, message: "transferTo is required." });
  return res.json({
    ok: true,
    data: {
      transferTo,
      instructions: "Return TwiML <Dial> with transferTo in Twilio action flow."
    }
  });
});
