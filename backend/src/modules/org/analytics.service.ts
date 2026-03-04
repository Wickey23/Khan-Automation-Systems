import type { PrismaClient } from "@prisma/client";
import { isPrismaMissingColumnError } from "../../lib/prisma-errors";

type AnalyticsRange = "7d" | "30d" | "custom";

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function shiftDays(base: Date, days: number) {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function makeDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function resolveRange(input: { range?: string; start?: string; end?: string }) {
  const range = (input.range || "7d") as AnalyticsRange;
  const now = new Date();
  if (range === "custom" && input.start && input.end) {
    const start = new Date(input.start);
    const end = new Date(input.end);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
      return { range, start: startOfDay(start), end: endOfDay(end) };
    }
  }
  if (range === "30d") {
    return { range, start: startOfDay(shiftDays(now, -29)), end: endOfDay(now) };
  }
  return { range: "7d" as const, start: startOfDay(shiftDays(now, -6)), end: endOfDay(now) };
}

function safeDivide(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return numerator / denominator;
}

export async function computeOrgAnalytics(
  prisma: PrismaClient,
  orgId: string,
  input: { range?: string; start?: string; end?: string }
) {
  const window = resolveRange(input);
  const whereWindow = { gte: window.start, lte: window.end };

  const [calls, leads, threads, messages] = await Promise.all([
    prisma.callLog.findMany({
      where: { orgId, startedAt: whereWindow },
      select: {
        id: true,
        startedAt: true,
        durationSec: true,
        outcome: true,
        appointmentRequested: true,
        leadId: true,
        callQualityScore: true
      }
    }),
    prisma.lead.findMany({
      where: { orgId, createdAt: whereWindow },
      select: { id: true, name: true, createdAt: true, source: true }
    }),
    prisma.messageThread.findMany({
      where: { orgId, channel: "SMS", createdAt: whereWindow },
      select: { id: true, createdAt: true }
    }),
    prisma.message.findMany({
      where: { orgId, createdAt: whereWindow },
      select: { threadId: true, direction: true, createdAt: true, metadataJson: true, leadId: true }
    })
  ]);
  let settings: { averageJobValueUsd: number | null } | null = null;
  const [appointmentsBooked, qualifiedLeads, missedCallsRecovered] = await Promise.all([
    prisma.appointment.count({
      where: { orgId, status: { in: ["CONFIRMED", "COMPLETED"] }, createdAt: whereWindow }
    }),
    prisma.lead.count({
      where: { orgId, createdAt: whereWindow, qualified: true }
    }),
    prisma.callClassificationLog.count({
      where: { orgId, createdAt: whereWindow, classification: "MISSED_CALL_RECOVERY" }
    })
  ]);
  try {
    settings = await prisma.businessSettings.findUnique({
      where: { orgId },
      select: { averageJobValueUsd: true }
    });
  } catch (error) {
    if (!isPrismaMissingColumnError(error)) throw error;
    settings = null;
  }

  const totalCalls = calls.length;
  const answeredCalls = calls.filter((call) => call.outcome !== "MISSED").length;
  const missedCalls = calls.filter((call) => call.outcome === "MISSED").length;
  const appointmentRequests = calls.filter(
    (call) => call.appointmentRequested || call.outcome === "APPOINTMENT_REQUEST"
  ).length;
  const totalDuration = calls.reduce((sum, call) => sum + (call.durationSec || 0), 0);
  const avgCallDurationSec = totalCalls ? totalDuration / totalCalls : 0;
  const leadsCreated = leads.filter((lead) => lead.source === "PHONE_CALL").length;
  const unknownLeadNames = leads.filter((lead) => {
    const name = String((lead as unknown as { name?: string }).name || "").trim().toLowerCase();
    return name === "unknown caller" || name === "unknown contact" || !name;
  }).length;

  const messageStatsByThread = new Map<string, { inbound: number; outbound: number }>();
  for (const message of messages) {
    const current = messageStatsByThread.get(message.threadId) || { inbound: 0, outbound: 0 };
    if (message.direction === "INBOUND") current.inbound += 1;
    if (message.direction === "OUTBOUND") current.outbound += 1;
    messageStatsByThread.set(message.threadId, current);
  }

  const engagedThreads = threads.filter((thread) => {
    const stats = messageStatsByThread.get(thread.id);
    return Boolean(stats && stats.inbound > 0 && stats.outbound > 0);
  }).length;

  const answerRate = safeDivide(answeredCalls, totalCalls);
  const leadCaptureRate = safeDivide(leadsCreated, totalCalls);
  const smsEngagementRate = safeDivide(engagedThreads, threads.length);
  const qualityCalls = calls.filter((call) => typeof call.callQualityScore === "number");
  const callQualityAverage = qualityCalls.length
    ? qualityCalls.reduce((sum, call) => sum + Number(call.callQualityScore || 0), 0) / qualityCalls.length
    : 0;

  const autoRecoveryMessages = messages.filter((message) => message.metadataJson.includes("\"recovery\":true"));
  const autoRecoverySent = autoRecoveryMessages.length;
  const recoveryThreadIds = new Set(autoRecoveryMessages.map((message) => message.threadId));
  const autoRecoveryLeadConversions = messages.filter(
    (message) => recoveryThreadIds.has(message.threadId) && message.direction === "INBOUND" && Boolean(message.leadId)
  ).length;
  const conversionRate = qualifiedLeads > 0 ? appointmentsBooked / qualifiedLeads : 0;
  const averageJobValueUsd = Math.max(0, settings?.averageJobValueUsd || 650);
  const estimatedRevenueOpportunityUsd = appointmentsBooked * averageJobValueUsd;

  const latestCallAt = calls
    .map((call) => call.startedAt.getTime())
    .sort((a, b) => b - a)[0];
  const latestLeadAt = leads
    .map((lead) => lead.createdAt.getTime())
    .sort((a, b) => b - a)[0];
  const latestMessageAt = messages
    .map((message) => message.createdAt.getTime())
    .sort((a, b) => b - a)[0];
  const dataFreshnessAt = [latestCallAt, latestLeadAt, latestMessageAt]
    .filter((value): value is number => Number.isFinite(value))
    .sort((a, b) => b - a)[0];

  const dayKeys: string[] = [];
  const callsByDay = new Map<string, number>();
  const leadsByDay = new Map<string, number>();
  let cursor = new Date(window.start);
  while (cursor <= window.end) {
    const key = makeDayKey(cursor);
    dayKeys.push(key);
    callsByDay.set(key, 0);
    leadsByDay.set(key, 0);
    cursor = shiftDays(cursor, 1);
  }

  for (const call of calls) {
    const key = makeDayKey(call.startedAt);
    callsByDay.set(key, (callsByDay.get(key) || 0) + 1);
  }

  for (const lead of leads) {
    const key = makeDayKey(lead.createdAt);
    leadsByDay.set(key, (leadsByDay.get(key) || 0) + 1);
  }

  const outcomeCounts = calls.reduce<Record<string, number>>((acc, call) => {
    const key = String(call.outcome || "UNKNOWN");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    range: window.range,
    start: window.start.toISOString(),
    end: window.end.toISOString(),
    kpis: {
      totalCalls,
      answeredCalls,
      answerRate,
      leadsCreated,
      leadCaptureRate,
      avgCallDurationSec,
      smsThreads: threads.length,
      smsEngagedThreads: engagedThreads,
      smsEngagementRate,
      appointmentRequests,
      missedCalls,
      callQualityAverage,
      autoRecoverySent,
      autoRecoveryLeadConversions,
      unknownNameRate: safeDivide(unknownLeadNames, leads.length),
      dataFreshnessAt: dataFreshnessAt ? new Date(dataFreshnessAt).toISOString() : null,
      appointmentsBooked,
      qualifiedLeads,
      missedCallsRecovered,
      conversionRate,
      averageJobValueUsd,
      estimatedRevenueOpportunityUsd
    },
    charts: {
      callsPerDay: dayKeys.map((day) => ({ day, value: callsByDay.get(day) || 0 })),
      leadsPerDay: dayKeys.map((day) => ({ day, value: leadsByDay.get(day) || 0 })),
      outcomeBreakdown: Object.entries(outcomeCounts).map(([outcome, value]) => ({ outcome, value }))
    }
  };
}

export function shapeOrgAnalyticsForRole<T extends {
  charts: {
    callsPerDay: unknown[];
    leadsPerDay: unknown[];
    outcomeBreakdown: unknown[];
  };
}>(data: T, role: string | null | undefined) {
  if (role !== "CLIENT") return data;
  return {
    ...data,
    charts: {
      callsPerDay: [],
      leadsPerDay: [],
      outcomeBreakdown: []
    }
  } as T;
}
