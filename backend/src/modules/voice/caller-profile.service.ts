import type { CallLogOutcome, PrismaClient } from "@prisma/client";

const writeThrottle = new Map<string, number>();

export function normalizePhoneE164(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function nowMs() {
  return Date.now();
}

export async function upsertCallerProfileOnInbound(input: {
  prisma: PrismaClient;
  orgId: string;
  callerNumber: string;
  callStartedAt?: Date;
}) {
  const phoneNumber = normalizePhoneE164(input.callerNumber);
  if (!phoneNumber) return null;

  const key = `${input.orgId}:${phoneNumber}`;
  const currentMs = nowMs();
  const lastWriteMs = writeThrottle.get(key) || 0;
  if (currentMs - lastWriteMs < 1000) {
    return input.prisma.callerProfile.findUnique({
      where: { orgId_phoneNumber: { orgId: input.orgId, phoneNumber } }
    });
  }

  const existing = await input.prisma.callerProfile.findUnique({
    where: { orgId_phoneNumber: { orgId: input.orgId, phoneNumber } }
  });

  const eventTime = input.callStartedAt || new Date();
  if (existing) {
    const secondsSinceLast = (eventTime.getTime() - existing.lastCallAt.getTime()) / 1000;
    if (secondsSinceLast >= 0 && secondsSinceLast < 5) {
      return existing;
    }

    writeThrottle.set(key, currentMs);
    return input.prisma.callerProfile.update({
      where: { orgId_phoneNumber: { orgId: input.orgId, phoneNumber } },
      data: {
        totalCalls: { increment: 1 },
        lastCallAt: eventTime
      }
    });
  }

  writeThrottle.set(key, currentMs);
  return input.prisma.callerProfile.create({
    data: {
      orgId: input.orgId,
      phoneNumber,
      totalCalls: 1,
      firstCallAt: eventTime,
      lastCallAt: eventTime
    }
  });
}

export async function updateCallerProfileOutcome(input: {
  prisma: PrismaClient;
  orgId: string;
  callerNumber: string;
  outcome: CallLogOutcome | null;
}) {
  const phoneNumber = normalizePhoneE164(input.callerNumber);
  if (!phoneNumber || !input.outcome) return;
  await input.prisma.callerProfile.updateMany({
    where: { orgId: input.orgId, phoneNumber },
    data: { lastOutcome: input.outcome, lastCallAt: new Date() }
  });
}

