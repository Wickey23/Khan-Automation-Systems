import { prisma } from "../../../lib/prisma";

export type OperationsEventStatus = "info" | "success" | "warning" | "critical";

export type OperationsFeedEvent = {
  id: string;
  eventType: string;
  title: string;
  summary: string;
  status: OperationsEventStatus;
  createdAt: string;
  entityType: string | null;
  entityId: string | null;
  href: string | null;
  metadata: Record<string, unknown>;
};

type OperationsFeedInput = {
  orgId: string;
  limit?: number;
  filter?: string;
};

type ScoredEvent = OperationsFeedEvent & {
  priorityScore: number;
  rankReason: string;
};

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function toHref(entityType: string | null, entityId: string | null) {
  if (!entityType || !entityId) return null;
  if (entityType === "call") return `/app/calls?callId=${encodeURIComponent(entityId)}&source=dashboard`;
  if (entityType === "lead") return `/app/leads?leadId=${encodeURIComponent(entityId)}&source=dashboard`;
  if (entityType === "message_thread") return `/app/messages?threadId=${encodeURIComponent(entityId)}&source=dashboard`;
  if (entityType === "approval_request") return `/app/approvals?approvalId=${encodeURIComponent(entityId)}&source=dashboard`;
  if (entityType === "follow_up_queue_item") return `/app/follow-up?queueItemId=${encodeURIComponent(entityId)}&source=dashboard`;
  if (entityType === "task") return `/app/follow-up?taskId=${encodeURIComponent(entityId)}&source=dashboard`;
  if (entityType === "appointment_request") return `/app/appointments?requestId=${encodeURIComponent(entityId)}&source=dashboard`;
  return null;
}

function scoreEvent(event: OperationsFeedEvent) {
  const now = Date.now();
  const ageMinutes = Math.max(0, Math.round((now - new Date(event.createdAt).getTime()) / 60000));
  const recencyBoost = ageMinutes < 15 ? 30 : ageMinutes < 60 ? 20 : ageMinutes < 240 ? 10 : 0;
  const baseByStatus =
    event.status === "critical" ? 100 : event.status === "warning" ? 70 : event.status === "success" ? 40 : 25;
  const baseByType =
    event.eventType.includes("approval")
      ? 30
      : event.eventType.includes("delivery") || event.eventType.includes("retry")
        ? 35
        : event.eventType.includes("handoff")
          ? 20
          : event.eventType.includes("attention")
            ? 25
            : event.eventType.includes("follow_up") || event.eventType.includes("task")
              ? 20
              : 10;
  return baseByStatus + baseByType + recencyBoost;
}

function fromApproval(approval: {
  id: string;
  toolKey: string;
  status: string;
  deliveryStatus: string | null;
  entityType: string | null;
  entityId: string | null;
  outputSummary: string | null;
  failureReason: string | null;
  retryable: boolean;
  retryCount: number;
  updatedAt: Date;
}) {
  const delivery = approval.deliveryStatus || "PENDING";
  if (approval.status === "PENDING") {
    return {
      eventType: "approval_pending",
      title: "Approval pending",
      summary: `${approval.toolKey} is waiting for operator decision.`,
      status: "warning" as const
    };
  }
  if (approval.status === "REJECTED") {
    return {
      eventType: "approval_rejected",
      title: "Approval rejected",
      summary: `${approval.toolKey} was rejected by an operator.`,
      status: "info" as const
    };
  }
  if (delivery === "FAILED") {
    return {
      eventType: approval.retryCount > 0 ? "retry_delivery_failed" : "delivery_failed",
      title: approval.retryCount > 0 ? "Retry send failed" : "Outbound send failed",
      summary: approval.failureReason || `${approval.toolKey} failed to deliver.`,
      status: "critical" as const
    };
  }
  if (delivery === "SENT") {
    return {
      eventType: approval.retryCount > 0 ? "retry_delivery_sent" : "delivery_sent",
      title: approval.retryCount > 0 ? "Retry send succeeded" : "Outbound sent",
      summary: approval.outputSummary || `${approval.toolKey} delivered successfully.`,
      status: "success" as const
    };
  }
  return {
    eventType: "approval_updated",
    title: "Approval updated",
    summary: `${approval.toolKey} is ${delivery.toLowerCase()}.`,
    status: approval.retryable ? ("warning" as const) : ("info" as const)
  };
}

export async function buildOperationsFeed(input: OperationsFeedInput) {
  const limit = Math.max(1, Math.min(50, input.limit || 20));
  const filter = String(input.filter || "").trim().toLowerCase();

  const [approvals, handoffs, memories, followUps, taskAudits, calls, messages, appointments] = await Promise.all([
    prisma.approvalRequest.findMany({
      where: { orgId: input.orgId },
      orderBy: { updatedAt: "desc" },
      take: Math.max(limit * 3, 30)
    }),
    prisma.agentActionLog.findMany({
      where: {
        orgId: input.orgId,
        actionType: "AGENT_HANDOFF"
      },
      orderBy: { createdAt: "desc" },
      take: Math.max(limit * 2, 20)
    }),
    prisma.agentEntityMemory.findMany({
      where: { orgId: input.orgId },
      orderBy: { updatedAt: "desc" },
      take: Math.max(limit * 2, 20)
    }),
    prisma.followUpQueueItem.findMany({
      where: {
        orgId: input.orgId,
        status: { in: ["OPEN", "IN_PROGRESS"] }
      },
      include: { task: true },
      orderBy: { updatedAt: "desc" },
      take: Math.max(limit * 2, 20)
    }),
    prisma.auditLog.findMany({
      where: {
        orgId: input.orgId,
        action: { in: ["AI_TASK_UPDATED", "AI_FOLLOWUP_STATUS_UPDATED"] }
      },
      orderBy: { createdAt: "desc" },
      take: Math.max(limit * 2, 20)
    }),
    prisma.callLog.findMany({
      where: {
        orgId: input.orgId,
        outcome: { in: ["MISSED", "ABANDONED"] }
      },
      orderBy: { createdAt: "desc" },
      take: Math.max(limit, 10)
    }),
    prisma.message.findMany({
      where: {
        orgId: input.orgId,
        status: { in: ["FAILED", "SENT", "DELIVERED"] }
      },
      orderBy: { updatedAt: "desc" },
      take: Math.max(limit, 10)
    }),
    prisma.appointmentRequest.findMany({
      where: {
        orgId: input.orgId,
        status: { in: ["PENDING_REVIEW", "SCHEDULED"] }
      },
      orderBy: { lastEventAt: "desc" },
      take: Math.max(limit, 10)
    })
  ]);

  const events: ScoredEvent[] = [];
  const seen = new Set<string>();
  function pushEvent(event: OperationsFeedEvent, reason: string) {
    const dedupe = `${event.eventType}:${event.entityType || "-"}:${event.entityId || "-"}:${event.title}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    const priorityScore = scoreEvent(event);
    events.push({ ...event, priorityScore, rankReason: reason });
  }

  for (const approval of approvals) {
    const base = fromApproval(approval);
    pushEvent(
      {
        id: `approval-${approval.id}`,
        eventType: base.eventType,
        title: base.title,
        summary: base.summary,
        status: base.status,
        createdAt: approval.updatedAt.toISOString(),
        entityType: approval.entityType || "approval_request",
        entityId: approval.entityId || approval.id,
        href: `/app/approvals?approvalId=${encodeURIComponent(approval.id)}&source=dashboard`,
        metadata: {
          toolKey: approval.toolKey,
          approvalStatus: approval.status,
          deliveryStatus: approval.deliveryStatus,
          retryable: approval.retryable,
          retryCount: approval.retryCount
        }
      },
      "approval"
    );
  }

  for (const handoff of handoffs) {
    const metadata = parseJsonObject(handoff.metadataJson) || {};
    const sourceAgent = asString(metadata.fromAgent) || "agent";
    const targetAgent = asString(metadata.toAgent) || "agent";
    const targetTool = asString(metadata.handoffToolKey) || handoff.toolKey || "tool";
    const suppressed = Boolean(metadata.suppressed);
    pushEvent(
      {
        id: `handoff-${handoff.id}`,
        eventType: suppressed ? "handoff_suppressed" : "handoff_executed",
        title: suppressed ? "AI handoff suppressed" : "AI handoff executed",
        summary: `${sourceAgent} -> ${targetAgent} via ${targetTool}${suppressed ? " (suppressed)" : ""}.`,
        status: suppressed ? "warning" : "info",
        createdAt: handoff.createdAt.toISOString(),
        entityType: handoff.entityType,
        entityId: handoff.entityId,
        href: toHref(handoff.entityType, handoff.entityId),
        metadata: {
          sourceAgent,
          targetAgent,
          targetTool,
          suppressed,
          reason: asString(metadata.handoffReason),
          targetResultSummary: asString(metadata.targetResultSummary)
        }
      },
      "handoff"
    );
  }

  for (const memory of memories) {
    const context = parseJsonObject(memory.contextJson) || {};
    const attention = parseJsonObject(context.attention);
    const level = asString(attention?.attentionLevel);
    if (level !== "CRITICAL" && level !== "HIGH") continue;
    const topReasons = Array.isArray(attention?.topReasons)
      ? attention?.topReasons.filter((reason): reason is string => typeof reason === "string")
      : [];
    pushEvent(
      {
        id: `attention-${memory.id}`,
        eventType: "high_attention_entity",
        title: level === "CRITICAL" ? "Critical entity attention" : "High entity attention",
        summary: topReasons[0] || memory.latestRecommendation || "Entity requires operator attention.",
        status: level === "CRITICAL" ? "critical" : "warning",
        createdAt: memory.updatedAt.toISOString(),
        entityType: memory.entityType,
        entityId: memory.entityId,
        href: toHref(memory.entityType, memory.entityId),
        metadata: {
          attentionLevel: level,
          attentionScore: typeof attention?.attentionScore === "number" ? attention.attentionScore : null,
          recommendation: memory.latestRecommendation,
          blocked: memory.outboundBlocked
        }
      },
      "attention"
    );
  }

  for (const followUp of followUps) {
    const overdue = Boolean(followUp.task?.dueAt && followUp.task.dueAt.getTime() < Date.now());
    pushEvent(
      {
        id: `followup-${followUp.id}`,
        eventType: overdue ? "follow_up_overdue" : "follow_up_open",
        title: overdue ? "Follow-up overdue" : "Follow-up open",
        summary: followUp.task?.title || followUp.reason,
        status: overdue ? "warning" : "info",
        createdAt: followUp.updatedAt.toISOString(),
        entityType: followUp.entityType || followUp.task?.entityType || "follow_up_queue_item",
        entityId: followUp.entityId || followUp.task?.entityId || followUp.id,
        href: `/app/follow-up?queueItemId=${encodeURIComponent(followUp.id)}&source=dashboard`,
        metadata: {
          queueStatus: followUp.status,
          taskStatus: followUp.task?.status || null,
          dueAt: followUp.task?.dueAt?.toISOString() || null
        }
      },
      "follow_up"
    );
  }

  for (const audit of taskAudits) {
    const metadata = parseJsonObject(audit.metadataJson) || {};
    pushEvent(
      {
        id: `audit-${audit.id}`,
        eventType: String(audit.action || "").toLowerCase(),
        title: audit.action === "AI_TASK_UPDATED" ? "Task status changed" : "Follow-up status changed",
        summary:
          asString(metadata.after && parseJsonObject(metadata.after)?.status) ||
          asString(metadata.interventionType) ||
          "Operator updated task/follow-up state.",
        status: "info",
        createdAt: audit.createdAt.toISOString(),
        entityType: audit.entityType,
        entityId: audit.entityId,
        href: toHref(audit.entityType, audit.entityId),
        metadata
      },
      "audit"
    );
  }

  for (const call of calls) {
    pushEvent(
      {
        id: `call-${call.id}`,
        eventType: "missed_call",
        title: "Missed call requires review",
        summary: call.aiSummary || call.transcript || `Call from ${call.fromNumber} was ${call.outcome.toLowerCase()}.`,
        status: "warning",
        createdAt: call.createdAt.toISOString(),
        entityType: "call",
        entityId: call.id,
        href: `/app/calls?callId=${encodeURIComponent(call.id)}&source=dashboard`,
        metadata: {
          outcome: call.outcome,
          fromNumber: call.fromNumber
        }
      },
      "call"
    );
  }

  for (const message of messages) {
    const failed = message.status === "FAILED";
    pushEvent(
      {
        id: `message-${message.id}`,
        eventType: failed ? "outbound_message_failed" : "outbound_message_sent",
        title: failed ? "Message delivery failed" : "Message delivered",
        summary: failed ? message.errorText || "Outbound message failed to deliver." : "Outbound message status updated.",
        status: failed ? "critical" : "success",
        createdAt: message.updatedAt.toISOString(),
        entityType: "message_thread",
        entityId: message.threadId,
        href: `/app/messages?threadId=${encodeURIComponent(message.threadId)}&source=dashboard`,
        metadata: {
          messageStatus: message.status,
          direction: message.direction,
          provider: message.provider
        }
      },
      "message"
    );
  }

  for (const appointment of appointments) {
    pushEvent(
      {
        id: `appointment-${appointment.id}`,
        eventType: appointment.status === "PENDING_REVIEW" ? "booking_pending_review" : "booking_scheduled",
        title: appointment.status === "PENDING_REVIEW" ? "Booking needs review" : "Booking scheduled",
        summary: `${appointment.customerName || "Customer"} booking is ${appointment.status.toLowerCase().replace(/_/g, " ")}.`,
        status: appointment.status === "PENDING_REVIEW" ? "warning" : "success",
        createdAt: appointment.lastEventAt.toISOString(),
        entityType: "appointment_request",
        entityId: appointment.id,
        href: `/app/appointments?requestId=${encodeURIComponent(appointment.id)}&source=dashboard`,
        metadata: {
          appointmentStatus: appointment.status
        }
      },
      "booking"
    );
  }

  const filtered = filter
    ? events.filter((event) => {
        const haystack = `${event.eventType} ${event.title} ${event.summary} ${event.status}`.toLowerCase();
        return haystack.includes(filter);
      })
    : events;

  return filtered
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, limit)
    .map(({ priorityScore, rankReason, ...event }) => ({
      ...event,
      metadata: {
        ...event.metadata,
        priorityScore,
        rankReason
      }
    }));
}
