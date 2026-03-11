import { Prisma, type PrismaClient } from "@prisma/client";

export function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

export async function stopEnrollmentsForLead(input: {
  prisma: PrismaClient | Prisma.TransactionClient;
  orgId: string;
  leadId: string;
  reason: string;
  eventType?: "REPLIED" | "UNSUBSCRIBED";
  metadata?: Record<string, unknown>;
}) {
  const db = input.prisma as any;
  const enrollments = await db.outreachEnrollment.findMany({
    where: {
      orgId: input.orgId,
      leadId: input.leadId,
      status: { in: ["ACTIVE", "PAUSED"] }
    }
  });

  if (!enrollments.length) return { stopped: 0 };

  await db.outreachEnrollment.updateMany({
    where: {
      id: { in: enrollments.map((item: any) => item.id) }
    },
    data: {
      status: "STOPPED",
      stopReason: input.reason,
      nextSendAt: null,
      processingStartedAt: null
    }
  });

  if (input.eventType) {
    await db.outreachEmailEvent.createMany({
      data: enrollments.map((item: any) => ({
        orgId: input.orgId,
        leadId: input.leadId,
        enrollmentId: item.id,
        sequenceId: item.sequenceId,
        stepNumber: item.currentStepNumber,
        provider: "resend",
        eventType: input.eventType,
        toEmail: "",
        fromEmail: "",
        metadata: input.metadata || Prisma.JsonNull
      }))
    });
  }

  return { stopped: enrollments.length };
}

export async function markLeadReplied(input: {
  prisma: PrismaClient | Prisma.TransactionClient;
  orgId: string;
  leadId: string;
  note?: string;
}) {
  const db = input.prisma as any;
  const lead = await db.outreachLead.update({
    where: { id: input.leadId },
    data: {
      status: "REPLIED",
      notes: input.note ? [undefined, input.note].filter(Boolean).join("\n") : undefined
    }
  });

  await stopEnrollmentsForLead({
    prisma: input.prisma,
    orgId: input.orgId,
    leadId: input.leadId,
    reason: "REPLIED",
    eventType: "REPLIED",
    metadata: input.note ? { note: input.note } : undefined
  });

  return lead;
}
