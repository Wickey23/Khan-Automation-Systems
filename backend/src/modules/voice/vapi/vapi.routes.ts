import { AiProvider, LeadSource, type Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { verifyVapiToolSecret } from "../../../middleware/webhook-security";
import { env } from "../../../config/env";
import { registerWebhookReplay } from "../../ops/webhook-replay.service";
import { computeCallQuality } from "../../org/call-quality.service";
import { evaluateAndSendAutoRecovery } from "../../sms/auto-recovery.service";
import { transitionCallState } from "../call-state.service";
import { updateCallerProfileOutcome } from "../caller-profile.service";
import { classifyCallAndMaybeUpdateLead } from "../../org/call-classification.service";
import { emitOrgNotification } from "../../notifications/notification.service";
import { maybeEmitWebhookRetryAlert } from "../../notifications/security-alert.service";
import { isFeatureEnabledForOrg } from "../../org/feature-gates";
import { enqueueFinalizeBookingJob, persistVapiWebhookEvent } from "./vapi-booking-finalizer.service";
import { evaluateBookingRuleEngine, extractToolArgsFromPayload } from "./booking-rule-engine";

export const vapiRouter = Router();
const vapiEnvelopeSchema = z.object({
  type: z.string().optional(),
  event: z.string().optional(),
  messageType: z.string().optional(),
  callId: z.string().optional(),
  providerCallId: z.string().optional(),
  callSid: z.string().optional()
});

function asObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

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

function parseInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseEventTimestamp(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed);
}

function normalizeOutcome(value: string) {
  const upper = value.trim().toUpperCase();
  if (["APPOINTMENT_REQUEST", "MESSAGE_TAKEN", "TRANSFERRED", "MISSED", "ABANDONED", "SPAM"].includes(upper)) {
    return upper as "APPOINTMENT_REQUEST" | "MESSAGE_TAKEN" | "TRANSFERRED" | "MISSED" | "ABANDONED" | "SPAM";
  }
  return null;
}

function deriveOutcomeFromStatus(input: {
  callStatus: string;
  currentOutcome: "APPOINTMENT_REQUEST" | "MESSAGE_TAKEN" | "TRANSFERRED" | "MISSED" | "ABANDONED" | "SPAM" | null;
}) {
  if (input.currentOutcome) return input.currentOutcome;
  if (["busy", "no-answer", "timeout", "failed", "canceled", "cancelled"].includes(input.callStatus)) {
    return "ABANDONED" as const;
  }
  return null;
}

const allowedVapiActionNames = new Set([
  "create_lead",
  "create_lead_from_call",
  "create_appointment_request",
  "book_appointment",
  "mark_booking_intent",
  "transfer_call",
  "send_sms_followup",
  "send_sms",
  "log_call",
  "notify_manager",
  "get_caller_context",
  "get_customer_context",
  "get_available_times"
]);

type ExtractedToolCall = {
  name: string;
  args: Record<string, unknown>;
};

function extractToolCallsFromPayload(payload: unknown) {
  const root = asObject(payload);
  const candidates = [
    root.toolCallList,
    root.toolCalls,
    asObject(root.message).toolCallList,
    asObject(root.message).toolCalls
  ];
  const out: ExtractedToolCall[] = [];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    for (const item of candidate) {
      const obj = asObject(item);
      const functionCall = asObject(obj.function);
      const name = pickString(obj.name, obj.toolName, functionCall.name);
      const argsNode = obj.args ?? obj.arguments ?? functionCall.arguments ?? functionCall.args ?? {};
      let args = asObject(argsNode);
      if (!Object.keys(args).length && typeof argsNode === "string") {
        try {
          args = asObject(JSON.parse(argsNode));
        } catch {
          args = {};
        }
      }
      if (name) out.push({ name, args });
    }
  }
  return out;
}

function deriveAppointmentIntentFallback(input: {
  transcript: string | null;
  summary: string | null;
  structuredData: Record<string, unknown>;
  rawPayload: unknown;
  fromNumber: string;
  appointmentRequested: boolean | null;
  outcome: "APPOINTMENT_REQUEST" | "MESSAGE_TAKEN" | "TRANSFERRED" | "MISSED" | "ABANDONED" | "SPAM" | null;
}) {
  if (input.appointmentRequested === true || input.outcome === "APPOINTMENT_REQUEST") {
    return {
      appointmentRequested: true,
      outcome: "APPOINTMENT_REQUEST" as const,
      source: "existing_signal",
      confidence: 1
    };
  }

  const transcript = String(input.transcript || "").trim();
  const summary = String(input.summary || "").trim();
  const toolArgs = extractToolArgsFromPayload(input.rawPayload);
  const evaluation = evaluateBookingRuleEngine({
    structured: input.structuredData,
    transcript: transcript || summary,
    toolArgs
  });

  const hasPhone = Boolean(input.fromNumber && input.fromNumber !== "unknown");
  const hasCollectedDetails = Boolean(
    evaluation.extracted.customerName ||
      evaluation.extracted.serviceAddress ||
      evaluation.extracted.requestedStartAt ||
      evaluation.extracted.issueSummary ||
      toolArgs?.issueSummary
  );

  if (evaluation.bookingIntent && evaluation.confidence >= 0.5 && hasPhone && hasCollectedDetails) {
    return {
      appointmentRequested: true,
      outcome: "APPOINTMENT_REQUEST" as const,
      source: `backend_${evaluation.source.toLowerCase()}`,
      confidence: evaluation.confidence,
      reasons: evaluation.reasons,
      ambiguities: evaluation.ambiguities
    };
  }

  return {
    appointmentRequested: input.appointmentRequested,
    outcome: input.outcome,
    source: "none",
    confidence: evaluation.confidence,
    reasons: evaluation.reasons,
    ambiguities: evaluation.ambiguities
  };
}

function safePayloadSnippet(payload: unknown) {
  try {
    return JSON.stringify(payload).slice(0, 4000);
  } catch {
    return "{\"parseError\":true}";
  }
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

function normalizeStructuredSummary(value: string | null | undefined) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (["unknown", "unknown caller", "no summary", "n/a"].includes(text.toLowerCase())) return "";
  return text.slice(0, 500);
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

function buildSafeVapiSummaryFallback(input: {
  summary?: string | null;
  transcript?: string | null;
  outcome?: string | null;
}) {
  const preferred = normalizeStructuredSummary(input.summary);
  if (preferred) return preferred;

  const transcript = String(input.transcript || "")
    .split("\n")
    .map((line) => line.replace(/^[A-Z_]+:\s*/i, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (transcript) return transcript.slice(0, 280);

  const outcome = String(input.outcome || "").toUpperCase();
  if (outcome === "MISSED" || outcome === "ABANDONED") return "Caller still needs follow-up. Review the missed call and recovery workflow.";
  if (outcome === "APPOINTMENT_REQUEST") return "Customer requested an appointment and should be reviewed by the office.";
  if (outcome === "SPAM") return "Call marked as spam.";
  return "Customer request captured for office review.";
}

function extractTranscriptFromMessages(...sources: unknown[]) {
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    const lines = source
      .map((item) => {
        const obj = asObject(item);
        const role = pickString(obj.role, obj.speaker, obj.type).toUpperCase();
        const content =
          pickString(obj.content, obj.message, obj.text) ||
          (Array.isArray(obj.contents)
            ? obj.contents
                .map((entry) => {
                  const contentObj = asObject(entry);
                  return pickString(contentObj.text, contentObj.content, contentObj.message);
                })
                .filter(Boolean)
                .join(" ")
            : "");
        if (!content) return "";
        const label = role === "ASSISTANT" ? "ASSISTANT" : role === "USER" ? "USER" : role;
        return label ? `${label}: ${content}` : content;
      })
      .filter(Boolean)
      .join("\n")
      .trim();
    if (lines) return lines;
  }
  return "";
}

async function ensureLeadForCall(input: {
  orgId: string;
  callLogId: string;
  fromNumber: string;
  summary: string | null;
  transcript: string | null;
  candidateLeadId: string | null;
  candidateName: string | null;
}) {
  if (!input.fromNumber || input.fromNumber === "unknown") return null;

  if (input.candidateLeadId) {
    const existing = await prisma.lead.findFirst({
      where: { id: input.candidateLeadId, orgId: input.orgId },
      select: { id: true }
    });
    if (existing?.id) {
      await prisma.callLog.updateMany({
        where: { orgId: input.orgId, id: input.callLogId },
        data: { leadId: existing.id }
      });
      return existing.id;
    }
  }

  const org = await prisma.organization.findUnique({ where: { id: input.orgId }, select: { name: true } });
  if (!org) return null;

  const existingLead = await prisma.lead.findFirst({
    where: { orgId: input.orgId, phone: input.fromNumber },
    orderBy: { createdAt: "desc" }
  });

  const candidateFromFields = toTitleCase(String(input.candidateName || "").trim());
  const candidateFromText = extractHumanNameFromText(`${input.summary || ""}\n${input.transcript || ""}`);
  const strongCandidate = !isPlaceholderName(candidateFromFields) ? candidateFromFields : candidateFromText;
  const fallbackName = strongCandidate || existingLead?.name || "Unknown Caller";
  const fallbackMessage = buildSafeVapiSummaryFallback({
    summary: input.summary,
    transcript: input.transcript
  }) || existingLead?.message || "";
  const fallbackEmail = `${input.fromNumber.replace(/\D/g, "") || "unknown"}@no-email.local`;

  const lead = existingLead
    ? await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          name:
            !isPlaceholderName(strongCandidate) && isPlaceholderName(existingLead.name)
              ? strongCandidate
              : existingLead.name,
          business: existingLead.business || org.name,
          email: existingLead.email || fallbackEmail,
          message: fallbackMessage || existingLead.message
        }
      })
    : await prisma.lead.create({
        data: {
          orgId: input.orgId,
          name: fallbackName,
          business: org.name,
          email: fallbackEmail,
          phone: input.fromNumber,
          message: fallbackMessage,
          source: LeadSource.PHONE_CALL
        }
      });

  await prisma.callLog.updateMany({
    where: { orgId: input.orgId, id: input.callLogId },
    data: { leadId: lead.id }
  });

  return lead.id;
}

async function logWebhookEvent(input: {
  orgId?: string | null;
  requestId?: string;
  statusCode: number;
  reason?: string;
  headers: Record<string, unknown>;
  payload: unknown;
}) {
  let safeOrgId: string | null = input.orgId || null;
  if (safeOrgId) {
    const orgExists = await prisma.organization.findUnique({
      where: { id: safeOrgId },
      select: { id: true }
    });
    if (!orgExists) safeOrgId = null;
  }

  try {
    await prisma.webhookEventLog.create({
      data: {
        orgId: safeOrgId,
        provider: "VAPI",
        endpoint: "/api/vapi/webhook",
        requestId: input.requestId || null,
        statusCode: input.statusCode,
        reason: input.reason || null,
        headersJson: JSON.stringify(input.headers || {}),
        payloadSnippet: safePayloadSnippet(input.payload)
      }
    });
  } catch {
    // Never let webhook logging crash the request path.
  }
}

vapiRouter.post("/webhook", verifyVapiToolSecret, async (req, res) => {
  const body = asObject(req.body);
  const eventType = pickString(body.type, body.event, body.messageType).toLowerCase() || "unknown";
  
  // Extract callSid for idempotency/logging
  const message = asObject(body.message);
  const root = Object.keys(message).length ? message : body;
  const call = asObject(root.call);
  const callSid = pickString(
    body.callSid, body.providerCallId, body.callId,
    root.callSid, root.providerCallId, root.callId,
    call.providerCallId, call.id,
    req.header("x-call-id")
  );

  try {
    const { assertSystemEnabled } = await import("../../../lib/system-flags");
    await assertSystemEnabled("disableWebhooks");

    if (callSid) {
      const idempotencyKey = `vapi:${callSid}:${eventType}`;
      const { executeOnce } = await import("../../../lib/idempotency");
      
      await executeOnce({
        key: idempotencyKey,
        ttlMs: 60000, // 1 minute
        handler: async () => {
          // Priority 2: Durable Staging
          const event = await persistVapiWebhookEvent({
            callId: callSid,
            messageType: eventType,
            payload: req.body as any
          });

          if (event) {
            const { webhookQueue } = await import("../../../lib/queue");
            await webhookQueue.add("vapi-webhook", {
              provider: "vapi",
              type: "vapi-event",
              eventId: event.id
            });
          }
        }
      }).catch((err) => {
        if (err.message.includes("Idempotency")) return;
        throw err;
      });
    }

    return res.json({ ok: true, enqueued: true });

  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message.includes("is currently disabled")) {
      return res.status(503).json({ ok: false, message: "Paused" });
    }
    return res.json({ ok: true, error: message });
  }
});
