import { ApprovalStatus } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { canApproveAsRole } from "./approval-policy.service";

export async function createApprovalRequest(input: {
  orgId: string;
  requestedByUserId?: string | null;
  agentRunId?: string;
  actionType: string;
  toolKey: string;
  entityType?: string;
  entityId?: string;
  reason?: string;
  inputSummary?: string;
  outputSummary?: string;
  expiresAt?: Date;
}) {
  return prisma.approvalRequest.create({
    data: {
      orgId: input.orgId,
      requestedByUserId: input.requestedByUserId || null,
      agentRunId: input.agentRunId || null,
      actionType: input.actionType,
      toolKey: input.toolKey,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      reason: input.reason || null,
      inputSummary: input.inputSummary || null,
      outputSummary: input.outputSummary || null,
      expiresAt: input.expiresAt || null,
      status: ApprovalStatus.PENDING
    }
  });
}

export async function decideApproval(input: {
  orgId: string;
  approvalRequestId: string;
  actorUserId: string;
  actorRole: string;
  note?: string;
  decision: "APPROVED" | "REJECTED";
}) {
  const workspaceSettings = await prisma.workspaceAiSetting.findUnique({
    where: { orgId: input.orgId },
    select: { allowClientStaffApprovals: true }
  });

  const approverAllowed = canApproveAsRole(input.actorRole, workspaceSettings?.allowClientStaffApprovals === true);
  if (!approverAllowed) {
    throw new Error("FORBIDDEN_ROLE");
  }

  const request = await prisma.approvalRequest.findFirst({
    where: { id: input.approvalRequestId, orgId: input.orgId }
  });

  if (!request) throw new Error("APPROVAL_NOT_FOUND");
  if (request.status !== ApprovalStatus.PENDING) throw new Error("APPROVAL_ALREADY_RESOLVED");

  const nextStatus = input.decision === "APPROVED" ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;

  const updated = await prisma.$transaction(async (tx) => {
    const action = await tx.approvalAction.create({
      data: {
        orgId: input.orgId,
        approvalRequestId: request.id,
        actorUserId: input.actorUserId,
        action: nextStatus,
        note: input.note || null
      }
    });

    const approvalRequest = await tx.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: nextStatus,
        resolvedAt: new Date(),
        outputSummary:
          nextStatus === ApprovalStatus.APPROVED
            ? "Approved by operator. Ready for execution in downstream delivery path."
            : "Rejected by operator."
      }
    });

    if (nextStatus === ApprovalStatus.APPROVED && request.entityType === "lead" && request.entityId && ["queue_sms", "queue_email"].includes(request.toolKey)) {
      await tx.lead.updateMany({
        where: { id: request.entityId, orgId: input.orgId },
        data: { status: "CONTACTED" }
      });
    }

    await tx.auditLog.create({
      data: {
        orgId: input.orgId,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: nextStatus === ApprovalStatus.APPROVED ? "AI_APPROVAL_APPROVED" : "AI_APPROVAL_REJECTED",
        approvalRequestId: request.id,
        toolKey: request.toolKey,
        entityType: request.entityType,
        entityId: request.entityId,
        metadataJson: JSON.stringify({ note: input.note || null, actionId: action.id })
      }
    });

    return approvalRequest;
  });

  return updated;
}
