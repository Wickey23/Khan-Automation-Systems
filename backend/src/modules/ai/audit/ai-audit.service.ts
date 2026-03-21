import { AiActionStatus, AiRunStatus, type Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

export async function createRunAudit(input: {
  orgId: string;
  actorUserId: string;
  actorRole: string;
  agentDefinitionId: string;
  routeReason: string;
  inputSummary?: string;
  entityType?: string;
  entityId?: string;
  idempotencyKey?: string;
}) {
  const run = await prisma.agentRun.create({
    data: {
      orgId: input.orgId,
      initiatedByUserId: input.actorUserId,
      agentDefinitionId: input.agentDefinitionId,
      status: AiRunStatus.RUNNING,
      routeReason: input.routeReason,
      inputSummary: input.inputSummary || null,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      startedAt: new Date(),
      idempotencyKey: input.idempotencyKey || null
    }
  });

  await prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      action: "AI_RUN_STARTED",
      agentRunId: run.id,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      metadataJson: JSON.stringify({ routeReason: input.routeReason })
    }
  });

  return run;
}

export async function completeRunAudit(input: {
  runId: string;
  status: AiRunStatus;
  outputSummary?: string;
  confidence?: number;
  errorCode?: string;
  errorSummary?: string;
}) {
  return prisma.agentRun.update({
    where: { id: input.runId },
    data: {
      status: input.status,
      outputSummary: input.outputSummary || null,
      confidence: input.confidence ?? null,
      errorCode: input.errorCode || null,
      errorSummary: input.errorSummary || null,
      completedAt: new Date()
    }
  });
}

export async function createActionAudit(input: {
  orgId: string;
  runId: string;
  agentDefinitionId: string;
  actionType: string;
  toolKey: string;
  status?: AiActionStatus;
  inputSummary?: string;
  outputSummary?: string;
  approvalRequired?: boolean;
  approvalStatus?: Prisma.InputJsonValue | null;
  approvalRequestId?: string;
  entityType?: string;
  entityId?: string;
  errorCode?: string;
  errorSummary?: string;
  metadataJson?: Prisma.InputJsonValue;
}) {
  return prisma.agentActionLog.create({
    data: {
      orgId: input.orgId,
      agentRunId: input.runId,
      agentDefinitionId: input.agentDefinitionId,
      actionType: input.actionType,
      toolKey: input.toolKey,
      status: input.status || AiActionStatus.PENDING,
      inputSummary: input.inputSummary || null,
      outputSummary: input.outputSummary || null,
      approvalRequired: Boolean(input.approvalRequired),
      approvalRequestId: input.approvalRequestId || null,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      errorCode: input.errorCode || null,
      errorSummary: input.errorSummary || null,
      metadataJson: input.metadataJson || undefined
    }
  });
}
