import { AiRunStatus } from "@prisma/client";
import { completeRunAudit, createRunAudit } from "../audit/ai-audit.service";
import { buildEntityContext } from "../context/entity-context.service";
import { buildWorkspaceContext } from "../context/workspace-context.service";
import { getAgentPlanner } from "../agents/agent-registry";
import { fetchRegistryForOrg, selectAgentByKey } from "../registry/agent-registry.service";
import { executeTool } from "../tools/execution/tool-execution.service";
import type { AiRunContext, AiRunRequest, AiRunResponse } from "../ai.types";

function inferAgentFromContext(input: AiRunRequest): { key: string; routeReason: AiRunResponse["routeReason"] } {
  const page = String(input.page || "").toLowerCase();
  const entityType = String(input.entityType || "").toLowerCase();
  const prompt = String(input.prompt || "").toLowerCase();

  if (page.includes("lead") || entityType === "lead") return { key: "lead_ops", routeReason: "page_context" };
  if (page.includes("message") || entityType === "message_thread") return { key: "communications", routeReason: "page_context" };
  if (page.includes("appointment") || entityType === "appointment") return { key: "scheduling", routeReason: "page_context" };
  if (page.includes("call") || entityType === "call") return { key: "front_desk", routeReason: "page_context" };
  if (page.includes("dashboard") || prompt.includes("summary") || prompt.includes("report")) {
    return { key: "manager_analytics", routeReason: "intent_routing" };
  }
  if (prompt.includes("knowledge") || prompt.includes("policy") || prompt.includes("what is")) {
    return { key: "knowledge", routeReason: "intent_routing" };
  }
  if (prompt.includes("task") || prompt.includes("follow up") || prompt.includes("follow-up")) {
    return { key: "task_followup", routeReason: "intent_routing" };
  }

  return { key: "front_desk", routeReason: "fallback_front_desk" };
}

export async function createAiRun(input: { context: AiRunContext; payload: AiRunRequest }): Promise<AiRunResponse> {
  const registry = await fetchRegistryForOrg(input.context.orgId);
  if (registry.length === 0) {
    throw new Error("AI_REGISTRY_EMPTY");
  }

  const explicitSelection = selectAgentByKey(registry, input.payload.agentKey);
  const inferred = inferAgentFromContext(input.payload);

  const selected = explicitSelection?.agent || registry.find((agent) => agent.key === inferred.key) || registry[0];
  const routeReason = explicitSelection?.routeReason || inferred.routeReason;

  const run = await createRunAudit({
    orgId: input.context.orgId,
    actorUserId: input.context.actorUserId,
    actorRole: input.context.actorRole,
    agentDefinitionId: selected.id,
    routeReason,
    inputSummary: input.payload.prompt.slice(0, 1000),
    entityType: input.payload.entityType,
    entityId: input.payload.entityId,
    idempotencyKey: input.payload.idempotencyKey || input.context.idempotencyKey
  });

  const planner = getAgentPlanner(selected.key);
  if (!planner) {
    await completeRunAudit({
      runId: run.id,
      status: AiRunStatus.FAILED,
      errorCode: "AGENT_NOT_IMPLEMENTED",
      errorSummary: `Agent planner missing for ${selected.key}`
    });
    throw new Error("AGENT_NOT_IMPLEMENTED");
  }

  const [workspaceContext, entityContext] = await Promise.all([
    buildWorkspaceContext(input.context.orgId),
    buildEntityContext({ orgId: input.context.orgId, entityType: input.payload.entityType, entityId: input.payload.entityId })
  ]);

  const plan = planner.plan({
    prompt: input.payload.prompt,
    intent: input.payload.intent,
    entityType: input.payload.entityType,
    entityId: input.payload.entityId
  });

  let approvalRequired = false;
  let approvalRequestId: string | undefined;
  const actions: AiRunResponse["actions"] = [];

  for (const step of plan.slice(0, 6)) {
    if (!selected.allowedTools.includes(step.toolKey)) {
      actions.push({ toolKey: step.toolKey, status: "FAILED", message: "TOOL_NOT_ALLOWED" });
      continue;
    }

    const toolResult = await executeTool({
      orgId: input.context.orgId,
      runId: run.id,
      agentDefinitionId: selected.id,
      agentKey: selected.key,
      actorUserId: input.context.actorUserId,
      actorRole: input.context.actorRole,
      toolKey: step.toolKey,
      toolInput: {
        ...step.input,
        __workspace: workspaceContext,
        __entity: entityContext
      },
      entityType: input.payload.entityType,
      entityId: input.payload.entityId,
      prompt: input.payload.prompt
    });

    actions.push({
      toolKey: step.toolKey,
      status: toolResult.status,
      approvalStatus: toolResult.approvalRequired ? "PENDING" : undefined,
      message: toolResult.outputSummary || toolResult.message
    });

    if (toolResult.approvalRequired) {
      approvalRequired = true;
      approvalRequestId = toolResult.approvalRequestId;
    }
  }

  const finalStatus = approvalRequired
    ? AiRunStatus.BLOCKED_APPROVAL
    : actions.some((action) => action.status === "FAILED")
      ? AiRunStatus.FAILED
      : AiRunStatus.COMPLETED;

  const summary = actions
    .map((action) => `${action.toolKey}: ${action.message || action.status}`)
    .join(" | ")
    .slice(0, 2000);

  await completeRunAudit({
    runId: run.id,
    status: finalStatus,
    outputSummary: summary,
    confidence: actions.length > 0 ? 0.72 : 0.5
  });

  return {
    runId: run.id,
    status: finalStatus,
    agentKey: selected.key,
    routeReason,
    summary,
    approvalRequired,
    approvalRequestId,
    actions
  };
}
