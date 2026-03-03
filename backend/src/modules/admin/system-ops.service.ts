import type { PrismaClient } from "@prisma/client";
import { env } from "../../config/env";
import { getOrgSlaSeverity } from "../ops/sla-monitor.service";

function safeParseJson(value: string | null | undefined) {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function ratio(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return numerator / denominator;
}

function parseThreshold(input: string, fallback: number) {
  const value = Number.parseFloat(input);
  if (!Number.isFinite(value)) return fallback;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function percentile95(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[index];
}

function extractSeverity(metadataJson: string) {
  const metadata = safeParseJson(metadataJson);
  return String(metadata.severity || "").toUpperCase();
}

export async function computeOperatorDashboard(prisma: PrismaClient) {
  const now = Date.now();
  const since5m = new Date(now - 5 * 60 * 1000);
  const since1h = new Date(now - 60 * 60 * 1000);
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const olderThan1h = new Date(now - 60 * 60 * 1000);

  const [calls5m, calls1h, calls24h, webhookEvents1h, messages1h, vapiEvents1h, calls24hRows, autoRecovery24h, orgs, p1Incidents14d, calls7dByOrg, authFails24h, forbidden24h, rejectedWebhooks24h] =
    await Promise.all([
      prisma.callLog.count({ where: { startedAt: { gte: since5m } } }),
      prisma.callLog.count({ where: { startedAt: { gte: since1h } } }),
      prisma.callLog.count({ where: { startedAt: { gte: since24h } } }),
      prisma.webhookEventLog.findMany({
        where: { createdAt: { gte: since1h } },
        select: { statusCode: true, provider: true, reason: true, orgId: true, createdAt: true }
      }),
      prisma.message.findMany({
        where: { createdAt: { gte: since1h }, provider: "TWILIO" },
        select: { status: true }
      }),
      prisma.webhookEventLog.findMany({
        where: { createdAt: { gte: since1h }, provider: "VAPI" },
        select: { statusCode: true, reason: true }
      }),
      prisma.callLog.findMany({
        where: { startedAt: { gte: since24h } },
        select: { id: true, leadId: true, completedAt: true, endedAt: true, state: true, routingDecisionJson: true, startedAt: true }
      }),
      prisma.auditLog.count({
        where: { createdAt: { gte: since24h }, action: "AUTO_RECOVERY_SMS_SENT" }
      }),
      prisma.organization.findMany({ select: { id: true, name: true } })
      ,
      prisma.auditLog.findMany({
        where: { createdAt: { gte: new Date(now - 14 * 24 * 60 * 60 * 1000) }, action: "INCIDENT_OPENED" },
        select: { metadataJson: true }
      }),
      prisma.callLog.groupBy({
        by: ["orgId"],
        where: { startedAt: { gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } },
        _count: { _all: true }
      }),
      prisma.auditLog.count({ where: { createdAt: { gte: since24h }, action: "AUTH_LOGIN_FAIL" } }),
      prisma.auditLog.count({ where: { createdAt: { gte: since24h }, action: "RBAC_FORBIDDEN" } }),
      prisma.webhookEventLog.count({ where: { createdAt: { gte: since24h }, statusCode: { gte: 400 } } })
    ]);

  const webhookTotal = webhookEvents1h.length;
  const webhookOk = webhookEvents1h.filter((event) => event.statusCode < 400).length;
  const webhookSuccessRate = ratio(webhookOk, webhookTotal);

  const twilioFailures = messages1h.filter((message) => message.status === "FAILED").length;
  const twilioErrorRate = ratio(twilioFailures, messages1h.length);

  const vapiFailures = vapiEvents1h.filter(
    (event) => event.statusCode >= 400 || String(event.reason || "").toLowerCase().includes("error")
  ).length;
  const vapiErrorRate = ratio(vapiFailures, vapiEvents1h.length);

  const tierCounts = new Map<number, number>();
  for (const call of calls24hRows) {
    const raw = call.routingDecisionJson as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") continue;
    const tier = Number(raw.tier);
    if (!Number.isFinite(tier)) continue;
    tierCounts.set(tier, (tierCounts.get(tier) || 0) + 1);
  }

  const callsMissingLeadLinkage = calls24hRows.filter(
    (call) => !call.leadId && (Boolean(call.completedAt) || Boolean(call.endedAt) || call.state === "COMPLETED")
  ).length;
  const callsStuckNonTerminalOver1h = calls24hRows.filter(
    (call) => call.startedAt < olderThan1h && call.state !== "COMPLETED"
  ).length;

  const orgOverrideRows = await prisma.organization.findMany({
    select: { id: true, routingEngineOverride: true, autoRecoveryOverride: true }
  });
  const orgExposureCount = orgOverrideRows.filter(
    (org) => org.routingEngineOverride !== "DEFAULT" || org.autoRecoveryOverride !== "DEFAULT"
  ).length;
  const orgExposurePercent = ratio(orgExposureCount, orgOverrideRows.length);
  const overrideOrgIds = new Set(
    orgOverrideRows
      .filter((org) => org.routingEngineOverride !== "DEFAULT" || org.autoRecoveryOverride !== "DEFAULT")
      .map((org) => org.id)
  );
  const totalCalls7d = calls7dByOrg.reduce((sum, row) => sum + row._count._all, 0);
  const callsWithOverride7d = calls7dByOrg
    .filter((row) => overrideOrgIds.has(row.orgId))
    .reduce((sum, row) => sum + row._count._all, 0);
  const trafficExposurePercent = ratio(callsWithOverride7d, totalCalls7d);

  const p1Durations = p1Incidents14d
    .map((incident) => safeParseJson(incident.metadataJson))
    .filter((metadata) => String(metadata.severity || "").toUpperCase() === "P1")
    .map((metadata) => {
      const detectedAt = new Date(String(metadata.detectedAt || metadata.createdAt || ""));
      const acknowledgedAt = new Date(String(metadata.acknowledgedAt || ""));
      const resolvedAt = new Date(String(metadata.resolvedAt || ""));
      const ackMs =
        Number.isNaN(detectedAt.getTime()) || Number.isNaN(acknowledgedAt.getTime())
          ? null
          : acknowledgedAt.getTime() - detectedAt.getTime();
      const resolutionMs =
        Number.isNaN(detectedAt.getTime()) || Number.isNaN(resolvedAt.getTime())
          ? null
          : resolvedAt.getTime() - detectedAt.getTime();
      return { ackMs, resolutionMs };
    });
  const p1AckTimeP95Ms = percentile95(
    p1Durations.map((row) => row.ackMs).filter((value): value is number => typeof value === "number" && value >= 0)
  );
  const p1ResolutionTimeP95Ms = percentile95(
    p1Durations
      .map((row) => row.resolutionMs)
      .filter((value): value is number => typeof value === "number" && value >= 0)
  );
  const p1IncidentCount14d = p1Durations.length;
  const lowIncidentVolumeWarning = p1IncidentCount14d < 3;
  const securityAnomalyDetected = authFails24h >= 20 || forbidden24h >= 20 || rejectedWebhooks24h >= 20;
  if (securityAnomalyDetected) {
    await prisma.auditLog.create({
      data: {
        actorUserId: "system-security",
        actorRole: "SYSTEM",
        action: "SECURITY_ANOMALY_DETECTED",
        metadataJson: JSON.stringify({ authFails24h, forbidden24h, rejectedWebhooks24h })
      }
    });
  }

  return {
    inboundCalls: { last5m: calls5m, last1h: calls1h, last24h: calls24h },
    webhookSuccessRate,
    twilioErrorRate,
    vapiProcessingErrorRate: vapiErrorRate,
    slaSeverityByOrg: orgs.map((org) => ({
      orgId: org.id,
      orgName: org.name,
      severity: getOrgSlaSeverity(org.id)
    })),
    callsByRoutingTier: [...tierCounts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([tier, count]) => ({ tier, count })),
    autoRecoveryVolumeLast24h: autoRecovery24h,
    callsMissingLeadLinkage,
    callsStuckNonTerminalOver1h,
    orgExposurePercent,
    trafficExposurePercent,
    p1AckTimeP95Ms,
    p1ResolutionTimeP95Ms,
    lowIncidentVolumeWarning,
    securityAnomalies: {
      authFails24h,
      forbidden24h,
      rejectedWebhooks24h
    }
  };
}

export async function computeSystemReadiness(prisma: PrismaClient) {
  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [webhooks24h, calls24h, incidents30d, callQualityRows, anomalies24h, orgs] = await Promise.all([
    prisma.webhookEventLog.findMany({
      where: { createdAt: { gte: since24h } },
      select: { statusCode: true }
    }),
    prisma.callLog.findMany({
      where: { startedAt: { gte: since24h } },
      select: { leadId: true, completedAt: true, endedAt: true }
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: since30d }, action: "INCIDENT_OPENED" },
      select: { metadataJson: true }
    }),
    prisma.callLog.findMany({
      where: { startedAt: { gte: since24h }, callQualityScore: { not: null } },
      select: { callQualityScore: true }
    }),
    prisma.auditLog.count({
      where: { createdAt: { gte: since24h }, action: "DATA_INTEGRITY_ANOMALY" }
    }),
    prisma.organization.findMany({ select: { id: true } })
  ]);

  const webhookSuccessRate = ratio(
    webhooks24h.filter((event) => event.statusCode < 400).length,
    webhooks24h.length
  );
  const completedCalls = calls24h.filter((call) => Boolean(call.completedAt || call.endedAt));
  const leadLinkedCompleted = completedCalls.filter((call) => Boolean(call.leadId));
  const leadLinkageRate = ratio(leadLinkedCompleted.length, completedCalls.length);
  const avgCallQuality =
    callQualityRows.length > 0
      ? callQualityRows.reduce((sum, row) => sum + Number(row.callQualityScore || 0), 0) / callQualityRows.length
      : 0;
  const autoRecoverySent = await prisma.auditLog.count({
    where: { createdAt: { gte: since24h }, action: "AUTO_RECOVERY_SMS_SENT" }
  });
  const autoRecoveryRate = ratio(autoRecoverySent, completedCalls.length);
  const p1IncidentCountLast30d = incidents30d.filter(
    (incident) => extractSeverity(incident.metadataJson) === "P1"
  ).length;

  const distribution = { INFO: 0, WARN: 0, CRITICAL: 0 };
  for (const org of orgs) {
    const severity = getOrgSlaSeverity(org.id);
    distribution[severity] += 1;
  }

  return {
    webhookSuccessRate,
    avgCallQuality,
    autoRecoveryRate,
    leadLinkageRate,
    P1IncidentCountLast30d: p1IncidentCountLast30d,
    SLAStatusDistribution: distribution,
    DataIntegrityAnomalies: anomalies24h
  };
}

const SYSTEMIC_FAIL_CODES = new Set([
  "REPEAT_P1_ROOT_CAUSE",
  "TENANT_ISOLATION_FAILED",
  "CAPACITY_REGRESSION",
  "WEBHOOK_SLO_BREACH",
  "LEAD_LINKAGE_SLO_BREACH",
  "P1_DISCIPLINE_BREACH"
]);

type ScaleGateInput = {
  webhookSuccessRate: number;
  leadLinkageRate: number;
  p1AckTimeP95Ms: number | null;
  p1ResolutionTimeP95Ms: number | null;
  orgExposurePercent: number;
  trafficExposurePercent: number;
  orgExposureThreshold: number;
  trafficExposureThreshold: number;
  p1IncidentCount14d: number;
  evaluationTimestamp: string;
  cooldownStatus: "PASS" | "FAIL";
};

export function evaluateScaleGateSnapshot(input: ScaleGateInput) {
  const failingCriteria: string[] = [];
  if (input.webhookSuccessRate < 0.995) failingCriteria.push("WEBHOOK_SLO_BREACH");
  if (input.leadLinkageRate < 0.98) failingCriteria.push("LEAD_LINKAGE_SLO_BREACH");
  const ackLimitMs = 15 * 60 * 1000;
  const resolutionLimitMs = 4 * 60 * 60 * 1000;
  if (
    (typeof input.p1AckTimeP95Ms === "number" && input.p1AckTimeP95Ms > ackLimitMs) ||
    (typeof input.p1ResolutionTimeP95Ms === "number" && input.p1ResolutionTimeP95Ms > resolutionLimitMs)
  ) {
    failingCriteria.push("P1_DISCIPLINE_BREACH");
  }
  if (input.trafficExposurePercent > input.trafficExposureThreshold) {
    failingCriteria.push("TRAFFIC_EXPOSURE_THRESHOLD_EXCEEDED");
  }
  if (input.orgExposurePercent > input.orgExposureThreshold) {
    failingCriteria.push("ORG_EXPOSURE_THRESHOLD_EXCEEDED");
  }
  if (input.cooldownStatus === "FAIL") {
    failingCriteria.push("SYSTEMIC_COOLDOWN_ACTIVE");
  }

  const systemicFailTriggered = failingCriteria.some((code) => SYSTEMIC_FAIL_CODES.has(code));
  const result: "PASS" | "FAIL" = failingCriteria.length ? "FAIL" : "PASS";
  return {
    result,
    failingCriteria,
    systemicFailTriggered,
    warnings: {
      lowIncidentVolumeWarning: input.p1IncidentCount14d < 3,
      lowIncidentVolumeContext: {
        p1IncidentCount14d: input.p1IncidentCount14d,
        minRecommendedSampleSize: 3
      }
    }
  };
}

export async function computeScaleGate(prisma: PrismaClient, input?: { actorUserId?: string | null; promotionAttempted?: boolean }) {
  const evaluationTimestamp = new Date();
  const now = evaluationTimestamp.getTime();
  const since14d = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [webhooks14d, calls14d, p1Incidents14d, calls7dByOrg, orgs, latestSystemicFail] = await Promise.all([
    prisma.webhookEventLog.findMany({
      where: { createdAt: { gte: since14d } },
      select: { statusCode: true }
    }),
    prisma.callLog.findMany({
      where: { startedAt: { gte: since14d } },
      select: { leadId: true, completedAt: true, endedAt: true }
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: since14d }, action: "INCIDENT_OPENED" },
      select: { metadataJson: true }
    }),
    prisma.callLog.groupBy({
      by: ["orgId"],
      where: { startedAt: { gte: since7d } },
      _count: { _all: true }
    }),
    prisma.organization.findMany({
      select: { id: true, routingEngineOverride: true, autoRecoveryOverride: true }
    }),
    prisma.scaleGateDecisionLog.findFirst({
      where: { result: "FAIL", systemicFailTriggered: true },
      orderBy: { evaluationTimestamp: "desc" },
      select: { evaluationTimestamp: true }
    })
  ]);

  const webhookSuccessRate = ratio(
    webhooks14d.filter((event) => event.statusCode < 400).length,
    webhooks14d.length
  );
  const completedCalls = calls14d.filter((call) => Boolean(call.completedAt || call.endedAt));
  const leadLinkageRate = ratio(completedCalls.filter((call) => Boolean(call.leadId)).length, completedCalls.length);

  const p1Durations = p1Incidents14d
    .map((incident) => safeParseJson(incident.metadataJson))
    .filter((metadata) => String(metadata.severity || "").toUpperCase() === "P1")
    .map((metadata) => {
      const detectedAt = new Date(String(metadata.detectedAt || metadata.createdAt || ""));
      const acknowledgedAt = new Date(String(metadata.acknowledgedAt || ""));
      const resolvedAt = new Date(String(metadata.resolvedAt || ""));
      const ackMs =
        Number.isNaN(detectedAt.getTime()) || Number.isNaN(acknowledgedAt.getTime())
          ? null
          : acknowledgedAt.getTime() - detectedAt.getTime();
      const resolutionMs =
        Number.isNaN(detectedAt.getTime()) || Number.isNaN(resolvedAt.getTime())
          ? null
          : resolvedAt.getTime() - detectedAt.getTime();
      return { ackMs, resolutionMs };
    });
  const p1AckTimeP95Ms = percentile95(
    p1Durations.map((row) => row.ackMs).filter((value): value is number => typeof value === "number" && value >= 0)
  );
  const p1ResolutionTimeP95Ms = percentile95(
    p1Durations
      .map((row) => row.resolutionMs)
      .filter((value): value is number => typeof value === "number" && value >= 0)
  );

  const orgExposureCount = orgs.filter(
    (org) => org.routingEngineOverride !== "DEFAULT" || org.autoRecoveryOverride !== "DEFAULT"
  ).length;
  const orgExposurePercent = ratio(orgExposureCount, orgs.length);
  const overrideOrgIds = new Set(
    orgs
      .filter((org) => org.routingEngineOverride !== "DEFAULT" || org.autoRecoveryOverride !== "DEFAULT")
      .map((org) => org.id)
  );
  const totalCalls7d = calls7dByOrg.reduce((sum, row) => sum + row._count._all, 0);
  const callsWithOverride7d = calls7dByOrg
    .filter((row) => overrideOrgIds.has(row.orgId))
    .reduce((sum, row) => sum + row._count._all, 0);
  const trafficExposurePercent = ratio(callsWithOverride7d, totalCalls7d);

  const orgExposureThreshold = parseThreshold(env.OPS_ORG_EXPOSURE_THRESHOLD, 0.5);
  const trafficExposureThreshold = parseThreshold(env.OPS_TRAFFIC_EXPOSURE_THRESHOLD, 0.5);

  let cooldownStatus: "PASS" | "FAIL" = "PASS";
  let cooldownRequired = false;
  if (latestSystemicFail?.evaluationTimestamp) {
    const requiredClearDate = new Date(latestSystemicFail.evaluationTimestamp.getTime() + 7 * 24 * 60 * 60 * 1000);
    cooldownRequired = true;
    if (evaluationTimestamp < requiredClearDate) cooldownStatus = "FAIL";
  }

  const evaluated = evaluateScaleGateSnapshot({
    webhookSuccessRate,
    leadLinkageRate,
    p1AckTimeP95Ms,
    p1ResolutionTimeP95Ms,
    orgExposurePercent,
    trafficExposurePercent,
    orgExposureThreshold,
    trafficExposureThreshold,
    p1IncidentCount14d: p1Durations.length,
    evaluationTimestamp: evaluationTimestamp.toISOString(),
    cooldownStatus
  });

  await prisma.scaleGateDecisionLog.create({
    data: {
      evaluatedAt: evaluationTimestamp,
      evaluationTimestamp,
      result: evaluated.result,
      failingCriteriaJson: evaluated.failingCriteria,
      metricsSnapshotJson: {
        webhookSuccessRate,
        leadLinkageRate,
        p1AckTimeP95Ms,
        p1ResolutionTimeP95Ms,
        orgExposurePercent,
        trafficExposurePercent,
        p1IncidentCount14d: p1Durations.length
      },
      actorUserId: input?.actorUserId || null,
      promotionAttempted: Boolean(input?.promotionAttempted),
      systemicFailTriggered: evaluated.systemicFailTriggered
    }
  });

  return {
    evaluationTimestamp: evaluationTimestamp.toISOString(),
    result: evaluated.result,
    failingCriteria: evaluated.failingCriteria,
    warnings: evaluated.warnings,
    exposure: {
      orgExposurePercent,
      trafficExposurePercent,
      thresholds: {
        orgExposureThreshold,
        trafficExposureThreshold
      }
    },
    cooldown: {
      systemicFailTriggered: evaluated.systemicFailTriggered,
      required: cooldownRequired,
      status: cooldownStatus
    },
    metrics: {
      webhookSuccessRate,
      leadLinkageRate,
      p1AckTimeP95Ms,
      p1ResolutionTimeP95Ms
    }
  };
}
