import { Prisma, type CalendarProvider, type PrismaClient } from "@prisma/client";
import { emitOrgNotification } from "../notifications/notification.service";
import { overlapsWithBufferLocked } from "./overlap.service";
import { validateSlotWithinBusinessHours } from "./slotting.service";

const TX_ISOLATION = Prisma.TransactionIsolationLevel.Serializable;

type BookingInput = {
  prisma: PrismaClient;
  orgId: string;
  userId: string;
  leadId?: string | null;
  callLogId?: string | null;
  customerName: string;
  customerPhone: string;
  issueSummary: string;
  assignedTechnician?: string | null;
  startAt: Date;
  endAt: Date;
  timezone: string;
  appointmentBufferMinutes?: number;
  requestedProvider: CalendarProvider;
  idempotencyKey?: string | null;
  createExternalEvent?: () => Promise<{ provider: CalendarProvider; externalEventId: string }>;
  pipelineFeatureEnabled?: boolean;
  businessHoursValidation?: {
    hoursJson?: string | null;
    timezone?: string | null;
  };
};

export async function bookAppointmentWithHold(input: BookingInput) {
  if (input.businessHoursValidation) {
    const durationMinutes = Math.max(
      1,
      Math.round((input.endAt.getTime() - input.startAt.getTime()) / (60 * 1000))
    );
    const withinHours = validateSlotWithinBusinessHours({
      hoursJson: input.businessHoursValidation.hoursJson || null,
      timezone: input.businessHoursValidation.timezone || input.timezone,
      slotStartAt: input.startAt,
      appointmentDurationMinutes: durationMinutes
    });
    if (!withinHours.ok) {
      return { ok: false as const, reason: "OUTSIDE_BUSINESS_HOURS" as const };
    }
  }

  const hold = await input.prisma.appointmentHold.create({
    data: {
      orgId: input.orgId,
      slotStart: input.startAt,
      slotEnd: input.endAt,
      phone: input.customerPhone,
      status: "HELD",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    }
  });

  const readOverlap = async (db: Pick<PrismaClient, "appointment">) => {
    const overlapCandidates = await db.appointment.findMany({
      where: {
        orgId: input.orgId,
        status: { not: "CANCELED" },
        startAt: { lt: new Date(input.endAt.getTime() + Math.max(0, input.appointmentBufferMinutes || 0) * 60 * 1000) },
        endAt: { gt: new Date(input.startAt.getTime() - Math.max(0, input.appointmentBufferMinutes || 0) * 60 * 1000) }
      },
      select: { id: true, startAt: true, endAt: true }
    });
    return overlapCandidates.find((candidate: { startAt: Date; endAt: Date }) =>
      overlapsWithBufferLocked(
        candidate.startAt,
        candidate.endAt,
        input.startAt,
        input.endAt,
        Math.max(0, input.appointmentBufferMinutes || 0)
      )
    );
  };
  const overlap = await readOverlap(input.prisma);
  if (overlap) {
    await input.prisma.appointmentHold.update({ where: { id: hold.id }, data: { status: "FAILED" } });
    return { ok: false as const, reason: "OVERLAP" as const, holdId: hold.id };
  }

  let provider: CalendarProvider = input.requestedProvider || "INTERNAL";
  let externalCalendarEventId: string | null = null;
  let status: "PENDING" | "CONFIRMED" = "PENDING";
  try {
    if (input.createExternalEvent && provider !== "INTERNAL") {
      const event = await input.createExternalEvent();
      provider = event.provider;
      externalCalendarEventId = event.externalEventId || null;
      status = event.provider === "INTERNAL" ? "PENDING" : "CONFIRMED";
    } else {
      provider = "INTERNAL";
    }
  } catch {
    provider = "INTERNAL";
    status = "PENDING";
  }

  let appointment: Awaited<ReturnType<typeof input.prisma.appointment.create>>;
  try {
    appointment = await input.prisma.$transaction(
      async (tx) => {
        const commitOverlap = await readOverlap(tx as unknown as PrismaClient);
        if (commitOverlap) {
          throw new Error("OVERLAP_AT_COMMIT");
        }
        try {
          const created = await tx.appointment.create({
            data: {
              orgId: input.orgId,
              leadId: input.leadId || null,
              callLogId: input.callLogId || null,
              customerName: input.customerName,
              customerPhone: input.customerPhone,
              issueSummary: input.issueSummary,
              assignedTechnician: input.assignedTechnician || null,
              status,
              startAt: input.startAt,
              endAt: input.endAt,
              timezone: input.timezone,
              calendarProvider: provider,
              externalCalendarEventId,
              idempotencyKey: input.idempotencyKey || null,
              createdByUserId: input.userId
            }
          });
          if (input.leadId && input.pipelineFeatureEnabled) {
            await tx.lead.updateMany({
              where: { id: input.leadId, orgId: input.orgId },
              data: { pipelineStage: status === "CONFIRMED" ? "SCHEDULED" : "NEEDS_SCHEDULING" }
            });
          }
          return created;
        } catch (error) {
          const code = String((error as { code?: string } | null)?.code || "");
          if (code === "P2002" && input.idempotencyKey) {
            const existing = await tx.appointment.findFirst({
              where: { orgId: input.orgId, idempotencyKey: input.idempotencyKey }
            });
            if (existing) return existing;
          }
          throw error;
        }
      },
      { isolationLevel: TX_ISOLATION }
    );
  } catch (error) {
    const message = String((error as Error)?.message || "");
    const code = String((error as { code?: string } | null)?.code || "");
    if (message === "OVERLAP_AT_COMMIT" || code === "P2034") {
      await input.prisma.appointmentHold.update({ where: { id: hold.id }, data: { status: "FAILED" } });
      return { ok: false as const, reason: "OVERLAP" as const, holdId: hold.id };
    }
    throw error;
  }

  const holdStatus = appointment.status === "CONFIRMED" ? "CONFIRMED" : "FAILED";
  await input.prisma.appointmentHold.update({
    where: { id: hold.id },
    data: { status: holdStatus }
  });

  try {
    await emitOrgNotification({
      prisma: input.prisma,
      orgId: input.orgId,
      type: "APPOINTMENT_BOOKED",
      severity: "INFO",
      title: "Appointment booked",
      body:
        status === "CONFIRMED"
          ? `Appointment confirmed for ${appointment.customerName} at ${appointment.startAt.toISOString()}.`
          : `Appointment captured for ${appointment.customerName}; scheduling follow-up needed.`,
      metadata: { appointmentId: appointment.id, calendarProvider: provider, status }
    });
  } catch {
    // Best-effort notifications should not fail appointment booking.
  }

  return { ok: true as const, appointment };
}
