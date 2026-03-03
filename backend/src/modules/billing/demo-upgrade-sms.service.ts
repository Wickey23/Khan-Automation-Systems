import { Prisma, type PrismaClient } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { sendSmsMessage } from "../twilio/twilio.service";

function normalizePhone(input: string) {
  const raw = String(input || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+")) return `+${digits}`;
  return `+${digits}`;
}

function asPositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const COOLDOWN_HOURS = asPositiveInt(env.GUIDED_DEMO_UPGRADE_SMS_COOLDOWN_HOURS, 24);

async function writeAuditLog(input: {
  prismaClient: PrismaClient;
  orgId: string;
  action: string;
  metadata: Record<string, unknown>;
}) {
  await input.prismaClient.auditLog.create({
    data: {
      orgId: input.orgId,
      actorUserId: "guided-demo",
      actorRole: "SYSTEM",
      action: input.action,
      metadataJson: JSON.stringify(input.metadata)
    }
  });
}

export async function sendThrottledUpgradeSms(input: {
  prismaClient?: PrismaClient;
  orgId: string;
  callerPhone: string;
  now?: Date;
  businessName: string;
}) {
  const prismaClient = input.prismaClient || prisma;
  const now = input.now || new Date();
  const callerPhone = normalizePhone(input.callerPhone);
  if (!callerPhone) {
    await writeAuditLog({
      prismaClient,
      orgId: input.orgId,
      action: "DEMO_UPGRADE_SMS_FAILED",
      metadata: { reason: "caller_phone_missing" }
    });
    return { sent: false as const, reason: "caller_phone_missing" };
  }

  const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
  const shouldSend = await prismaClient.$transaction(
    async (tx) => {
      const row = await tx.demoUpgradeSmsThrottle.findUnique({
        where: { orgId_callerPhone: { orgId: input.orgId, callerPhone } }
      });
      if (row && now.getTime() - row.lastSentAt.getTime() < cooldownMs) {
        return false;
      }
      await tx.demoUpgradeSmsThrottle.upsert({
        where: { orgId_callerPhone: { orgId: input.orgId, callerPhone } },
        update: { lastSentAt: now },
        create: { orgId: input.orgId, callerPhone, lastSentAt: now }
      });
      return true;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  if (!shouldSend) {
    await writeAuditLog({
      prismaClient,
      orgId: input.orgId,
      action: "DEMO_UPGRADE_SMS_THROTTLED",
      metadata: { callerPhone, cooldownHours: COOLDOWN_HOURS }
    });
    return { sent: false as const, reason: "throttled" };
  }

  const activePhone = await prismaClient.phoneNumber.findFirst({
    where: { orgId: input.orgId, status: "ACTIVE", provider: "TWILIO" },
    orderBy: { createdAt: "desc" },
    select: { e164Number: true }
  });

  if (!activePhone?.e164Number) {
    await writeAuditLog({
      prismaClient,
      orgId: input.orgId,
      action: "DEMO_UPGRADE_SMS_FAILED",
      metadata: { callerPhone, reason: "twilio_sender_missing" }
    });
    return { sent: false as const, reason: "twilio_sender_missing" };
  }

  const body = String(env.GUIDED_DEMO_UPGRADE_SMS_TEMPLATE || "")
    .replace(/\{\{\s*businessName\s*\}\}/g, input.businessName)
    .trim();

  try {
    const statusCallbackUrl = `${env.API_BASE_URL}/api/twilio/sms/status?orgId=${encodeURIComponent(input.orgId)}`;
    const sent = await sendSmsMessage({
      from: activePhone.e164Number,
      to: callerPhone,
      body: body || `Thanks for calling ${input.businessName}. Upgrade in billing to continue AI call handling.`,
      statusCallbackUrl
    });
    await writeAuditLog({
      prismaClient,
      orgId: input.orgId,
      action: "DEMO_UPGRADE_SMS_SENT",
      metadata: { callerPhone, messageSid: sent.sid, status: sent.status || null }
    });
    return { sent: true as const, reason: null, messageSid: sent.sid };
  } catch (error) {
    await writeAuditLog({
      prismaClient,
      orgId: input.orgId,
      action: "DEMO_UPGRADE_SMS_FAILED",
      metadata: {
        callerPhone,
        reason: error instanceof Error ? error.message : "unknown_error"
      }
    });
    return { sent: false as const, reason: "send_failed" };
  }
}
