import { UserRole } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAnyRole, requireAuth, type AuthenticatedRequest } from "../../middleware/require-auth";
import {
  aiApprovalDecisionSchema,
  aiQuerySchema,
  aiRetryRunSchema,
  aiRunCreateSchema,
  aiTimelineParamsSchema,
  aiToolExecuteSchema
} from "./ai.schema";
import { decideApproval } from "./approvals/approval.service";
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
      note: parsed.data.note
    });
    return res.json({ ok: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "APPROVAL_FAILED";
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

  const [audit, runs, approvals] = await Promise.all([
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
    })
  ]);

  return res.json({ ok: true, data: { audit, runs, approvals } });
});

aiRouter.get("/queues/follow-up", async (req: AuthenticatedRequest, res) => {
  const queryParsed = aiQuerySchema.safeParse(req.query);
  if (!queryParsed.success) return res.status(400).json({ ok: false, message: "Invalid query." });

  const orgId = await resolveOrgId(req);
  if (!orgId) return res.status(400).json({ ok: false, message: "ORG_SCOPE_REQUIRED" });

  const queue = await prisma.followUpQueueItem.findMany({
    where: { orgId, ...(queryParsed.data.status ? { status: queryParsed.data.status } : {}) },
    include: { task: true },
    orderBy: { createdAt: "desc" },
    take: queryParsed.data.limit
  });

  return res.json({ ok: true, data: { queue } });
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
