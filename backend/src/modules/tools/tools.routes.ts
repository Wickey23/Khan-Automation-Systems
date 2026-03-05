import { LeadSource } from "@prisma/client";
import { Router, type Response } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { verifyVapiToolSecret } from "../../middleware/webhook-security";
import { hasProMessaging } from "../billing/plan-features";
import { sendSmsMessage } from "../twilio/twilio.service";
import {
  computeAvailabilityWindow,
  generateAvailabilitySlots,
  validateSlotWithinBusinessHours
} from "../appointments/slotting.service";
import { getBusyBlocks } from "../appointments/calendar-busy.service";
import { bookAppointmentWithHold } from "../appointments/booking.service";
import { createCalendarEventFromConnection } from "../appointments/calendar-oauth.service";
import { isFeatureEnabledForOrg } from "../org/feature-gates";

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

const bookAppointmentSchema = z.object({
  orgId: z.string().min(1).optional(),
  callId: z.string().optional(),
  requestedStartAt: z.string().datetime().optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().min(5),
  issueSummary: z.string().optional(),
  serviceAddress: z.string().optional(),
  serviceType: z.string().optional(),
  preferenceWindow: z
    .object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional()
    })
    .optional()
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

toolsRouter.post("/book-appointment", async (req, res) => {
  try {
    const parsed = bookAppointmentSchema.safeParse(req.body);
    if (!parsed.success) return toolError(res, "VALIDATION_ERROR", "Invalid book-appointment payload.");
    const payload = parsed.data;
    const root = asObject(req.body);
    const messageRoot = asObject(root.message);
    const call = asObject(messageRoot.call);
    let resolvedOrgId = pickString(
      payload.orgId,
      root.orgId,
      root.organizationId,
      call.orgId,
      call.organizationId,
      messageRoot.orgId,
      process.env.DEFAULT_TOOL_ORG_ID,
      process.env.ORG_ID
    );
    let resolvedCallId = pickString(payload.callId, root.callId, root.providerCallId, call.id, call.callId, call.providerCallId);

    if (!resolvedOrgId && resolvedCallId) {
      const callRow = await prisma.callLog.findFirst({
        where: { OR: [{ id: resolvedCallId }, { providerCallId: resolvedCallId }] },
        orderBy: { createdAt: "desc" },
        select: { id: true, orgId: true, leadId: true }
      });
      if (callRow?.orgId) {
        resolvedOrgId = callRow.orgId;
      }
      if (callRow?.id) {
        resolvedCallId = callRow.id;
      }
    }

    if (!resolvedOrgId) {
      return toolError(res, "MISSING_ORG_CONTEXT", "Missing org context for book-appointment tool payload.");
    }

    if (!isFeatureEnabledForOrg(env.FEATURE_APPOINTMENTS_ENABLED, resolvedOrgId)) {
      return toolError(res, "FEATURE_DISABLED", "Appointments feature is disabled for this org.", 404);
    }
    const settings = await prisma.businessSettings.findUnique({
      where: { orgId: resolvedOrgId },
      select: {
        hoursJson: true,
        timezone: true,
        appointmentDurationMinutes: true,
        appointmentBufferMinutes: true,
        bookingLeadTimeHours: true,
        bookingMaxDaysAhead: true
      }
    });
    const timezone = settings?.timezone || "America/New_York";
    const calendarOauthEnabled = isFeatureEnabledForOrg(env.FEATURE_CALENDAR_OAUTH_ENABLED, resolvedOrgId);
    const callLog = resolvedCallId
      ? await prisma.callLog.findFirst({
          where: { orgId: resolvedOrgId, OR: [{ id: resolvedCallId }, { providerCallId: resolvedCallId }] },
          select: { id: true, leadId: true }
        })
      : null;

    const buildSlots = async () => {
      const window = computeAvailabilityWindow({
        now: new Date(),
        from: payload.preferenceWindow?.from ? new Date(payload.preferenceWindow.from) : undefined,
        to: payload.preferenceWindow?.to ? new Date(payload.preferenceWindow.to) : undefined,
        bookingLeadTimeHours: settings?.bookingLeadTimeHours ?? 2,
        bookingMaxDaysAhead: settings?.bookingMaxDaysAhead ?? 14
      });
      const internalBusy = await prisma.appointment.findMany({
        where: {
          orgId: resolvedOrgId,
          status: { not: "CANCELED" },
          startAt: { lte: window.to },
          endAt: { gte: window.from }
        },
        select: { startAt: true, endAt: true, status: true },
        orderBy: { startAt: "asc" },
        take: 500
      });
      let externalBusyBlocks: Array<{ startAt: Date; endAt: Date }> = [];
      if (isFeatureEnabledForOrg(env.FEATURE_CALENDAR_OAUTH_ENABLED, resolvedOrgId)) {
        try {
          const externalBusy = await getBusyBlocks({
            prisma,
            orgId: resolvedOrgId,
            fromUtc: window.from,
            toUtc: window.to
          });
          externalBusyBlocks = externalBusy.map((row) => ({ startAt: row.startUtc, endAt: row.endUtc }));
        } catch {
          externalBusyBlocks = [];
        }
      }
      const slots = generateAvailabilitySlots({
        hoursJson: settings?.hoursJson || null,
        timezone,
        appointmentDurationMinutes: settings?.appointmentDurationMinutes ?? 60,
        appointmentBufferMinutes: settings?.appointmentBufferMinutes ?? 15,
        bookingLeadTimeHours: settings?.bookingLeadTimeHours ?? 2,
        bookingMaxDaysAhead: settings?.bookingMaxDaysAhead ?? 14,
        from: window.from,
        to: window.to,
        existingAppointments: internalBusy,
        externalBusyBlocks
      });
      return slots.map((slot) => ({
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString()
      }));
    };

    if (!payload.requestedStartAt) {
      const slots = (await buildSlots()).slice(0, 3);
      return res.json({ ok: true, data: { slots } });
    }

    const startAt = new Date(payload.requestedStartAt);
    const durationMinutes = Math.max(1, settings?.appointmentDurationMinutes ?? 60);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
    const idempotencyKey = `tool:${resolvedOrgId}:${resolvedCallId || "manual"}:${startAt.toISOString()}`;

    const activeConnection = calendarOauthEnabled
      ? await prisma.calendarConnection.findFirst({
          where: { orgId: resolvedOrgId, isActive: true },
          orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
          select: { id: true, provider: true }
        })
      : null;
    const requestedProvider = activeConnection?.provider || (calendarOauthEnabled ? "GOOGLE" : "INTERNAL");

    const booking = await bookAppointmentWithHold({
      prisma,
      orgId: resolvedOrgId,
      userId: "vapi-tool",
      leadId: callLog?.leadId || null,
      callLogId: callLog?.id || resolvedCallId || null,
      customerName: payload.customerName,
      customerPhone: normalizePhone(payload.customerPhone),
      issueSummary: payload.issueSummary || payload.serviceType || "Service appointment request",
      serviceAddress: payload.serviceAddress || null,
      startAt,
      endAt,
      timezone,
      appointmentBufferMinutes: settings?.appointmentBufferMinutes ?? 15,
      requestedProvider,
      idempotencyKey,
      businessHoursValidation: {
        hoursJson: settings?.hoursJson || null,
        timezone
      },
      pipelineFeatureEnabled: isFeatureEnabledForOrg(env.FEATURE_PIPELINE_STAGE_ENABLED, resolvedOrgId),
      returnFailureOnCalendarFallback: true,
      createExternalEvent:
        activeConnection && activeConnection.provider !== "INTERNAL"
          ? async () => {
              const event = await createCalendarEventFromConnection({
                prisma,
                connectionId: activeConnection.id,
                orgId: resolvedOrgId,
                title: `${payload.customerName} - Service Appointment`,
                description: payload.issueSummary || "Booked via AI receptionist",
                startAt,
                endAt,
                timezone
              });
              return { provider: event.provider, externalEventId: event.externalEventId || "" };
            }
          : calendarOauthEnabled
            ? async () => {
                throw new Error("calendar_unavailable");
              }
          : undefined,
      fetchExternalBusyBlocks:
        activeConnection && activeConnection.provider !== "INTERNAL"
          ? async ({ fromUtc, toUtc }) => {
              const busy = await getBusyBlocks({
                prisma,
                orgId: resolvedOrgId,
                fromUtc,
                toUtc,
                provider: activeConnection.provider
              });
              return busy.map((row) => ({ startAt: row.startUtc, endAt: row.endUtc }));
            }
          : undefined,
      computeNextSlots: async () => (await buildSlots()).slice(0, 3)
    });

    if (booking.ok) {
      return res.json({ ok: true, data: { appointment: booking.appointment } });
    }

    if (booking.reason === "CALENDAR_UNAVAILABLE" && isFeatureEnabledForOrg(env.FEATURE_PIPELINE_STAGE_ENABLED, resolvedOrgId)) {
      const existingLead =
        callLog?.leadId
          ? await prisma.lead.findFirst({ where: { id: callLog.leadId, orgId: resolvedOrgId }, select: { id: true } })
          : await prisma.lead.findFirst({
              where: { orgId: resolvedOrgId, phone: normalizePhone(payload.customerPhone) },
              orderBy: { createdAt: "desc" },
              select: { id: true }
            });
      if (existingLead?.id) {
        await prisma.lead.updateMany({
          where: { id: existingLead.id, orgId: resolvedOrgId },
          data: { pipelineStage: "NEEDS_SCHEDULING" }
        });
      } else {
        await prisma.lead.create({
          data: {
            orgId: resolvedOrgId,
            name: payload.customerName,
            business: "",
            email: "",
            phone: normalizePhone(payload.customerPhone),
            source: "PHONE_CALL",
            pipelineStage: "NEEDS_SCHEDULING",
            serviceRequested: payload.serviceType || null,
            serviceAddress: payload.serviceAddress || null
          }
        });
      }
    }

    return res.status(409).json({
      ok: false,
      error: {
        code: booking.reason === "CALENDAR_UNAVAILABLE" ? "CALENDAR_UNAVAILABLE" : "BOOKING_FAILED",
        message:
          booking.reason === "OVERLAP"
            ? "Requested slot is no longer available."
            : booking.reason === "OUTSIDE_BUSINESS_HOURS"
              ? "Requested slot is outside business hours."
              : "Calendar unavailable; appointment saved for manual scheduling."
      },
      data: {
        failureReason: booking.reason,
        nextSlots: (booking.nextSlots || []).slice(0, 3)
      }
    });
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
