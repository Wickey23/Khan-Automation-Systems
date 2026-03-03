import { AiProvider, LeadSource, type Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { verifyVapiToolSecret } from "../../../middleware/webhook-security";
import { env } from "../../../config/env";
import { computeCallQuality } from "../../org/call-quality.service";
import { evaluateAndSendAutoRecovery } from "../../sms/auto-recovery.service";
import { transitionCallState } from "../call-state.service";
import { updateCallerProfileOutcome } from "../caller-profile.service";

export const vapiRouter = Router();

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

function normalizeOutcome(value: string) {
  const upper = value.trim().toUpperCase();
  if (["APPOINTMENT_REQUEST", "MESSAGE_TAKEN", "TRANSFERRED", "MISSED", "SPAM"].includes(upper)) {
    return upper as "APPOINTMENT_REQUEST" | "MESSAGE_TAKEN" | "TRANSFERRED" | "MISSED" | "SPAM";
  }
  return null;
}

function safePayloadSnippet(payload: unknown) {
  try {
    return JSON.stringify(payload).slice(0, 4000);
  } catch {
    return "{\"parseError\":true}";
  }
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

  const fallbackName = (input.candidateName || "").trim() || existingLead?.name || "Unknown Caller";
  const fallbackMessage = (input.summary || input.transcript || "").trim() || existingLead?.message || "";
  const fallbackEmail = `${input.fromNumber.replace(/\D/g, "") || "unknown"}@no-email.local`;

  const lead = existingLead
    ? await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          name: fallbackName,
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
  const body = asObject(req.body);
  const call = asObject(body.call);
  const callTransport = asObject(call.transport);
  const customer = asObject(body.customer);
  const phoneNumber = asObject(body.phoneNumber);
  const analysis = asObject(body.analysis);
  const artifact = asObject(body.artifact);
  const eventType = pickString(body.type, body.event, body.messageType).toLowerCase() || "unknown";
  const assistant = asObject(call.assistant);

  const callSid = pickString(
    body.callSid,
    body.providerCallId,
    body.callId,
    call.providerCallId,
    call.phoneCallProviderCallId,
    callTransport.providerCallId,
    call.id,
    call.sid,
    call.callSid
  );
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
    if (appointmentRequested !== null) updateData.appointmentRequested = appointmentRequested;
    if (outcome) updateData.outcome = outcome;
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
        ...(outcome ? { outcome } : {}),
        ...(appointmentRequested !== null ? { appointmentRequested } : {}),
        ...(eventType === "end-of-call-report" || endedByStatus ? { endedAt: new Date() } : {})
      }
    });

    if (eventType === "end-of-call-report" || endedByStatus) {
      const candidateName = pickString(
        analysis.name,
        structuredData.name,
        structuredData.fullName,
        customer.name,
        customerData.name
      ) || null;
      await ensureLeadForCall({
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
