import { LeadSource, type PrismaClient } from "@prisma/client";
import { openIncident } from "./incident.service";

function normalizePhone(input: string) {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return input.trim().startsWith("+") ? `+${digits}` : `+${digits}`;
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return JSON.stringify({ parseError: true });
  }
}

async function linkOrCreateLeadForCall(prisma: PrismaClient, callId: string) {
  const call = await prisma.callLog.findUnique({
    where: { id: callId },
    select: { id: true, orgId: true, fromNumber: true, aiSummary: true, transcript: true, leadId: true }
  });
  if (!call || call.leadId) return { repaired: false as const, reason: "NO_CALL_OR_ALREADY_LINKED" };

  const phone = normalizePhone(call.fromNumber);
  if (!phone || phone === "+") return { repaired: false as const, reason: "INVALID_PHONE" };

  const [org, existingLead] = await Promise.all([
    prisma.organization.findUnique({ where: { id: call.orgId }, select: { name: true } }),
    prisma.lead.findFirst({ where: { orgId: call.orgId, phone }, orderBy: { createdAt: "desc" } })
  ]);
  if (!org) return { repaired: false as const, reason: "ORG_NOT_FOUND" };

  const emailFallback = `${phone.replace(/\D/g, "") || "unknown"}@no-email.local`;
  const message = String(call.aiSummary || call.transcript || "").trim();
  const lead = existingLead
    ? await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          business: existingLead.business || org.name,
          email: existingLead.email || emailFallback,
          message: message || existingLead.message
        }
      })
    : await prisma.lead.create({
        data: {
          orgId: call.orgId,
          name: "Unknown Caller",
          business: org.name,
          email: emailFallback,
          phone,
          message,
          source: LeadSource.PHONE_CALL
        }
      });

  await prisma.callLog.update({
    where: { id: call.id },
    data: { leadId: lead.id }
  });
  return { repaired: true as const, leadId: lead.id };
}

export async function runDataIntegrityGuardTick(prisma: PrismaClient) {
  const now = Date.now();
  const olderThan24h = new Date(now - 24 * 60 * 60 * 1000);
  const olderThan2h = new Date(now - 2 * 60 * 60 * 1000);
  const last24h = new Date(now - 24 * 60 * 60 * 1000);

  const [callsMissingCompletedAt, stuckCalls, allProfiles, callsMissingLeadLinkage] = await Promise.all([
    prisma.callLog.findMany({
      where: {
        startedAt: { lt: olderThan24h },
        completedAt: null
      },
      take: 200,
      select: { id: true, orgId: true, providerCallId: true, startedAt: true, state: true }
    }),
    prisma.callLog.findMany({
      where: {
        startedAt: { lt: olderThan2h },
        state: { not: "COMPLETED" }
      },
      take: 200,
      select: { id: true, orgId: true, providerCallId: true, startedAt: true, state: true }
    }),
    prisma.callerProfile.findMany({
      select: { orgId: true, phoneNumber: true }
    }),
    prisma.callLog.findMany({
      where: {
        startedAt: { gte: last24h },
        leadId: null,
        OR: [{ completedAt: { not: null } }, { endedAt: { not: null } }, { state: "COMPLETED" }]
      },
      take: 400,
      select: { id: true, orgId: true, providerCallId: true, startedAt: true }
    })
  ]);

  const duplicateMap = new Map<string, number>();
  for (const profile of allProfiles) {
    const key = `${profile.orgId}::${profile.phoneNumber}`;
    duplicateMap.set(key, (duplicateMap.get(key) || 0) + 1);
  }
  const duplicateProfiles = [...duplicateMap.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => {
      const [orgId, phoneNumber] = key.split("::");
      return { orgId, phoneNumber };
    });

  let repairedLeadLinks = 0;
  for (const call of callsMissingLeadLinkage) {
    const repaired = await linkOrCreateLeadForCall(prisma, call.id);
    if (repaired.repaired) {
      repairedLeadLinks += 1;
      await prisma.auditLog.create({
        data: {
          orgId: call.orgId,
          actorUserId: "data-integrity-guard",
          actorRole: "SYSTEM",
          action: "DATA_INTEGRITY_REPAIR",
          metadataJson: safeJson({
            issue: "MISSING_LEAD_LINKAGE",
            orgId: call.orgId,
            provider: "SYSTEM",
            endpoint: "guard:data-integrity",
            eventType: "REPAIR",
            requestId: "-",
            providerCallId: call.providerCallId || "-",
            latencyMs: null,
            status: "REPAIRED",
            callId: call.id
          })
        }
      });
    }
  }

  const anomalies = [
    ...callsMissingCompletedAt.map((call) => ({
      orgId: call.orgId,
      providerCallId: call.providerCallId || "-",
      issue: "MISSING_COMPLETED_AT_24H",
      state: call.state
    })),
    ...stuckCalls.map((call) => ({
      orgId: call.orgId,
      providerCallId: call.providerCallId || "-",
      issue: "STUCK_NON_TERMINAL_2H",
      state: call.state
    })),
    ...callsMissingLeadLinkage.map((call) => ({
      orgId: call.orgId,
      providerCallId: call.providerCallId || "-",
      issue: "MISSING_LEAD_LINKAGE",
      state: null
    })),
    ...duplicateProfiles.map((row) => ({
      orgId: row.orgId,
      providerCallId: "-",
      issue: "DUPLICATE_CALLER_PROFILE",
      state: null
    }))
  ];

  for (const anomaly of anomalies.slice(0, 500)) {
    await prisma.auditLog.create({
      data: {
        orgId: anomaly.orgId || null,
        actorUserId: "data-integrity-guard",
        actorRole: "SYSTEM",
        action: "DATA_INTEGRITY_ANOMALY",
        metadataJson: safeJson({
          issue: anomaly.issue,
          orgId: anomaly.orgId || null,
          provider: "SYSTEM",
          endpoint: "guard:data-integrity",
          eventType: "ANOMALY",
          requestId: "-",
          providerCallId: anomaly.providerCallId || "-",
          latencyMs: null,
          status: "DETECTED",
          state: anomaly.state
        })
      }
    });
    if (anomaly.issue === "STUCK_NON_TERMINAL_2H" || anomaly.issue === "MISSING_COMPLETED_AT_24H") {
      await openIncident({
        prisma,
        orgId: anomaly.orgId,
        severity: "P2",
        rootCauseHint: anomaly.issue,
        provider: "SYSTEM",
        endpoint: "guard:data-integrity",
        eventType: "ANOMALY",
        providerCallId: anomaly.providerCallId,
        status: "OPEN"
      });
    }
  }

  return {
    scanned: {
      callsMissingCompletedAt: callsMissingCompletedAt.length,
      stuckCalls: stuckCalls.length,
      duplicateProfiles: duplicateProfiles.length,
      callsMissingLeadLinkage: callsMissingLeadLinkage.length
    },
    anomaliesLogged: anomalies.length,
    repairedLeadLinks
  };
}
