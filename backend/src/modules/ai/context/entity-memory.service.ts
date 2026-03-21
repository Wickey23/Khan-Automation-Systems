import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

export type NextBestAction = {
  action: string;
  why: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  approvalNeeded: boolean;
  shouldCreateFollowup: boolean;
  blockedReasons: string[];
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function deriveNextBestAction(input: {
  entityType: string;
  contextPayload: Record<string, unknown>;
}): NextBestAction {
  const blockedReasons = asStringArray(input.contextPayload.blockedReasons);
  const latestDeliveryStatus = asString(input.contextPayload.latestDeliveryStatus);
  const hasOpenFollowups = Number(input.contextPayload.openFollowUpCount || 0) > 0;
  const dnc = Boolean(input.contextPayload.dnc);
  const overdueTaskCount = Number(input.contextPayload.overdueTaskCount || 0);

  if (input.entityType === "call") {
    const urgency = asString(input.contextPayload.latestUrgency || input.contextPayload.urgency).toLowerCase();
    const outcome = asString(input.contextPayload.outcome).toUpperCase();
    if (dnc) {
      return {
        action: "Escalate to manual review",
        why: "Lead is marked do-not-contact.",
        priority: "HIGH",
        approvalNeeded: false,
        shouldCreateFollowup: true,
        blockedReasons: [...blockedReasons, "DNC_BLOCKED"]
      };
    }
    if (urgency === "high" || outcome === "MISSED" || outcome === "ABANDONED") {
      return {
        action: "Queue callback approval and open follow-up",
        why: "Urgent or missed call requires timely recovery.",
        priority: "URGENT",
        approvalNeeded: true,
        shouldCreateFollowup: !hasOpenFollowups,
        blockedReasons
      };
    }
    return {
      action: "Review call notes and close or follow up",
      why: "No urgent risk detected.",
      priority: "MEDIUM",
      approvalNeeded: false,
      shouldCreateFollowup: false,
      blockedReasons
    };
  }

  if (input.entityType === "lead") {
    const score = Number(input.contextPayload.latestLeadScore || 0);
    const status = asString(input.contextPayload.leadStatus).toUpperCase();
    if (dnc) {
      return {
        action: "Stop outbound and mark lead for compliance review",
        why: "Lead is flagged do-not-contact.",
        priority: "HIGH",
        approvalNeeded: false,
        shouldCreateFollowup: false,
        blockedReasons: [...blockedReasons, "DNC_BLOCKED"]
      };
    }
    if (latestDeliveryStatus === "FAILED") {
      return {
        action: "Retry approved outbound send",
        why: "Latest approved delivery failed.",
        priority: "HIGH",
        approvalNeeded: false,
        shouldCreateFollowup: true,
        blockedReasons
      };
    }
    if (status === "NEW" && score >= 60) {
      return {
        action: "Queue first-touch outreach for approval",
        why: "Lead quality is strong and still uncontacted.",
        priority: "HIGH",
        approvalNeeded: true,
        shouldCreateFollowup: !hasOpenFollowups,
        blockedReasons
      };
    }
    return {
      action: "Maintain follow-up cadence",
      why: overdueTaskCount > 0 ? "Existing overdue tasks require attention first." : "Continue qualification workflow.",
      priority: overdueTaskCount > 0 ? "HIGH" : "MEDIUM",
      approvalNeeded: false,
      shouldCreateFollowup: overdueTaskCount === 0 && !hasOpenFollowups,
      blockedReasons
    };
  }

  if (input.entityType === "message_thread") {
    const classification = asString(input.contextPayload.latestClassification).toUpperCase();
    if (dnc) {
      return {
        action: "Do not send outbound replies",
        why: "Thread/lead is opt-out or do-not-contact.",
        priority: "HIGH",
        approvalNeeded: false,
        shouldCreateFollowup: true,
        blockedReasons: [...blockedReasons, "DNC_BLOCKED"]
      };
    }
    if (classification === "BOOKING" || classification === "QUOTE") {
      return {
        action: "Draft response and queue approval",
        why: "Inbound message indicates booking or quote intent.",
        priority: "HIGH",
        approvalNeeded: true,
        shouldCreateFollowup: !hasOpenFollowups,
        blockedReasons
      };
    }
    return {
      action: "Draft response and mark thread status",
      why: "Thread requires standard communication handling.",
      priority: "MEDIUM",
      approvalNeeded: true,
      shouldCreateFollowup: false,
      blockedReasons
    };
  }

  return {
    action: "Review entity manually",
    why: "No domain-specific recommendation available.",
    priority: "MEDIUM",
    approvalNeeded: false,
    shouldCreateFollowup: false,
    blockedReasons
  };
}

export async function upsertEntityMemory(input: {
  orgId: string;
  entityType: string;
  entityId: string;
  latestSummary?: string | null;
  latestClassification?: string | null;
  latestRecommendation?: string | null;
  recommendationWhy?: string | null;
  recommendationPriority?: string | null;
  approvalNeeded?: boolean;
  outboundBlocked?: boolean;
  lastApprovalStatus?: string | null;
  lastDeliveryStatus?: string | null;
  lastTaskStatus?: string | null;
  riskFlags?: string[];
  context?: Record<string, unknown>;
  updatedByRunId?: string | null;
  updatedByUserId?: string | null;
}) {
  const data = {
    latestSummary: input.latestSummary ?? undefined,
    latestClassification: input.latestClassification ?? undefined,
    latestRecommendation: input.latestRecommendation ?? undefined,
    recommendationWhy: input.recommendationWhy ?? undefined,
    recommendationPriority: input.recommendationPriority ?? undefined,
    approvalNeeded: input.approvalNeeded ?? undefined,
    outboundBlocked: input.outboundBlocked ?? undefined,
    lastApprovalStatus: input.lastApprovalStatus ?? undefined,
    lastDeliveryStatus: input.lastDeliveryStatus ?? undefined,
    lastTaskStatus: input.lastTaskStatus ?? undefined,
    riskFlagsJson: (input.riskFlags || []) as Prisma.InputJsonValue,
    contextJson: (input.context || {}) as Prisma.InputJsonValue,
    updatedByRunId: input.updatedByRunId ?? undefined,
    updatedByUserId: input.updatedByUserId ?? undefined
  };

  return prisma.agentEntityMemory.upsert({
    where: {
      orgId_entityType_entityId: {
        orgId: input.orgId,
        entityType: input.entityType,
        entityId: input.entityId
      }
    },
    update: data,
    create: {
      orgId: input.orgId,
      entityType: input.entityType,
      entityId: input.entityId,
      latestSummary: input.latestSummary || null,
      latestClassification: input.latestClassification || null,
      latestRecommendation: input.latestRecommendation || null,
      recommendationWhy: input.recommendationWhy || null,
      recommendationPriority: input.recommendationPriority || null,
      approvalNeeded: Boolean(input.approvalNeeded),
      outboundBlocked: Boolean(input.outboundBlocked),
      lastApprovalStatus: input.lastApprovalStatus || null,
      lastDeliveryStatus: input.lastDeliveryStatus || null,
      lastTaskStatus: input.lastTaskStatus || null,
      riskFlagsJson: (input.riskFlags || []) as Prisma.InputJsonValue,
      contextJson: (input.context || {}) as Prisma.InputJsonValue,
      updatedByRunId: input.updatedByRunId || null,
      updatedByUserId: input.updatedByUserId || null
    }
  });
}

export async function getEntityMemory(orgId: string, entityType: string, entityId: string) {
  return prisma.agentEntityMemory.findUnique({
    where: {
      orgId_entityType_entityId: {
        orgId,
        entityType,
        entityId
      }
    }
  });
}
