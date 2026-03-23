import { UserRole } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAnyRole, requireAuth, type AuthenticatedRequest } from "../../middleware/require-auth";
import {
  aiApprovalDecisionSchema,
  aiAttentionQuerySchema,
  aiApprovalRetrySchema,
  aiFollowUpQueueUpdateSchema,
  aiQuerySchema,
  aiRetryRunSchema,
  aiRunCreateSchema,
  aiTaskUpdateSchema,
  aiTimelineParamsSchema,
  aiToolExecuteSchema
} from "./ai.schema";
import { decideApproval, retryApprovalDelivery } from "./approvals/approval.service";
import { buildAttentionQueue, type AttentionLevel } from "./context/entity-attention.service";
import { buildOperationsFeed } from "./context/operations-feed.service";
import { refreshEntityOperationalMemory } from "./context/entity-state-refresh.service";
import { createAiRun } from "./orchestrator/orchestrator.service";
import { fetchRegistryForOrg } from "./registry/agent-registry.service";
import { executeTool } from "./tools/execution/tool-execution.service";

export const aiRouter = Router();

aiRouter.use(requireAuth, requireAnyRole([UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF]));

async function resolveOrgId(req: AuthenticatedRequest) {
  if (req.auth?.orgId) return req.auth.orgId;
  const user = await prisma.user.findUnique({ where: { id: req.auth?.userId }, select: { orgId: true } });
  return user?.orgId || null;
}

function guardFeatureEnabled() {
  return String(process.env.FEATURE_AI_OPS_ENABLED || "false").toLowerCase() === "true";
}

function parseMetadata(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

aiRouter.use(async (req, res, next) => {
  if (!guardFeatureEnabled()) {
    return res.status(404).json({ ok: false, message: "AI ops is disabled." });
  }
  return next();
});

aiRouter.get("/registry", async (req: AuthenticatedRequest, res) => {
  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });
  const registry = await fetchRegistryForOrg(orgId);
  return res.json({ ok: true, data: { registry } });
});

aiRouter.post("/runs", async (req: AuthenticatedRequest, res) => {
  const parsed = aiRunCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid run payload." });

  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  try {
    const data = await createAiRun({
      context: {
        orgId,
        actorUserId: req.auth!.userId,
        actorRole: req.auth!.role,
        page: parsed.data.page,
        entityType: parsed.data.entityType,
        entityId: parsed.data.entityId,
        idempotencyKey: parsed.data.idempotencyKey
      },
      payload: parsed.data
    });

    return res.json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error instanceof Error ? error.message : "AI_RUN_FAILED" });
  }
});

aiRouter.get("/runs/:id", async (req: AuthenticatedRequest, res) => {
  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  const run = await prisma.agentRun.findFirst({
    where: { id: req.params.id, orgId },
    include: { actionLogs: { orderBy: { createdAt: "asc" } } }
  });

  if (!run) return res.status(404).json({ ok: false, message: "Run not found." });
  return res.json({ ok: true, data: run });
});

aiRouter.post("/runs/:id/retry", async (req: AuthenticatedRequest, res) => {
  const parsed = aiRetryRunSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid retry payload." });

  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  const prior = await prisma.agentRun.findFirst({ where: { id: req.params.id, orgId } });
  if (!prior) return res.status(404).json({ ok: false, message: "Run not found." });
  if (prior.status === "RUNNING") return res.status(409).json({ ok: false, message: "Run is already running." });

  const retried = await createAiRun({
    context: {
      orgId,
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      entityType: prior.entityType || undefined,
      entityId: prior.entityId || undefined,
      idempotencyKey: parsed.data.idempotencyKey
    },
    payload: {
      prompt: prior.inputSummary || "Retry previous AI request",
      entityType: prior.entityType || undefined,
      entityId: prior.entityId || undefined
    }
  });

  return res.json({ ok: true, data: retried });
});

aiRouter.get("/approvals", async (req: AuthenticatedRequest, res) => {
  const queryParsed = aiQuerySchema.safeParse(req.query);
  if (!queryParsed.success) return res.status(400).json({ ok: false, message: "Invalid query." });

  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  const approvals = await prisma.approvalRequest.findMany({
    where: {
      orgId,
      ...(queryParsed.data.status ? { status: queryParsed.data.status as never } : {})
    },
    include: {
      actions: { orderBy: { createdAt: "asc" } },
      requestedByUser: { select: { id: true, email: true } }
    },
    orderBy: { createdAt: "desc" },
    take: queryParsed.data.limit
  });

  return res.json({ ok: true, data: { approvals } });
});

aiRouter.post("/approvals/:id/approve", async (req: AuthenticatedRequest, res) => {
  const parsed = aiApprovalDecisionSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid approval payload." });

  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  try {
    const updated = await decideApproval({
      orgId,
      approvalRequestId: req.params.id,
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      decision: "APPROVED",
      note: parsed.data.note,
      mode: parsed.data.mode,
      editedSubject: parsed.data.editedSubject,
      editedContent: parsed.data.editedContent
    });
    return res.json({ ok: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "APPROVAL_FAILED";
    const status = message === "FORBIDDEN_ROLE" ? 403 : 409;
    return res.status(status).json({ ok: false, message });
  }
});

aiRouter.post("/approvals/:id/retry-send", async (req: AuthenticatedRequest, res) => {
  const parsed = aiApprovalRetrySchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid retry payload." });

  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  try {
    const updated = await retryApprovalDelivery({
      orgId,
      approvalRequestId: req.params.id,
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role
    });
    return res.json({ ok: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "APPROVAL_RETRY_FAILED";
    const status = message === "FORBIDDEN_ROLE" ? 403 : 409;
    return res.status(status).json({ ok: false, message });
  }
});

aiRouter.post("/approvals/:id/reject", async (req: AuthenticatedRequest, res) => {
  const parsed = aiApprovalDecisionSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid approval payload." });

  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  try {
    const updated = await decideApproval({
      orgId,
      approvalRequestId: req.params.id,
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      decision: "REJECTED",
      note: parsed.data.note
    });
    return res.json({ ok: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "APPROVAL_FAILED";
    const status = message === "FORBIDDEN_ROLE" ? 403 : 409;
    return res.status(status).json({ ok: false, message });
  }
});

aiRouter.get("/timelines/:entityType/:entityId", async (req: AuthenticatedRequest, res) => {
  const parsed = aiTimelineParamsSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid timeline params." });

  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  const [audit, runs, approvals, memory, handoffActions] = await Promise.all([
    prisma.auditLog.findMany({
      where: { orgId, entityType: parsed.data.entityType, entityId: parsed.data.entityId },
      orderBy: { createdAt: "desc" },
      take: 40
    }),
    prisma.agentRun.findMany({
      where: { orgId, entityType: parsed.data.entityType, entityId: parsed.data.entityId },
      include: { actionLogs: true },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.approvalRequest.findMany({
      where: { orgId, entityType: parsed.data.entityType, entityId: parsed.data.entityId },
      include: { actions: true },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.agentEntityMemory.findUnique({
      where: {
        orgId_entityType_entityId: {
          orgId,
          entityType: parsed.data.entityType,
          entityId: parsed.data.entityId
        }
      }
    }),
    prisma.agentActionLog.findMany({
      where: {
        orgId,
        entityType: parsed.data.entityType,
        entityId: parsed.data.entityId,
        actionType: "AGENT_HANDOFF"
      },
      orderBy: { createdAt: "desc" },
      take: 40
    })
  ]);
  const contextSnapshot = parseMetadata(memory?.contextJson);
  const nextBestActionFromContext = contextSnapshot?.nextBestAction as Record<string, unknown> | undefined;
  const attentionFromContext = contextSnapshot?.attention as Record<string, unknown> | undefined;
  const recommendation = memory
    ? {
        action: memory.latestRecommendation || (typeof nextBestActionFromContext?.action === "string" ? nextBestActionFromContext.action : null),
        why: memory.recommendationWhy || (typeof nextBestActionFromContext?.why === "string" ? nextBestActionFromContext.why : null),
        priority:
          memory.recommendationPriority ||
          (typeof nextBestActionFromContext?.priority === "string" ? nextBestActionFromContext.priority : null),
        approvalNeeded:
          typeof nextBestActionFromContext?.approvalNeeded === "boolean" ? nextBestActionFromContext.approvalNeeded : memory.approvalNeeded,
        shouldCreateFollowup:
          typeof nextBestActionFromContext?.shouldCreateFollowup === "boolean"
            ? nextBestActionFromContext.shouldCreateFollowup
            : false,
        blockedReasons: Array.from(
          new Set([
            ...toStringArray(nextBestActionFromContext?.blockedReasons),
            ...toStringArray(memory.riskFlagsJson)
          ])
        ),
        refreshedAt: memory.updatedAt
      }
    : null;
  const attention = memory
    ? {
        attentionScore:
          typeof attentionFromContext?.attentionScore === "number" ? attentionFromContext.attentionScore : null,
        attentionLevel:
          typeof attentionFromContext?.attentionLevel === "string" ? attentionFromContext.attentionLevel : null,
        topReasons: toStringArray(attentionFromContext?.topReasons),
        recommendedOwnerAction:
          typeof attentionFromContext?.recommendedOwnerAction === "string"
            ? attentionFromContext.recommendedOwnerAction
            : recommendation?.action || null,
        updatedAt:
          typeof attentionFromContext?.updatedAt === "string" ? attentionFromContext.updatedAt : memory.updatedAt
      }
    : null;

  const operationalMemory = memory
    ? {
        entityType: memory.entityType,
        entityId: memory.entityId,
        latestSummary: memory.latestSummary,
        latestClassification: memory.latestClassification,
        recommendation,
        approvalSnapshot: {
          lastApprovalStatus: memory.lastApprovalStatus,
          lastDeliveryStatus: memory.lastDeliveryStatus,
          approvalNeeded: memory.approvalNeeded
        },
        taskSnapshot: {
          lastTaskStatus: memory.lastTaskStatus,
          openFollowUpCount: Number(parseMetadata(memory.contextJson)?.openFollowUpCount || 0)
        },
        riskFlags: toStringArray(memory.riskFlagsJson),
        outboundBlocked: memory.outboundBlocked,
        updatedAt: memory.updatedAt
      }
    : null;

  const handoffs = handoffActions.map((action) => {
    const metadata = parseMetadata(action.metadataJson) || {};
    return {
      id: action.id,
      at: action.createdAt,
      status: action.status,
      sourceAgent: typeof metadata.fromAgent === "string" ? metadata.fromAgent : null,
      targetAgent: typeof metadata.toAgent === "string" ? metadata.toAgent : null,
      targetTool: typeof metadata.handoffToolKey === "string" ? metadata.handoffToolKey : action.toolKey || null,
      reason: typeof metadata.handoffReason === "string" ? metadata.handoffReason : null,
      sourceRecommendationSnapshot:
        metadata.sourceRecommendationSnapshot && typeof metadata.sourceRecommendationSnapshot === "object"
          ? (metadata.sourceRecommendationSnapshot as Record<string, unknown>)
          : null,
      targetResultSummary:
        typeof metadata.targetResultSummary === "string" ? metadata.targetResultSummary : action.outputSummary || null,
      suppressed: Boolean(metadata.suppressed),
      suppressionReason: typeof metadata.suppressionReason === "string" ? metadata.suppressionReason : null,
      createdApproval: Boolean(metadata.createdApproval),
      createdFollowup: Boolean(metadata.createdFollowup),
      createdTask: Boolean(metadata.createdTask),
      approvalRequestId: action.approvalRequestId
    };
  });

  return res.json({ ok: true, data: { audit, runs, approvals, memory, operationalMemory, recommendation, attention, handoffs } });
});

aiRouter.get("/attention", async (req: AuthenticatedRequest, res) => {
  const parsed = aiAttentionQuerySchema.safeParse(req.query || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid attention query." });

  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  const levels = parsed.data.levels.filter((value): value is AttentionLevel =>
    ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(value)
  );
  const items = await buildAttentionQueue({
    orgId,
    limit: parsed.data.limit,
    levels: levels.length ? levels : undefined
  });

  return res.json({ ok: true, data: { items } });
});

aiRouter.get("/queues/follow-up", async (req: AuthenticatedRequest, res) => {
  const queryParsed = aiQuerySchema.safeParse(req.query);
  if (!queryParsed.success) return res.status(400).json({ ok: false, message: "Invalid query." });

  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  const queue = await prisma.followUpQueueItem.findMany({
    where: { orgId, ...(queryParsed.data.status ? { status: queryParsed.data.status } : {}) },
    include: {
      task: {
        include: {
          assignedToUser: { select: { id: true, email: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: queryParsed.data.limit
  });

  return res.json({ ok: true, data: { queue } });
});

aiRouter.patch("/tasks/:id", async (req: AuthenticatedRequest, res) => {
  const parsed = aiTaskUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid task payload." });

  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  const task = await prisma.task.findFirst({ where: { id: req.params.id, orgId } });
  if (!task) return res.status(404).json({ ok: false, message: "TASK_NOT_FOUND" });

  if (parsed.data.assignedToUserId) {
    const assignee = await prisma.user.findFirst({ where: { id: parsed.data.assignedToUserId, orgId } });
    if (!assignee) return res.status(404).json({ ok: false, message: "ASSIGNEE_NOT_FOUND" });
  }

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: {
      status: parsed.data.status,
      priority: parsed.data.priority,
      dueAt: parsed.data.dueAt === undefined ? undefined : parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      assignedToUserId: parsed.data.assignedToUserId === undefined ? undefined : parsed.data.assignedToUserId
    },
    include: { assignedToUser: { select: { id: true, email: true } } }
  });

  await prisma.auditLog.create({
    data: {
      orgId,
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "AI_TASK_UPDATED",
      entityType: "task",
      entityId: updated.id,
      metadataJson: JSON.stringify({
        interventionType: "manual_task_update",
        before: {
          status: task.status,
          priority: task.priority,
          dueAt: task.dueAt,
          assignedToUserId: task.assignedToUserId
        },
        after: {
          status: updated.status,
          priority: updated.priority,
          dueAt: updated.dueAt,
          assignedToUserId: updated.assignedToUserId
        }
      })
    }
  });

  if (updated.entityType && updated.entityId) {
    await refreshEntityOperationalMemory({
      orgId,
      entityType: updated.entityType,
      entityId: updated.entityId,
      updatedByUserId: req.auth!.userId,
      reason: "task_updated"
    });
  }

  return res.json({ ok: true, data: { task: updated } });
});

aiRouter.patch("/queues/follow-up/:id", async (req: AuthenticatedRequest, res) => {
  const parsed = aiFollowUpQueueUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid follow-up payload." });

  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  const item = await prisma.followUpQueueItem.findFirst({ where: { id: req.params.id, orgId } });
  if (!item) return res.status(404).json({ ok: false, message: "FOLLOW_UP_ITEM_NOT_FOUND" });

  const status = parsed.data.status.toUpperCase();
  const updated = await prisma.followUpQueueItem.update({
    where: { id: item.id },
    data: { status, resolvedAt: status === "OPEN" ? null : new Date() },
    include: {
      task: {
        include: {
          assignedToUser: { select: { id: true, email: true } }
        }
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      orgId,
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "AI_FOLLOWUP_STATUS_UPDATED",
      entityType: "follow_up_queue_item",
      entityId: updated.id,
      metadataJson: JSON.stringify({
        interventionType: "manual_followup_status_update",
        before: { status: item.status },
        after: { status: updated.status }
      })
    }
  });

  if (updated.entityType && updated.entityId) {
    await refreshEntityOperationalMemory({
      orgId,
      entityType: updated.entityType,
      entityId: updated.entityId,
      updatedByUserId: req.auth!.userId,
      reason: "followup_status_updated"
    });
  }
  if (updated.task?.entityType && updated.task?.entityId) {
    await refreshEntityOperationalMemory({
      orgId,
      entityType: updated.task.entityType,
      entityId: updated.task.entityId,
      updatedByUserId: req.auth!.userId,
      reason: "followup_task_linked_update"
    });
  }

  return res.json({ ok: true, data: { item: updated } });
});

aiRouter.get("/insights/manager-summary", async (req: AuthenticatedRequest, res) => {
  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [callsTotal, callsMissed, messagesTotal, bookingRequests, openFollowUps, pendingApprovals] = await Promise.all([
    prisma.callLog.count({ where: { orgId, createdAt: { gte: since } } }),
    prisma.callLog.count({ where: { orgId, createdAt: { gte: since }, outcome: "MISSED" } }),
    prisma.message.count({ where: { orgId, createdAt: { gte: since } } }),
    prisma.appointmentRequest.count({ where: { orgId, createdAt: { gte: since } } }),
    prisma.followUpQueueItem.count({ where: { orgId, status: "OPEN" } }),
    prisma.approvalRequest.count({ where: { orgId, status: "PENDING" } })
  ]);

  return res.json({
    ok: true,
    data: {
      since,
      callsTotal,
      callsMissed,
      messagesTotal,
      bookingRequests,
      openFollowUps,
      pendingApprovals
    }
  });
});

aiRouter.get("/insights/operations-feed", async (req: AuthenticatedRequest, res) => {
  const queryParsed = aiQuerySchema.safeParse(req.query);
  if (!queryParsed.success) return res.status(400).json({ ok: false, message: "Invalid query." });

  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  const events = await buildOperationsFeed({
    orgId,
    limit: queryParsed.data.limit,
    filter: queryParsed.data.filter
  });

  return res.json({ ok: true, data: { events } });
});

aiRouter.post("/tools/:toolKey/execute", async (req: AuthenticatedRequest, res) => {
  const bodyParsed = aiToolExecuteSchema.safeParse({
    ...req.body,
    toolKey: req.params.toolKey
  });
  if (!bodyParsed.success) return res.status(400).json({ ok: false, message: "Invalid tool payload." });

  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  const registry = await fetchRegistryForOrg(orgId);
  const chosenAgent = registry.find((agent) => agent.key === (bodyParsed.data.agentKey || "task_followup")) || registry[0];
  if (!chosenAgent) return res.status(409).json({ ok: false, message: "No active agents." });

  const run = await prisma.agentRun.create({
    data: {
      orgId,
      initiatedByUserId: req.auth!.userId,
      agentDefinitionId: chosenAgent.id,
      status: "RUNNING",
      routeReason: "explicit_agent",
      inputSummary: JSON.stringify(bodyParsed.data.input).slice(0, 1000),
      entityType: bodyParsed.data.entityType || null,
      entityId: bodyParsed.data.entityId || null,
      startedAt: new Date(),
      idempotencyKey: bodyParsed.data.idempotencyKey || null
    }
  });

  const result = await executeTool({
    orgId,
    runId: run.id,
    agentDefinitionId: chosenAgent.id,
    agentKey: chosenAgent.key,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    toolKey: bodyParsed.data.toolKey,
    toolInput: bodyParsed.data.input,
    entityType: bodyParsed.data.entityType,
    entityId: bodyParsed.data.entityId,
    prompt: "Direct tool execution"
  });

  await prisma.agentRun.update({
    where: { id: run.id },
    data: {
      status: result.approvalRequired ? "BLOCKED_APPROVAL" : result.ok ? "COMPLETED" : "FAILED",
      outputSummary: result.outputSummary || result.message,
      completedAt: new Date()
    }
  });

  return res.json({ ok: true, data: result });
});

aiRouter.post("/knowledge/search", async (req: AuthenticatedRequest, res) => {
  const parsed = aiToolExecuteSchema.safeParse({ toolKey: "search_workspace_knowledge", input: req.body || {} });
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid payload." });

  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  const run = await prisma.agentRun.create({
    data: {
      orgId,
      initiatedByUserId: req.auth!.userId,
      agentDefinitionId: (await fetchRegistryForOrg(orgId)).find((agent) => agent.key === "knowledge")?.id || "",
      status: "RUNNING",
      routeReason: "explicit_agent",
      inputSummary: JSON.stringify(req.body || {}).slice(0, 1000),
      startedAt: new Date()
    }
  });

  const result = await executeTool({
    orgId,
    runId: run.id,
    agentDefinitionId: run.agentDefinitionId,
    agentKey: "knowledge",
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    toolKey: "search_workspace_knowledge",
    toolInput: req.body || {},
    prompt: "Knowledge search"
  });

  await prisma.agentRun.update({
    where: { id: run.id },
    data: {
      status: result.ok ? "COMPLETED" : "FAILED",
      outputSummary: result.outputSummary || result.message,
      completedAt: new Date()
    }
  });

  return res.json({ ok: true, data: result });
});

aiRouter.post("/knowledge/answer", async (req: AuthenticatedRequest, res) => {
  const parsed = aiToolExecuteSchema.safeParse({ toolKey: "answer_internal_question", input: req.body || {} });
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid payload." });

  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  const run = await prisma.agentRun.create({
    data: {
      orgId,
      initiatedByUserId: req.auth!.userId,
      agentDefinitionId: (await fetchRegistryForOrg(orgId)).find((agent) => agent.key === "knowledge")?.id || "",
      status: "RUNNING",
      routeReason: "explicit_agent",
      inputSummary: JSON.stringify(req.body || {}).slice(0, 1000),
      startedAt: new Date()
    }
  });

  const result = await executeTool({
    orgId,
    runId: run.id,
    agentDefinitionId: run.agentDefinitionId,
    agentKey: "knowledge",
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    toolKey: "answer_internal_question",
    toolInput: req.body || {},
    prompt: "Knowledge answer"
  });

  await prisma.agentRun.update({
    where: { id: run.id },
    data: {
      status: result.ok ? "COMPLETED" : "FAILED",
      outputSummary: result.outputSummary || result.message,
      completedAt: new Date()
    }
  });

  return res.json({ ok: true, data: result });
});
