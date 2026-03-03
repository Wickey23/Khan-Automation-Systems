import type { PrismaClient } from "@prisma/client";
import { env } from "../../config/env";
import { emitRuntimeEvent } from "../runtime/runtime-events.service";
import { escalateIncident, openIncident, resolveIncident } from "./incident.service";

export type SlaSeverity = "INFO" | "WARN" | "CRITICAL";

type SlaState = {
  severity: SlaSeverity;
  criticalBreaches: number;
  recoveryWindows: number;
  updatedAt: number;
};

const stateByOrg = new Map<string, SlaState>();

function asInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getThresholds() {
  return {
    warnWebhook: asInt(env.SLA_WARN_WEBHOOK_FAILURES, 5),
    criticalWebhook: asInt(env.SLA_CRITICAL_WEBHOOK_FAILURES, 10),
    warnProvider: asInt(env.SLA_WARN_PROVIDER_ERRORS, 5),
    criticalProvider: asInt(env.SLA_CRITICAL_PROVIDER_ERRORS, 10),
    criticalConsecutive: asInt(env.SLA_CRITICAL_CONSECUTIVE_BREACHES, 2),
    recoveryWindowsRequired: asInt(env.SLA_RECOVERY_WINDOWS_REQUIRED, 2)
  };
}

function nextSeverity(input: {
  orgId: string;
  webhookFailures: number;
  twilioErrors: number;
  vapiErrors: number;
}) {
  const thresholds = getThresholds();
  const prev = stateByOrg.get(input.orgId) || {
    severity: "INFO" as SlaSeverity,
    criticalBreaches: 0,
    recoveryWindows: 0,
    updatedAt: Date.now()
  };

  const criticalNow =
    input.webhookFailures >= thresholds.criticalWebhook ||
    input.twilioErrors >= thresholds.criticalProvider ||
    input.vapiErrors >= thresholds.criticalProvider;
  const warnNow =
    input.webhookFailures >= thresholds.warnWebhook ||
    input.twilioErrors >= thresholds.warnProvider ||
    input.vapiErrors >= thresholds.warnProvider;

  let severity: SlaSeverity = "INFO";
  let criticalBreaches = prev.criticalBreaches;
  let recoveryWindows = prev.recoveryWindows;

  if (criticalNow) {
    criticalBreaches += 1;
    recoveryWindows = 0;
    severity = criticalBreaches >= thresholds.criticalConsecutive ? "CRITICAL" : "WARN";
  } else if (warnNow) {
    criticalBreaches = 0;
    recoveryWindows = 0;
    severity = "WARN";
  } else {
    criticalBreaches = 0;
    recoveryWindows += 1;
    if (recoveryWindows >= thresholds.recoveryWindowsRequired) severity = "INFO";
    else severity = prev.severity;
  }

  const next = { severity, criticalBreaches, recoveryWindows, updatedAt: Date.now() };
  stateByOrg.set(input.orgId, next);
  return { prev, next };
}

export function getOrgSlaSeverity(orgId: string): SlaSeverity {
  return stateByOrg.get(orgId)?.severity || "INFO";
}

export async function runSlaMonitorTick(prisma: PrismaClient) {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const [orgs, webhookFailures, twilioFailures, vapiFailures] = await Promise.all([
    prisma.organization.findMany({ select: { id: true } }),
    prisma.webhookEventLog.groupBy({
      by: ["orgId"],
      where: { createdAt: { gte: since }, statusCode: { gte: 400 } },
      _count: { _all: true }
    }),
    prisma.message.groupBy({
      by: ["orgId"],
      where: { createdAt: { gte: since }, provider: "TWILIO", status: "FAILED" },
      _count: { _all: true }
    }),
    prisma.webhookEventLog.groupBy({
      by: ["orgId"],
      where: {
        createdAt: { gte: since },
        provider: "VAPI",
        OR: [{ statusCode: { gte: 400 } }, { reason: { contains: "error", mode: "insensitive" } }]
      },
      _count: { _all: true }
    })
  ]);

  const webhookCount = new Map<string, number>();
  const twilioCount = new Map<string, number>();
  const vapiCount = new Map<string, number>();

  for (const row of webhookFailures) webhookCount.set(row.orgId || "", row._count._all);
  for (const row of twilioFailures) twilioCount.set(row.orgId || "", row._count._all);
  for (const row of vapiFailures) vapiCount.set(row.orgId || "", row._count._all);

  for (const org of orgs) {
    const orgId = org.id;
    const webhookFailuresCount = webhookCount.get(orgId) || 0;
    const twilioErrorsCount = twilioCount.get(orgId) || 0;
    const vapiErrorsCount = vapiCount.get(orgId) || 0;
    const { prev, next } = nextSeverity({
      orgId,
      webhookFailures: webhookFailuresCount,
      twilioErrors: twilioErrorsCount,
      vapiErrors: vapiErrorsCount
    });

    if (prev.severity !== next.severity && next.severity !== "INFO") {
      const payload = {
        orgId,
        previousSeverity: prev.severity,
        severity: next.severity,
        webhookFailures: webhookFailuresCount,
        twilioErrors: twilioErrorsCount,
        vapiErrors: vapiErrorsCount
      };
      await prisma.auditLog.create({
        data: {
          orgId,
          actorUserId: "sla-monitor",
          actorRole: "SYSTEM",
          action: "SLA_THRESHOLD_BREACHED",
          metadataJson: JSON.stringify(payload)
        }
      });
      await emitRuntimeEvent({
        prisma,
        type: "SLA_THRESHOLD_BREACHED",
        orgId,
        payload
      });
      if (next.severity === "WARN") {
        await openIncident({
          prisma,
          orgId,
          severity: "P2",
          rootCauseHint: "SLA_WARN_THRESHOLD_BREACH",
          provider: "SYSTEM",
          endpoint: "sla-monitor",
          eventType: "SLA",
          status: "OPEN",
          details: payload
        });
      } else if (next.severity === "CRITICAL") {
        await escalateIncident({
          prisma,
          orgId,
          reason: "SLA escalated to CRITICAL",
          details: payload
        });
      }
    } else if (prev.severity !== "INFO" && next.severity === "INFO") {
      await resolveIncident({
        prisma,
        orgId,
        resolution: "SLA recovered to INFO",
        details: {
          previousSeverity: prev.severity,
          severity: next.severity,
          webhookFailures: webhookFailuresCount,
          twilioErrors: twilioErrorsCount,
          vapiErrors: vapiErrorsCount
        }
      });
    }
  }
}
