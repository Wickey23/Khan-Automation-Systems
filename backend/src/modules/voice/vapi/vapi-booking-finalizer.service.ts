import crypto from "crypto";
import { type PrismaClient } from "@prisma/client";
import { env } from "../../../config/env";
import { isFeatureEnabledForOrg } from "../../org/feature-gates";
import { bookAppointmentWithHold } from "../../appointments/booking.service";
import { createCalendarEventFromConnection } from "../../appointments/calendar-oauth.service";
import { getBusyBlocks } from "../../appointments/calendar-busy.service";

const DECISION_VERSION = "2026-03-06.1";
const RETRY_BASE_MS = [5_000, 30_000, 120_000, 300_000];
const MAX_RETRIES = 4;

function asObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pickString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function parseOptionalDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizePhone(input: string) {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return String(input || "").trim();
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashJson(value: unknown) {
  return crypto.createHash("sha256").update(canonicalize(value)).digest("hex");
}

export async function persistVapiWebhookEvent(input: {
  prisma: PrismaClient;
  callId: string;
  messageType: string;
  eventTs: number | null;
  payload: unknown;
}) {
  const payloadHash = hashJson(input.payload);
  try {
    await input.prisma.vapiWebhookEvent.create({
      data: {
        callId: input.callId,
        messageType: input.messageType,
        eventTs: input.eventTs === null ? null : BigInt(input.eventTs),
        payload: input.payload as object,
        payloadHash
      }
    });
  } catch {
    // Duplicate/invalid event should not block webhook processing.
  }
}

export async function enqueueFinalizeBookingJob(input: {
  prisma: PrismaClient;
  callId: string;
}) {
  const existing = await input.prisma.finalizeBookingJob.findUnique({
    where: { callId: input.callId },
    select: { id: true, status: true }
  });
  if (!existing) {
    await input.prisma.finalizeBookingJob.create({
      data: { callId: input.callId, status: "queued", nextAttemptAt: new Date() }
    });
    return;
  }
  if (existing.status === "done" || existing.status === "processing") return;
  await input.prisma.finalizeBookingJob.update({
    where: { callId: input.callId },
    data: { status: "queued", nextAttemptAt: new Date(), error: null }
  });
}

async function claimNextJob(prisma: PrismaClient) {
  const now = new Date();
  const job = await prisma.finalizeBookingJob.findFirst({
    where: {
      status: { in: ["queued", "failed"] },
      nextAttemptAt: { lte: now }
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }]
  });
  if (!job) return null;
  const updated = await prisma.finalizeBookingJob.updateMany({
    where: { id: job.id, status: { in: ["queued", "failed"] } },
    data: {
      status: "processing",
      claimedAt: now,
      attemptCount: { increment: 1 }
    }
  });
  if (updated.count === 0) return null;
  return prisma.finalizeBookingJob.findUnique({ where: { id: job.id } });
}

async function fetchCallFromVapi(callId: string) {
  const apiKey = String(env.VAPI_API_KEY || "").trim();
  if (!apiKey) return null;
  try {
    const response = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(callId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as unknown;
    return payload;
  } catch {
    return null;
  }
}

async function ensureLead(input: {
  prisma: PrismaClient;
  orgId: string;
  callLogId: string | null;
  phone: string;
  name: string;
  message: string;
}) {
  const existing = await input.prisma.lead.findFirst({
    where: { orgId: input.orgId, phone: input.phone },
    orderBy: { createdAt: "desc" }
  });
  if (existing) {
    const lead = await input.prisma.lead.update({
      where: { id: existing.id },
      data: {
        name: existing.name === "Unknown Caller" ? input.name : existing.name,
        message: input.message || existing.message
      }
    });
    if (input.callLogId) {
      await input.prisma.callLog.updateMany({
        where: { id: input.callLogId, orgId: input.orgId },
        data: { leadId: lead.id }
      });
    }
    return lead.id;
  }

  const org = await input.prisma.organization.findUnique({
    where: { id: input.orgId },
    select: { name: true }
  });
  const lead = await input.prisma.lead.create({
    data: {
      orgId: input.orgId,
      name: input.name || "Unknown Caller",
      business: org?.name || "",
      email: `${input.phone.replace(/\D/g, "") || "unknown"}@no-email.local`,
      phone: input.phone,
      message: input.message || "",
      source: "PHONE_CALL"
    }
  });
  if (input.callLogId) {
    await input.prisma.callLog.updateMany({
      where: { id: input.callLogId, orgId: input.orgId },
      data: { leadId: lead.id }
    });
  }
  return lead.id;
}

async function finalizeBookingFromCall(input: { prisma: PrismaClient; callId: string; attemptCount: number }) {
  const latestEndReport = await input.prisma.vapiWebhookEvent.findFirst({
    where: { callId: input.callId, messageType: "end-of-call-report" },
    orderBy: { receivedAt: "desc" }
  });
  let payload = latestEndReport?.payload || null;
  let source: "webhook" | "vapi-fetch" = "webhook";
  if (!payload && input.attemptCount >= 2) {
    const fetched = await fetchCallFromVapi(input.callId);
    if (fetched) {
      payload = fetched;
      source = "vapi-fetch";
      await persistVapiWebhookEvent({
        prisma: input.prisma,
        callId: input.callId,
        messageType: "call-fetch",
        eventTs: null,
        payload: fetched
      });
    }
  }
  if (!payload) {
    const error = new Error("analysis_missing");
    (error as Error & { code?: string }).code = "ANALYSIS_MISSING";
    throw error;
  }

  const root = asObject(payload);
  const analysis = asObject(root.analysis);
  const structured = asObject(analysis.structuredData);
  const call = asObject(root.call);
  const callIdCandidates = [input.callId, pickString(call.id, call.providerCallId, root.callId, root.providerCallId)];
  const callIdFilters = callIdCandidates
    .filter(Boolean)
    .flatMap((value) => [{ providerCallId: value as string }, { id: value as string }]);
  const callLog = await input.prisma.callLog.findFirst({
    where: { OR: callIdFilters },
    orderBy: { createdAt: "desc" }
  });
  if (!callLog?.orgId) {
    throw new Error("call_log_not_found");
  }

  const orgId = callLog.orgId;
  const bookingIntent =
    Boolean(structured.bookingIntent) ||
    Boolean(structured.appointmentRequested) ||
    callLog.appointmentRequested === true ||
    callLog.outcome === "APPOINTMENT_REQUEST";
  if (!bookingIntent) {
    return { state: "NO_BOOKING_INTENT", callId: input.callId, orgId, source };
  }

  const customerPhone = normalizePhone(callLog.fromNumber);
  const customerName = pickString(
    structured.customerName,
    structured.name,
    structured.fullName,
    analysis.name
  ) || "Unknown Caller";
  const issueSummary = pickString(
    structured.issueSummary,
    structured.problem,
    structured.serviceIssue,
    callLog.aiSummary,
    callLog.transcript
  ).slice(0, 500);
  const serviceAddress = pickString(
    structured.serviceAddress,
    structured.address
  ) || null;
  const requestedStartAt = parseOptionalDate(
    pickString(structured.requestedStartAt, structured.startAt, structured.preferredDateTime)
  );

  const leadId = await ensureLead({
    prisma: input.prisma,
    orgId,
    callLogId: callLog.id,
    phone: customerPhone,
    name: customerName,
    message: issueSummary || ""
  });

  const pipelineEnabled = isFeatureEnabledForOrg(env.FEATURE_PIPELINE_STAGE_ENABLED, orgId);
  if (!requestedStartAt) {
    if (pipelineEnabled) {
      await input.prisma.lead.updateMany({
        where: { id: leadId, orgId },
        data: { pipelineStage: "NEEDS_SCHEDULING" }
      });
    }
    return { state: "NEEDS_SCHEDULING", callId: input.callId, orgId, leadId, source };
  }

  const settings = await input.prisma.businessSettings.findUnique({
    where: { orgId },
    select: {
      timezone: true,
      hoursJson: true,
      appointmentDurationMinutes: true,
      appointmentBufferMinutes: true
    }
  });
  const timezone = settings?.timezone || "America/New_York";
  const durationMinutes = Math.max(1, settings?.appointmentDurationMinutes ?? 60);
  const startAt = requestedStartAt;
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
  const calendarOauthEnabled = isFeatureEnabledForOrg(env.FEATURE_CALENDAR_OAUTH_ENABLED, orgId);
  const activeConnection = calendarOauthEnabled
    ? await input.prisma.calendarConnection.findFirst({
        where: { orgId, isActive: true },
        orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
        select: { id: true, provider: true }
      })
    : null;
  const requestedProvider = activeConnection?.provider || (calendarOauthEnabled ? "GOOGLE" : "INTERNAL");

  const decisionInput = {
    callId: input.callId,
    orgId,
    customerName,
    customerPhone,
    serviceAddress,
    issueSummary,
    requestedStartAt: startAt.toISOString(),
    requestedProvider
  };

  const booking = await bookAppointmentWithHold({
    prisma: input.prisma,
    orgId,
    userId: "postcall-worker",
    leadId,
    callLogId: callLog.id,
    customerName,
    customerPhone,
    issueSummary: issueSummary || "Service appointment request",
    serviceAddress,
    startAt,
    endAt,
    timezone,
    appointmentBufferMinutes: settings?.appointmentBufferMinutes ?? 15,
    requestedProvider,
    idempotencyKey: `postcall:${input.callId}`,
    businessHoursValidation: {
      hoursJson: settings?.hoursJson || null,
      timezone
    },
    pipelineFeatureEnabled: pipelineEnabled,
    returnFailureOnCalendarFallback: true,
    createExternalEvent:
      activeConnection && activeConnection.provider !== "INTERNAL"
        ? async () => {
            const event = await createCalendarEventFromConnection({
              prisma: input.prisma,
              connectionId: activeConnection.id,
              orgId,
              title: `${customerName} - Service Appointment`,
              description: issueSummary || "Booked from post-call worker",
              startAt,
              endAt,
              timezone
            });
            return { provider: event.provider, externalEventId: event.externalEventId || "" };
          }
        : undefined,
    fetchExternalBusyBlocks:
      activeConnection && activeConnection.provider !== "INTERNAL"
        ? async ({ fromUtc, toUtc }) => {
            const busy = await getBusyBlocks({
              prisma: input.prisma,
              orgId,
              fromUtc,
              toUtc,
              provider: activeConnection.provider
            });
            return busy.map((row) => ({ startAt: row.startUtc, endAt: row.endUtc }));
          }
        : undefined
  });

  if (!booking.ok && pipelineEnabled) {
    await input.prisma.lead.updateMany({
      where: { id: leadId, orgId },
      data: { pipelineStage: "NEEDS_SCHEDULING" }
    });
  }

  return {
    state: booking.ok ? "CONFIRMED" : booking.reason === "CALENDAR_UNAVAILABLE" ? "NEEDS_SCHEDULING" : "PROPOSED",
    callId: input.callId,
    orgId,
    source,
    leadId,
    bookingOk: booking.ok,
    bookingReason: booking.ok ? null : booking.reason,
    appointmentId: booking.ok ? booking.appointment.id : booking.appointment?.id || null,
    decisionVersion: DECISION_VERSION,
    decisionInputHash: hashJson(decisionInput)
  };
}

export async function runFinalizeBookingWorkerTick(prisma: PrismaClient) {
  const job = await claimNextJob(prisma);
  if (!job) return null;

  try {
    const result = await finalizeBookingFromCall({
      prisma,
      callId: job.callId,
      attemptCount: job.attemptCount
    });
    await prisma.finalizeBookingJob.update({
      where: { id: job.id },
      data: {
        status: "done",
        processedAt: new Date(),
        resultJson: result as object,
        error: null,
        decisionVersion: String((result as { decisionVersion?: string }).decisionVersion || DECISION_VERSION),
        decisionInputHash: String((result as { decisionInputHash?: string }).decisionInputHash || "")
      }
    });
    return result;
  } catch (error) {
    const code = String((error as Error & { code?: string })?.code || "");
    const nextDelay = RETRY_BASE_MS[Math.min(job.attemptCount, RETRY_BASE_MS.length - 1)] || 300_000;
    const shouldRetry = code === "ANALYSIS_MISSING" && job.attemptCount < MAX_RETRIES;
    await prisma.finalizeBookingJob.update({
      where: { id: job.id },
      data: {
        status: shouldRetry ? "failed" : "done",
        nextAttemptAt: new Date(Date.now() + nextDelay),
        error: error instanceof Error ? error.message : "unknown_error",
        resultJson: shouldRetry
          ? undefined
          : ({ failed: true, reason: error instanceof Error ? error.message : "unknown_error" } as object),
        processedAt: shouldRetry ? null : new Date()
      }
    });
    return null;
  }
}
