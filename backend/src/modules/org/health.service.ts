import type { Organization, PrismaClient } from "@prisma/client";
import { computeReadinessReport } from "../admin/readiness.service";
import { getOrgSlaSeverity } from "../ops/sla-monitor.service";

type HealthLevel = "GREEN" | "YELLOW" | "RED";

function successScoreFromOutcome(outcome: string) {
  if (outcome === "APPOINTMENT_REQUEST") return 1;
  if (outcome === "TRANSFERRED") return 0.9;
  if (outcome === "MESSAGE_TAKEN") return 0.75;
  if (outcome === "SPAM") return 0.2;
  if (outcome === "MISSED") return 0;
  return 0.5;
}

export async function computeOrgHealth(input: {
  prisma: PrismaClient;
  org: Organization;
  env: { VAPI_TOOL_SECRET?: string; CALL_QUALITY_MIN_SCORE?: string };
}) {
  const readiness = await computeReadinessReport({
    prisma: input.prisma,
    org: input.org,
    env: input.env
  });

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [calls, recentLead, recentMessage, recentCall] = await Promise.all([
    input.prisma.callLog.findMany({
      where: { orgId: input.org.id, startedAt: { gte: since30d } },
      select: { outcome: true, callQualityScore: true }
    }),
    input.prisma.lead.findFirst({
      where: { orgId: input.org.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    }),
    input.prisma.message.findFirst({
      where: { orgId: input.org.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    }),
    input.prisma.callLog.findFirst({
      where: { orgId: input.org.id },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true }
    })
  ]);

  const avgSuccessScore =
    calls.length > 0
      ? calls.reduce((sum, row) => sum + successScoreFromOutcome(String(row.outcome || "")), 0) / calls.length
      : 0;
  const qualityValues = calls
    .map((row) => (typeof row.callQualityScore === "number" ? Number(row.callQualityScore) : null))
    .filter((value): value is number => value !== null);
  const avgCallQuality = qualityValues.length
    ? qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length
    : 0;
  const qualityThreshold = Number.parseInt(String(input.env.CALL_QUALITY_MIN_SCORE || "75"), 10) || 75;
  const slaSeverity = getOrgSlaSeverity(input.org.id);

  const lastActivity = [recentLead?.createdAt, recentMessage?.createdAt, recentCall?.startedAt]
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;
  const hasRecentActivity = Boolean(lastActivity && lastActivity >= since7d);

  const checks = {
    ...readiness.checks,
    callSuccessScore: {
      ok: avgSuccessScore >= 0.75,
      reason: `Average call success score is ${(avgSuccessScore * 100).toFixed(0)}%`,
      fixHint: "/app/calls"
    },
    recentActivity: {
      ok: hasRecentActivity,
      reason: hasRecentActivity
        ? `Last activity ${lastActivity?.toISOString()}`
        : "No call, message, or lead activity in the last 7 days",
      fixHint: "/app"
    },
    callQualityAverage: {
      ok: avgCallQuality >= qualityThreshold,
      reason: `Average call quality is ${avgCallQuality.toFixed(1)} (threshold ${qualityThreshold})`,
      fixHint: "/app/calls"
    },
    slaDegradation: {
      ok: slaSeverity !== "CRITICAL",
      reason: `SLA monitor severity is ${slaSeverity}`,
      fixHint: "/admin/events"
    }
  };

  const failed = Object.values(checks).filter((check) => !check.ok).length;
  const missingChecks = Object.entries(checks)
    .filter(([, check]) => !check.ok)
    .map(([key, check]) => ({ key, reason: check.reason, fixHint: check.fixHint }));
  const level: HealthLevel = failed === 0 ? "GREEN" : failed <= 2 ? "YELLOW" : "RED";

  return {
    level,
    score: Math.max(0, 100 - failed * 12),
    checks,
    summary:
      level === "GREEN"
        ? "All systems operational."
        : level === "YELLOW"
          ? "Action recommended on key operational checks."
          : "Critical operational issues need attention.",
    metrics: {
      avgSuccessScore,
      avgCallQuality,
      slaSeverity,
      recentActivityAt: lastActivity ? lastActivity.toISOString() : null
    },
    missingChecks
  };
}
