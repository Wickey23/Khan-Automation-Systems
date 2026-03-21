import { MessageDirection, TaskStatus } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { deriveNextBestAction, getEntityMemory } from "./entity-memory.service";

export type EntityContext = {
  entityType: string;
  entityId: string;
  summary: string;
  payload: Record<string, unknown>;
};

function mapRiskFlags(input: {
  dnc?: boolean;
  overdueTaskCount?: number;
  latestDeliveryStatus?: string | null;
  latestUrgency?: string | null;
}) {
  const flags: string[] = [];
  if (input.dnc) flags.push("DNC_BLOCKED");
  if ((input.overdueTaskCount || 0) > 0) flags.push("OVERDUE_TASKS");
  if (String(input.latestDeliveryStatus || "").toUpperCase() === "FAILED") flags.push("FAILED_DELIVERY");
  if (String(input.latestUrgency || "").toLowerCase() === "high") flags.push("URGENT");
  return flags;
}

async function loadSharedEntitySignals(orgId: string, entityType: string, entityId: string) {
  const [latestApproval, openFollowUpCount, latestTask, recentAudit, memory] = await Promise.all([
    prisma.approvalRequest.findFirst({
      where: { orgId, entityType, entityId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        deliveryStatus: true,
        deliveryProvider: true,
        providerMessageId: true,
        failureReason: true,
        retryable: true,
        updatedAt: true
      }
    }),
    prisma.followUpQueueItem.count({
      where: { orgId, entityType, entityId, status: "OPEN" }
    }),
    prisma.task.findFirst({
      where: {
        orgId,
        entityType,
        entityId
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        priority: true,
        dueAt: true,
        assignedToUserId: true
      }
    }),
    prisma.auditLog.findMany({
      where: { orgId, entityType, entityId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { action: true, createdAt: true }
    }),
    getEntityMemory(orgId, entityType, entityId)
  ]);

  const overdueTaskCount = await prisma.task.count({
    where: {
      orgId,
      entityType,
      entityId,
      status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] },
      dueAt: { lt: new Date() }
    }
  });

  return {
    latestApproval,
    latestTask,
    openFollowUpCount,
    overdueTaskCount,
    recentAudit: recentAudit.map((row) => ({ action: row.action, at: row.createdAt.toISOString() })),
    memory
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

  if (entityType === "call") {
    const call = await prisma.callLog.findFirst({
      where: { orgId: input.orgId, id: entityId },
      include: {
        lead: { select: { id: true, name: true, phone: true, email: true, dnc: true, status: true } },
        aiSummaries: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });
    if (!call) return null;

    const shared = await loadSharedEntitySignals(input.orgId, entityType, entityId);
    const latestAi = call.aiSummaries[0] || null;
    const latestUrgency = String((latestAi?.extractedJson as Record<string, unknown> | null)?.urgency || "").toLowerCase() || null;
    const blockedReasons = mapRiskFlags({
      dnc: call.lead?.dnc || false,
      overdueTaskCount: shared.overdueTaskCount,
      latestDeliveryStatus: shared.latestApproval?.deliveryStatus,
      latestUrgency
    });

    const basePayload = {
      id: call.id,
      fromNumber: call.fromNumber,
      toNumber: call.toNumber,
      outcome: call.outcome,
      durationSec: call.durationSec,
      transcript: String(call.transcript || "").slice(0, 4000),
      lead: call.lead,
      latestSummary: call.aiSummary || latestAi?.summary || null,
      latestUrgency,
      latestIntent: String((latestAi?.extractedJson as Record<string, unknown> | null)?.intent || "") || null,
      latestApprovalStatus: shared.latestApproval?.status || null,
      latestDeliveryStatus: shared.latestApproval?.deliveryStatus || null,
      openFollowUpCount: shared.openFollowUpCount,
      overdueTaskCount: shared.overdueTaskCount,
      dnc: call.lead?.dnc || false,
      blockedReasons,
      recentAudit: shared.recentAudit,
      latestTask: shared.latestTask,
      latestTaskStatus: shared.latestTask?.status || null,
      memory: shared.memory
    };

    const recommendation = deriveNextBestAction({ entityType, contextPayload: basePayload });
    return {
      entityType,
      entityId,
      summary: `Call ${call.id} from ${call.fromNumber}. Outcome: ${call.outcome}.`,
      payload: {
        ...basePayload,
        nextBestAction: recommendation
      }
    };
  }

  if (entityType === "message_thread") {
    const thread = await prisma.messageThread.findFirst({
      where: { orgId: input.orgId, id: entityId },
      include: {
        lead: { select: { id: true, name: true, phone: true, email: true, dnc: true, status: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 12 },
        classifications: { orderBy: { createdAt: "desc" }, take: 1 },
        aiSummaries: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });
    if (!thread) return null;

    const shared = await loadSharedEntitySignals(input.orgId, entityType, entityId);
    const latestInbound = thread.messages.find((message) => message.direction === MessageDirection.INBOUND) || null;
    const latestOutbound = thread.messages.find((message) => message.direction === MessageDirection.OUTBOUND) || null;
    const latestClassification = thread.classifications[0]?.classification || thread.aiSummaries[0]?.classification || null;
    const blockedReasons = mapRiskFlags({
      dnc: thread.lead?.dnc || false,
      overdueTaskCount: shared.overdueTaskCount,
      latestDeliveryStatus: shared.latestApproval?.deliveryStatus
    });

    const basePayload = {
      id: thread.id,
      contactName: thread.contactName,
      contactPhone: thread.contactPhone,
      channel: thread.channel,
      lead: thread.lead,
      latestInbound,
      latestOutbound,
      latestClassification,
      latestSummary: thread.aiSummaries[0]?.summary || null,
      latestApprovalStatus: shared.latestApproval?.status || null,
      latestDeliveryStatus: shared.latestApproval?.deliveryStatus || null,
      openFollowUpCount: shared.openFollowUpCount,
      overdueTaskCount: shared.overdueTaskCount,
      dnc: thread.lead?.dnc || false,
      blockedReasons,
      recentAudit: shared.recentAudit,
      latestTask: shared.latestTask,
      latestTaskStatus: shared.latestTask?.status || null,
      memory: shared.memory
    };
    const recommendation = deriveNextBestAction({ entityType, contextPayload: basePayload });

    return {
      entityType,
      entityId,
      summary: `Thread with ${thread.contactPhone} (${thread.channel}).`,
      payload: {
        ...basePayload,
        messages: thread.messages,
        nextBestAction: recommendation
      }
    };
  }

  if (entityType === "lead") {
    const lead = await prisma.lead.findFirst({
      where: { orgId: input.orgId, id: entityId },
      include: {
        pipelineRecords: { orderBy: { updatedAt: "desc" }, take: 1 },
        messageThreads: { orderBy: { updatedAt: "desc" }, take: 1 },
        sourceCallLog: { select: { id: true, outcome: true, fromNumber: true, createdAt: true } }
      }
    });
    if (!lead) return null;

    const shared = await loadSharedEntitySignals(input.orgId, entityType, entityId);
    const latestPipeline = lead.pipelineRecords[0] || null;
    const blockedReasons = mapRiskFlags({
      dnc: lead.dnc,
      overdueTaskCount: shared.overdueTaskCount,
      latestDeliveryStatus: shared.latestApproval?.deliveryStatus
    });
    const basePayload = {
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
      openFollowUpCount: shared.openFollowUpCount,
      overdueTaskCount: shared.overdueTaskCount,
      blockedReasons,
      latestMessageThreadId: lead.messageThreads[0]?.id || null,
      latestSourceCallId: lead.sourceCallLog?.id || null,
      recentAudit: shared.recentAudit,
      latestTask: shared.latestTask,
      latestTaskStatus: shared.latestTask?.status || null,
      memory: shared.memory
    };
    const recommendation = deriveNextBestAction({ entityType, contextPayload: basePayload });

    return {
      entityType,
      entityId,
      summary: `Lead ${lead.name || lead.phone || lead.id} in stage ${lead.pipelineStage}.`,
      payload: {
        ...basePayload,
        nextBestAction: recommendation
      }
    };
  }

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
    const shared = await loadSharedEntitySignals(input.orgId, entityType, entityId);
    return {
      entityType,
      entityId,
      summary: `Appointment ${appointment.id} for ${appointment.customerName || appointment.customerPhone}.`,
      payload: {
        ...appointment,
        latestApprovalStatus: shared.latestApproval?.status || null,
        latestDeliveryStatus: shared.latestApproval?.deliveryStatus || null,
        openFollowUpCount: shared.openFollowUpCount,
        overdueTaskCount: shared.overdueTaskCount,
        recentAudit: shared.recentAudit,
        latestTask: shared.latestTask,
        latestTaskStatus: shared.latestTask?.status || null,
        memory: shared.memory
      }
    };
  }

  return null;
}
