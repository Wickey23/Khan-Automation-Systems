import { LeadSource } from "@prisma/client";
import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { verifyVapiToolSecret } from "../../middleware/webhook-security";
import { hasProMessaging } from "../billing/plan-features";
import { sendSmsMessage } from "../twilio/twilio.service";

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

function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (!digits) return input.trim();
  if (digits.length === 10) return `+1${digits}`;
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  if (input.trim().startsWith("+")) return input.trim();
  return `+${digits}`;
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

    const { orgId, to, message } = parsed.data;
    const isPro = await hasProMessaging(prisma, orgId);
    if (!isPro) {
      return toolError(res, "FEATURE_NOT_IN_PLAN", "SMS automation is available on Pro plan only.", 403);
    }

    const toNumber = normalizePhone(to);
    const fromPhone = await prisma.phoneNumber.findFirst({
      where: { orgId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" }
    });
    if (!fromPhone?.e164Number) {
      return toolError(res, "NO_ACTIVE_NUMBER", "No active org phone number configured for SMS.", 400);
    }

    const matchedLead = await prisma.lead.findFirst({
      where: { orgId, phone: toNumber },
      select: { id: true, name: true, dnc: true }
    });
    if (matchedLead?.dnc) {
      return toolError(res, "DNC_BLOCKED", "Recipient has opted out of SMS (STOP).", 403);
    }

    const thread = await prisma.messageThread.upsert({
      where: {
        orgId_channel_contactPhone: {
          orgId,
          channel: "SMS",
          contactPhone: toNumber
        }
      },
      update: {
        leadId: matchedLead?.id || undefined,
        contactName: matchedLead?.name || undefined,
        lastMessageAt: new Date()
      },
      create: {
        orgId,
        channel: "SMS",
        contactPhone: toNumber,
        contactName: matchedLead?.name || null,
        leadId: matchedLead?.id || null,
        lastMessageAt: new Date()
      }
    });

    let providerMessageId: string | null = null;
    let status: "SENT" | "FAILED" = "SENT";
    let errorText: string | null = null;
    try {
      const sent = await sendSmsMessage({
        from: fromPhone.e164Number,
        to: toNumber,
        body: message
      });
      providerMessageId = sent.sid;
    } catch (error) {
      status = "FAILED";
      errorText = error instanceof Error ? error.message : "sms_send_failed";
    }

    const smsMessage = await prisma.message.create({
      data: {
        threadId: thread.id,
        orgId,
        leadId: matchedLead?.id || null,
        direction: "OUTBOUND",
        status,
        body: message,
        provider: "TWILIO",
        providerMessageId,
        fromNumber: fromPhone.e164Number,
        toNumber,
        sentAt: new Date(),
        errorText,
        metadataJson: JSON.stringify({ source: "vapi_tool" })
      }
    });

    await prisma.auditLog.create({
      data: {
        orgId,
        actorUserId: "vapi-tool",
        actorRole: "SYSTEM",
        action: "TOOL_SEND_SMS",
        metadataJson: JSON.stringify({ ...(req.body || {}), messageId: smsMessage.id, status })
      }
    });
    return res.json({ ok: true, data: { queued: status !== "FAILED", messageId: smsMessage.id, status } });
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
