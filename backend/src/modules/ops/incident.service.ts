import type { PrismaClient } from "@prisma/client";

export type IncidentSeverity = "P1" | "P2" | "P3";

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return JSON.stringify({ parseError: true });
  }
}

export async function openIncident(input: {
  prisma: PrismaClient;
  orgId?: string | null;
  severity: IncidentSeverity;
  rootCauseHint: string;
  provider?: string;
  endpoint?: string;
  eventType?: string;
  requestId?: string;
  providerCallId?: string | null;
  latencyMs?: number | null;
  status?: string | number;
  details?: Record<string, unknown>;
}) {
  return input.prisma.auditLog.create({
    data: {
      orgId: input.orgId || null,
      actorUserId: "incident-service",
      actorRole: "SYSTEM",
      action: "INCIDENT_OPENED",
      metadataJson: safeJson({
        severity: input.severity,
        rootCauseHint: input.rootCauseHint,
        orgId: input.orgId || null,
        provider: input.provider || "SYSTEM",
        endpoint: input.endpoint || "-",
        eventType: input.eventType || "-",
        requestId: input.requestId || "-",
        providerCallId: input.providerCallId || "-",
        latencyMs: input.latencyMs ?? null,
        status: input.status ?? "OPEN",
        details: input.details || {}
      })
    }
  });
}

export async function escalateIncident(input: {
  prisma: PrismaClient;
  orgId?: string | null;
  reason: string;
  requestId?: string;
  providerCallId?: string | null;
  details?: Record<string, unknown>;
}) {
  return input.prisma.auditLog.create({
    data: {
      orgId: input.orgId || null,
      actorUserId: "incident-service",
      actorRole: "SYSTEM",
      action: "INCIDENT_ESCALATED",
      metadataJson: safeJson({
        reason: input.reason,
        orgId: input.orgId || null,
        provider: "SYSTEM",
        endpoint: "-",
        eventType: "INCIDENT",
        requestId: input.requestId || "-",
        providerCallId: input.providerCallId || "-",
        latencyMs: null,
        status: "ESCALATED",
        details: input.details || {}
      })
    }
  });
}

export async function resolveIncident(input: {
  prisma: PrismaClient;
  orgId?: string | null;
  resolution: string;
  requestId?: string;
  providerCallId?: string | null;
  details?: Record<string, unknown>;
}) {
  return input.prisma.auditLog.create({
    data: {
      orgId: input.orgId || null,
      actorUserId: "incident-service",
      actorRole: "SYSTEM",
      action: "INCIDENT_RESOLVED",
      metadataJson: safeJson({
        resolution: input.resolution,
        orgId: input.orgId || null,
        provider: "SYSTEM",
        endpoint: "-",
        eventType: "INCIDENT",
        requestId: input.requestId || "-",
        providerCallId: input.providerCallId || "-",
        latencyMs: null,
        status: "RESOLVED",
        details: input.details || {}
      })
    }
  });
}

