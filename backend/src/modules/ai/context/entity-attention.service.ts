import { prisma } from "../../../lib/prisma";
import { buildEntityContext } from "./entity-context.service";
import { deriveNextBestAction, type NextBestAction } from "./entity-memory.service";

export type AttentionLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type EntityAttention = {
  attentionScore: number;
  attentionLevel: AttentionLevel;
  topReasons: string[];
  recommendedOwnerAction: string;
  updatedAt: string;
};

export type AttentionQueueItem = {
  entityType: string;
  entityId: string;
  label: string;
  title: string;
  attentionScore: number;
  attentionLevel: AttentionLevel;
  topReasons: string[];
  recommendedOwnerAction: string;
  recommendationSummary: {
    action: string;
    why: string;
    priority: string;
  } | null;
  blockedReasons: string[];
  blocked: boolean;
  stale: boolean;
  unresolved: boolean;
  entityHref: string;
  approvalContext: {
    latestApprovalId: string | null;
    status: string | null;
    deliveryStatus: string | null;
    retryable: boolean;
    pendingCount: number;
    oldestPendingMinutes: number | null;
  };
  followUpContext: {
    openCount: number;
    overdueCount: number;
    latestTaskId: string | null;
    latestTaskStatus: string | null;
  };
  updatedAt: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function scoreToLevel(score: number): AttentionLevel {
  if (score >= 80) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

function computePriorityScore(priority: string) {
  const normalized = priority.toUpperCase();
  if (normalized === "URGENT") return 40;
  if (normalized === "HIGH") return 28;
  if (normalized === "MEDIUM") return 12;
  if (normalized === "LOW") return 4;
  return 0;
}

export function deriveEntityAttention(input: {
  entityType: string;
  contextPayload: Record<string, unknown>;
  recommendation: NextBestAction;
  updatedAt?: Date | string | null;
}): EntityAttention {
  let attentionScore = computePriorityScore(input.recommendation.priority);
  const reasons: string[] = [];

  const blockedReasons = asStringArray(input.recommendation.blockedReasons);
  const pendingApprovalCount = asNumber(input.contextPayload.pendingApprovalCount);
  const pendingApprovalOldestMinutes = asNumber(input.contextPayload.pendingApprovalOldestMinutes);
  const overdueTaskCount = asNumber(input.contextPayload.overdueTaskCount);
  const openFollowUpCount = asNumber(input.contextPayload.openFollowUpCount);
  const latestDeliveryStatus = asString(input.contextPayload.latestDeliveryStatus).toUpperCase();
  const retryableFailedDelivery = blockedReasons.includes("RETRYABLE_DELIVERY_FAILURE");
  const recentHandoffActive = blockedReasons.includes("RECENT_HANDOFF_ACTIVE");
  const dncBlocked = blockedReasons.includes("DNC_BLOCKED");
  const lastActionAgeMinutes = asNumber(input.contextPayload.lastMeaningfulActionAgeMinutes);

  if (dncBlocked) {
    attentionScore += 22;
    reasons.push("Outbound blocked due to DNC/opt-out state.");
  }

  if (pendingApprovalCount > 0) {
    attentionScore += 14;
    reasons.push(`Pending approval requires review (${pendingApprovalCount}).`);
    if (pendingApprovalOldestMinutes >= 30) {
      attentionScore += 12;
      reasons.push(`Oldest pending approval is aging (${pendingApprovalOldestMinutes}m).`);
    }
  }

  if (latestDeliveryStatus === "FAILED") {
    attentionScore += retryableFailedDelivery ? 24 : 16;
    reasons.push(retryableFailedDelivery ? "Delivery failed and is retryable." : "Delivery failed and needs manual resolution.");
  }

  if (overdueTaskCount > 0) {
    attentionScore += Math.min(28, 10 + overdueTaskCount * 6);
    reasons.push(`Overdue follow-up/tasks open (${overdueTaskCount}).`);
  }

  if (input.entityType === "call") {
    const callOutcome = asString(input.contextPayload.outcome).toUpperCase();
    const urgency = asString(input.contextPayload.latestUrgency).toLowerCase();
    if (callOutcome === "MISSED" || callOutcome === "ABANDONED") {
      attentionScore += 18;
      reasons.push("Missed/abandoned call still unresolved.");
    }
    if (urgency === "high") {
      attentionScore += 14;
      reasons.push("Call marked high urgency.");
    }
  }

  if (input.entityType === "message_thread") {
    const classification = asString(input.contextPayload.latestClassification).toUpperCase();
    if (classification === "BOOKING" || classification === "QUOTE") {
      attentionScore += 12;
      reasons.push("Commercial intent detected (booking/quote).");
    }
  }

  if (input.entityType === "lead") {
    const leadScore = asNumber(input.contextPayload.latestLeadScore);
    const status = asString(input.contextPayload.leadStatus).toUpperCase();
    if (leadScore >= 70 && (status === "NEW" || status === "CONTACTED")) {
      attentionScore += 10;
      reasons.push("High-fit lead needs timely progression.");
    }
  }

  if (recentHandoffActive && openFollowUpCount === 0 && pendingApprovalCount === 0) {
    attentionScore += 12;
    reasons.push("Recent handoff has no visible downstream completion.");
  }

  if (input.recommendation.action && lastActionAgeMinutes >= 180) {
    attentionScore += 10;
    reasons.push(`Recommendation appears stale (${lastActionAgeMinutes}m without meaningful action).`);
  }

  attentionScore = Math.max(0, Math.min(100, attentionScore));
  const attentionLevel = scoreToLevel(attentionScore);

  return {
    attentionScore,
    attentionLevel,
    topReasons: reasons.slice(0, 4),
    recommendedOwnerAction: input.recommendation.action,
    updatedAt: input.updatedAt ? new Date(input.updatedAt).toISOString() : new Date().toISOString()
  };
}

function buildEntityLabel(entityType: string, payload: Record<string, unknown>) {
  if (entityType === "call") {
    return `Call ${asString(payload.fromNumber) || asString(payload.id)}`;
  }
  if (entityType === "lead") {
    return asString(payload.name) || asString(payload.phone) || asString(payload.id);
  }
  if (entityType === "message_thread") {
    return asString(payload.contactName) || asString(payload.contactPhone) || asString(payload.id);
  }
  return asString(payload.id) || `${entityType} record`;
}

function buildEntityHref(entityType: string, entityId: string) {
  if (entityType === "call") return `/app/calls?callId=${encodeURIComponent(entityId)}`;
  if (entityType === "lead") return `/app/leads?leadId=${encodeURIComponent(entityId)}`;
  if (entityType === "message_thread") return `/app/messages?threadId=${encodeURIComponent(entityId)}`;
  return "/app";
}

export async function buildAttentionQueue(input: {
  orgId: string;
  limit?: number;
  levels?: AttentionLevel[];
}) {
  const limit = Math.max(1, Math.min(input.limit || 30, 100));
  const coreTypes = ["call", "lead", "message_thread"];
  const refs = new Map<string, { entityType: string; entityId: string }>();

  const [memoryRows, pendingApprovals, openFollowUps] = await Promise.all([
    prisma.agentEntityMemory.findMany({
      where: { orgId: input.orgId, entityType: { in: coreTypes } },
      orderBy: { updatedAt: "desc" },
      take: limit * 4
    }),
    prisma.approvalRequest.findMany({
      where: { orgId: input.orgId, entityType: { in: coreTypes }, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: limit * 3,
      select: { entityType: true, entityId: true }
    }),
    prisma.followUpQueueItem.findMany({
      where: { orgId: input.orgId, entityType: { in: coreTypes }, status: "OPEN" },
      orderBy: { createdAt: "asc" },
      take: limit * 3,
      select: { entityType: true, entityId: true }
    })
  ]);

  for (const row of memoryRows) refs.set(`${row.entityType}:${row.entityId}`, { entityType: row.entityType, entityId: row.entityId });
  for (const row of pendingApprovals) if (row.entityType && row.entityId) refs.set(`${row.entityType}:${row.entityId}`, { entityType: row.entityType, entityId: row.entityId });
  for (const row of openFollowUps) if (row.entityType && row.entityId) refs.set(`${row.entityType}:${row.entityId}`, { entityType: row.entityType, entityId: row.entityId });

  const attentionItems: AttentionQueueItem[] = [];
  for (const ref of refs.values()) {
    const context = await buildEntityContext({
      orgId: input.orgId,
      entityType: ref.entityType,
      entityId: ref.entityId
    });
    if (!context) continue;

    const payload = context.payload;
    const recommendation =
      payload.nextBestAction && typeof payload.nextBestAction === "object"
        ? ({
            action: asString((payload.nextBestAction as Record<string, unknown>).action),
            why: asString((payload.nextBestAction as Record<string, unknown>).why),
            priority: (asString((payload.nextBestAction as Record<string, unknown>).priority).toUpperCase() || "MEDIUM") as
              | "LOW"
              | "MEDIUM"
              | "HIGH"
              | "URGENT",
            approvalNeeded: Boolean((payload.nextBestAction as Record<string, unknown>).approvalNeeded),
            shouldCreateFollowup: Boolean((payload.nextBestAction as Record<string, unknown>).shouldCreateFollowup),
            blockedReasons: asStringArray((payload.nextBestAction as Record<string, unknown>).blockedReasons)
          } satisfies NextBestAction)
        : deriveNextBestAction({ entityType: ref.entityType, contextPayload: payload });

    const attention = deriveEntityAttention({
      entityType: ref.entityType,
      contextPayload: payload,
      recommendation,
      updatedAt: payload.memory && typeof payload.memory === "object" && "updatedAt" in (payload.memory as Record<string, unknown>)
        ? (payload.memory as Record<string, unknown>).updatedAt as string
        : new Date()
    });

    if (input.levels?.length && !input.levels.includes(attention.attentionLevel)) continue;

    const item: AttentionQueueItem = {
      entityType: ref.entityType,
      entityId: ref.entityId,
      label: buildEntityLabel(ref.entityType, payload),
      title: context.summary,
      attentionScore: attention.attentionScore,
      attentionLevel: attention.attentionLevel,
      topReasons: attention.topReasons,
      recommendedOwnerAction: attention.recommendedOwnerAction,
      recommendationSummary: recommendation.action
        ? {
            action: recommendation.action,
            why: recommendation.why,
            priority: recommendation.priority
          }
        : null,
      blockedReasons: recommendation.blockedReasons,
      blocked: recommendation.blockedReasons.length > 0,
      stale: attention.topReasons.some((reason) => /stale|aging|unresolved/i.test(reason)),
      unresolved:
        attention.attentionLevel === "HIGH" ||
        attention.attentionLevel === "CRITICAL" ||
        recommendation.blockedReasons.length > 0,
      entityHref: buildEntityHref(ref.entityType, ref.entityId),
      approvalContext: {
        latestApprovalId: asString(payload.latestApprovalId) || null,
        status: asString(payload.latestApprovalStatus) || null,
        deliveryStatus: asString(payload.latestDeliveryStatus) || null,
        retryable: Boolean(payload.latestApprovalRetryable),
        pendingCount: asNumber(payload.pendingApprovalCount),
        oldestPendingMinutes: asNumber(payload.pendingApprovalOldestMinutes) || null
      },
      followUpContext: {
        openCount: asNumber(payload.openFollowUpCount),
        overdueCount: asNumber(payload.overdueTaskCount),
        latestTaskId: asString(payload.latestTaskId) || null,
        latestTaskStatus: asString(payload.latestTaskStatus) || null
      },
      updatedAt: attention.updatedAt
    };

    attentionItems.push(item);
  }

  attentionItems.sort((a, b) => {
    if (b.attentionScore !== a.attentionScore) return b.attentionScore - a.attentionScore;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return attentionItems.slice(0, limit);
}
