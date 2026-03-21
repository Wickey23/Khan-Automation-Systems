import { AiActionStatus, AiRunStatus, ApprovalStatus } from "@prisma/client";
import { prisma } from "../../../../lib/prisma";
import { createApprovalRequest } from "../../approvals/approval.service";
import { toolRequiresApproval } from "../../approvals/approval-policy.service";
import { createActionAudit } from "../../audit/ai-audit.service";
import { buildEntityContext } from "../../context/entity-context.service";
import { deriveNextBestAction, upsertEntityMemory } from "../../context/entity-memory.service";
import { getToolDefinition } from "../tool-registry";
import type { ToolExecutionResult } from "../../ai.types";

function hasRole(role: string, requiredRoles: string[]) {
  return requiredRoles.includes(role);
}

export async function executeTool(input: {
  orgId: string;
  runId: string;
  agentDefinitionId: string;
  agentKey?: string;
  actorUserId: string;
  actorRole: string;
  toolKey: string;
  toolInput: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  prompt: string;
  skipHandoffs?: boolean;
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

    let finalResult: ToolExecutionResult = result;
    if (result.ok && input.entityType && input.entityId) {
      const context = await buildEntityContext({
        orgId: input.orgId,
        entityType: input.entityType,
        entityId: input.entityId
      });
      if (context) {
        const recommendation = deriveNextBestAction({
          entityType: input.entityType,
          contextPayload: context.payload
        });
        const riskFlags = Array.isArray(context.payload.blockedReasons)
          ? context.payload.blockedReasons.filter((item): item is string => typeof item === "string")
          : [];
        await upsertEntityMemory({
          orgId: input.orgId,
          entityType: input.entityType,
          entityId: input.entityId,
          latestSummary:
            typeof context.payload.latestSummary === "string"
              ? context.payload.latestSummary
              : typeof result.output?.summary === "string"
                ? result.output.summary
                : null,
          latestClassification:
            typeof context.payload.latestClassification === "string"
              ? context.payload.latestClassification
              : typeof result.output?.classification === "string"
                ? result.output.classification
                : null,
          latestRecommendation: recommendation.action,
          recommendationWhy: recommendation.why,
          recommendationPriority: recommendation.priority,
          approvalNeeded: recommendation.approvalNeeded,
          outboundBlocked: recommendation.blockedReasons.length > 0,
          lastApprovalStatus: typeof context.payload.latestApprovalStatus === "string" ? context.payload.latestApprovalStatus : null,
          lastDeliveryStatus: typeof context.payload.latestDeliveryStatus === "string" ? context.payload.latestDeliveryStatus : null,
          lastTaskStatus: typeof context.payload.latestTaskStatus === "string" ? context.payload.latestTaskStatus : null,
          riskFlags: [...new Set([...riskFlags, ...recommendation.blockedReasons])],
          context: {
            nextBestAction: recommendation,
            latestApprovalStatus: context.payload.latestApprovalStatus || null,
            latestDeliveryStatus: context.payload.latestDeliveryStatus || null,
            openFollowUpCount: context.payload.openFollowUpCount || 0
          },
          updatedByRunId: input.runId,
          updatedByUserId: input.actorUserId
        });
        finalResult = {
          ...result,
          output: {
            ...(result.output || {}),
            nextBestAction: recommendation
          }
        };
      }
    }

    await createActionAudit({
      orgId: input.orgId,
      runId: input.runId,
      agentDefinitionId: input.agentDefinitionId,
      actionType: "TOOL_EXECUTION",
      toolKey: tool.key,
      status: finalResult.status as AiActionStatus,
      inputSummary: JSON.stringify(parsed.data).slice(0, 600),
      outputSummary: (finalResult.outputSummary || finalResult.message || "").slice(0, 1000),
      approvalRequired: false,
      approvalStatus: ApprovalStatus.APPROVED,
      entityType: input.entityType,
      entityId: input.entityId,
      errorCode: finalResult.ok ? undefined : finalResult.message
    });

    if (!input.skipHandoffs) {
      await runAgentHandoffs({
        orgId: input.orgId,
        runId: input.runId,
        agentDefinitionId: input.agentDefinitionId,
        agentKey: input.agentKey,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        entityType: input.entityType,
        entityId: input.entityId,
        sourceToolKey: tool.key,
        sourceResult: finalResult,
        prompt: input.prompt
      });
    }

    return finalResult;
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

async function hasOpenFollowup(orgId: string, entityType?: string, entityId?: string) {
  if (!entityType || !entityId) return false;
  const existing = await prisma.followUpQueueItem.findFirst({
    where: {
      orgId,
      entityType,
      entityId,
      status: "OPEN"
    },
    select: { id: true }
  });
  return Boolean(existing);
}

async function hasRecentPendingApproval(input: {
  orgId: string;
  entityType?: string;
  entityId?: string;
  toolKey: string;
}) {
  if (!input.entityType || !input.entityId) return false;
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const existing = await prisma.approvalRequest.findFirst({
    where: {
      orgId: input.orgId,
      entityType: input.entityType,
      entityId: input.entityId,
      toolKey: input.toolKey,
      status: "PENDING",
      createdAt: { gte: since }
    },
    select: { id: true }
  });
  return Boolean(existing);
}

async function resolveAgentKey(agentDefinitionId: string, explicit?: string) {
  if (explicit) return explicit;
  const definition = await prisma.agentDefinition.findUnique({
    where: { id: agentDefinitionId },
    select: { key: true }
  });
  return definition?.key || "";
}

async function runAgentHandoffs(input: {
  orgId: string;
  runId: string;
  agentDefinitionId: string;
  agentKey?: string;
  actorUserId: string;
  actorRole: string;
  entityType?: string;
  entityId?: string;
  sourceToolKey: string;
  sourceResult: ToolExecutionResult;
  prompt: string;
}) {
  if (!input.entityType || !input.entityId || !input.sourceResult.ok) return;
  const agentKey = await resolveAgentKey(input.agentDefinitionId, input.agentKey);
  if (!agentKey) return;

  const entityContext = await buildEntityContext({
    orgId: input.orgId,
    entityType: input.entityType,
    entityId: input.entityId
  });
  const payload = entityContext?.payload || {};
  const dnc = Boolean(payload.dnc);

  const enqueueHandoff = async (handoff: {
    toAgent: string;
    toolKey: string;
    reason: string;
    toolInput: Record<string, unknown>;
    skipIfOpenFollowup?: boolean;
    skipIfPendingApproval?: boolean;
  }) => {
    if (handoff.skipIfOpenFollowup && (await hasOpenFollowup(input.orgId, input.entityType, input.entityId))) {
      return;
    }
    if (
      handoff.skipIfPendingApproval &&
      (await hasRecentPendingApproval({
        orgId: input.orgId,
        entityType: input.entityType,
        entityId: input.entityId,
        toolKey: handoff.toolKey
      }))
    ) {
      return;
    }

    const handoffResult = await executeTool({
      orgId: input.orgId,
      runId: input.runId,
      agentDefinitionId: input.agentDefinitionId,
      agentKey: handoff.toAgent,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      toolKey: handoff.toolKey,
      toolInput: handoff.toolInput,
      entityType: input.entityType,
      entityId: input.entityId,
      prompt: `${input.prompt} (handoff: ${handoff.reason})`,
      skipHandoffs: true
    });

    await createActionAudit({
      orgId: input.orgId,
      runId: input.runId,
      agentDefinitionId: input.agentDefinitionId,
      actionType: "AGENT_HANDOFF",
      toolKey: handoff.toolKey,
      status: handoffResult.status as AiActionStatus,
      inputSummary: JSON.stringify(handoff.toolInput).slice(0, 600),
      outputSummary: `Handoff ${agentKey} -> ${handoff.toAgent}: ${handoff.reason}. ${handoffResult.outputSummary || handoffResult.message}`,
      approvalRequired: Boolean(handoffResult.approvalRequired),
      approvalRequestId: handoffResult.approvalRequestId,
      entityType: input.entityType,
      entityId: input.entityId
    });

    await prisma.auditLog.create({
      data: {
        orgId: input.orgId,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: "AI_AGENT_HANDOFF",
        agentRunId: input.runId,
        entityType: input.entityType,
        entityId: input.entityId,
        metadataJson: JSON.stringify({
          fromAgent: agentKey,
          toAgent: handoff.toAgent,
          sourceToolKey: input.sourceToolKey,
          handoffToolKey: handoff.toolKey,
          reason: handoff.reason,
          resultStatus: handoffResult.status,
          approvalRequestId: handoffResult.approvalRequestId || null
        })
      }
    });
  };

  if (agentKey === "front_desk") {
    const urgency = String((input.sourceResult.output as Record<string, unknown> | undefined)?.urgency || payload.latestUrgency || "").toLowerCase();
    if ((input.sourceToolKey === "detect_urgency" && urgency === "high") || input.sourceToolKey === "suggest_front_desk_action") {
      await enqueueHandoff({
        toAgent: "task_followup",
        toolKey: "schedule_followup",
        reason: "Urgent or unresolved call needs operational follow-up.",
        toolInput: { reason: "Front desk handoff: urgent call follow-up required." },
        skipIfOpenFollowup: true
      });
    }

    if (input.sourceToolKey === "draft_callback" && !dnc) {
      const draft = String((input.sourceResult.output as Record<string, unknown> | undefined)?.draft || "").trim();
      if (draft) {
        await enqueueHandoff({
          toAgent: "communications",
          toolKey: "queue_sms",
          reason: "Callback draft should move into approval queue.",
          toolInput: { content: draft, callId: input.entityId },
          skipIfPendingApproval: true
        });
      }
    }
  }

  if (agentKey === "lead_ops") {
    if (input.sourceToolKey === "draft_outreach_sms" && !dnc) {
      const draft = String((input.sourceResult.output as Record<string, unknown> | undefined)?.draft || "").trim();
      if (draft) {
        await enqueueHandoff({
          toAgent: "communications",
          toolKey: "queue_sms",
          reason: "Lead SMS draft should move to approval queue.",
          toolInput: { content: draft, leadId: input.entityId },
          skipIfPendingApproval: true
        });
      }
    }

    if (input.sourceToolKey === "draft_outreach_email" && !dnc) {
      const output = (input.sourceResult.output as Record<string, unknown> | undefined) || {};
      const body = String(output.body || "").trim();
      if (body) {
        await enqueueHandoff({
          toAgent: "communications",
          toolKey: "queue_email",
          reason: "Lead email draft should move to approval queue.",
          toolInput: {
            subject: String(output.subject || "").trim(),
            content: body,
            leadId: input.entityId
          },
          skipIfPendingApproval: true
        });
      }
    }

    if (input.sourceToolKey === "classify_lead_reply" || input.sourceToolKey === "score_lead") {
      await enqueueHandoff({
        toAgent: "task_followup",
        toolKey: "schedule_lead_followup",
        reason: "Lead qualification requires explicit follow-up task.",
        toolInput: { leadId: input.entityId, reason: "Lead ops handoff for follow-up ownership." },
        skipIfOpenFollowup: true
      });
    }
  }

  if (agentKey === "communications") {
    if (input.sourceToolKey === "classify_message") {
      const classification = String((input.sourceResult.output as Record<string, unknown> | undefined)?.classification || payload.latestClassification || "").toUpperCase();
      const payloadLead = payload.lead && typeof payload.lead === "object" ? (payload.lead as Record<string, unknown>) : null;
      const payloadLeadId = payloadLead && typeof payloadLead.id === "string" ? payloadLead.id : null;
      await enqueueHandoff({
        toAgent: "task_followup",
        toolKey: "create_message_followup_task",
        reason: "Classified inbound thread should be tracked with follow-up ownership.",
        toolInput: { threadId: input.entityId },
        skipIfOpenFollowup: true
      });
      if (["BOOKING", "QUOTE"].includes(classification) && payloadLeadId) {
        await enqueueHandoff({
          toAgent: "lead_ops",
          toolKey: "score_lead",
          reason: "Inbound commercial intent should re-score linked lead.",
          toolInput: { leadId: payloadLeadId }
        });
      }
    }

    if (input.sourceToolKey === "detect_opt_out") {
      const optedOut = Boolean((input.sourceResult.output as Record<string, unknown> | undefined)?.optedOut);
      if (optedOut) {
        await enqueueHandoff({
          toAgent: "task_followup",
          toolKey: "schedule_followup",
          reason: "Opt-out requires compliance follow-up review.",
          toolInput: { reason: "Communications handoff: opt-out detected, review suppression state." },
          skipIfOpenFollowup: true
        });
      }
    }
  }

  if (agentKey === "manager_analytics" && input.sourceToolKey === "compute_missed_opportunities") {
    const riskScore = Number((input.sourceResult.output as Record<string, unknown> | undefined)?.riskScore || 0);
    if (riskScore >= 40) {
      await enqueueHandoff({
        toAgent: "task_followup",
        toolKey: "build_callback_queue",
        reason: "High missed-opportunity risk requires callback queue refresh.",
        toolInput: { limit: 30 }
      });
    }
  }
}
