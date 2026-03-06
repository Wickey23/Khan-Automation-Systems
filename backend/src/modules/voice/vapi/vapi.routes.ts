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
  if (["APPOINTMENT_REQUEST", "MESSAGE_TAKEN", "TRANSFERRED", "MISSED", "SPAM"].includes(upper)) {
    return upper as "APPOINTMENT_REQUEST" | "MESSAGE_TAKEN" | "TRANSFERRED" | "MISSED" | "SPAM";
  }
  return null;
}

function deriveAppointmentIntentFallback(input: {
  transcript: string | null;
  summary: string | null;
  structuredData: Record<string, unknown>;
  rawPayload: unknown;
  fromNumber: string;
  appointmentRequested: boolean | null;
  outcome: "APPOINTMENT_REQUEST" | "MESSAGE_TAKEN" | "TRANSFERRED" | "MISSED" | "SPAM" | null;
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
  const fallbackMessage = (input.summary || input.transcript || "").trim() || existingLead?.message || "";
  const fallbackEmail = `${input.fromNumber.replace(/\D/g, "") || "unknown"}@no-email.local`;

  const lead = existingLead
    ? await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          name: !isPlaceholderName(strongCandidate) && isPlaceholderName(existingLead.name) ? strongCandidate : existingLead.name,
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
  await prisma.webhookEventLog.create({
    data: {
      orgId: input.orgId || null,
      provider: "VAPI",
      endpoint: "/api/vapi/webhook",
      requestId: input.requestId || null,
      statusCode: input.statusCode,
      reason: input.reason || null,
      headersJson: JSON.stringify(input.headers || {}),
      payloadSnippet: safePayloadSnippet(input.payload)
    }
  });
}

vapiRouter.post("/webhook", verifyVapiToolSecret, async (req, res) => {
  const parsedEnvelope = vapiEnvelopeSchema.safeParse(req.body || {});
  if (!parsedEnvelope.success) {
    await prisma.auditLog.create({
      data: {
        actorUserId: "vapi-webhook",
        actorRole: "SYSTEM",
        action: "VAPI_WEBHOOK_SCHEMA_IGNORED",
        metadataJson: JSON.stringify({ requestId: req.requestId || null })
      }
    });
    await logWebhookEvent({
      requestId: req.requestId,
      orgId: null,
      statusCode: 200,
      reason: "schema_validation_failed",
      headers: req.headers as Record<string, unknown>,
      payload: req.body
    });
    return res.json({ ok: true, data: { ignored: true } });
  }

  const body = asObject(req.body);
  const message = asObject(body.message);
  const root = Object.keys(message).length ? message : body;
  const call = asObject(root.call);
  const callTransport = asObject(call.transport);
  const customer = asObject(root.customer);
  const phoneNumber = asObject(root.phoneNumber);
  const analysis = asObject(root.analysis);
  const artifact = asObject(root.artifact);
  const eventType = pickString(body.type, body.event, body.messageType, root.type, root.event, root.messageType).toLowerCase() || "unknown";
  const assistant = asObject(call.assistant);

  const callSid = pickString(
    body.callSid,
    body.providerCallId,
    body.callId,
    root.callSid,
    root.providerCallId,
    root.callId,
    call.providerCallId,
    call.phoneCallProviderCallId,
    callTransport.providerCallId,
    call.id,
    call.sid,
    call.callSid,
    req.header("x-call-id")
  );
  if (callSid) {
    const replay = await registerWebhookReplay(prisma, {
      provider: "VAPI",
      eventKey: `vapi:${callSid}:${eventType}`,
      orgId: null,
      outcome: eventType
    });
    if (replay.duplicate) {
      await prisma.auditLog.create({
        data: {
          actorUserId: "vapi-webhook",
          actorRole: "SYSTEM",
          action: "WEBHOOK_REPLAY_BLOCKED",
          metadataJson: JSON.stringify({ provider: "VAPI", eventKey: `vapi:${callSid}:${eventType}` })
        }
      });
      await logWebhookEvent({
        orgId: null,
        requestId: req.requestId,
        statusCode: 200,
        reason: "duplicate_replay_ignored",
        headers: req.headers as Record<string, unknown>,
        payload: body
      });
      return res.json({ ok: true, data: { ignored: true } });
    }
  }
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
  const customerData = asObject(analysis.customer);
  const orgIdFromPayload = pickString(body.orgId, call.orgId) || null;
  const assistantId = pickString(body.assistantId, call.assistantId, assistant.id, assistant.assistantId) || null;
  const phoneNumberId = pickString(body.phoneNumberId, call.phoneNumberId, phoneNumber.id) || null;
  const durationSec = parseInteger(body.durationSec ?? call.durationSec ?? call.duration);
  const eventTs = parseEventTimestamp((asObject(body.message).timestamp as unknown) ?? body.timestamp);

  try {
    if (!callSid) {
      await prisma.auditLog.create({
        data: {
          actorUserId: "vapi-webhook",
          actorRole: "SYSTEM",
          action: "VAPI_WEBHOOK_NO_CALL_ID",
          metadataJson: JSON.stringify({ eventType, requestId: req.requestId || null })
        }
      });

      await logWebhookEvent({
        orgId: orgIdFromPayload,
        requestId: req.requestId,
        statusCode: 200,
        reason: "missing_call_id",
        headers: req.headers as Record<string, unknown>,
        payload: body
      });
      return res.json({ ok: true, data: { queuedBackfill: true, reason: "missing_call_id" } });
    }

    await persistVapiWebhookEvent({
      prisma,
      callId: callSid,
      messageType: eventType || "unknown",
      eventTs,
      payload: body
    });
    if (eventType === "end-of-call-report" || endedByStatus) {
      await enqueueFinalizeBookingJob({
        prisma,
        callId: callSid
      });
    }

    const fromNumber = normalizeToE164(
      pickString(body.fromNumber, body.from, customer.number, call.customerNumber)
    ) || "unknown";
    const toNumber = normalizeToE164(
      pickString(body.toNumber, body.to, phoneNumber.number, call.phoneNumber, call.to)
    ) || "unknown";

    const demoConfig = await prisma.appConfig.findUnique({ where: { id: "singleton" } });
    const demoNumber = normalizeToE164(String(demoConfig?.demoNumber || ""));
    const hasDemoSelector = Boolean(demoConfig?.demoVapiAssistantId || demoConfig?.demoVapiPhoneNumberId || demoNumber);
    const isDemoCall =
      hasDemoSelector &&
      ((Boolean(demoConfig?.demoVapiAssistantId) && assistantId === demoConfig?.demoVapiAssistantId) ||
        (Boolean(demoConfig?.demoVapiPhoneNumberId) && phoneNumberId === demoConfig?.demoVapiPhoneNumberId) ||
        (Boolean(demoNumber) && toNumber === demoNumber));

    if (isDemoCall) {
      const demoUpdateData: Record<string, unknown> = {
        assistantId,
        phoneNumberId,
        fromNumber,
        toNumber,
        status: callStatus || null,
        rawJson: body as Prisma.InputJsonValue
      };
      if (summary !== null) demoUpdateData.aiSummary = summary;
      if (transcript !== null) demoUpdateData.transcript = transcript;
      if (recordingUrl !== null) demoUpdateData.recordingUrl = recordingUrl;
      if (outcome) demoUpdateData.outcome = outcome;
      if (successEvaluation !== null) demoUpdateData.successEvaluation = successEvaluation;
      if (durationSec !== null) demoUpdateData.durationSec = durationSec;
      if (eventType === "end-of-call-report" || endedByStatus) demoUpdateData.endedAt = new Date();

      await prisma.demoCallLog.upsert({
        where: { providerCallId: callSid },
        update: demoUpdateData,
        create: {
          providerCallId: callSid,
          assistantId,
          phoneNumberId,
          fromNumber,
          toNumber,
          status: callStatus || null,
          rawJson: body as Prisma.InputJsonValue,
          ...(summary ? { aiSummary: summary } : {}),
          ...(transcript ? { transcript } : {}),
          ...(recordingUrl ? { recordingUrl } : {}),
          ...(outcome ? { outcome } : {}),
          ...(successEvaluation !== null ? { successEvaluation } : {}),
          ...(durationSec !== null ? { durationSec } : {}),
          ...(eventType === "end-of-call-report" || endedByStatus ? { endedAt: new Date() } : {})
        }
      });
    }

    let resolvedOrgId = orgIdFromPayload || "";
    if (!resolvedOrgId && toNumber !== "unknown") {
      const phone = await prisma.phoneNumber.findFirst({
        where: { e164Number: toNumber, status: { not: "RELEASED" } },
        select: { orgId: true }
      });
      resolvedOrgId = phone?.orgId || "";
    }

    if (!resolvedOrgId) {
      await prisma.auditLog.create({
        data: {
          actorUserId: "vapi-webhook",
          actorRole: "SYSTEM",
          action: "VAPI_WEBHOOK_UNRESOLVED",
          metadataJson: JSON.stringify({
            eventType,
            callSid,
            requestId: req.requestId || null,
            fromNumber,
            toNumber
          })
        }
      });
      await logWebhookEvent({
        requestId: req.requestId,
        orgId: null,
        statusCode: 200,
        reason: "unresolved_org",
        headers: req.headers as Record<string, unknown>,
        payload: body
      });
      return res.json({ ok: true, data: { queuedBackfill: true, eventType, callSid } });
    }

    const appointmentIntentFallback = deriveAppointmentIntentFallback({
      transcript,
      summary,
      structuredData,
      rawPayload: body,
      fromNumber,
      appointmentRequested,
      outcome
    });

    const effectiveAppointmentRequested = appointmentIntentFallback.appointmentRequested;
    const effectiveOutcome = appointmentIntentFallback.outcome;

    const updateData: Record<string, unknown> = {
      fromNumber,
      toNumber,
      aiProvider: AiProvider.VAPI,
      rawJson: body as Prisma.InputJsonValue
    };
    if (summary !== null) updateData.aiSummary = summary;
    if (transcript !== null) updateData.transcript = transcript;
    if (recordingUrl !== null) updateData.recordingUrl = recordingUrl;
    if (leadId !== null) updateData.leadId = leadId;
    if (effectiveAppointmentRequested !== null) updateData.appointmentRequested = effectiveAppointmentRequested;
    if (effectiveOutcome) updateData.outcome = effectiveOutcome;
    if (eventType === "end-of-call-report" || endedByStatus) updateData.endedAt = new Date();

    const persistedCall = await prisma.callLog.upsert({
      where: {
        orgId_providerCallId: {
          orgId: resolvedOrgId,
          providerCallId: callSid
        }
      },
      update: updateData,
      create: {
        orgId: resolvedOrgId,
        providerCallId: callSid,
        fromNumber,
        toNumber,
        aiProvider: AiProvider.VAPI,
        outcome: "MESSAGE_TAKEN",
        rawJson: body as Prisma.InputJsonValue,
        ...(summary ? { aiSummary: summary } : {}),
        ...(transcript ? { transcript } : {}),
        ...(recordingUrl ? { recordingUrl } : {}),
        ...(leadId ? { leadId } : {}),
        ...(effectiveOutcome ? { outcome: effectiveOutcome } : {}),
        ...(effectiveAppointmentRequested !== null ? { appointmentRequested: effectiveAppointmentRequested } : {}),
        ...(eventType === "end-of-call-report" || endedByStatus ? { endedAt: new Date() } : {})
      }
    });

    if (appointmentIntentFallback.source !== "none" && appointmentIntentFallback.source !== "existing_signal") {
      await prisma.auditLog.create({
        data: {
          actorUserId: "vapi-webhook",
          actorRole: "SYSTEM",
          action: "BOOKING_INTENT_INFERRED",
          metadataJson: JSON.stringify({
            callId: callSid,
            orgId: resolvedOrgId,
            source: appointmentIntentFallback.source,
            confidence: appointmentIntentFallback.confidence,
            reasons: appointmentIntentFallback.reasons || [],
            ambiguities: appointmentIntentFallback.ambiguities || []
          })
        }
      });
    }

    let resolvedLeadId: string | null = persistedCall.leadId || null;
    if (eventType === "end-of-call-report" || endedByStatus) {
      const candidateName = pickString(
        analysis.name,
        structuredData.name,
        structuredData.fullName,
        customer.name,
        customerData.name
      ) || null;
      resolvedLeadId = await ensureLeadForCall({
        orgId: resolvedOrgId,
        callLogId: persistedCall.id,
        fromNumber,
        summary,
        transcript,
        candidateLeadId: leadId,
        candidateName
      });
    }

    if (env.ROUTING_ENGINE_ENABLED === "true") {
      await transitionCallState({
        prisma,
        callLogId: persistedCall.id,
        toState: "CONNECTED",
        metadata: { source: "vapi-webhook", eventType, status: callStatus || null }
      });
      if (eventType === "tool-calls" || Array.isArray(body.toolCallList) || Array.isArray(body.toolCalls)) {
        await transitionCallState({
          prisma,
          callLogId: persistedCall.id,
          toState: "AI_ACTIVE",
          metadata: { source: "vapi-webhook", eventType }
        });
      }
      if (outcome === "TRANSFERRED" || callStatus.includes("transfer")) {
        await transitionCallState({
          prisma,
          callLogId: persistedCall.id,
          toState: "TRANSFERRED",
          metadata: { source: "vapi-webhook", eventType, outcome: outcome || null }
        });
      }
      if (eventType === "end-of-call-report" || endedByStatus) {
        await transitionCallState({
          prisma,
          callLogId: persistedCall.id,
          toState: "COMPLETED",
          metadata: { source: "vapi-webhook", eventType, status: callStatus || null }
        });
      }
    }

    if (eventType === "end-of-call-report" || endedByStatus) {
      const classification = await classifyCallAndMaybeUpdateLead({
        prisma,
        orgId: resolvedOrgId,
        callLogId: persistedCall.id,
        leadId: resolvedLeadId
      }).catch(() => null);

      if (env.ROUTING_ENGINE_ENABLED === "true") {
        await computeCallQuality({ prisma, callLogId: persistedCall.id });
        await updateCallerProfileOutcome({
          prisma,
          orgId: resolvedOrgId,
          callerNumber: fromNumber,
          outcome: outcome || null
        });
      }
      if (env.AUTO_RECOVERY_ENABLED === "true") {
        await evaluateAndSendAutoRecovery({ prisma, callLogId: persistedCall.id });
      }
      if (isFeatureEnabledForOrg(env.FEATURE_NOTIFICATIONS_V1_ENABLED, resolvedOrgId) && classification && !classification.skipped) {
        if (classification.classification === "EMERGENCY") {
          await emitOrgNotification({
            prisma,
            orgId: resolvedOrgId,
            type: "EMERGENCY_CALL_FLAGGED",
            severity: "URGENT",
            title: "Emergency call flagged",
            body: `A call was classified as emergency from ${fromNumber}.`,
            targetRoleMin: "MANAGER",
            metadata: { callLogId: persistedCall.id, leadId: resolvedLeadId || null, confidence: classification.confidence }
          });
        } else if (classification.classification === "MISSED_CALL_RECOVERY") {
          await emitOrgNotification({
            prisma,
            orgId: resolvedOrgId,
            type: "MISSED_CALL_RECOVERY_NEEDED",
            severity: "ACTION_REQUIRED",
            title: "Missed-call recovery needed",
            body: `A missed call requires recovery workflow for ${fromNumber}.`,
            targetRoleMin: "MANAGER",
            metadata: { callLogId: persistedCall.id, leadId: resolvedLeadId || null }
          });
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        orgId: resolvedOrgId,
        actorUserId: "vapi-webhook",
        actorRole: "SYSTEM",
        action: "VAPI_WEBHOOK_EVENT",
        metadataJson: JSON.stringify({
          requestId: req.requestId || null,
          eventType,
          callSid,
          status: callStatus || null,
          successEvaluation,
          structuredData,
          toolCallList: body.toolCallList || body.toolCalls || null
        })
      }
    });

    await logWebhookEvent({
      orgId: resolvedOrgId,
      requestId: req.requestId,
      statusCode: 200,
      reason: "processed",
      headers: req.headers as Record<string, unknown>,
      payload: body
    });

    return res.json({ ok: true, data: { eventType, callSid } });
  } catch (error) {
    await logWebhookEvent({
      orgId: orgIdFromPayload,
      requestId: req.requestId,
      statusCode: 200,
      reason: error instanceof Error ? error.message : "unknown_error",
      headers: req.headers as Record<string, unknown>,
      payload: body
    });
    // Always acknowledge webhook to avoid retries storms.
    return res.json({ ok: true, data: { accepted: true } });
  }
});
