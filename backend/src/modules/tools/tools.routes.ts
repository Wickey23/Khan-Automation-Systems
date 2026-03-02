import { LeadSource } from "@prisma/client";
import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { verifyVapiToolSecret } from "../../middleware/webhook-security";

export const toolsRouter = Router();
toolsRouter.use(verifyVapiToolSecret);

const createLeadSchema = z.object({
  orgId: z.string().min(1),
  callId: z.string().optional(),
  name: z.string().min(1).default("Unknown Caller"),
  phone: z.string().min(1).default("unknown"),
  message: z.string().optional().default("")
});

const sendSmsSchema = z.object({
  orgId: z.string().min(1),
  callId: z.string().optional(),
  to: z.string().min(1),
  message: z.string().min(1)
});

const notifySchema = z.object({
  orgId: z.string().min(1),
  callId: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  summary: z.string().optional()
});

const appointmentSchema = z.object({
  orgId: z.string().min(1),
  callId: z.string().optional()
});

const transferSchema = z.object({
  orgId: z.string().min(1),
  callId: z.string().optional(),
  transferTo: z.string().min(1),
  reason: z.string().optional()
});

function toolError(res: Response, code: string, message: string, status = 400) {
  return res.status(status).json({ ok: false, error: { code, message } });
}

toolsRouter.post("/create-lead-from-call", async (req, res) => {
  try {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) return toolError(res, "VALIDATION_ERROR", "Invalid create-lead payload.");

    const { orgId, name, phone, message, callId } = parsed.data;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return toolError(res, "ORG_NOT_FOUND", "Organization not found.", 404);

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
        where: { orgId, OR: [{ id: callId }, { providerCallId: callId }] },
        data: { leadId: lead.id }
      });
    }

    return res.json({ ok: true, data: { leadId: lead.id } });
  } catch (error) {
    return toolError(res, "SERVER_ERROR", error instanceof Error ? error.message : "Unknown tool error", 500);
  }
});

toolsRouter.post("/send-sms", async (req, res) => {
  try {
    const parsed = sendSmsSchema.safeParse(req.body);
    if (!parsed.success) return toolError(res, "VALIDATION_ERROR", "Invalid send-sms payload.");

    await prisma.auditLog.create({
      data: {
        orgId: parsed.data.orgId,
        actorUserId: "vapi-tool",
        actorRole: "SYSTEM",
        action: "TOOL_SEND_SMS",
        metadataJson: JSON.stringify(req.body || {})
      }
    });
    return res.json({ ok: true, data: { queued: true } });
  } catch (error) {
    return toolError(res, "SERVER_ERROR", error instanceof Error ? error.message : "Unknown tool error", 500);
  }
});

toolsRouter.post("/notify-manager", async (req, res) => {
  try {
    const parsed = notifySchema.safeParse(req.body);
    if (!parsed.success) return toolError(res, "VALIDATION_ERROR", "Invalid notify-manager payload.");

    await prisma.auditLog.create({
      data: {
        orgId: parsed.data.orgId,
        actorUserId: "vapi-tool",
        actorRole: "SYSTEM",
        action: "TOOL_NOTIFY_MANAGER",
        metadataJson: JSON.stringify(req.body || {})
      }
    });
    return res.json({ ok: true, data: { notified: true } });
  } catch (error) {
    return toolError(res, "SERVER_ERROR", error instanceof Error ? error.message : "Unknown tool error", 500);
  }
});

toolsRouter.post("/request-appointment", async (req, res) => {
  try {
    const parsed = appointmentSchema.safeParse(req.body);
    if (!parsed.success) return toolError(res, "VALIDATION_ERROR", "Invalid request-appointment payload.");

    if (parsed.data.callId) {
      await prisma.callLog.updateMany({
        where: { orgId: parsed.data.orgId, OR: [{ id: parsed.data.callId }, { providerCallId: parsed.data.callId }] },
        data: { appointmentRequested: true, outcome: "APPOINTMENT_REQUEST" }
      });
    }
    return res.json({ ok: true, data: { appointmentRequested: true } });
  } catch (error) {
    return toolError(res, "SERVER_ERROR", error instanceof Error ? error.message : "Unknown tool error", 500);
  }
});

toolsRouter.post("/transfer-call", async (req, res) => {
  try {
    const parsed = transferSchema.safeParse(req.body);
    if (!parsed.success) return toolError(res, "VALIDATION_ERROR", "Invalid transfer-call payload.");
    return res.json({
      ok: true,
      data: {
        transferTo: parsed.data.transferTo,
        instructions: "Return TwiML <Dial> with transferTo in Twilio action flow."
      }
    });
  } catch (error) {
    return toolError(res, "SERVER_ERROR", error instanceof Error ? error.message : "Unknown tool error", 500);
  }
});
