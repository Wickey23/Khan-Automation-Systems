import type { PrismaClient } from "@prisma/client";
import { env } from "../../config/env";
import { hasProMessaging, isActiveSubscriptionStatus } from "../billing/plan-features";
import { emitRuntimeEvent } from "../runtime/runtime-events.service";
import { sendSmsMessage } from "../twilio/twilio.service";
import { normalizePhoneE164 } from "../voice/caller-profile.service";

function parseIntSafe(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildWindowBucket(date: Date, windowHours: number) {
  const bucketMs = windowHours * 60 * 60 * 1000;
  return String(Math.floor(date.getTime() / bucketMs));
}

function reasonForAutoRecovery(call: {
  durationSec: number | null;
  aiStartedAt: Date | null;
  transferredAt: Date | null;
  outcome: string;
}) {
  if ((call.durationSec || 0) > 0 && (call.durationSec || 0) < 10) return "SHORT_CALL";
  if (!call.aiStartedAt) return "NO_AI_ENGAGEMENT";
  if (call.transferredAt && call.outcome === "MISSED") return "TRANSFER_FAILED";
  return null;
}

async function writeSkipAudit(
  prisma: PrismaClient,
  orgId: string,
  payload: Record<string, unknown>
) {
  await prisma.auditLog.create({
    data: {
      orgId,
      actorUserId: "auto-recovery",
      actorRole: "SYSTEM",
      action: "AUTO_RECOVERY_SMS_SKIPPED",
      metadataJson: JSON.stringify(payload)
    }
  });
}

export async function evaluateAndSendAutoRecovery(input: { prisma: PrismaClient; callLogId: string }) {
  const call = await input.prisma.callLog.findUnique({
    where: { id: input.callLogId },
    include: { organization: true }
  });
  if (!call) return { sent: false, skipped: "CALL_NOT_FOUND" as const };

  const reasonCode = reasonForAutoRecovery({
    durationSec: call.durationSec,
    aiStartedAt: call.aiStartedAt,
    transferredAt: call.transferredAt,
    outcome: String(call.outcome || "")
  });
  if (!reasonCode) return { sent: false, skipped: "TRIGGER_NOT_MET" as const };

  if (env.AUTO_RECOVERY_ENABLED !== "true") {
    return { sent: false, skipped: "FEATURE_FLAG_DISABLED" as const };
  }

  const hasPro = await hasProMessaging(input.prisma, call.orgId);
  const status = String(call.organization.subscriptionStatus || "").toLowerCase();
  if (!hasPro || !isActiveSubscriptionStatus(status)) {
    await writeSkipAudit(input.prisma, call.orgId, { callLogId: call.id, reasonCode, skipped: "PLAN_OR_BILLING_BLOCKED" });
    return { sent: false, skipped: "PLAN_OR_BILLING_BLOCKED" as const };
  }

  const settings = await input.prisma.businessSettings.findUnique({ where: { orgId: call.orgId } });
  const autoRecoveryEnabled = (() => {
    if (!settings?.policiesJson) return false;
    try {
      const parsed = JSON.parse(settings.policiesJson) as Record<string, unknown>;
      return Boolean(parsed.autoRecoveryEnabled);
    } catch {
      return false;
    }
  })();
  if (!autoRecoveryEnabled) {
    await writeSkipAudit(input.prisma, call.orgId, { callLogId: call.id, reasonCode, skipped: "AUTO_RECOVERY_NOT_ENABLED" });
    return { sent: false, skipped: "AUTO_RECOVERY_NOT_ENABLED" as const };
  }

  const activePhone = await input.prisma.phoneNumber.findFirst({
    where: { orgId: call.orgId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" }
  });
  if (!activePhone || activePhone.provider !== "TWILIO") {
    await writeSkipAudit(input.prisma, call.orgId, { callLogId: call.id, reasonCode, skipped: "TWILIO_PROVIDER_REQUIRED" });
    return { sent: false, skipped: "TWILIO_PROVIDER_REQUIRED" as const };
  }

  const to = normalizePhoneE164(call.fromNumber);
  if (!to) {
    await writeSkipAudit(input.prisma, call.orgId, { callLogId: call.id, reasonCode, skipped: "CALLER_NUMBER_MISSING" });
    return { sent: false, skipped: "CALLER_NUMBER_MISSING" as const };
  }

  const lead = await input.prisma.lead.findFirst({
    where: { orgId: call.orgId, phone: to },
    select: { id: true, dnc: true }
  });
  if (lead?.dnc) {
    await writeSkipAudit(input.prisma, call.orgId, { callLogId: call.id, reasonCode, skipped: "DNC_BLOCK" });
    return { sent: false, skipped: "DNC_BLOCK" as const };
  }

  const windowHours = parseIntSafe(env.AUTO_RECOVERY_DEDUPE_WINDOW_HOURS, 2);
  const bucket = buildWindowBucket(new Date(), windowHours);
  try {
    await input.prisma.autoRecoveryDedupe.create({
      data: {
        orgId: call.orgId,
        phoneNumber: to,
        reasonCode,
        windowBucket: bucket
      }
    });
  } catch {
    await writeSkipAudit(input.prisma, call.orgId, { callLogId: call.id, reasonCode, skipped: "DEDUPE_BLOCK" });
    return { sent: false, skipped: "DEDUPE_BLOCK" as const };
  }

  const sinceStartOfDay = new Date();
  sinceStartOfDay.setHours(0, 0, 0, 0);
  const dailyCap = parseIntSafe(env.AUTO_RECOVERY_DAILY_CAP, 50);
  const sentToday = await input.prisma.message.count({
    where: {
      orgId: call.orgId,
      direction: "OUTBOUND",
      createdAt: { gte: sinceStartOfDay },
      metadataJson: { contains: "\"recovery\":true" }
    }
  });
  if (sentToday >= dailyCap) {
    await writeSkipAudit(input.prisma, call.orgId, { callLogId: call.id, reasonCode, skipped: "DAILY_CAP_REACHED" });
    return { sent: false, skipped: "DAILY_CAP_REACHED" as const };
  }

  const thread = await input.prisma.messageThread.upsert({
    where: {
      orgId_channel_contactPhone: {
        orgId: call.orgId,
        channel: "SMS",
        contactPhone: to
      }
    },
    update: { lastMessageAt: new Date() },
    create: {
      orgId: call.orgId,
      channel: "SMS",
      contactPhone: to,
      lastMessageAt: new Date()
    }
  });

  const body = "Sorry we missed your call. How can we help you today?";
  try {
    const statusCallbackUrl = `${env.API_BASE_URL}/api/twilio/sms/status?orgId=${encodeURIComponent(call.orgId)}`;
    const result = await sendSmsMessage({
      from: activePhone.e164Number,
      to,
      body,
      statusCallbackUrl
    });

    await input.prisma.message.create({
      data: {
        threadId: thread.id,
        orgId: call.orgId,
        leadId: lead?.id || null,
        direction: "OUTBOUND",
        status: "SENT",
        body,
        provider: "TWILIO",
        providerMessageId: result.sid || null,
        fromNumber: activePhone.e164Number,
        toNumber: to,
        metadataJson: JSON.stringify({
          recovery: true,
          reasonCode,
          callLogId: call.id
        }),
        sentAt: new Date()
      }
    });

    await input.prisma.auditLog.create({
      data: {
        orgId: call.orgId,
        actorUserId: "auto-recovery",
        actorRole: "SYSTEM",
        action: "AUTO_RECOVERY_SMS_SENT",
        metadataJson: JSON.stringify({ callLogId: call.id, reasonCode, to, messageSid: result.sid || null })
      }
    });
    await emitRuntimeEvent({
      prisma: input.prisma,
      type: "AUTO_RECOVERY_SENT",
      orgId: call.orgId,
      payload: { callLogId: call.id, reasonCode, to, messageSid: result.sid || null }
    });
    return { sent: true, reasonCode };
  } catch (error) {
    await writeSkipAudit(input.prisma, call.orgId, {
      callLogId: call.id,
      reasonCode,
      skipped: "SEND_FAILED",
      message: error instanceof Error ? error.message : "unknown"
    });
    return { sent: false, skipped: "SEND_FAILED" as const };
  }
}
