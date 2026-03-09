import type { NotificationType, PrismaClient } from "@prisma/client";
import { emitOrgNotification } from "./notification.service";

const WEBHOOK_RETRY_NOTIFICATION_TYPE = "SECURITY_WEBHOOK_RETRY_FAILURE" as NotificationType;
const SMS_SUPPRESSION_NOTIFICATION_TYPE = "SECURITY_SMS_AUTOMATION_SUPPRESSED" as NotificationType;

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function createSystemAlertIfNeeded(input: {
  prisma: PrismaClient;
  action: string;
  thresholdAction: string;
  thresholdCount: number;
  windowMinutes: number;
  dedupeMinutes: number;
  orgId?: string | null;
  metadataMatch?: string[];
  metadata: Record<string, unknown>;
}) {
  const recentCount = await input.prisma.auditLog.count({
    where: {
      orgId: input.orgId ?? undefined,
      action: input.action,
      createdAt: { gte: minutesAgo(input.windowMinutes) },
      ...(input.metadataMatch?.length
        ? {
            AND: input.metadataMatch.map((value) => ({
              metadataJson: { contains: value }
            }))
          }
        : {})
    }
  });
  if (recentCount < input.thresholdCount) return null;

  const existing = await input.prisma.auditLog.findFirst({
    where: {
      orgId: input.orgId ?? undefined,
      action: input.thresholdAction,
      createdAt: { gte: minutesAgo(input.dedupeMinutes) },
      ...(input.metadataMatch?.length
        ? {
            AND: input.metadataMatch.map((value) => ({
              metadataJson: { contains: value }
            }))
          }
        : {})
    },
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });
  if (existing) return null;

  return input.prisma.auditLog.create({
    data: {
      actorUserId: "security-alerts",
      actorRole: "SYSTEM",
      action: input.thresholdAction,
      metadataJson: JSON.stringify({
        count: recentCount,
        windowMinutes: input.windowMinutes,
        ...(input.metadata || {})
      })
    }
  });
}

export async function maybeEmitWebhookRetryAlert(input: {
  prisma: PrismaClient;
  orgId?: string | null;
  provider: "TWILIO" | "VAPI";
  endpoint: string;
}) {
  const metadataMatch = [`"provider":"${input.provider}"`, `"endpoint":"${input.endpoint}"`];

  await createSystemAlertIfNeeded({
    prisma: input.prisma,
    action: "WEBHOOK_RETRY_WORTHY_FAILURE",
    thresholdAction: "SECURITY_ALERT_WEBHOOK_RETRY_FAILURE_SPIKE",
    thresholdCount: 3,
    windowMinutes: 15,
    dedupeMinutes: 60,
    orgId: input.orgId || null,
    metadataMatch,
    metadata: {
      provider: input.provider,
      endpoint: input.endpoint,
      orgId: input.orgId || null
    }
  }).catch(() => null);

  if (!input.orgId) return null;

  const existing = await input.prisma.orgNotification.findFirst({
    where: {
      orgId: input.orgId,
      type: WEBHOOK_RETRY_NOTIFICATION_TYPE,
      createdAt: { gte: minutesAgo(60) },
      metadataJson: { path: ["provider"], equals: input.provider },
      AND: [{ metadataJson: { path: ["endpoint"], equals: input.endpoint } }]
    },
    select: { id: true }
  }).catch(() => null);
  if (existing) return null;

  const recentCount = await input.prisma.auditLog.count({
    where: {
      orgId: input.orgId,
      action: "WEBHOOK_RETRY_WORTHY_FAILURE",
      createdAt: { gte: minutesAgo(15) },
      AND: metadataMatch.map((value) => ({
        metadataJson: { contains: value }
      }))
    }
  });
  if (recentCount < 3) return null;

  return emitOrgNotification({
    prisma: input.prisma,
    orgId: input.orgId,
    type: WEBHOOK_RETRY_NOTIFICATION_TYPE,
    severity: "ACTION_REQUIRED",
    title: "Webhook retry failures increasing",
    body: `${input.provider} webhook retries are increasing for ${input.endpoint}. Review system health and recent provider activity.`,
    targetRoleMin: "ADMIN",
    metadata: {
      provider: input.provider,
      endpoint: input.endpoint,
      count: recentCount,
      windowMinutes: 15
    }
  }).catch(() => null);
}

export async function maybeEmitSmsSuppressionAlert(input: {
  prisma: PrismaClient;
  orgId: string;
  reason: string;
  source: string;
  requestId?: string | null;
}) {
  await createSystemAlertIfNeeded({
    prisma: input.prisma,
    action: "SMS_AUTOMATION_SUPPRESSED",
    thresholdAction: "SECURITY_ALERT_SMS_SUPPRESSION_SPIKE",
    thresholdCount: 1,
    windowMinutes: 15,
    dedupeMinutes: 60,
    orgId: input.orgId,
    metadataMatch: [`"reason":"${input.reason}"`, `"source":"${input.source}"`],
    metadata: {
      orgId: input.orgId,
      reason: input.reason,
      source: input.source,
      requestId: input.requestId || null
    }
  }).catch(() => null);

  const existing = await input.prisma.orgNotification.findFirst({
    where: {
      orgId: input.orgId,
      type: SMS_SUPPRESSION_NOTIFICATION_TYPE,
      createdAt: { gte: minutesAgo(60) },
      metadataJson: { path: ["reason"], equals: input.reason },
      AND: [{ metadataJson: { path: ["source"], equals: input.source } }]
    },
    select: { id: true }
  }).catch(() => null);
  if (existing) return null;

  return emitOrgNotification({
    prisma: input.prisma,
    orgId: input.orgId,
    type: SMS_SUPPRESSION_NOTIFICATION_TYPE,
    severity: "ACTION_REQUIRED",
    title: "SMS automation was suppressed",
    body: `An automated SMS flow was suppressed for ${input.reason}. Review messaging limits or request state before retrying.`,
    targetRoleMin: "ADMIN",
    metadata: {
      reason: input.reason,
      source: input.source,
      requestId: input.requestId || null
    }
  }).catch(() => null);
}

export async function maybeEmitToolContextRejectedAlert(input: {
  prisma: PrismaClient;
  route: string;
}) {
  return createSystemAlertIfNeeded({
    prisma: input.prisma,
    action: "TOOL_ORG_CONTEXT_REJECTED",
    thresholdAction: "SECURITY_ALERT_TOOL_CONTEXT_REJECTED_SPIKE",
    thresholdCount: 5,
    windowMinutes: 15,
    dedupeMinutes: 60,
    metadataMatch: [`"route":"${input.route}"`],
    metadata: {
      route: input.route
    }
  }).catch(() => null);
}

export async function maybeEmitWebhookSignatureInvalidAlert(input: {
  prisma: PrismaClient;
  provider: "TWILIO" | "VAPI";
  endpoint: string;
  reason: string;
}) {
  const recentCount = await input.prisma.webhookEventLog.count({
    where: {
      provider: input.provider,
      endpoint: input.endpoint,
      reason: input.reason,
      createdAt: { gte: minutesAgo(15) }
    }
  });
  if (recentCount < 5) return null;

  const existing = await input.prisma.auditLog.findFirst({
    where: {
      action: "SECURITY_ALERT_WEBHOOK_SIGNATURE_INVALID_SPIKE",
      createdAt: { gte: minutesAgo(60) },
      AND: [
        { metadataJson: { contains: `"provider":"${input.provider}"` } },
        { metadataJson: { contains: `"endpoint":"${input.endpoint}"` } },
        { metadataJson: { contains: `"reason":"${input.reason}"` } }
      ]
    },
    select: { id: true }
  });
  if (existing) return null;

  return input.prisma.auditLog.create({
    data: {
      actorUserId: "security-alerts",
      actorRole: "SYSTEM",
      action: "SECURITY_ALERT_WEBHOOK_SIGNATURE_INVALID_SPIKE",
      metadataJson: JSON.stringify({
        provider: input.provider,
        endpoint: input.endpoint,
        reason: input.reason,
        count: recentCount,
        windowMinutes: 15
      })
    }
  });
}
