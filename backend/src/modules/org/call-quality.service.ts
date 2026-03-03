import type { Prisma, PrismaClient } from "@prisma/client";
import { emitRuntimeEvent } from "../runtime/runtime-events.service";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readRawNumber(rawJson: unknown, path: string[]) {
  let cursor: unknown = rawJson;
  for (const segment of path) {
    if (!cursor || typeof cursor !== "object") return null;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  const numeric = Number(cursor);
  return Number.isFinite(numeric) ? numeric : null;
}

export function computeCallQualityBreakdown(input: {
  durationSec: number | null;
  appointmentRequested: boolean;
  leadId: string | null;
  rawJson: unknown;
}) {
  const duration = input.durationSec || 0;
  const durationScore = duration >= 20 ? 20 : 0;
  const shortHangupScore = duration > 0 && duration < 10 ? -20 : 10;

  const providerRaw =
    readRawNumber(input.rawJson, ["analysis", "successEvaluation"]) ??
    readRawNumber(input.rawJson, ["analysis", "score"]) ??
    readRawNumber(input.rawJson, ["successEvaluation"]);
  const providerNormalized =
    providerRaw === null
      ? 12.5
      : providerRaw <= 1
        ? providerRaw * 25
        : providerRaw <= 10
          ? (providerRaw / 10) * 25
          : clamp(providerRaw, 0, 25);

  const appointmentScore = input.appointmentRequested ? 20 : 0;
  const leadScore = input.leadId ? 20 : 0;

  const sentimentRaw =
    readRawNumber(input.rawJson, ["analysis", "sentiment"]) ??
    readRawNumber(input.rawJson, ["analysis", "sentimentScore"]);
  const sentimentScore = sentimentRaw === null ? 0 : clamp(sentimentRaw * 5, -5, 5);

  const total = clamp(
    Math.round(durationScore + shortHangupScore + providerNormalized + appointmentScore + leadScore + sentimentScore),
    0,
    100
  );

  return {
    version: "v1",
    total,
    components: {
      durationScore,
      shortHangupScore,
      providerNormalized,
      appointmentScore,
      leadScore,
      sentimentScore
    }
  };
}

export async function computeCallQuality(input: { prisma: PrismaClient; callLogId: string }) {
  const call = await input.prisma.callLog.findUnique({
    where: { id: input.callLogId },
    select: {
      id: true,
      orgId: true,
      providerCallId: true,
      durationSec: true,
      appointmentRequested: true,
      leadId: true,
      rawJson: true
    }
  });
  if (!call) return null;

  const breakdown = computeCallQualityBreakdown({
    durationSec: call.durationSec,
    appointmentRequested: call.appointmentRequested,
    leadId: call.leadId,
    rawJson: call.rawJson
  });

  await input.prisma.callLog.update({
    where: { id: call.id },
    data: {
      callQualityScore: breakdown.total,
      callQualityBreakdownJson: breakdown as unknown as Prisma.InputJsonValue,
      callQualityVersion: breakdown.version
    }
  });

  await emitRuntimeEvent({
    prisma: input.prisma,
    type: "CALL_QUALITY_COMPUTED",
    orgId: call.orgId,
    payload: {
      callLogId: call.id,
      providerCallId: call.providerCallId,
      score: breakdown.total,
      version: breakdown.version
    }
  });

  return breakdown;
}
