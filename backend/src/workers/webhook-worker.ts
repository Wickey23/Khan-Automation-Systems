import { Worker, type Job } from "bullmq";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import Stripe from "stripe";
import { deriveOrgLifecycleFromBilling } from "../modules/billing/billing-lifecycle.service";
import { sendBillingConfirmationEmail } from "../services/email";
import { 
  normalizePhone, 
  classifySmsKeyword 
} from "../modules/sms/sms-utils.service";
import { aiReplyQueue } from "../lib/queue";
import { env } from "../config/env";
import {
  extractOutreachMetadata,
  syncOutreachPhoneEventFromVapi
} from "../modules/voice/vapi/outreach-sync.service";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const jobMonitoredTypes = new Set(["vapi", "vapi-event"]);
const jobFailureTypes = new Set(["vapi", "vapi-event", "twilio_sms_inbound", "twilio_sms_status"]);

export const webhookWorker = new Worker(
  "webhook-processing",
  async (job: Job) => {
    const { type, eventId, orgId } = job.data;
    const jobOrgId = orgId || null;
    const shouldLogStart = jobMonitoredTypes.has(type);
    const jobStart = Date.now();
    const jobMetadata = {
      queue: job.queueName || "webhook-processing",
      attempts: job.attemptsMade ?? 0
    };
    if (shouldLogStart) {
      await logWebhookJobStatus({
        jobId: String(job.id),
        type,
        eventId: eventId || null,
        orgId: jobOrgId,
        status: "processing",
        metadata: jobMetadata
      });
    }

    try {
      let payload: any;

      switch (type) {
        case "stripe": {
          const event = await prisma.billingWebhookEvent.findUnique({ where: { id: eventId } });
          if (!event || !event.payload) throw new Error(`Billing event ${eventId} not found or missing payload`);
          payload = event.payload;
          await handleStripeEvent(payload, orgId);
          await prisma.billingWebhookEvent.update({ where: { id: eventId }, data: { processed: true, processingError: null } });
          break;
        }
        case "twilio_sms_inbound": {
          const event = await prisma.smsWebhookEvent.findUnique({ where: { id: eventId } });
          if (!event) throw new Error(`SMS event ${eventId} not found`);
          payload = event.payload;
          // Twilio inbound SMS usually doesn't have orgId in payload, we handle in handler
          await handleTwilioSmsInbound(payload, orgId);
          await prisma.smsWebhookEvent.update({ where: { id: eventId }, data: { processed: true, processingError: null } });
          break;
        }
        case "twilio_sms_status": {
          const event = await prisma.smsWebhookEvent.findUnique({ where: { id: eventId } });
          if (!event) throw new Error(`SMS status event ${eventId} not found`);
          payload = event.payload;
          await handleTwilioSmsStatus(payload, orgId);
          await prisma.smsWebhookEvent.update({ where: { id: eventId }, data: { processed: true, processingError: null } });
          break;
        }
        case "vapi-event":
        case "vapi": {
          const event = await prisma.vapiWebhookEvent.findUnique({ where: { id: eventId } });
          if (!event) throw new Error(`Vapi event ${eventId} not found`);
          payload = event.payload;
          await handleVapiEvent(payload, orgId);
          break;
        }
        default:
          console.warn(`[Worker] Unknown job type: ${type}`);
      }
      if (shouldLogStart) {
        await logWebhookJobStatus({
          jobId: String(job.id),
          type,
          eventId: eventId || null,
          orgId: jobOrgId,
          status: "completed",
          durationMs: Date.now() - jobStart,
          metadata: jobMetadata
        });
      }
    } catch (error) {
      const maxAttempts = Number(job.opts?.attempts || 1);
      const attemptsMade = Number(job.attemptsMade || 0) + 1;
      const terminal = isTerminalWebhookFailure({ error, attemptsMade, maxAttempts });
      const classification = classifyWebhookError(error);

      if (jobFailureTypes.has(type)) {
        await logWebhookJobStatus({
          jobId: String(job.id),
          type,
          eventId: eventId || null,
          orgId: jobOrgId,
          status: terminal ? "failed_terminal" : "failed",
          message: classification.message,
          durationMs: Date.now() - jobStart,
          metadata: {
            ...jobMetadata,
            attemptsMade,
            maxAttempts,
            terminal
          }
        });
      }
      await markWebhookEventFailure({
        type,
        eventId: eventId || null,
        message: classification.message,
        terminal
      });
      await prisma.auditLog
        .create({
          data: {
            orgId: jobOrgId,
            actorUserId: "webhook-worker",
            actorRole: "SYSTEM",
            action: terminal ? "WEBHOOK_JOB_TERMINAL" : "WEBHOOK_JOB_RETRY_SCHEDULED",
            metadataJson: JSON.stringify({
              jobId: String(job.id),
              type,
              eventId: eventId || null,
              attemptsMade,
              maxAttempts,
              message: classification.message,
              terminal
            })
          }
        })
        .catch(() => null);
      console.error(`Error processing webhook job ${job.id}:`, error);
      if (terminal) {
        return;
      }
      throw error;
    }
  },
  { 
    connection: redis as any,
    concurrency: 3 
  }
);

async function handleStripeEvent(event: Stripe.Event, orgId?: string) {
  let targetOrgId = orgId;
  
  // Find organization if not provided
  if (!targetOrgId && event.account) {
    // For Connect events
    const org = await prisma.organization.findFirst({
      where: { stripeCustomerId: event.account },
      select: { id: true }
    });
    targetOrgId = org?.id;
  } else if (!targetOrgId && (event.data.object as any).customer) {
    const customerId = (event.data.object as any).customer;
    const org = await prisma.organization.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true }
    });
    targetOrgId = org?.id;
  }

  if (!targetOrgId) return;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = session.subscription as string;
      
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      await prisma.organization.update({
        where: { id: targetOrgId },
        data: {
          subscriptionStatus: subscription.status,
          billingActive: subscription.status === "active",
        }
      });

      const currentOrg = await prisma.organization.findUnique({ 
        where: { id: targetOrgId },
        include: { users: { take: 1 } }
      });
      
      const lifecycle = deriveOrgLifecycleFromBilling({
        currentStatus: currentOrg?.status || "ONBOARDING",
        currentLive: currentOrg?.live || false,
        billingActive: subscription.status === "active"
      });

      await prisma.organization.update({
        where: { id: targetOrgId },
        data: { status: lifecycle.status, live: lifecycle.live }
      });

      if (currentOrg?.users[0]?.email) {
        // Idempotency: skip email if this event was already processed
        const wasProcessed = await prisma.billingWebhookEvent.findFirst({
          where: { eventId: event.id, processed: true }
        });
        
        if (!wasProcessed) {
          await sendBillingConfirmationEmail({
            email: currentOrg.users[0].email,
            planLabel: "Pro",
            statusLabel: subscription.status,
            source: "checkout"
          });
        }
      }
      break;
    }

    case "customer.subscription.deleted":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await prisma.organization.update({
        where: { id: targetOrgId },
        data: {
          subscriptionStatus: subscription.status,
          billingActive: subscription.status === "active",
        }
      });
      
      const currentOrg = await prisma.organization.findUnique({ where: { id: targetOrgId } });
      const lifecycle = deriveOrgLifecycleFromBilling({
        currentStatus: currentOrg?.status || "ONBOARDING",
        currentLive: currentOrg?.live || false,
        billingActive: subscription.status === "active"
      });

      await prisma.organization.update({
        where: { id: targetOrgId },
        data: { status: lifecycle.status, live: lifecycle.live }
      });
      break;
    }
  }

}

async function handleVapiEvent(payload: unknown, jobOrgId?: string) {
  if (!payload || typeof payload !== "object") return;
  const root = asObject(payload);
  const message = asObject(root.message);
  const callData = asObject(root.call);
  const eventType = pickString(root.messageType, root.type, root.event).toLowerCase() || "unknown";
  const providerCallId = pickString(
    callData.id,
    callData.providerCallId,
    root.callId,
    root.providerCallId,
    root.callSid
  );
  if (!providerCallId) {
    console.warn(`[Worker] Skipping Vapi event missing call id (${eventType})`);
    return;
  }

  const metadataRecords = [
    ...collectMetadataRecords(root.metadata),
    ...collectMetadataRecords(callData.metadata),
    ...collectMetadataRecords(message.metadata),
    ...collectMetadataRecords(asObject(callData.metadata).entries),
    ...collectMetadataRecords(asObject(root.metadata).entries)
  ];
  const outreachMeta = extractOutreachMetadata(metadataRecords);
  if (!outreachMeta) return;

  const orgId = pickString(outreachMeta.orgId, root.orgId, jobOrgId);
  if (!orgId) {
    console.warn(`[Worker] Skipping Vapi event without org id for call ${providerCallId}`);
    return;
  }

  const analysis = asObject(root.analysis);
  const summary = pickString(root.summary, callData.summary, analysis.summary, analysis.text);
  const transcript = pickString(
    root.transcript,
    callData.transcript,
    analysis.transcript,
    analysis.transcriptText
  );
  const recordingInfo = asObject(callData.recording);
  const recordingFile = asObject(recordingInfo.file);
  const recordingUrl = pickString(
    root.recordingUrl,
    callData.recordingUrl,
    recordingInfo.url,
    recordingFile.url,
    asObject(root.recording).url
  );
  const outcome = pickString(root.outcome, callData.outcome, analysis.outcome);
  const callStatus = pickString(
    root.status,
    root.callStatus,
    callData.status,
    callData.callStatus
  ).toLowerCase();
  const customer = asObject(callData.customer);
  const agent = asObject(callData.agent);
  const toPhone = pickString(callData.toNumber, callData.to, customer.number, root.to);
  const fromPhone = pickString(callData.fromNumber, callData.from, agent.phoneNumber, root.from);

  await syncOutreachPhoneEventFromVapi({
    orgId,
    providerCallId,
    eventType,
    callStatus,
    outcome: outcome || null,
    summary: summary || null,
    transcript: transcript || null,
    recordingUrl: recordingUrl || null,
    toPhone: toPhone || "",
    fromPhone: fromPhone || null,
    outreach: {
      leadId: outreachMeta.leadId,
      enrollmentId: outreachMeta.enrollmentId,
      callerConfigId: outreachMeta.callerConfigId
    }
  });
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function collectMetadataRecords(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      .map((item) => item as Record<string, unknown>);
  }
  if (value && typeof value === "object") {
    return [value as Record<string, unknown>];
  }
  return [];
}

type WebhookJobPhase = "processing" | "completed" | "failed" | "failed_terminal";

function classifyWebhookError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "unknown_error");
  const normalized = message.toLowerCase();
  const nonRetryable =
    normalized.includes("not found") ||
    normalized.includes("missing payload") ||
    normalized.includes("missing call id") ||
    normalized.includes("invalid") ||
    normalized.includes("p2002") ||
    normalized.includes("p2025");
  return {
    message,
    nonRetryable
  };
}

function isTerminalWebhookFailure(input: { error: unknown; attemptsMade: number; maxAttempts: number }) {
  const classification = classifyWebhookError(input.error);
  if (classification.nonRetryable) return true;
  return input.attemptsMade >= input.maxAttempts;
}

async function markWebhookEventFailure(input: {
  type: string;
  eventId: string | null;
  message: string;
  terminal: boolean;
}) {
  if (!input.eventId) return;
  try {
    if (input.type === "stripe") {
      await prisma.billingWebhookEvent.updateMany({
        where: { id: input.eventId },
        data: {
          processed: input.terminal,
          processingError: input.message
        }
      });
      return;
    }
    if (input.type === "twilio_sms_inbound" || input.type === "twilio_sms_status") {
      await prisma.smsWebhookEvent.updateMany({
        where: { id: input.eventId },
        data: {
          processed: input.terminal,
          processingError: input.message
        }
      });
      return;
    }
  } catch {
    // best effort failure state only
  }
}

async function logWebhookJobStatus(input: {
  jobId: string;
  type: string;
  eventId: string | null;
  orgId: string | null;
  status: WebhookJobPhase;
  message?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        orgId: input.orgId,
        actorUserId: "webhook-worker",
        actorRole: "SYSTEM",
        action: "WEBHOOK_JOB_STATUS",
        metadataJson: JSON.stringify({
          jobId: input.jobId,
          type: input.type,
          eventId: input.eventId,
          status: input.status,
          message: input.message || null,
          durationMs: input.durationMs ?? null,
          ...input.metadata
        })
      }
    });
  } catch {
    // best-effort logging only—do not crash the worker if auditing fails
  }
}

async function logSmsAudit(input: {
  orgId?: string | null;
  eventType: "sms_inbound" | "sms_status";
  messageSid: string;
  status?: string | null;
  errorText?: string | null;
  threadId?: string | null;
  fromNumber?: string | null;
  toNumber?: string | null;
  bodySnippet?: string | null;
}) {
  if (!input.orgId) return;
  try {
    await prisma.auditLog.create({
      data: {
        orgId: input.orgId,
        actorUserId: "twilio-sms",
        actorRole: "SYSTEM",
        action: "SMS_EVENT",
        metadataJson: JSON.stringify({
          eventType: input.eventType,
          messageSid: input.messageSid,
          status: input.status || null,
          errorText: input.errorText || null,
          threadId: input.threadId || null,
          fromNumber: input.fromNumber || null,
          toNumber: input.toNumber || null,
          bodySnippet: input.bodySnippet || null
        })
      }
    });
  } catch {
    // best-effort
  }
}

async function handleTwilioSmsInbound(payload: any, orgId: string) {
  const from = normalizePhone(payload.From);
  const to = normalizePhone(payload.To);
  const body = payload.Body || "";

  const thread = await prisma.messageThread.upsert({
    where: {
      orgId_channel_contactPhone: {
        orgId,
        channel: "SMS",
        contactPhone: from,
      }
    },
    update: { lastMessageAt: new Date() },
    create: {
      orgId,
      channel: "SMS",
      contactPhone: from,
    }
  });

  const existing = await prisma.message.findFirst({
    where: { providerMessageId: payload.MessageSid }
  });

  if (!existing) {
    await prisma.message.create({
      data: {
        orgId,
        threadId: thread.id,
        direction: "INBOUND",
        status: "RECEIVED",
        body,
        fromNumber: from,
        toNumber: to,
        providerMessageId: payload.MessageSid,
      }
    });
    await logSmsAudit({
      orgId,
      eventType: "sms_inbound",
      messageSid: payload.MessageSid,
      fromNumber: from,
      toNumber: to,
      threadId: thread.id,
      bodySnippet: String(body || "").slice(0, 240)
    });
  }

  const keyword = classifySmsKeyword(body);
  if (keyword === "STOP") {
    await prisma.lead.updateMany({
      where: { orgId, phone: from },
      data: { dnc: true }
    });
    await prisma.auditLog.create({
      data: {
        orgId,
        actorUserId: "twilio-sms",
        actorRole: "SYSTEM",
        action: "SMS_OPT_OUT",
        metadataJson: JSON.stringify({
          threadId: thread.id,
          messageSid: payload.MessageSid,
          fromNumber: from,
          toNumber: to,
          keyword,
          bodySnippet: String(body || "").slice(0, 120)
        })
      }
    });
    return;
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { aiAgentConfigs: true }
  });

  if (org?.aiAgentConfigs[0]?.vapiAgentId) {
    await aiReplyQueue.add("generate-reply", {
      orgId,
      fromNumber: from,
      toNumber: to,
      body,
      threadId: thread.id
    }, {
      // Idempotency: prevent dual AI replies for the same inbound message ID
      jobId: `ai-reply-${payload.MessageSid}`
    });
    console.log(`[Worker] Enqueued AI reply generation for ${from}`);
  }
}

async function handleTwilioSmsStatus(payload: any, orgId: string) {
  await prisma.message.updateMany({
    where: { 
      orgId, 
      providerMessageId: payload.MessageSid 
    },
    data: {
      status: (payload.MessageStatus?.toUpperCase() as any) || "SENT",
      errorText: payload.ErrorMessage || (payload.ErrorCode ? `Twilio ${payload.ErrorCode}: ${payload.ErrorMessage}` : null),
    }
  });
  await logSmsAudit({
    orgId,
    eventType: "sms_status",
    messageSid: payload.MessageSid,
    status: (payload.MessageStatus?.toUpperCase()?.trim() || null),
    errorText:
      payload.ErrorMessage || (payload.ErrorCode ? `Twilio ${payload.ErrorCode}: ${payload.ErrorMessage}` : null)
  });
}
