import { LeadSource } from "@prisma/client";
import { Router, type Response } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { verifyVapiToolSecret } from "../../middleware/webhook-security";
import { hasProMessaging } from "../billing/plan-features";
import { sendSmsMessage } from "../twilio/twilio.service";
import { validateSlotWithinBusinessHours } from "../appointments/slotting.service";

export const toolsRouter = Router();
toolsRouter.use(verifyVapiToolSecret);

const createLeadSchema = z.object({
  orgId: z.string().min(1).optional(),
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
  callId: z.string().optional(),
  requestedStartAt: z.string().datetime().optional(),
  appointmentDurationMinutes: z.number().int().positive().max(480).optional()
});

const transferSchema = z.object({
  orgId: z.string().min(1),
  callId: z.string().optional(),
  transferTo: z.string().min(1),
  reason: z.string().optional()
});

const callerContextSchema = z.object({
  orgId: z.string().min(1).optional(),
  callId: z.string().optional(),
  callerPhone: z.string().optional()
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

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function isPlaceholderName(value: string | null | undefined) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return !normalized || normalized === "unknown caller" || normalized === "unknown contact" || normalized === "unknown";
}

function extractHumanNameFromText(text: string) {
  const source = String(text || "").trim();
  if (!source) return "";

  const stopWords = new Set([
    "sorry",
    "help",
    "issue",
    "problem",
    "phone",
    "number",
    "looking",
    "escalating",
    "customer",
    "caller",
    "unknown",
    "support",
    "service",
    "name",
    "from"
  ]);

  const patterns = [
    /\bmy name is\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,2})\b/i,
    /\bthis is\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,2})\b/i,
    /\bi(?:'m| am)\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,1})\b/i,
    /\b([A-Za-z][A-Za-z'-]+\s+[A-Za-z][A-Za-z'-]+)\s+called\b/i
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    const raw = match?.[1]?.trim() || "";
    if (!raw) continue;
    const cleaned = raw
      .replace(/\b(from|and|but)\b.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) continue;
    const parts = cleaned.split(" ").filter(Boolean);
    if (!parts.length || parts.length > 3) continue;
    if (parts.some((part) => stopWords.has(part.toLowerCase()))) continue;
    if (parts.length === 1 && parts[0].length < 2) continue;
    return toTitleCase(parts.join(" "));
  }

  return "";
}

function pickString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function asObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

toolsRouter.post("/create-lead-from-call", async (req, res) => {
  try {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) return toolError(res, "VALIDATION_ERROR", "Invalid create-lead payload.");

    const root = asObject(req.body);
    const messageRoot = asObject(root.message);
    const call = asObject(messageRoot.call);
    // Tool webhooks commonly put runtime ids at top-level; keep nested fallbacks for compatibility.
    const runtimeOrgId = pickString(root.orgId, root.organizationId, call.orgId, call.organizationId, messageRoot.orgId);
    const runtimeCallId = pickString(root.callId, root.providerCallId, call.id, call.callId, call.providerCallId);

    const { orgId: explicitOrgId, name, phone, message, callId: explicitCallId } = parsed.data;
    const normalizedPhone = normalizePhone(phone);
    const parsedNameFromMessage = extractHumanNameFromText(message || "");
    const normalizedInputName = toTitleCase(String(name || "").trim());
    const finalInputName = !isPlaceholderName(normalizedInputName)
      ? normalizedInputName
      : parsedNameFromMessage || "Unknown Caller";
    let resolvedCallId = pickString(runtimeCallId, explicitCallId);
    let resolvedOrgId = pickString(runtimeOrgId, explicitOrgId);

    // If call id exists, use it to resolve org deterministically.
    if (resolvedCallId) {
      const callRow = await prisma.callLog.findFirst({
        where: { OR: [{ id: resolvedCallId }, { providerCallId: resolvedCallId }] },
        orderBy: { createdAt: "desc" },
        select: { id: true, orgId: true, providerCallId: true }
      });
      if (callRow?.orgId) {
        resolvedOrgId = callRow.orgId;
      }
      if (callRow?.id && !explicitCallId) {
        resolvedCallId = callRow.id;
      }
    }

    // Fallback: resolve org/call from the most recent call from the same phone.
    if (!resolvedOrgId || !resolvedCallId) {
      const recentCall = await prisma.callLog.findFirst({
        where: {
          fromNumber: normalizedPhone,
          createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, orgId: true }
      });
      if (recentCall?.orgId && !resolvedOrgId) {
        resolvedOrgId = recentCall.orgId;
      }
      if (recentCall?.id && !resolvedCallId) {
        resolvedCallId = recentCall.id;
      }
    }

    if (!resolvedOrgId) {
      return toolError(res, "MISSING_ORG_CONTEXT", "Missing orgId and unable to resolve from recent call context.");
    }

    const org = await prisma.organization.findUnique({ where: { id: resolvedOrgId } });
    if (!org) return toolError(res, "ORG_NOT_FOUND", "Organization not found.", 404);

    const existingLead = await prisma.lead.findFirst({
      where: { orgId: resolvedOrgId, phone: normalizedPhone },
      orderBy: { createdAt: "desc" }
    });

    const lead = existingLead
      ? await prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            name:
              !isPlaceholderName(finalInputName) && isPlaceholderName(existingLead.name)
                ? finalInputName
                : existingLead.name,
            business: existingLead.business || org.name,
            email: existingLead.email || `${normalizedPhone.replace(/\D/g, "") || "unknown"}@no-email.local`,
            message: message || existingLead.message
          }
        })
      : await prisma.lead.create({
          data: {
            orgId: resolvedOrgId,
            name: finalInputName,
            business: org.name,
            email: `${normalizedPhone.replace(/\D/g, "") || "unknown"}@no-email.local`,
            phone: normalizedPhone,
            message,
            source: LeadSource.PHONE_CALL
          }
        });

    if (resolvedCallId) {
      await prisma.callLog.updateMany({
        where: { orgId: resolvedOrgId, OR: [{ id: resolvedCallId }, { providerCallId: resolvedCallId }] },
        data: { leadId: lead.id }
      });
    } else {
      // Deterministic fallback when call id is absent in tool payload.
      await prisma.callLog.updateMany({
        where: {
          orgId: resolvedOrgId,
          fromNumber: normalizedPhone,
          createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }
        },
        data: { leadId: lead.id }
      });
    }

    await prisma.auditLog.create({
      data: {
        orgId: resolvedOrgId,
        actorUserId: "vapi-tool",
        actorRole: "SYSTEM",
        action: "TOOL_CREATE_LEAD",
        metadataJson: JSON.stringify({
          resolvedOrgId,
          resolvedCallId: resolvedCallId || null,
          leadId: lead.id,
          phone: normalizedPhone
        })
      }
    });

    return res.json({ ok: true, data: { leadId: lead.id, orgId: resolvedOrgId, callId: resolvedCallId || null } });
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
    let status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED" = "QUEUED";
    let errorText: string | null = null;
    try {
      const statusCallbackUrl = `${env.API_BASE_URL}/api/twilio/sms/status?orgId=${encodeURIComponent(orgId)}`;
      const sent = await sendSmsMessage({
        from: fromPhone.e164Number,
        to: toNumber,
        body: message,
        statusCallbackUrl
      });
      providerMessageId = sent.sid;
      const twStatus = String(sent.status || "").toLowerCase();
      if (twStatus === "delivered") status = "DELIVERED";
      else if (twStatus === "sent") status = "SENT";
      else if (["failed", "undelivered", "canceled"].includes(twStatus)) status = "FAILED";
      else status = "QUEUED";
      if (sent.errorCode || sent.errorMessage) {
        errorText = `Twilio ${sent.errorCode || ""} ${sent.errorMessage || ""}`.trim();
      }
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

    if (parsed.data.requestedStartAt) {
      const settings = await prisma.businessSettings.findUnique({
        where: { orgId: parsed.data.orgId },
        select: { hoursJson: true, timezone: true }
      });
      const slotCheck = validateSlotWithinBusinessHours({
        hoursJson: settings?.hoursJson || null,
        timezone: settings?.timezone || "America/New_York",
        slotStartAt: new Date(parsed.data.requestedStartAt),
        appointmentDurationMinutes: parsed.data.appointmentDurationMinutes ?? 60
      });
      if (!slotCheck.ok) {
        return toolError(
          res,
          "BOOKING_OUTSIDE_BUSINESS_HOURS",
          "Requested slot is outside business hours or extends past closing time.",
          400
        );
      }
    }

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

toolsRouter.post("/get-caller-context", async (req, res) => {
  try {
    const parsed = callerContextSchema.safeParse(req.body);
    if (!parsed.success) return toolError(res, "VALIDATION_ERROR", "Invalid get-caller-context payload.");

    const { orgId: orgIdRaw, callId, callerPhone } = parsed.data;
    let resolvedOrgId = String(orgIdRaw || "").trim();
    let resolvedPhone = normalizePhone(callerPhone || "");

    if (!resolvedOrgId && callId) {
      const call = await prisma.callLog.findFirst({
        where: { OR: [{ id: callId }, { providerCallId: callId }] },
        select: { orgId: true, fromNumber: true }
      });
      if (call?.orgId) {
        resolvedOrgId = call.orgId;
      }
      if (!resolvedPhone && call?.fromNumber) {
        resolvedPhone = normalizePhone(call.fromNumber);
      }
    }

    if (!resolvedOrgId) {
      return toolError(
        res,
        "MISSING_ORG_CONTEXT",
        "orgId is required when callId cannot be resolved to an organization."
      );
    }

    if (!callerPhone && callId) {
      const call = await prisma.callLog.findFirst({
        where: { orgId: resolvedOrgId, OR: [{ id: callId }, { providerCallId: callId }] },
        select: { fromNumber: true }
      });
      if (call?.fromNumber) {
        resolvedPhone = normalizePhone(call.fromNumber);
      }
    }

    if (!resolvedPhone) {
      return res.json({
        ok: true,
        data: {
          found: false,
          reason: "caller_phone_not_resolved"
        }
      });
    }

    const [callerProfile, latestLead, recentCalls, latestThread] = await Promise.all([
      prisma.callerProfile.findUnique({
        where: { orgId_phoneNumber: { orgId: resolvedOrgId, phoneNumber: resolvedPhone } },
        select: {
          totalCalls: true,
          firstCallAt: true,
          lastCallAt: true,
          lastOutcome: true,
          flaggedVIP: true
        }
      }),
      prisma.lead.findFirst({
        where: { orgId: resolvedOrgId, phone: resolvedPhone },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          business: true,
          email: true,
          urgency: true,
          notes: true,
          createdAt: true
        }
      }),
      prisma.callLog.findMany({
        where: { orgId: resolvedOrgId, fromNumber: resolvedPhone },
        orderBy: { startedAt: "desc" },
        take: 3,
        select: {
          startedAt: true,
          outcome: true,
          aiSummary: true,
          appointmentRequested: true
        }
      }),
      prisma.messageThread.findFirst({
        where: { orgId: resolvedOrgId, channel: "SMS", contactPhone: resolvedPhone },
        orderBy: { lastMessageAt: "desc" },
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1 }
        }
      })
    ]);

    const lastMessage = latestThread?.messages?.[0];
    const contextSummary = [
      callerProfile ? `repeat caller (${callerProfile.totalCalls} calls)` : "new/unknown caller",
      latestLead?.name ? `name on file: ${latestLead.name}` : null,
      latestLead?.urgency ? `prior urgency: ${latestLead.urgency}` : null,
      callerProfile?.lastOutcome ? `last outcome: ${callerProfile.lastOutcome}` : null,
      recentCalls[0]?.aiSummary ? `recent summary: ${recentCalls[0].aiSummary}` : null
    ]
      .filter(Boolean)
      .join(" | ");

    return res.json({
      ok: true,
      data: {
        found: Boolean(callerProfile || latestLead || recentCalls.length || latestThread),
        callerPhone: resolvedPhone,
        callerProfile,
        latestLead,
        recentCalls,
        latestMessage: lastMessage
          ? {
              direction: lastMessage.direction,
              body: lastMessage.body,
              createdAt: lastMessage.createdAt
            }
          : null,
        contextSummary
      }
    });
  } catch (error) {
    return toolError(res, "SERVER_ERROR", error instanceof Error ? error.message : "Unknown tool error", 500);
  }
});
