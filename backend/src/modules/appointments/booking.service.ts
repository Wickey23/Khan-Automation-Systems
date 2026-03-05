import { Prisma, type CalendarProvider, type PrismaClient } from "@prisma/client";
import { emitOrgNotification } from "../notifications/notification.service";
import { sendSmsMessage } from "../twilio/twilio.service";
import { buildExpandedBusyIntervals, type BusyWindow, validateSlotWithinBusinessHours } from "./slotting.service";
import { overlapsLocked } from "./overlap.service";

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
  serviceAddress?: string | null;
  assignedTechnician?: string | null;
  startAt: Date;
  endAt: Date;
  timezone: string;
  appointmentBufferMinutes?: number;
  requestedProvider: CalendarProvider;
  idempotencyKey?: string | null;
  createExternalEvent?: () => Promise<{ provider: CalendarProvider; externalEventId: string }>;
  fetchExternalBusyBlocks?: (window: { fromUtc: Date; toUtc: Date }) => Promise<BusyWindow[]>;
  computeNextSlots?: () => Promise<Array<{ startAt: string; endAt: string }>>;
  returnFailureOnCalendarFallback?: boolean;
  pipelineFeatureEnabled?: boolean;
  businessHoursValidation?: {
    hoursJson?: string | null;
    timezone?: string | null;
  };
};

type FailedBookingResult = {
  ok: false;
  reason: "OVERLAP" | "OUTSIDE_BUSINESS_HOURS" | "CALENDAR_UNAVAILABLE";
  holdId?: string;
  nextSlots?: Array<{ startAt: string; endAt: string }>;
  appointment?: Awaited<ReturnType<PrismaClient["appointment"]["create"]>>;
};

type SuccessfulBookingResult = {
  ok: true;
  appointment: Awaited<ReturnType<PrismaClient["appointment"]["create"]>>;
  fallbackReason?: "CALENDAR_UNAVAILABLE";
  nextSlots?: Array<{ startAt: string; endAt: string }>;
};

type BookingResult = FailedBookingResult | SuccessfulBookingResult;

async function readInternalBusy(input: {
  prisma: Pick<PrismaClient, "appointment">;
  orgId: string;
  fromUtc: Date;
  toUtc: Date;
}) {
  return input.prisma.appointment.findMany({
    where: {
      orgId: input.orgId,
      status: { not: "CANCELED" },
      startAt: { lt: input.toUtc },
      endAt: { gt: input.fromUtc }
    },
    select: { id: true, startAt: true, endAt: true }
  });
}

function overlapsBusy(input: {
  startAt: Date;
  endAt: Date;
  internalBusy: Array<{ startAt: Date; endAt: Date }>;
  externalBusy: BusyWindow[];
  bufferMinutes: number;
}) {
  const mergedBusy = buildExpandedBusyIntervals({
    internalBusy: input.internalBusy,
    externalBusy: input.externalBusy,
    bufferMinutes: input.bufferMinutes
  });
  return mergedBusy.some((row) => overlapsLocked(row.startUtc, row.endUtc, input.startAt, input.endAt));
}

async function trySendCustomerConfirmationSms(input: {
  prisma: PrismaClient;
  orgId: string;
  customerPhone: string;
  customerName: string;
  serviceAddress?: string | null;
  startAt: Date;
  timezone: string;
}) {
  try {
    const [org, activePhone] = await Promise.all([
      input.prisma.organization.findUnique({
        where: { id: input.orgId },
        select: { name: true }
      }),
      input.prisma.phoneNumber.findFirst({
        where: { orgId: input.orgId, provider: "TWILIO", status: "ACTIVE" },
        select: { e164Number: true }
      })
    ]);
    if (!activePhone?.e164Number) return;

    const localTime = new Date(input.startAt).toLocaleString("en-US", {
      timeZone: input.timezone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
    const businessName = org?.name || "Khan Systems";
    const addressLine = input.serviceAddress ? ` Address: ${input.serviceAddress}.` : "";
    await sendSmsMessage({
      from: activePhone.e164Number,
      to: input.customerPhone,
      body: `Hi ${input.customerName}, your appointment with ${businessName} is confirmed for ${localTime}.${addressLine}`
    });
  } catch {
    // Non-fatal by lock.
  }
}

export async function bookAppointmentWithHold(input: BookingInput): Promise<BookingResult> {
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
      return { ok: false, reason: "OUTSIDE_BUSINESS_HOURS" };
    }
  }

  const bufferMinutes = Math.max(0, input.appointmentBufferMinutes || 0);
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

  const precheckFrom = new Date(input.startAt.getTime() - bufferMinutes * 60 * 1000);
  const precheckTo = new Date(input.endAt.getTime() + bufferMinutes * 60 * 1000);
  let calendarFallback = false;
  const initialInternalBusy = await readInternalBusy({
    prisma: input.prisma,
    orgId: input.orgId,
    fromUtc: precheckFrom,
    toUtc: precheckTo
  });
  let initialExternalBusy: BusyWindow[] = [];
  if (input.fetchExternalBusyBlocks) {
    try {
      initialExternalBusy = await input.fetchExternalBusyBlocks({ fromUtc: precheckFrom, toUtc: precheckTo });
    } catch {
      calendarFallback = true;
      initialExternalBusy = [];
    }
  }
  if (
    overlapsBusy({
      startAt: input.startAt,
      endAt: input.endAt,
      internalBusy: initialInternalBusy,
      externalBusy: initialExternalBusy,
      bufferMinutes
    })
  ) {
    await input.prisma.appointmentHold.update({ where: { id: hold.id }, data: { status: "FAILED" } });
    return { ok: false, reason: "OVERLAP", holdId: hold.id };
  }

  let provider: CalendarProvider = input.requestedProvider || "INTERNAL";
  let externalCalendarEventId: string | null = null;
  let status: "PENDING" | "CONFIRMED" = "PENDING";

  let appointment: Awaited<ReturnType<typeof input.prisma.appointment.create>>;
  try {
    appointment = await input.prisma.$transaction(
      async (tx) => {
        const commitInternalBusy = await readInternalBusy({
          prisma: tx as unknown as PrismaClient,
          orgId: input.orgId,
          fromUtc: precheckFrom,
          toUtc: precheckTo
        });
        let commitExternalBusy: BusyWindow[] = [];
        if (input.fetchExternalBusyBlocks) {
          try {
            commitExternalBusy = await input.fetchExternalBusyBlocks({ fromUtc: precheckFrom, toUtc: precheckTo });
          } catch {
            calendarFallback = true;
            commitExternalBusy = [];
          }
        }
        if (
          overlapsBusy({
            startAt: input.startAt,
            endAt: input.endAt,
            internalBusy: commitInternalBusy,
            externalBusy: commitExternalBusy,
            bufferMinutes
          })
        ) {
          throw new Error("OVERLAP_AT_COMMIT");
        }

        const durationMinutes = Math.max(1, Math.round((input.endAt.getTime() - input.startAt.getTime()) / (60 * 1000)));
        const commitWithinHours = validateSlotWithinBusinessHours({
          hoursJson: input.businessHoursValidation?.hoursJson || null,
          timezone: input.businessHoursValidation?.timezone || input.timezone,
          slotStartAt: input.startAt,
          appointmentDurationMinutes: durationMinutes
        });
        if (!commitWithinHours.ok) {
          throw new Error("OUTSIDE_BUSINESS_HOURS_AT_COMMIT");
        }

        try {
          if (!calendarFallback && input.createExternalEvent && provider !== "INTERNAL") {
            const event = await input.createExternalEvent();
            provider = event.provider;
            externalCalendarEventId = event.externalEventId || null;
            status = event.provider === "INTERNAL" ? "PENDING" : "CONFIRMED";
          } else {
            provider = "INTERNAL";
            status = "PENDING";
          }
        } catch {
          provider = "INTERNAL";
          status = "PENDING";
          externalCalendarEventId = null;
          calendarFallback = true;
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
      return { ok: false, reason: "OVERLAP", holdId: hold.id };
    }
    if (message === "OUTSIDE_BUSINESS_HOURS_AT_COMMIT") {
      await input.prisma.appointmentHold.update({ where: { id: hold.id }, data: { status: "FAILED" } });
      return { ok: false, reason: "OUTSIDE_BUSINESS_HOURS", holdId: hold.id };
    }
    throw error;
  }

  await input.prisma.appointmentHold.update({
    where: { id: hold.id },
    data: { status: appointment.status === "CONFIRMED" ? "CONFIRMED" : "FAILED" }
  });

  let nextSlots: Array<{ startAt: string; endAt: string }> | undefined;
  if (calendarFallback && input.computeNextSlots) {
    try {
      nextSlots = (await input.computeNextSlots()).slice(0, 3);
    } catch {
      nextSlots = [];
    }
  }

  try {
    await emitOrgNotification({
      prisma: input.prisma,
      orgId: input.orgId,
      type: "APPOINTMENT_BOOKED",
      severity: calendarFallback ? "ACTION_REQUIRED" : "INFO",
      title: calendarFallback ? "Calendar booking fallback" : "Appointment booked",
      body: calendarFallback
        ? `Calendar create failed for ${appointment.customerName}; manual scheduling required.`
        : `Appointment confirmed for ${appointment.customerName} at ${appointment.startAt.toISOString()}.`,
      metadata: { appointmentId: appointment.id, calendarProvider: appointment.calendarProvider, status: appointment.status }
    });
  } catch {
    // Non-fatal by lock.
  }

  if (!calendarFallback && appointment.status === "CONFIRMED") {
    await trySendCustomerConfirmationSms({
      prisma: input.prisma,
      orgId: input.orgId,
      customerPhone: input.customerPhone,
      customerName: appointment.customerName,
      serviceAddress: input.serviceAddress || null,
      startAt: appointment.startAt,
      timezone: appointment.timezone
    });
  }

  if (calendarFallback && input.returnFailureOnCalendarFallback) {
    return {
      ok: false,
      reason: "CALENDAR_UNAVAILABLE",
      holdId: hold.id,
      appointment,
      nextSlots
    };
  }

  return {
    ok: true,
    appointment,
    ...(calendarFallback ? { fallbackReason: "CALENDAR_UNAVAILABLE" as const, nextSlots } : {})
  };
}
