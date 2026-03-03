import type { PrismaClient } from "@prisma/client";
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

  const [calls5m, calls1h, calls24h, webhookEvents1h, messages1h, vapiEvents1h, calls24hRows, autoRecovery24h, orgs] =
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
    callsStuckNonTerminalOver1h
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

