import { env } from "../../config/env";
import type { PrismaClient } from "@prisma/client";

function parseAuditMetadata(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

type BackfillResult = {
  scanned: number;
  resolved: number;
  skipped: number;
  unresolvedScanned: number;
  unresolvedResolved: number;
  unresolvedSkipped: number;
  historyScanned: number;
  historyResolved: number;
  historySkipped: number;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pickString(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeToE164(input: string): string {
  if (!input) return "";
  const normalized = input.replace(/[^\d+]/g, "");
  if (!normalized) return "";
  if (normalized.startsWith("+")) return normalized;
  if (normalized.length === 10) return `+1${normalized}`;
  if (normalized.length === 11 && normalized.startsWith("1")) return `+${normalized}`;
  return `+${normalized}`;
}

function normalizeOutcome(value: string) {
  const upper = value.trim().toUpperCase();
  if (["APPOINTMENT_REQUEST", "MESSAGE_TAKEN", "TRANSFERRED", "MISSED", "SPAM"].includes(upper)) {
    return upper as "APPOINTMENT_REQUEST" | "MESSAGE_TAKEN" | "TRANSFERRED" | "MISSED" | "SPAM";
  }
  return null;
}

async function fetchVapiCalls(): Promise<Array<Record<string, unknown>>> {
  if (!env.VAPI_API_KEY) return [];
  const headers = { Authorization: `Bearer ${env.VAPI_API_KEY}` };
  const endpoints = ["https://api.vapi.ai/call?limit=100", "https://api.vapi.ai/calls?limit=100"];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) continue;
      const payload = (await response.json()) as unknown;
      if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
      const obj = asObject(payload);
      if (Array.isArray(obj.data)) return obj.data as Array<Record<string, unknown>>;
      if (Array.isArray(obj.calls)) return obj.calls as Array<Record<string, unknown>>;
    } catch {
      // Try next endpoint format.
    }
  }

  return [];
}

type OrgTarget = {
  orgId: string;
  assistantIds: Set<string>;
  phoneNumberIds: Set<string>;
  toNumbers: Set<string>;
};

async function loadOrgTargets(prisma: PrismaClient, filterOrgId?: string): Promise<OrgTarget[]> {
  const orgs = await prisma.organization.findMany({
    where: filterOrgId ? { id: filterOrgId } : undefined,
    include: {
      aiAgentConfigs: { orderBy: { updatedAt: "desc" }, take: 1 },
      phoneNumbers: { where: { status: { not: "RELEASED" } } }
    }
  });

  return orgs.map((org) => {
    const ai = org.aiAgentConfigs[0];
    const assistantIds = new Set<string>();
    const phoneNumberIds = new Set<string>();
    const toNumbers = new Set<string>();

    if (ai?.vapiAgentId) assistantIds.add(ai.vapiAgentId.trim());
    if (ai?.vapiPhoneNumberId) phoneNumberIds.add(ai.vapiPhoneNumberId.trim());

    for (const line of org.phoneNumbers) {
      if (line.e164Number) toNumbers.add(normalizeToE164(line.e164Number));
    }

    return { orgId: org.id, assistantIds, phoneNumberIds, toNumbers };
  });
}

function resolveOrgIdForVapiCall(call: Record<string, unknown>, targets: OrgTarget[]): string {
  if (!targets.length) return "";
  const assistant = asObject(call.assistant);
  const phoneNumberObj = asObject(call.phoneNumber);
  const customer = asObject(call.customer);

  const assistantId = pickString(call.assistantId, assistant.id, assistant.assistantId);
  const phoneNumberId = pickString(call.phoneNumberId, phoneNumberObj.id);
  const toNumber = normalizeToE164(
    pickString(
      call.to,
      call.toNumber,
      call.phoneNumber,
      phoneNumberObj.number
    )
  );
  const fromNumber = normalizeToE164(
    pickString(call.from, call.fromNumber, customer.number, call.customerNumber)
  );

  const byPhoneNumberId = targets.find((target) => phoneNumberId && target.phoneNumberIds.has(phoneNumberId));
  if (byPhoneNumberId) return byPhoneNumberId.orgId;

  const byToNumber = targets.find((target) => toNumber && target.toNumbers.has(toNumber));
  if (byToNumber) return byToNumber.orgId;

  const byAssistantId = targets.find((target) => assistantId && target.assistantIds.has(assistantId));
  if (byAssistantId) return byAssistantId.orgId;

  // If to-number is missing, fallback to from-number for inbound edge cases.
  const byFromNumber = targets.find((target) => fromNumber && target.toNumbers.has(fromNumber));
  if (byFromNumber) return byFromNumber.orgId;

  return "";
}

async function backfillFromVapiHistory(
  prisma: PrismaClient,
  actorUserId: string,
  filterOrgId?: string
): Promise<{ scanned: number; resolved: number; skipped: number }> {
  const calls = await fetchVapiCalls();
  if (!calls.length) return { scanned: 0, resolved: 0, skipped: 0 };

  const targets = await loadOrgTargets(prisma, filterOrgId);
  if (!targets.length) return { scanned: calls.length, resolved: 0, skipped: calls.length };

  let resolved = 0;
  let skipped = 0;

  for (const rawCall of calls) {
    try {
      const call = asObject(rawCall);
      const analysis = asObject(call.analysis);
      const artifact = asObject(call.artifact);
      const customer = asObject(call.customer);
      const phoneNumberObj = asObject(call.phoneNumber);

      const providerCallId = pickString(call.providerCallId, call.callSid, call.sid, call.id);
      if (!providerCallId) {
        skipped += 1;
        continue;
      }

      const orgId = resolveOrgIdForVapiCall(call, targets);
      if (!orgId) {
        skipped += 1;
        continue;
      }

      const startedAtRaw = pickString(call.startedAt, call.createdAt, call.created);
      const endedAtRaw = pickString(call.endedAt, call.updatedAt, call.ended);
      const startedAt = startedAtRaw ? new Date(startedAtRaw) : new Date();
      const endedAt = endedAtRaw ? new Date(endedAtRaw) : null;
      const durationSec = startedAt && endedAt ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)) : null;

      const fromNumber = normalizeToE164(
        pickString(call.from, call.fromNumber, customer.number, call.customerNumber)
      ) || "unknown";
      const toNumber = normalizeToE164(
        pickString(call.to, call.toNumber, call.phoneNumber, phoneNumberObj.number)
      ) || "unknown";

      const summary = pickString(call.summary, analysis.summary) || null;
      const transcript = pickString(call.transcript, artifact.transcript) || null;
      const recordingUrl = pickString(call.recordingUrl, artifact.recordingUrl) || null;
      const outcome = normalizeOutcome(pickString(call.outcome, analysis.outcome));

      const updateData: Record<string, unknown> = {
        orgId,
        aiProvider: "VAPI",
        fromNumber,
        toNumber,
        startedAt,
        ...(endedAt ? { endedAt } : {}),
        ...(durationSec !== null ? { durationSec } : {}),
        ...(summary ? { aiSummary: summary } : {}),
        ...(transcript ? { transcript } : {}),
        ...(recordingUrl ? { recordingUrl } : {}),
        ...(outcome ? { outcome } : {})
      };
      const createData: Record<string, unknown> = {
        orgId,
        providerCallId,
        fromNumber,
        toNumber,
        aiProvider: "VAPI",
        startedAt,
        outcome: outcome || "MESSAGE_TAKEN",
        ...(endedAt ? { endedAt } : {}),
        ...(durationSec !== null ? { durationSec } : {}),
        ...(summary ? { aiSummary: summary } : {}),
        ...(transcript ? { transcript } : {}),
        ...(recordingUrl ? { recordingUrl } : {})
      };

      const existing = await prisma.callLog.findFirst({
        where: { providerCallId },
        orderBy: { createdAt: "desc" }
      });

      const log = existing
        ? await prisma.callLog.update({
            where: { id: existing.id },
            data: updateData
          })
        : await prisma.callLog.create({
            data: createData as any
          });

      await prisma.auditLog.create({
        data: {
          orgId,
          actorUserId,
          actorRole: "SYSTEM",
          action: "VAPI_HISTORY_SYNCED",
          metadataJson: JSON.stringify({
            providerCallId,
            callLogId: log.id
          })
        }
      });

      resolved += 1;
    } catch {
      skipped += 1;
    }
  }

  return {
    scanned: calls.length,
    resolved,
    skipped
  };
}

export async function backfillMissedVapiCalls(
  prisma: PrismaClient,
  actorUserId: string,
  filterOrgId?: string
): Promise<BackfillResult> {
  const unresolved = await prisma.auditLog.findMany({
    where: { action: "VAPI_WEBHOOK_UNRESOLVED" },
    orderBy: { createdAt: "asc" },
    take: 500
  });

  let resolved = 0;
  let skipped = 0;

  for (const row of unresolved) {
    try {
      const meta = parseAuditMetadata(row.metadataJson);
      const callSid = String(meta.callSid || "").trim();
      if (!callSid) {
        skipped += 1;
        continue;
      }

      let orgId = String(meta.orgIdFromPayload || "").trim();
      const toNumber = String(meta.toNumber || "").trim();
      const fromNumber = String(meta.fromNumber || "").trim() || "unknown";
      const eventType = String(meta.eventType || "unknown").toLowerCase();
      const callStatus = String(meta.callStatus || "").toLowerCase();
      const endedByStatus = ["ended", "completed", "failed", "canceled", "cancelled", "busy", "no-answer", "timeout"].includes(callStatus);

      if (!orgId && toNumber) {
        const phone = await prisma.phoneNumber.findFirst({
          where: { e164Number: toNumber, status: { not: "RELEASED" } },
          select: { orgId: true }
        });
        orgId = phone?.orgId || "";
      }

      if (!orgId) {
        skipped += 1;
        continue;
      }
      if (filterOrgId && orgId !== filterOrgId) {
        skipped += 1;
        continue;
      }

      const existing = await prisma.callLog.findFirst({
        where: { providerCallId: callSid },
        orderBy: { createdAt: "desc" }
      });

      const updateData: Record<string, unknown> = {
        aiProvider: "VAPI"
      };
      const summary = String(meta.summary || "").trim();
      const transcript = String(meta.transcript || "").trim();
      const recordingUrl = String(meta.recordingUrl || "").trim();
      const outcomeRaw = String(meta.outcome || "").trim().toUpperCase();
      const outcome = ["APPOINTMENT_REQUEST", "MESSAGE_TAKEN", "TRANSFERRED", "MISSED", "SPAM"].includes(outcomeRaw)
        ? outcomeRaw
        : null;
      if (summary) updateData.aiSummary = summary;
      if (transcript) updateData.transcript = transcript;
      if (recordingUrl) updateData.recordingUrl = recordingUrl;
      if (outcome) updateData.outcome = outcome;
      if (eventType === "end-of-call-report" || endedByStatus) updateData.endedAt = new Date();

      const log = existing
        ? await prisma.callLog.update({ where: { id: existing.id }, data: updateData })
        : await prisma.callLog.create({
            data: {
              orgId,
              providerCallId: callSid,
              fromNumber,
              toNumber: toNumber || "unknown",
              aiProvider: "VAPI",
              outcome: (outcome || "MESSAGE_TAKEN") as any,
              ...(updateData as Record<string, string | number | boolean | Date | null | undefined>)
            }
          });

      await prisma.auditLog.update({
        where: { id: row.id },
        data: {
          action: "VAPI_WEBHOOK_RESOLVED",
          orgId,
          metadataJson: JSON.stringify({
            ...meta,
            resolvedAt: new Date().toISOString(),
            resolvedByUserId: actorUserId,
            callLogId: log.id
          })
        }
      });

      resolved += 1;
    } catch {
      skipped += 1;
    }
  }

  const unresolvedResult = { scanned: unresolved.length, resolved, skipped };
  const historyResult = await backfillFromVapiHistory(prisma, actorUserId, filterOrgId);

  return {
    scanned: unresolvedResult.scanned + historyResult.scanned,
    resolved: unresolvedResult.resolved + historyResult.resolved,
    skipped: unresolvedResult.skipped + historyResult.skipped,
    unresolvedScanned: unresolvedResult.scanned,
    unresolvedResolved: unresolvedResult.resolved,
    unresolvedSkipped: unresolvedResult.skipped,
    historyScanned: historyResult.scanned,
    historyResolved: historyResult.resolved,
    historySkipped: historyResult.skipped
  };
}
