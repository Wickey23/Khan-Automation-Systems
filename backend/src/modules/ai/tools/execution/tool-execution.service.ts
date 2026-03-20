import { AiActionStatus, AiRunStatus, ApprovalStatus } from "@prisma/client";
import { prisma } from "../../../../lib/prisma";
import { createApprovalRequest } from "../../approvals/approval.service";
import { toolRequiresApproval } from "../../approvals/approval-policy.service";
import { createActionAudit } from "../../audit/ai-audit.service";
import { getToolDefinition } from "../tool-registry";
import type { ToolExecutionResult } from "../../ai.types";

function hasRole(role: string, requiredRoles: string[]) {
  return requiredRoles.includes(role);
}

export async function executeTool(input: {
  orgId: string;
  runId: string;
  agentDefinitionId: string;
  actorUserId: string;
  actorRole: string;
  toolKey: string;
  toolInput: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  prompt: string;
}) {
  const tool = getToolDefinition(input.toolKey);
  if (!tool) {
    return {
      ok: false,
      status: AiActionStatus.FAILED,
      message: "TOOL_NOT_FOUND",
      outputSummary: "Tool is not registered."
    } satisfies ToolExecutionResult;
  }

  if (!hasRole(input.actorRole, tool.requiredRoles)) {
    return {
      ok: false,
      status: AiActionStatus.FAILED,
      message: "FORBIDDEN_ROLE",
      outputSummary: "Role is not permitted for this tool."
    };
  }

  const parsed = tool.inputSchema.safeParse(input.toolInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: AiActionStatus.FAILED,
      message: "VALIDATION_ERROR",
      outputSummary: "Tool payload is invalid."
    };
  }

  const requiresApproval = toolRequiresApproval(tool.key);

  if (requiresApproval) {
    const approvalRequest = await createApprovalRequest({
      orgId: input.orgId,
      requestedByUserId: input.actorUserId,
      agentRunId: input.runId,
      actionType: "TOOL_EXECUTION",
      toolKey: tool.key,
      entityType: input.entityType,
      entityId: input.entityId,
      reason: "AI action requires operator approval",
      inputSummary: JSON.stringify(parsed.data).slice(0, 600)
    });

    await createActionAudit({
      orgId: input.orgId,
      runId: input.runId,
      agentDefinitionId: input.agentDefinitionId,
      actionType: "TOOL_EXECUTION",
      toolKey: tool.key,
      status: AiActionStatus.PENDING,
      inputSummary: JSON.stringify(parsed.data).slice(0, 600),
      outputSummary: "Approval required before execution.",
      approvalRequired: true,
      approvalRequestId: approvalRequest.id,
      entityType: input.entityType,
      entityId: input.entityId
    });

    await prisma.agentRun.update({
      where: { id: input.runId },
      data: { status: AiRunStatus.BLOCKED_APPROVAL }
    });

    return {
      ok: true,
      status: AiActionStatus.PENDING,
      message: "APPROVAL_REQUIRED",
      outputSummary: "Approval required before execution.",
      approvalRequired: true,
      approvalRequestId: approvalRequest.id
    } satisfies ToolExecutionResult;
  }

  try {
    const result = await tool.execute(parsed.data, {
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole as never,
      entityType: input.entityType,
      entityId: input.entityId,
      prompt: input.prompt
    });

    await createActionAudit({
      orgId: input.orgId,
      runId: input.runId,
      agentDefinitionId: input.agentDefinitionId,
      actionType: "TOOL_EXECUTION",
      toolKey: tool.key,
      status: result.status as AiActionStatus,
      inputSummary: JSON.stringify(parsed.data).slice(0, 600),
      outputSummary: (result.outputSummary || result.message || "").slice(0, 1000),
      approvalRequired: false,
      approvalStatus: ApprovalStatus.APPROVED,
      entityType: input.entityType,
      entityId: input.entityId,
      errorCode: result.ok ? undefined : result.message
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "tool_execution_failed";
    await createActionAudit({
      orgId: input.orgId,
      runId: input.runId,
      agentDefinitionId: input.agentDefinitionId,
      actionType: "TOOL_EXECUTION",
      toolKey: tool.key,
      status: AiActionStatus.FAILED,
      inputSummary: JSON.stringify(parsed.data).slice(0, 600),
      outputSummary: "Tool execution failed.",
      approvalRequired: false,
      entityType: input.entityType,
      entityId: input.entityId,
      errorCode: "TOOL_EXECUTION_FAILED",
      errorSummary: message.slice(0, 1000)
    });

    return {
      ok: false,
      status: AiActionStatus.FAILED,
      message: "TOOL_EXECUTION_FAILED",
      outputSummary: message.slice(0, 500)
    } satisfies ToolExecutionResult;
  }
}
