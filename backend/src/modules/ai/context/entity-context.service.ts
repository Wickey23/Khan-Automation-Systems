import { MessageDirection, TaskStatus } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { deriveNextBestAction, getEntityMemory } from "./entity-memory.service";

export type EntityContext = {
  entityType: string;
  entityId: string;
  summary: string;
  payload: Record<string, unknown>;
};

type EntityRef = { entityType: string; entityId: string };

function toEntityRefs(base: EntityRef, linked: EntityRef[]) {
  return [...linked, base].filter((item) => item.entityType && item.entityId);
}

function mapBlockedReasons(input: {
  dnc: boolean;
  latestDeliveryStatus?: string | null;
  pendingApprovalCount: number;
  hasOpenFollowup: boolean;
  overdueTaskCount: number;
  retryableFailedDelivery: boolean;
  hadRecentHandoff: boolean;
}) {
  const reasons: string[] = [];
  if (input.dnc) reasons.push("DNC_BLOCKED");
  if (String(input.latestDeliveryStatus || "").toUpperCase() === "FAILED") reasons.push("FAILED_DELIVERY");
  if (input.retryableFailedDelivery) reasons.push("RETRYABLE_DELIVERY_FAILURE");
  if (input.pendingApprovalCount > 0) reasons.push("PENDING_APPROVAL_EXISTS");
  if (input.hasOpenFollowup) reasons.push("OPEN_FOLLOWUP_EXISTS");
  if (input.overdueTaskCount > 0) reasons.push("OVERDUE_FOLLOWUP");
  if (input.hadRecentHandoff) reasons.push("RECENT_HANDOFF_ACTIVE");
  return reasons;
}

async function loadSharedEntitySignals(input: {
  orgId: string;
  base: EntityRef;
  linked: EntityRef[];
}) {
  const refs = toEntityRefs(input.base, input.linked);
  const whereOr = refs.map((ref) => ({ entityType: ref.entityType, entityId: ref.entityId }));
  const [latestApproval, oldestPendingApproval, pendingApprovalCount, latestTask, openFollowUpCount, overdueTaskCount, recentAudit, recentHandoff] =
    await Promise.all([
      prisma.approvalRequest.findFirst({
        where: { orgId: input.orgId, OR: whereOr },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          entityType: true,
          entityId: true,
          status: true,
          deliveryStatus: true,
          deliveryProvider: true,
          providerMessageId: true,
          failureReason: true,
          retryable: true,
          updatedAt: true
        }
      }),
      prisma.approvalRequest.findFirst({
        where: {
          orgId: input.orgId,
          status: "PENDING",
          OR: whereOr
        },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true }
      }),
      prisma.approvalRequest.count({
        where: {
          orgId: input.orgId,
          status: "PENDING",
          OR: whereOr
        }
      }),
      prisma.task.findFirst({
        where: {
          orgId: input.orgId,
          OR: whereOr
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          entityType: true,
          entityId: true,
          status: true,
          priority: true,
          dueAt: true,
          assignedToUserId: true
        }
      }),
      prisma.followUpQueueItem.count({
        where: { orgId: input.orgId, status: "OPEN", OR: whereOr }
      }),
      prisma.task.count({
        where: {
          orgId: input.orgId,
          OR: whereOr,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] },
          dueAt: { lt: new Date() }
        }
      }),
      prisma.auditLog.findMany({
        where: { orgId: input.orgId, OR: whereOr },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { action: true, createdAt: true, entityType: true, entityId: true }
      }),
      prisma.auditLog.findFirst({
        where: {
          orgId: input.orgId,
          action: "AI_AGENT_HANDOFF",
          OR: whereOr,
          createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true }
      })
    ]);

  return {
    latestApproval,
    pendingApprovalOldestMinutes: oldestPendingApproval
      ? Math.max(0, Math.round((Date.now() - oldestPendingApproval.createdAt.getTime()) / (60 * 1000)))
      : 0,
    pendingApprovalCount,
    latestTask,
    openFollowUpCount,
    overdueTaskCount,
    hadRecentHandoff: Boolean(recentHandoff),
    lastMeaningfulActionAgeMinutes: recentAudit[0]
      ? Math.max(0, Math.round((Date.now() - recentAudit[0].createdAt.getTime()) / (60 * 1000)))
      : 9_999,
    recentAudit: recentAudit.map((row) => ({
      action: row.action,
      at: row.createdAt.toISOString(),
      entityType: row.entityType,
      entityId: row.entityId
    }))
  };
}

async function buildCallContext(orgId: string, entityId: string): Promise<EntityContext | null> {
  const call = await prisma.callLog.findFirst({
    where: { orgId, id: entityId },
    include: {
      lead: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          dnc: true,
          status: true,
          messageThreads: {
            orderBy: { lastMessageAt: "desc" },
            take: 1,
            select: { id: true, lastMessageAt: true, channel: true, contactPhone: true }
          }
        }
      },
      aiSummaries: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });
  if (!call) return null;

  const linked: EntityRef[] = [];
  if (call.lead?.id) linked.push({ entityType: "lead", entityId: call.lead.id });
  if (call.lead?.messageThreads[0]?.id) linked.push({ entityType: "message_thread", entityId: call.lead.messageThreads[0].id });

  const shared = await loadSharedEntitySignals({
    orgId,
    base: { entityType: "call", entityId },
    linked
  });

  const memory = await getEntityMemory(orgId, "call", entityId);
  const latestAi = call.aiSummaries[0] || null;
  const latestUrgency = String((latestAi?.extractedJson as Record<string, unknown> | null)?.urgency || "").toLowerCase() || null;
  const blockedReasons = mapBlockedReasons({
    dnc: call.lead?.dnc || false,
    latestDeliveryStatus: shared.latestApproval?.deliveryStatus,
    pendingApprovalCount: shared.pendingApprovalCount,
    hasOpenFollowup: shared.openFollowUpCount > 0,
    overdueTaskCount: shared.overdueTaskCount,
    retryableFailedDelivery: Boolean(shared.latestApproval?.retryable && shared.latestApproval?.deliveryStatus === "FAILED"),
    hadRecentHandoff: shared.hadRecentHandoff
  });

  const payload = {
    id: call.id,
    fromNumber: call.fromNumber,
    toNumber: call.toNumber,
    outcome: call.outcome,
    durationSec: call.durationSec,
    transcript: String(call.transcript || "").slice(0, 4000),
    linkedLead: call.lead || null,
    linkedThread: call.lead?.messageThreads[0] || null,
    latestSummary: call.aiSummary || latestAi?.summary || null,
    latestUrgency,
    latestIntent: String((latestAi?.extractedJson as Record<string, unknown> | null)?.intent || "") || null,
    latestApprovalStatus: shared.latestApproval?.status || null,
    latestDeliveryStatus: shared.latestApproval?.deliveryStatus || null,
    latestApprovalId: shared.latestApproval?.id || null,
    latestApprovalRetryable: Boolean(shared.latestApproval?.retryable),
    latestApprovalEntityType: shared.latestApproval?.entityType || null,
    pendingApprovalCount: shared.pendingApprovalCount,
    pendingApprovalOldestMinutes: shared.pendingApprovalOldestMinutes,
    openFollowUpCount: shared.openFollowUpCount,
    overdueTaskCount: shared.overdueTaskCount,
    lastMeaningfulActionAgeMinutes: shared.lastMeaningfulActionAgeMinutes,
    latestTask: shared.latestTask,
    latestTaskId: shared.latestTask?.id || null,
    latestTaskStatus: shared.latestTask?.status || null,
    dnc: call.lead?.dnc || false,
    blockedReasons,
    recentAudit: shared.recentAudit,
    memory
  };
  const recommendation = deriveNextBestAction({ entityType: "call", contextPayload: payload });

  return {
    entityType: "call",
    entityId,
    summary: `Call ${call.id} from ${call.fromNumber}. Outcome: ${call.outcome}.`,
    payload: { ...payload, nextBestAction: recommendation }
  };
}

async function buildLeadContext(orgId: string, entityId: string): Promise<EntityContext | null> {
  const lead = await prisma.lead.findFirst({
    where: { orgId, id: entityId },
    include: {
      pipelineRecords: { orderBy: { updatedAt: "desc" }, take: 1 },
      messageThreads: {
        orderBy: { lastMessageAt: "desc" },
        take: 1,
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 2 }
        }
      },
      sourceCallLog: {
        select: { id: true, fromNumber: true, outcome: true, createdAt: true, aiSummary: true }
      }
    }
  });
  if (!lead) return null;

  const linked: EntityRef[] = [];
  if (lead.sourceCallLog?.id) linked.push({ entityType: "call", entityId: lead.sourceCallLog.id });
  if (lead.messageThreads[0]?.id) linked.push({ entityType: "message_thread", entityId: lead.messageThreads[0].id });

  const shared = await loadSharedEntitySignals({
    orgId,
    base: { entityType: "lead", entityId },
    linked
  });
  const memory = await getEntityMemory(orgId, "lead", entityId);
  const latestPipeline = lead.pipelineRecords[0] || null;
  const blockedReasons = mapBlockedReasons({
    dnc: lead.dnc,
    latestDeliveryStatus: shared.latestApproval?.deliveryStatus,
    pendingApprovalCount: shared.pendingApprovalCount,
    hasOpenFollowup: shared.openFollowUpCount > 0,
    overdueTaskCount: shared.overdueTaskCount,
    retryableFailedDelivery: Boolean(shared.latestApproval?.retryable && shared.latestApproval?.deliveryStatus === "FAILED"),
    hadRecentHandoff: shared.hadRecentHandoff
  });

  const latestThread = lead.messageThreads[0] || null;
  const payload = {
    id: lead.id,
    name: lead.name,
    business: lead.business,
    email: lead.email,
    phone: lead.phone,
    leadStatus: lead.status,
    message: lead.message,
    serviceRequested: lead.serviceRequested,
    urgency: lead.urgency,
    dnc: lead.dnc,
    latestLeadScore: latestPipeline?.confidence ? Math.round(latestPipeline.confidence * 100) : 0,
    latestPipelineStage: latestPipeline?.stage || lead.pipelineStage,
    latestSummary: latestPipeline?.summary || null,
    latestApprovalStatus: shared.latestApproval?.status || null,
    latestDeliveryStatus: shared.latestApproval?.deliveryStatus || null,
    latestApprovalId: shared.latestApproval?.id || null,
    latestApprovalRetryable: Boolean(shared.latestApproval?.retryable),
    latestApprovalEntityType: shared.latestApproval?.entityType || null,
    pendingApprovalCount: shared.pendingApprovalCount,
    pendingApprovalOldestMinutes: shared.pendingApprovalOldestMinutes,
    openFollowUpCount: shared.openFollowUpCount,
    overdueTaskCount: shared.overdueTaskCount,
    lastMeaningfulActionAgeMinutes: shared.lastMeaningfulActionAgeMinutes,
    latestTask: shared.latestTask,
    latestTaskId: shared.latestTask?.id || null,
    latestTaskStatus: shared.latestTask?.status || null,
    blockedReasons,
    latestThread: latestThread
      ? {
          id: latestThread.id,
          contactPhone: latestThread.contactPhone,
          lastInbound: latestThread.messages.find((item) => item.direction === MessageDirection.INBOUND)?.body || null,
          lastOutbound: latestThread.messages.find((item) => item.direction === MessageDirection.OUTBOUND)?.body || null
        }
      : null,
    latestSourceCall: lead.sourceCallLog || null,
    recentAudit: shared.recentAudit,
    memory
  };
  const recommendation = deriveNextBestAction({ entityType: "lead", contextPayload: payload });
  return {
    entityType: "lead",
    entityId,
    summary: `Lead ${lead.name || lead.phone || lead.id} in stage ${lead.pipelineStage}.`,
    payload: { ...payload, nextBestAction: recommendation }
  };
}

async function buildMessageThreadContext(orgId: string, entityId: string): Promise<EntityContext | null> {
  const thread = await prisma.messageThread.findFirst({
    where: { orgId, id: entityId },
    include: {
      lead: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          dnc: true,
          status: true,
          sourceCallLog: {
            select: { id: true, fromNumber: true, outcome: true, createdAt: true }
          }
        }
      },
      messages: { orderBy: { createdAt: "desc" }, take: 12 },
      classifications: { orderBy: { createdAt: "desc" }, take: 1 },
      aiSummaries: { orderBy: { createdAt: "desc" }, take: 1 }
    }
  });
  if (!thread) return null;

  const linked: EntityRef[] = [];
  if (thread.lead?.id) linked.push({ entityType: "lead", entityId: thread.lead.id });
  if (thread.lead?.sourceCallLog?.id) linked.push({ entityType: "call", entityId: thread.lead.sourceCallLog.id });

  const shared = await loadSharedEntitySignals({
    orgId,
    base: { entityType: "message_thread", entityId },
    linked
  });
  const memory = await getEntityMemory(orgId, "message_thread", entityId);
  const latestInbound = thread.messages.find((message) => message.direction === MessageDirection.INBOUND) || null;
  const latestOutbound = thread.messages.find((message) => message.direction === MessageDirection.OUTBOUND) || null;
  const latestClassification = thread.classifications[0]?.classification || thread.aiSummaries[0]?.classification || null;
  const blockedReasons = mapBlockedReasons({
    dnc: thread.lead?.dnc || false,
    latestDeliveryStatus: shared.latestApproval?.deliveryStatus,
    pendingApprovalCount: shared.pendingApprovalCount,
    hasOpenFollowup: shared.openFollowUpCount > 0,
    overdueTaskCount: shared.overdueTaskCount,
    retryableFailedDelivery: Boolean(shared.latestApproval?.retryable && shared.latestApproval?.deliveryStatus === "FAILED"),
    hadRecentHandoff: shared.hadRecentHandoff
  });

  const payload = {
    id: thread.id,
    contactName: thread.contactName,
    contactPhone: thread.contactPhone,
    channel: thread.channel,
    linkedLead: thread.lead || null,
    linkedSourceCall: thread.lead?.sourceCallLog || null,
    latestInbound,
    latestOutbound,
    latestClassification,
    latestSummary: thread.aiSummaries[0]?.summary || null,
    latestApprovalStatus: shared.latestApproval?.status || null,
    latestDeliveryStatus: shared.latestApproval?.deliveryStatus || null,
    latestApprovalId: shared.latestApproval?.id || null,
    latestApprovalRetryable: Boolean(shared.latestApproval?.retryable),
    latestApprovalEntityType: shared.latestApproval?.entityType || null,
    pendingApprovalCount: shared.pendingApprovalCount,
    pendingApprovalOldestMinutes: shared.pendingApprovalOldestMinutes,
    openFollowUpCount: shared.openFollowUpCount,
    overdueTaskCount: shared.overdueTaskCount,
    lastMeaningfulActionAgeMinutes: shared.lastMeaningfulActionAgeMinutes,
    latestTask: shared.latestTask,
    latestTaskId: shared.latestTask?.id || null,
    latestTaskStatus: shared.latestTask?.status || null,
    dnc: thread.lead?.dnc || false,
    blockedReasons,
    recentAudit: shared.recentAudit,
    memory
  };
  const recommendation = deriveNextBestAction({ entityType: "message_thread", contextPayload: payload });
  return {
    entityType: "message_thread",
    entityId,
    summary: `Thread with ${thread.contactPhone} (${thread.channel}).`,
    payload: {
      ...payload,
      messages: thread.messages,
      nextBestAction: recommendation
    }
  };
}

export async function buildEntityContext(input: {
  orgId: string;
  entityType?: string;
  entityId?: string;
}): Promise<EntityContext | null> {
  const entityType = String(input.entityType || "").trim();
  const entityId = String(input.entityId || "").trim();
  if (!entityType || !entityId) return null;

  if (entityType === "call") return buildCallContext(input.orgId, entityId);
  if (entityType === "lead") return buildLeadContext(input.orgId, entityId);
  if (entityType === "message_thread") return buildMessageThreadContext(input.orgId, entityId);

  if (entityType === "appointment") {
    const appointment = await prisma.appointment.findFirst({
      where: { orgId: input.orgId, id: entityId },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        issueSummary: true,
        status: true,
        startAt: true,
        endAt: true,
        assignedTechnician: true
      }
    });
    if (!appointment) return null;
    const shared = await loadSharedEntitySignals({
      orgId: input.orgId,
      base: { entityType: "appointment", entityId },
      linked: []
    });
    const memory = await getEntityMemory(input.orgId, "appointment", entityId);
    return {
      entityType,
      entityId,
      summary: `Appointment ${appointment.id} for ${appointment.customerName || appointment.customerPhone}.`,
      payload: {
        ...appointment,
        latestApprovalStatus: shared.latestApproval?.status || null,
        latestDeliveryStatus: shared.latestApproval?.deliveryStatus || null,
        latestApprovalId: shared.latestApproval?.id || null,
        latestApprovalRetryable: Boolean(shared.latestApproval?.retryable),
        pendingApprovalCount: shared.pendingApprovalCount,
        pendingApprovalOldestMinutes: shared.pendingApprovalOldestMinutes,
        openFollowUpCount: shared.openFollowUpCount,
        overdueTaskCount: shared.overdueTaskCount,
        lastMeaningfulActionAgeMinutes: shared.lastMeaningfulActionAgeMinutes,
        recentAudit: shared.recentAudit,
        latestTask: shared.latestTask,
        latestTaskId: shared.latestTask?.id || null,
        latestTaskStatus: shared.latestTask?.status || null,
        blockedReasons: mapBlockedReasons({
          dnc: false,
          latestDeliveryStatus: shared.latestApproval?.deliveryStatus,
          pendingApprovalCount: shared.pendingApprovalCount,
          hasOpenFollowup: shared.openFollowUpCount > 0,
          overdueTaskCount: shared.overdueTaskCount,
          retryableFailedDelivery: Boolean(shared.latestApproval?.retryable && shared.latestApproval?.deliveryStatus === "FAILED"),
          hadRecentHandoff: shared.hadRecentHandoff
        }),
        memory
      }
    };
  }

  return null;
}
