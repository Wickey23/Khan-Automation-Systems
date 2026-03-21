import { ApprovalStatus, MessageDirection, MessageStatus, type Prisma } from "@prisma/client";
import { env } from "../../../config/env";
import { prisma } from "../../../lib/prisma";
import { sendSmsMessage } from "../../twilio/twilio.service";
import { canApproveAsRole } from "./approval-policy.service";
import { sendOutboundEmail } from "../../../services/email";
import { upsertEntityMemory } from "../context/entity-memory.service";
import { refreshEntityOperationalMemory } from "../context/entity-state-refresh.service";

type ApprovalMode = "SEND_NOW" | "APPROVE_ONLY";

type ParsedApprovalInput = {
  content?: string;
  draft?: string;
  body?: string;
  subject?: string;
  toPhone?: string;
  toEmail?: string;
  leadId?: string;
  threadId?: string;
  callId?: string;
};

function cleanText(value?: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseApprovalInput(inputSummary?: string | null): ParsedApprovalInput {
  if (!inputSummary) return {};
  try {
    const parsed = JSON.parse(inputSummary) as Record<string, unknown>;
    return {
      content: typeof parsed.content === "string" ? parsed.content : undefined,
      draft: typeof parsed.draft === "string" ? parsed.draft : undefined,
      body: typeof parsed.body === "string" ? parsed.body : undefined,
      subject: typeof parsed.subject === "string" ? parsed.subject : undefined,
      toPhone: typeof parsed.toPhone === "string" ? parsed.toPhone : undefined,
      toEmail: typeof parsed.toEmail === "string" ? parsed.toEmail : undefined,
      leadId: typeof parsed.leadId === "string" ? parsed.leadId : undefined,
      threadId: typeof parsed.threadId === "string" ? parsed.threadId : undefined,
      callId: typeof parsed.callId === "string" ? parsed.callId : undefined
    };
  } catch {
    return {};
  }
}

async function refreshPrimaryAndLinkedEntities(input: {
  orgId: string;
  entityType?: string | null;
  entityId?: string | null;
  updatedByUserId?: string | null;
  reason: string;
}) {
  if (!input.entityType || !input.entityId) return;

  const refs: Array<{ entityType: string; entityId: string }> = [{ entityType: input.entityType, entityId: input.entityId }];
  if (input.entityType === "lead") {
    const [latestCall, latestThread] = await Promise.all([
      prisma.callLog.findFirst({
        where: { orgId: input.orgId, leadId: input.entityId },
        orderBy: { createdAt: "desc" },
        select: { id: true }
      }),
      prisma.messageThread.findFirst({
        where: { orgId: input.orgId, leadId: input.entityId },
        orderBy: { lastMessageAt: "desc" },
        select: { id: true }
      })
    ]);
    if (latestCall?.id) refs.push({ entityType: "call", entityId: latestCall.id });
    if (latestThread?.id) refs.push({ entityType: "message_thread", entityId: latestThread.id });
  } else if (input.entityType === "call") {
    const call = await prisma.callLog.findFirst({
      where: { orgId: input.orgId, id: input.entityId },
      select: { leadId: true }
    });
    if (call?.leadId) refs.push({ entityType: "lead", entityId: call.leadId });
  } else if (input.entityType === "message_thread") {
    const thread = await prisma.messageThread.findFirst({
      where: { orgId: input.orgId, id: input.entityId },
      select: { leadId: true }
    });
    if (thread?.leadId) refs.push({ entityType: "lead", entityId: thread.leadId });
  }

  for (const ref of refs) {
    await refreshEntityOperationalMemory({
      orgId: input.orgId,
      entityType: ref.entityType,
      entityId: ref.entityId,
      updatedByUserId: input.updatedByUserId || null,
      reason: input.reason
    });
  }
}

async function resolveLeadForApproval(orgId: string, request: { entityType?: string | null; entityId?: string | null }, parsed: ParsedApprovalInput) {
  const leadId = parsed.leadId || (request.entityType === "lead" ? request.entityId || undefined : undefined);
  if (leadId) {
    const byId = await prisma.lead.findFirst({ where: { id: leadId, orgId } });
    if (byId) return byId;
  }

  if (request.entityType === "message_thread" || parsed.threadId) {
    const thread = await prisma.messageThread.findFirst({
      where: { id: parsed.threadId || request.entityId || "", orgId },
      include: { lead: true }
    });
    if (thread?.lead) return thread.lead;
  }

  if (request.entityType === "call" || parsed.callId) {
    const call = await prisma.callLog.findFirst({
      where: { id: parsed.callId || request.entityId || "", orgId },
      include: { lead: true }
    });
    if (call?.lead) return call.lead;
  }

  return null;
}

async function resolveSmsRecipient(input: {
  orgId: string;
  request: { entityType?: string | null; entityId?: string | null };
  parsed: ParsedApprovalInput;
  finalBody: string;
}) {
  const lead = await resolveLeadForApproval(input.orgId, input.request, input.parsed);

  let toPhone = cleanText(input.parsed.toPhone || lead?.phone || "");
  let threadLeadId: string | null = lead?.id || null;
  let threadId: string | null = input.parsed.threadId || (input.request.entityType === "message_thread" ? input.request.entityId || null : null);

  if (!toPhone && input.request.entityType === "message_thread" && input.request.entityId) {
    const thread = await prisma.messageThread.findFirst({
      where: { id: input.request.entityId, orgId: input.orgId },
      include: { lead: true }
    });
    if (thread) {
      toPhone = cleanText(thread.contactPhone);
      threadId = thread.id;
      threadLeadId = thread.leadId || null;
    }
  }

  if (!toPhone && input.request.entityType === "call" && input.request.entityId) {
    const call = await prisma.callLog.findFirst({
      where: { id: input.request.entityId, orgId: input.orgId }
    });
    if (call) {
      toPhone = cleanText(call.fromNumber);
    }
  }

  if (!toPhone) {
    throw new Error("SMS_RECIPIENT_NOT_FOUND");
  }

  const activePhone = await prisma.phoneNumber.findFirst({
    where: { orgId: input.orgId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" }
  });
  if (!activePhone?.e164Number) {
    throw new Error("NO_ACTIVE_NUMBER");
  }

  if (lead?.dnc) {
    throw new Error("DNC_BLOCKED");
  }

  const thread =
    threadId
      ? await prisma.messageThread.findFirst({
          where: { id: threadId, orgId: input.orgId }
        })
      : null;

  const upsertedThread = thread
    ? await prisma.messageThread.update({
        where: { id: thread.id },
        data: {
          lastMessageAt: new Date(),
          leadId: threadLeadId || undefined,
          contactName: lead?.name || thread.contactName
        }
      })
    : await prisma.messageThread.upsert({
        where: {
          orgId_channel_contactPhone: {
            orgId: input.orgId,
            channel: "SMS",
            contactPhone: toPhone
          }
        },
        update: {
          lastMessageAt: new Date(),
          leadId: threadLeadId || undefined,
          contactName: lead?.name || undefined
        },
        create: {
          orgId: input.orgId,
          channel: "SMS",
          contactPhone: toPhone,
          leadId: threadLeadId || null,
          contactName: lead?.name || null,
          lastMessageAt: new Date()
        }
      });

  const statusCallbackUrl = `${env.API_BASE_URL}/api/twilio/sms/status?orgId=${encodeURIComponent(input.orgId)}`;
  const sent = await sendSmsMessage({
    from: activePhone.e164Number,
    to: toPhone,
    body: input.finalBody,
    statusCallbackUrl
  });

  const twStatus = String(sent.status || "").toLowerCase();
  const status =
    twStatus === "delivered"
      ? MessageStatus.DELIVERED
      : twStatus === "sent"
        ? MessageStatus.SENT
        : ["failed", "undelivered", "canceled"].includes(twStatus)
          ? MessageStatus.FAILED
          : MessageStatus.QUEUED;
  const errorText = sent.errorCode || sent.errorMessage ? `Twilio ${sent.errorCode || ""} ${sent.errorMessage || ""}`.trim() : null;

  const message = await prisma.message.create({
    data: {
      threadId: upsertedThread.id,
      orgId: input.orgId,
      leadId: threadLeadId,
      direction: MessageDirection.OUTBOUND,
      status,
      body: input.finalBody,
      provider: "TWILIO",
      providerMessageId: sent.sid || null,
      fromNumber: activePhone.e164Number,
      toNumber: toPhone,
      sentAt: new Date(),
      errorText,
      metadataJson: JSON.stringify({ source: "ai_approval" })
    }
  });

  return {
    lead,
    message,
    provider: "TWILIO",
    providerMessageId: sent.sid || null,
    deliveryStatus: status === MessageStatus.FAILED ? "FAILED" : "SENT",
    failureReason: status === MessageStatus.FAILED ? errorText || "twilio_send_failed" : null,
    retryable: status === MessageStatus.FAILED
  };
}

async function resolveOrCreateOutreachLead(orgId: string, lead: { name: string; business: string; email: string; phone: string } | null) {
  if (!lead?.email) return null;
  const existing = await prisma.outreachLead.findFirst({
    where: { orgId, email: lead.email.toLowerCase() }
  });
  if (existing) return existing;
  return prisma.outreachLead.create({
    data: {
      orgId,
      contactName: lead.name || null,
      companyName: lead.business || null,
      email: lead.email.toLowerCase(),
      phone: cleanText(lead.phone) || null,
      status: "ACTIVE"
    }
  });
}

async function executeEmailDelivery(input: {
  orgId: string;
  request: { entityType?: string | null; entityId?: string | null; id: string };
  parsed: ParsedApprovalInput;
  finalSubject: string;
  finalBody: string;
}) {
  const lead = await resolveLeadForApproval(input.orgId, input.request, input.parsed);
  const toEmail = cleanText(input.parsed.toEmail || lead?.email || "");
  if (!toEmail) throw new Error("EMAIL_RECIPIENT_NOT_FOUND");

  const outreachLead = await resolveOrCreateOutreachLead(
    input.orgId,
    lead
      ? {
          name: lead.name,
          business: lead.business,
          email: lead.email,
          phone: lead.phone
        }
      : null
  );

  const queuedEvent = await prisma.outreachEmailEvent.create({
    data: {
      orgId: input.orgId,
      leadId: outreachLead?.id || null,
      provider: "resend",
      eventType: "QUEUED",
      subject: input.finalSubject,
      toEmail,
      fromEmail: process.env.EMAIL_FROM_OUTREACH || process.env.EMAIL_FROM_PRODUCT || "noreply@khansystems.com",
      metadata: {
        source: "ai_approval",
        approvalRequestId: input.request.id
      }
    }
  });

  const emailResult = await sendOutboundEmail({
    to: toEmail,
    subject: input.finalSubject,
    text: input.finalBody,
    kind: "product"
  });

  await prisma.outreachEmailEvent.update({
    where: { id: queuedEvent.id },
    data: {
      eventType: "SENT",
      provider: emailResult.provider,
      providerMessageId: emailResult.providerMessageId || null,
      metadata: (emailResult.raw as Prisma.InputJsonValue) || undefined
    }
  });

  return {
    lead,
    provider: emailResult.provider.toUpperCase(),
    providerMessageId: emailResult.providerMessageId || null,
    deliveryStatus: "SENT",
    failureReason: null as string | null,
    retryable: false
  };
}

async function persistRejectedDecision(input: {
  orgId: string;
  requestId: string;
  actorUserId: string;
  actorRole: string;
  note?: string;
  toolKey: string;
  entityType?: string | null;
  entityId?: string | null;
}) {
  const approvalRequest = await prisma.$transaction(async (tx) => {
    const action = await tx.approvalAction.create({
      data: {
        orgId: input.orgId,
        approvalRequestId: input.requestId,
        actorUserId: input.actorUserId,
        action: ApprovalStatus.REJECTED,
        note: input.note || null
      }
    });

    const approvalRequest = await tx.approvalRequest.update({
      where: { id: input.requestId },
      data: {
        status: ApprovalStatus.REJECTED,
        resolvedAt: new Date(),
        outputSummary: "Rejected by operator.",
        deliveryStatus: "REJECTED",
        failedAt: new Date(),
        failureReason: input.note || "Rejected by operator.",
        retryable: false
      }
    });

    await tx.agentActionLog.updateMany({
      where: { orgId: input.orgId, approvalRequestId: input.requestId },
      data: {
        status: "REJECTED",
        approvalStatus: ApprovalStatus.REJECTED,
        outputSummary: "Rejected by operator."
      }
    });

    await tx.auditLog.create({
      data: {
        orgId: input.orgId,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: "AI_APPROVAL_REJECTED",
        approvalRequestId: input.requestId,
        toolKey: input.toolKey,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
        metadataJson: JSON.stringify({ note: input.note || null, actionId: action.id })
      }
    });

    if (input.entityType && input.entityId) {
      await upsertEntityMemory({
        orgId: input.orgId,
        entityType: input.entityType,
        entityId: input.entityId,
        latestRecommendation: "Review and revise outbound draft before retrying outreach.",
        recommendationWhy: "Approval was rejected.",
        recommendationPriority: "MEDIUM",
        approvalNeeded: true,
        lastApprovalStatus: "REJECTED",
        lastDeliveryStatus: "REJECTED",
        outboundBlocked: true,
        riskFlags: ["APPROVAL_REJECTED"],
        updatedByUserId: input.actorUserId
      });
    }

    return approvalRequest;
  });
  await refreshPrimaryAndLinkedEntities({
    orgId: input.orgId,
    entityType: input.entityType,
    entityId: input.entityId,
    updatedByUserId: input.actorUserId,
    reason: "approval_rejected"
  });
  return approvalRequest;
}

async function executeApprovedDelivery(input: {
  orgId: string;
  requestId: string;
  actorUserId: string;
  actorRole: string;
  toolKey: string;
  entityType?: string | null;
  entityId?: string | null;
  finalSubject: string | null;
  finalContent: string;
}) {
  const request = await prisma.approvalRequest.findFirst({
    where: { id: input.requestId, orgId: input.orgId }
  });
  if (!request) throw new Error("APPROVAL_NOT_FOUND");

  const parsed = parseApprovalInput(request.inputSummary);
  const attemptAt = new Date();

  await prisma.approvalRequest.update({
    where: { id: request.id },
    data: {
      deliveryStatus: "SENDING",
      deliveryAttemptedAt: attemptAt,
      retryCount: { increment: 1 },
      failureReason: null
    }
  });

  try {
    const delivery =
      input.toolKey === "queue_sms" || input.toolKey === "send_approved_sms"
        ? await resolveSmsRecipient({
            orgId: input.orgId,
            request,
            parsed,
            finalBody: input.finalContent
          })
        : await executeEmailDelivery({
            orgId: input.orgId,
            request,
            parsed,
            finalSubject: cleanText(input.finalSubject) || "Follow-up from Front Desk OS",
            finalBody: input.finalContent
          });

    await prisma.$transaction(async (tx) => {
      await tx.approvalRequest.update({
        where: { id: request.id },
        data: {
          deliveryStatus: delivery.deliveryStatus,
          deliveryProvider: delivery.provider,
          providerMessageId: delivery.providerMessageId || null,
          deliveryChannel: input.toolKey.includes("sms") ? "SMS" : "EMAIL",
          sentAt: new Date(),
          failedAt: null,
          failureReason: null,
          retryable: false,
          outputSummary: `Approved and sent via ${delivery.provider}.`
        }
      });

      await tx.agentActionLog.updateMany({
        where: { orgId: input.orgId, approvalRequestId: request.id },
        data: {
          status: "EXECUTED",
          approvalStatus: ApprovalStatus.APPROVED,
          outputSummary: `Approved and sent via ${delivery.provider}.`
        }
      });

      if (delivery.lead && ["queue_sms", "queue_email", "send_approved_sms", "send_approved_email"].includes(input.toolKey)) {
        await tx.lead.update({
          where: { id: delivery.lead.id },
          data: { status: "CONTACTED" }
        });
      }

      await tx.entityNote.create({
        data: {
          orgId: input.orgId,
          entityType: input.entityType || "approval_request",
          entityId: input.entityId || request.id,
          noteType: "ai_delivery",
          body: `${input.toolKey} approved and sent (${delivery.provider}${delivery.providerMessageId ? `: ${delivery.providerMessageId}` : ""}).`,
          createdByUserId: input.actorUserId
        }
      });

      await tx.auditLog.create({
        data: {
          orgId: input.orgId,
          actorUserId: input.actorUserId,
          actorRole: input.actorRole,
          action: "AI_APPROVAL_DELIVERY_SENT",
          approvalRequestId: request.id,
          toolKey: input.toolKey,
          entityType: input.entityType || null,
          entityId: input.entityId || null,
          metadataJson: JSON.stringify({
            provider: delivery.provider,
            providerMessageId: delivery.providerMessageId,
            channel: input.toolKey.includes("sms") ? "SMS" : "EMAIL"
          })
        }
      });
    });

    if (input.entityType && input.entityId) {
      await upsertEntityMemory({
        orgId: input.orgId,
        entityType: input.entityType,
        entityId: input.entityId,
        latestRecommendation: "Continue workflow; outbound communication was sent.",
        recommendationWhy: "Approved communication delivered successfully.",
        recommendationPriority: "LOW",
        approvalNeeded: false,
        lastApprovalStatus: "APPROVED",
        lastDeliveryStatus: "SENT",
        outboundBlocked: false,
        riskFlags: [],
        updatedByUserId: input.actorUserId
      });
    }
    await refreshPrimaryAndLinkedEntities({
      orgId: input.orgId,
      entityType: input.entityType,
      entityId: input.entityId,
      updatedByUserId: input.actorUserId,
      reason: "approval_delivery_sent"
    });
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : "delivery_failed";
    const retryable = /timeout|429|temporar|network|twilio|resend/i.test(failureReason);
    await prisma.$transaction(async (tx) => {
      await tx.approvalRequest.update({
        where: { id: request.id },
        data: {
          deliveryStatus: "FAILED",
          deliveryChannel: input.toolKey.includes("sms") ? "SMS" : "EMAIL",
          failedAt: new Date(),
          failureReason,
          retryable,
          outputSummary: `Approved but delivery failed: ${failureReason.slice(0, 300)}`
        }
      });

      await tx.agentActionLog.updateMany({
        where: { orgId: input.orgId, approvalRequestId: request.id },
        data: {
          status: "FAILED",
          approvalStatus: ApprovalStatus.APPROVED,
          errorCode: "DELIVERY_FAILED",
          errorSummary: failureReason.slice(0, 1000),
          outputSummary: "Approved but delivery failed."
        }
      });

      await tx.entityNote.create({
        data: {
          orgId: input.orgId,
          entityType: input.entityType || "approval_request",
          entityId: input.entityId || request.id,
          noteType: "ai_delivery_failed",
          body: `${input.toolKey} approved but send failed: ${failureReason.slice(0, 300)}`,
          createdByUserId: input.actorUserId
        }
      });

      await tx.auditLog.create({
        data: {
          orgId: input.orgId,
          actorUserId: input.actorUserId,
          actorRole: input.actorRole,
          action: "AI_APPROVAL_DELIVERY_FAILED",
          approvalRequestId: request.id,
          toolKey: input.toolKey,
          entityType: input.entityType || null,
          entityId: input.entityId || null,
          metadataJson: JSON.stringify({ failureReason, retryable })
        }
      });
    });
    if (input.entityType && input.entityId) {
      await upsertEntityMemory({
        orgId: input.orgId,
        entityType: input.entityType,
        entityId: input.entityId,
        latestRecommendation: "Retry failed outbound send or edit content before retry.",
        recommendationWhy: "Approved communication failed to send.",
        recommendationPriority: "HIGH",
        approvalNeeded: false,
        lastApprovalStatus: "APPROVED",
        lastDeliveryStatus: "FAILED",
        outboundBlocked: true,
        riskFlags: ["FAILED_DELIVERY"],
        updatedByUserId: input.actorUserId
      });
    }
    await refreshPrimaryAndLinkedEntities({
      orgId: input.orgId,
      entityType: input.entityType,
      entityId: input.entityId,
      updatedByUserId: input.actorUserId,
      reason: "approval_delivery_failed"
    });
    throw error;
  }
}

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
  const channel = input.toolKey.includes("sms") ? "SMS" : input.toolKey.includes("email") ? "EMAIL" : null;
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
      deliveryChannel: channel,
      deliveryStatus: channel ? "PENDING" : null,
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
  mode?: ApprovalMode;
  editedSubject?: string;
  editedContent?: string;
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

  if (input.decision === "REJECTED") {
    return persistRejectedDecision({
      orgId: input.orgId,
      requestId: request.id,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      note: input.note,
      toolKey: request.toolKey,
      entityType: request.entityType,
      entityId: request.entityId
    });
  }

  const parsed = parseApprovalInput(request.inputSummary);
  const finalContent = cleanText(input.editedContent || parsed.content || parsed.draft || parsed.body);
  if (!finalContent) {
    throw new Error("APPROVED_CONTENT_REQUIRED");
  }
  const finalSubject = cleanText(input.editedSubject || parsed.subject || "");
  const mode = input.mode || "SEND_NOW";

  const approved = await prisma.$transaction(async (tx) => {
    const action = await tx.approvalAction.create({
      data: {
        orgId: input.orgId,
        approvalRequestId: request.id,
        actorUserId: input.actorUserId,
        action: ApprovalStatus.APPROVED,
        note: input.note || null
      }
    });

    const approvalRequest = await tx.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: ApprovalStatus.APPROVED,
        resolvedAt: new Date(),
        outputSummary: mode === "SEND_NOW" ? "Approved by operator. Sending now..." : "Approved by operator. Queued for manual send.",
        approvedSubject: finalSubject || null,
        approvedContent: finalContent,
        deliveryChannel: request.toolKey.includes("sms") ? "SMS" : "EMAIL",
        deliveryStatus: mode === "SEND_NOW" ? "SENDING" : "QUEUED",
        retryable: mode !== "SEND_NOW"
      }
    });

    await tx.agentActionLog.updateMany({
      where: { orgId: input.orgId, approvalRequestId: request.id },
      data: {
        status: mode === "SEND_NOW" ? "APPROVED" : "PENDING",
        approvalStatus: ApprovalStatus.APPROVED,
        outputSummary: mode === "SEND_NOW" ? "Approved and sending." : "Approved and queued."
      }
    });

    await tx.auditLog.create({
      data: {
        orgId: input.orgId,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: "AI_APPROVAL_APPROVED",
        approvalRequestId: request.id,
        toolKey: request.toolKey,
        entityType: request.entityType,
        entityId: request.entityId,
        metadataJson: JSON.stringify({
          note: input.note || null,
          actionId: action.id,
          mode,
          edited: Boolean(input.editedContent || input.editedSubject)
        })
      }
    });

    return approvalRequest;
  });

  if (request.entityType && request.entityId) {
    await upsertEntityMemory({
      orgId: input.orgId,
      entityType: request.entityType,
      entityId: request.entityId,
      latestRecommendation:
        mode === "SEND_NOW" ? "Await delivery result for approved outbound communication." : "Send queued approved communication when ready.",
      recommendationWhy: "Approval decision recorded.",
      recommendationPriority: mode === "SEND_NOW" ? "MEDIUM" : "HIGH",
      approvalNeeded: false,
      lastApprovalStatus: "APPROVED",
      lastDeliveryStatus: mode === "SEND_NOW" ? "SENDING" : "QUEUED",
      outboundBlocked: false,
      riskFlags: mode === "SEND_NOW" ? [] : ["APPROVED_QUEUED"],
      updatedByUserId: input.actorUserId
    });
    await refreshPrimaryAndLinkedEntities({
      orgId: input.orgId,
      entityType: request.entityType,
      entityId: request.entityId,
      updatedByUserId: input.actorUserId,
      reason: mode === "SEND_NOW" ? "approval_approved_sending" : "approval_approved_queued"
    });
  }

  if (mode === "SEND_NOW") {
    await executeApprovedDelivery({
      orgId: input.orgId,
      requestId: request.id,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      toolKey: request.toolKey,
      entityType: request.entityType,
      entityId: request.entityId,
      finalSubject: finalSubject || null,
      finalContent
    });
    return prisma.approvalRequest.findFirstOrThrow({ where: { id: request.id, orgId: input.orgId } });
  }

  return approved;
}

export async function retryApprovalDelivery(input: {
  orgId: string;
  approvalRequestId: string;
  actorUserId: string;
  actorRole: string;
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
  if (request.status !== ApprovalStatus.APPROVED) throw new Error("APPROVAL_NOT_APPROVED");
  if (!["FAILED", "QUEUED"].includes(String(request.deliveryStatus || ""))) throw new Error("DELIVERY_RETRY_NOT_ALLOWED");
  if (!request.approvedContent) throw new Error("APPROVED_CONTENT_REQUIRED");

  await executeApprovedDelivery({
    orgId: input.orgId,
    requestId: request.id,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    toolKey: request.toolKey,
    entityType: request.entityType,
    entityId: request.entityId,
    finalSubject: request.approvedSubject || null,
    finalContent: request.approvedContent
  });

  return prisma.approvalRequest.findFirstOrThrow({ where: { id: request.id, orgId: input.orgId } });
}
