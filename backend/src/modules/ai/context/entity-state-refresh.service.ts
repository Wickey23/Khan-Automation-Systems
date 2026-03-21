import { buildEntityContext } from "./entity-context.service";
import { deriveNextBestAction, upsertEntityMemory } from "./entity-memory.service";

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function refreshEntityOperationalMemory(input: {
  orgId: string;
  entityType: string;
  entityId: string;
  updatedByRunId?: string | null;
  updatedByUserId?: string | null;
  reason?: string;
}) {
  const context = await buildEntityContext({
    orgId: input.orgId,
    entityType: input.entityType,
    entityId: input.entityId
  });
  if (!context) return null;

  const recommendation = deriveNextBestAction({
    entityType: input.entityType,
    contextPayload: context.payload
  });

  const riskFlags = [
    ...new Set([...toStringArray(context.payload.blockedReasons), ...recommendation.blockedReasons])
  ];

  return upsertEntityMemory({
    orgId: input.orgId,
    entityType: input.entityType,
    entityId: input.entityId,
    latestSummary:
      typeof context.payload.latestSummary === "string" ? context.payload.latestSummary : null,
    latestClassification:
      typeof context.payload.latestClassification === "string" ? context.payload.latestClassification : null,
    latestRecommendation: recommendation.action,
    recommendationWhy: recommendation.why,
    recommendationPriority: recommendation.priority,
    approvalNeeded: recommendation.approvalNeeded,
    outboundBlocked: recommendation.blockedReasons.length > 0,
    lastApprovalStatus:
      typeof context.payload.latestApprovalStatus === "string" ? context.payload.latestApprovalStatus : null,
    lastDeliveryStatus:
      typeof context.payload.latestDeliveryStatus === "string" ? context.payload.latestDeliveryStatus : null,
    lastTaskStatus:
      typeof context.payload.latestTaskStatus === "string" ? context.payload.latestTaskStatus : null,
    riskFlags,
    context: {
      ...(context.payload as Record<string, unknown>),
      nextBestAction: recommendation,
      refreshedReason: input.reason || "operational_refresh"
    },
    updatedByRunId: input.updatedByRunId || null,
    updatedByUserId: input.updatedByUserId || null
  });
}
