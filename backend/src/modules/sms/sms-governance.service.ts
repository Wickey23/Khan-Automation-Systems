import { AppointmentRequestEventType, type PrismaClient } from "@prisma/client";
import { env } from "../../config/env";
import { maybeEmitSmsSuppressionAlert } from "../notifications/security-alert.service";

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const ORG_SMS_HOURLY_CAP = parsePositiveInt(env.SMS_ORG_HOURLY_CAP, 60);
const ORG_SMS_DAILY_CAP = parsePositiveInt(env.SMS_ORG_DAILY_CAP, 250);
const REQUEST_SLOT_OFFER_MAX = parsePositiveInt(env.APPOINTMENT_REQUEST_SLOT_OFFER_MAX, 4);
const REQUEST_CLARIFICATION_MAX = parsePositiveInt(env.APPOINTMENT_REQUEST_CLARIFICATION_MAX, 3);

const CLARIFICATION_SOURCES = [
  "appointment_request_reply_ambiguous",
  "appointment_request_reply_invalid",
  "appointment_request_reply_multiple_matches",
  "appointment_request_reply_stale"
];

type GovernanceBlockReason =
  | "ORG_SMS_HOURLY_CAP"
  | "ORG_SMS_DAILY_CAP"
  | "REQUEST_SLOT_OFFER_CAP"
  | "REQUEST_CLARIFICATION_CAP";

async function writeSuppressionAudit(input: {
  prisma: PrismaClient;
  orgId: string;
  actorUserId: string;
  actorRole: string;
  reason: GovernanceBlockReason;
  source: string;
  metadata?: Record<string, unknown>;
}) {
  await input.prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      action: "SMS_AUTOMATION_SUPPRESSED",
      metadataJson: JSON.stringify({
        reason: input.reason,
        source: input.source,
        ...(input.metadata || {})
      })
    }
  });
  console.warn(
    JSON.stringify({
      event: "SMS_AUTOMATION_SUPPRESSED",
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      reason: input.reason,
      source: input.source,
      ...(input.metadata || {})
    })
  );
  await maybeEmitSmsSuppressionAlert({
    prisma: input.prisma,
    orgId: input.orgId,
    reason: input.reason,
    source: input.source,
    requestId: typeof input.metadata?.requestId === "string" ? input.metadata.requestId : null
  }).catch(() => null);
}

export async function assertOrgSmsQuota(input: {
  prisma: PrismaClient;
  orgId: string;
  actorUserId: string;
  actorRole: string;
  source: string;
  metadata?: Record<string, unknown>;
}) {
  const now = new Date();
  const hourStart = new Date(now.getTime() - 60 * 60 * 1000);
  const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [sentLastHour, sentLastDay] = await Promise.all([
    input.prisma.message.count({
      where: {
        orgId: input.orgId,
        direction: "OUTBOUND",
        createdAt: { gte: hourStart }
      }
    }),
    input.prisma.message.count({
      where: {
        orgId: input.orgId,
        direction: "OUTBOUND",
        createdAt: { gte: dayStart }
      }
    })
  ]);

  if (sentLastHour >= ORG_SMS_HOURLY_CAP) {
    await writeSuppressionAudit({
      ...input,
      reason: "ORG_SMS_HOURLY_CAP",
      metadata: { sentLastHour, cap: ORG_SMS_HOURLY_CAP, ...(input.metadata || {}) }
    });
    return { ok: false as const, reason: "ORG_SMS_HOURLY_CAP" as const };
  }
  if (sentLastDay >= ORG_SMS_DAILY_CAP) {
    await writeSuppressionAudit({
      ...input,
      reason: "ORG_SMS_DAILY_CAP",
      metadata: { sentLastDay, cap: ORG_SMS_DAILY_CAP, ...(input.metadata || {}) }
    });
    return { ok: false as const, reason: "ORG_SMS_DAILY_CAP" as const };
  }
  return { ok: true as const };
}

export async function assertRequestSlotOfferAllowed(input: {
  prisma: PrismaClient;
  orgId: string;
  requestId: string;
  actorUserId: string;
  actorRole: string;
  source: string;
}) {
  const offersSent = await input.prisma.appointmentRequestEvent.count({
    where: {
      orgId: input.orgId,
      appointmentRequestId: input.requestId,
      type: AppointmentRequestEventType.SLOTS_OFFERED
    }
  });
  if (offersSent >= REQUEST_SLOT_OFFER_MAX) {
    await writeSuppressionAudit({
      prisma: input.prisma,
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      reason: "REQUEST_SLOT_OFFER_CAP",
      source: input.source,
      metadata: { requestId: input.requestId, offersSent, cap: REQUEST_SLOT_OFFER_MAX }
    });
    return { ok: false as const, reason: "REQUEST_SLOT_OFFER_CAP" as const };
  }
  return { ok: true as const };
}

export async function assertRequestClarificationAllowed(input: {
  prisma: PrismaClient;
  orgId: string;
  requestId: string;
  actorUserId: string;
  actorRole: string;
  source: string;
}) {
  const count = await input.prisma.message.count({
    where: {
      orgId: input.orgId,
      direction: "OUTBOUND",
      metadataJson: { contains: `"appointmentRequestId":"${input.requestId}"` },
      OR: CLARIFICATION_SOURCES.map((source) => ({
        metadataJson: { contains: `"source":"${source}"` }
      }))
    }
  });
  if (count >= REQUEST_CLARIFICATION_MAX) {
    await writeSuppressionAudit({
      prisma: input.prisma,
      orgId: input.orgId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      reason: "REQUEST_CLARIFICATION_CAP",
      source: input.source,
      metadata: { requestId: input.requestId, clarificationsSent: count, cap: REQUEST_CLARIFICATION_MAX }
    });
    return { ok: false as const, reason: "REQUEST_CLARIFICATION_CAP" as const };
  }
  return { ok: true as const };
}

export function isClarificationSource(source: string) {
  return CLARIFICATION_SOURCES.includes(source);
}
