import type { Organization, PrismaClient } from "@prisma/client";

export type FirstSuccessType = "call" | "sms" | "booking";

export interface FirstSuccessMilestone {
  firstSuccessAt: Date | null;
  firstSuccessType: FirstSuccessType | null;
}

type FirstSuccessCandidate = {
  type: FirstSuccessType;
  at: Date;
  sourceId: string;
};

function deriveGoLiveReference(organization: Organization) {
  if (organization.goLiveAt) return organization.goLiveAt;
  if (organization.status === "LIVE" || organization.status === "TESTING") {
    return organization.onboardingApprovedAt || null;
  }
  return null;
}

function normalizeMilestone(organization: Organization): FirstSuccessMilestone {
  const type = String(organization.firstSuccessType || "").toLowerCase();
  if (organization.firstSuccessAt && (type === "call" || type === "sms" || type === "booking")) {
    return {
      firstSuccessAt: organization.firstSuccessAt,
      firstSuccessType: type
    };
  }
  return {
    firstSuccessAt: null,
    firstSuccessType: null
  };
}

function pickEarliestCandidate(candidates: Array<FirstSuccessCandidate | null>) {
  const ordered = candidates
    .filter((candidate): candidate is FirstSuccessCandidate => Boolean(candidate))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  return ordered[0] || null;
}

export async function ensureFirstSuccessMilestone(input: {
  prisma: PrismaClient;
  organization: Organization;
  actorUserId?: string;
  actorRole?: string;
}): Promise<FirstSuccessMilestone> {
  const { prisma, organization } = input;
  const existing = normalizeMilestone(organization);
  if (existing.firstSuccessAt && existing.firstSuccessType) {
    return existing;
  }

  const goLiveReference = deriveGoLiveReference(organization);
  if (!goLiveReference) {
    return existing;
  }

  const [firstCall, firstSms, firstBooking] = await Promise.all([
    prisma.callLog.findFirst({
      where: {
        orgId: organization.id,
        startedAt: { gte: goLiveReference },
        outcome: { in: ["APPOINTMENT_REQUEST", "MESSAGE_TAKEN", "TRANSFERRED"] }
      },
      orderBy: { startedAt: "asc" },
      select: { id: true, startedAt: true }
    }),
    prisma.message.findFirst({
      where: {
        orgId: organization.id,
        createdAt: { gte: goLiveReference },
        status: { in: ["RECEIVED", "SENT", "DELIVERED"] }
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true }
    }),
    prisma.appointmentRequest.findFirst({
      where: {
        orgId: organization.id,
        createdAt: { gte: goLiveReference }
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true }
    })
  ]);

  const candidate = pickEarliestCandidate([
    firstCall ? { type: "call", at: firstCall.startedAt, sourceId: firstCall.id } : null,
    firstSms ? { type: "sms", at: firstSms.createdAt, sourceId: firstSms.id } : null,
    firstBooking ? { type: "booking", at: firstBooking.createdAt, sourceId: firstBooking.id } : null
  ]);

  if (!candidate) return existing;

  const applied = await prisma.organization.updateMany({
    where: {
      id: organization.id,
      firstSuccessAt: null,
      firstSuccessType: null
    },
    data: {
      firstSuccessAt: candidate.at,
      firstSuccessType: candidate.type
    }
  });

  if (applied.count > 0) {
    await prisma.auditLog.create({
      data: {
        orgId: organization.id,
        actorUserId: input.actorUserId || "system:first_success",
        actorRole: input.actorRole || "SYSTEM",
        action: "ORG_FIRST_SUCCESS_RECORDED",
        metadataJson: JSON.stringify({
          firstSuccessType: candidate.type,
          firstSuccessAt: candidate.at.toISOString(),
          sourceId: candidate.sourceId
        })
      }
    });
    return {
      firstSuccessAt: candidate.at,
      firstSuccessType: candidate.type
    };
  }

  const latest = await prisma.organization.findUnique({
    where: { id: organization.id },
    select: { firstSuccessAt: true, firstSuccessType: true }
  });
  const latestType = String(latest?.firstSuccessType || "").toLowerCase();
  return {
    firstSuccessAt: latest?.firstSuccessAt || null,
    firstSuccessType: latestType === "call" || latestType === "sms" || latestType === "booking" ? latestType : null
  };
}
