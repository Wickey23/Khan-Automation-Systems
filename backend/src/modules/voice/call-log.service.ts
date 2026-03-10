import type { Prisma, PrismaClient } from "@prisma/client";
import { parseTwilioDuration } from "./twilio-voice-parser";
import { normalizePhoneForLookup } from "./phone-number-normalizer";

function nowIfMissing(value: Date | null | undefined) {
  return value || new Date();
}

export async function createInboundTwilioCall(input: {
  prisma: PrismaClient;
  orgId: string;
  callSid: string;
  parentCallSid?: string | null;
  accountSid?: string | null;
  fromNumber: string;
  toNumber: string;
  callStatus?: string | null;
  direction?: string | null;
  forwardedToNumber?: string | null;
  source?: string;
  rawPayload?: Record<string, unknown>;
}) {
  const from = normalizePhoneForLookup(input.fromNumber);
  const to = normalizePhoneForLookup(input.toNumber);
  return input.prisma.callLog.upsert({
    where: {
      orgId_providerCallId: {
        orgId: input.orgId,
        providerCallId: input.callSid
      }
    },
    update: {
      parentCallSid: input.parentCallSid || undefined,
      accountSid: input.accountSid || undefined,
      fromNumber: from.normalized || from.raw || "unknown",
      toNumber: to.normalized || to.raw || "unknown",
      forwardedToNumber: input.forwardedToNumber || undefined,
      direction: input.direction || "inbound",
      initialWebhookAt: new Date(),
      callStatus: input.callStatus || undefined,
      rawJson: (input.rawPayload as Prisma.InputJsonValue | undefined) || undefined
    },
    create: {
      orgId: input.orgId,
      providerCallId: input.callSid,
      parentCallSid: input.parentCallSid || null,
      accountSid: input.accountSid || null,
      fromNumber: from.normalized || from.raw || "unknown",
      toNumber: to.normalized || to.raw || "unknown",
      forwardedToNumber: input.forwardedToNumber || null,
      direction: input.direction || "inbound",
      initialWebhookAt: new Date(),
      startedAt: new Date(),
      callStatus: input.callStatus || "initiated",
      outcome: "MESSAGE_TAKEN",
      source: input.source || "twilio",
      rawJson: (input.rawPayload as Prisma.InputJsonValue | undefined) || undefined
    }
  });
}

export async function updateTwilioCallStatus(input: {
  prisma: PrismaClient;
  callSid: string;
  parentCallSid?: string | null;
  payload: Record<string, unknown>;
}) {
  const match =
    (await input.prisma.callLog.findFirst({
      where: { providerCallId: input.callSid },
      orderBy: { createdAt: "desc" }
    })) ||
    (input.parentCallSid
      ? await input.prisma.callLog.findFirst({
          where: { providerCallId: input.parentCallSid },
          orderBy: { createdAt: "desc" }
        })
      : null);

  if (!match) return null;

  const callStatus = String(input.payload.CallStatus || "").toLowerCase();
  const dialCallStatus = String(input.payload.DialCallStatus || "").toLowerCase();
  const duration = parseTwilioDuration(input.payload.CallDuration ?? input.payload.Duration);
  const answeredBy = String(input.payload.AnsweredBy || "").trim() || null;
  const finalStatus = dialCallStatus || callStatus;
  const missedReason =
    finalStatus === "busy"
      ? "BUSY"
      : finalStatus === "no-answer"
        ? "NO_ANSWER"
        : finalStatus === "failed"
          ? "FAILED"
          : undefined;
  const answered =
    finalStatus === "answered" ||
    finalStatus === "in-progress" ||
    finalStatus === "completed" ||
    callStatus === "in-progress";

  return input.prisma.callLog.update({
    where: { id: match.id },
    data: {
      parentCallSid: input.parentCallSid || match.parentCallSid,
      accountSid: String(input.payload.AccountSid || "").trim() || match.accountSid,
      callStatus: callStatus || match.callStatus,
      dialCallStatus: dialCallStatus || match.dialCallStatus,
      answeredBy: answeredBy || match.answeredBy,
      answeredAt: answered ? nowIfMissing(match.answeredAt) : match.answeredAt,
      endedAt: ["completed", "busy", "no-answer", "failed", "canceled"].includes(finalStatus)
        ? new Date()
        : match.endedAt,
      completedAt: ["completed", "busy", "no-answer", "failed", "canceled"].includes(finalStatus)
        ? nowIfMissing(match.completedAt)
        : match.completedAt,
      durationSec: duration ?? match.durationSec,
      missedReason: missedReason || match.missedReason,
      rawStatusPayload: input.payload as Prisma.InputJsonValue,
      forwardedToNumber: String(input.payload.To || "").trim() || match.forwardedToNumber,
      unansweredTransfer:
        ["busy", "no-answer", "failed"].includes(finalStatus) ? Boolean(match.transferredAt || match.forwardedToNumber) : match.unansweredTransfer,
      outcome:
        missedReason === "BUSY" || missedReason === "NO_ANSWER" || missedReason === "FAILED"
          ? "ABANDONED"
          : match.outcome
    }
  });
}

export async function markCallMissedReason(input: {
  prisma: PrismaClient;
  callLogId: string;
  missedReason: string;
}) {
  return input.prisma.callLog.update({
    where: { id: input.callLogId },
    data: {
      missedReason: input.missedReason,
      callStatus: "failed",
      endedAt: new Date(),
      completedAt: new Date(),
      outcome: input.missedReason === "UNMAPPED_NUMBER" || input.missedReason === "NO_FORWARDING_NUMBER" ? "ABANDONED" : undefined
    }
  });
}
