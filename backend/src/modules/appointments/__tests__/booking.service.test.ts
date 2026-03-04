import assert from "node:assert/strict";
import test from "node:test";
import { bookAppointmentWithHold } from "../booking.service";

function createPrismaMock() {
  const holds: Array<{ id: string; status: string }> = [];
  const appointments: Array<Record<string, unknown>> = [];
  const leadUpdates: Array<Record<string, unknown>> = [];

  const prisma = {
    appointmentHold: {
      create: async ({ data }: any) => {
        const row = { id: `hold_${holds.length + 1}`, ...data };
        holds.push({ id: row.id, status: row.status });
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = holds.find((item) => item.id === where.id);
        if (row) row.status = data.status;
        return row || null;
      }
    },
    appointment: {
      overlapHit: false,
      duplicateKeyHit: false,
      findMany: async () =>
        (prisma.appointment as any).overlapHit
          ? [
              {
                id: "appt_existing",
                startAt: new Date("2026-03-05T19:30:00.000Z"),
                endAt: new Date("2026-03-05T20:30:00.000Z")
              }
            ]
          : [],
      findFirst: async ({ where }: any) => {
        if (where?.id && (prisma.appointment as any).overlapHit) {
          return {
            id: "appt_existing_overlap",
            startAt: new Date("2026-03-05T19:30:00.000Z"),
            endAt: new Date("2026-03-05T20:30:00.000Z")
          };
        }
        if (where?.idempotencyKey) {
          return appointments.find((row) => row.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      },
      create: async ({ data }: any) => {
        if ((prisma.appointment as any).duplicateKeyHit) {
          const err = new Error("unique violation") as Error & { code?: string };
          err.code = "P2002";
          throw err;
        }
        const row = { id: `appt_${appointments.length + 1}`, ...data };
        appointments.push(row);
        return row;
      }
    },
    lead: {
      updateMany: async ({ data }: any) => {
        leadUpdates.push(data);
        return { count: 1 };
      }
    }
  } as any;

  return { prisma, holds, appointments, leadUpdates };
}

test("booking confirms when external calendar event is created", async () => {
  const mock = createPrismaMock();
  const result = await bookAppointmentWithHold({
    prisma: mock.prisma,
    orgId: "org_1",
    userId: "user_1",
    leadId: "lead_1",
    customerName: "Alice",
    customerPhone: "+15165550000",
    issueSummary: "AC tune up",
    startAt: new Date("2026-03-05T15:00:00.000Z"),
    endAt: new Date("2026-03-05T16:00:00.000Z"),
    timezone: "America/New_York",
    requestedProvider: "GOOGLE",
    pipelineFeatureEnabled: true,
    createExternalEvent: async () => ({ provider: "GOOGLE", externalEventId: "evt_123" })
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.appointment.status, "CONFIRMED");
  assert.equal(result.appointment.calendarProvider, "GOOGLE");
  assert.equal(mock.holds[0]?.status, "CONFIRMED");
  assert.equal(mock.leadUpdates[0]?.pipelineStage, "SCHEDULED");
});

test("booking falls back to internal pending when external event creation fails", async () => {
  const mock = createPrismaMock();
  const result = await bookAppointmentWithHold({
    prisma: mock.prisma,
    orgId: "org_1",
    userId: "user_1",
    leadId: "lead_1",
    customerName: "Bob",
    customerPhone: "+15165551111",
    issueSummary: "Water heater",
    startAt: new Date("2026-03-05T17:00:00.000Z"),
    endAt: new Date("2026-03-05T18:00:00.000Z"),
    timezone: "America/New_York",
    requestedProvider: "OUTLOOK",
    pipelineFeatureEnabled: true,
    createExternalEvent: async () => {
      throw new Error("provider unavailable");
    }
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.appointment.status, "PENDING");
  assert.equal(result.appointment.calendarProvider, "INTERNAL");
  assert.equal(mock.holds[0]?.status, "FAILED");
  assert.equal(mock.leadUpdates[0]?.pipelineStage, "NEEDS_SCHEDULING");
});

test("booking rejects overlap and marks hold failed", async () => {
  const mock = createPrismaMock();
  (mock.prisma.appointment as any).overlapHit = true;
  const result = await bookAppointmentWithHold({
    prisma: mock.prisma,
    orgId: "org_1",
    userId: "user_1",
    customerName: "Carol",
    customerPhone: "+15165552222",
    issueSummary: "Electrical issue",
    startAt: new Date("2026-03-05T19:00:00.000Z"),
    endAt: new Date("2026-03-05T20:00:00.000Z"),
    timezone: "America/New_York",
    requestedProvider: "INTERNAL"
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "OVERLAP");
  assert.equal(mock.holds[0]?.status, "FAILED");
  assert.equal(mock.appointments.length, 0);
});

test("booking overlap respects buffer minutes between appointments", async () => {
  const mock = createPrismaMock();
  (mock.prisma.appointment as any).findMany = async () => [
    {
      id: "appt_existing",
      startAt: new Date("2026-03-05T10:00:00.000Z"),
      endAt: new Date("2026-03-05T11:00:00.000Z")
    }
  ];
  const result = await bookAppointmentWithHold({
    prisma: mock.prisma,
    orgId: "org_1",
    userId: "user_1",
    customerName: "Dina",
    customerPhone: "+15165553333",
    issueSummary: "Tune-up",
    startAt: new Date("2026-03-05T11:10:00.000Z"),
    endAt: new Date("2026-03-05T12:10:00.000Z"),
    timezone: "America/New_York",
    appointmentBufferMinutes: 15,
    requestedProvider: "INTERNAL"
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "OVERLAP");
});

test("booking returns existing appointment on idempotency duplicate", async () => {
  const mock = createPrismaMock();
  (mock.prisma.appointment as any).duplicateKeyHit = true;
  (mock.prisma.appointment as any).findMany = async () => [];
  (mock.prisma.appointment as any).findFirst = async ({ where }: any) => {
    if (where?.idempotencyKey === "idem_123") {
      return {
        id: "appt_existing",
        orgId: "org_1",
        leadId: null,
        callLogId: null,
        customerName: "Eli",
        customerPhone: "+15165554444",
        issueSummary: "Existing booking",
        assignedTechnician: null,
        status: "CONFIRMED",
        startAt: new Date("2026-03-05T13:00:00.000Z"),
        endAt: new Date("2026-03-05T14:00:00.000Z"),
        timezone: "America/New_York",
        calendarProvider: "INTERNAL",
        externalCalendarEventId: null,
        idempotencyKey: "idem_123",
        createdByUserId: "user_1"
      };
    }
    return null;
  };

  const result = await bookAppointmentWithHold({
    prisma: mock.prisma,
    orgId: "org_1",
    userId: "user_1",
    customerName: "Eli",
    customerPhone: "+15165554444",
    issueSummary: "Duplicate request",
    startAt: new Date("2026-03-05T13:00:00.000Z"),
    endAt: new Date("2026-03-05T14:00:00.000Z"),
    timezone: "America/New_York",
    requestedProvider: "INTERNAL",
    idempotencyKey: "idem_123"
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.appointment.id, "appt_existing");
});
