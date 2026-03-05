import assert from "node:assert/strict";
import test from "node:test";
import type { Router } from "express";
import { env } from "../../../config/env";
import { prisma } from "../../../lib/prisma";
import { toolsRouter } from "../tools.routes";

function getRouteHandler(router: Router, path: string, method: "post") {
  const layer = (router as any).stack.find((entry: any) => entry?.route?.path === path && entry.route.methods?.[method]);
  if (!layer) throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  const stack = layer.route.stack || [];
  const handler = stack[stack.length - 1]?.handle;
  if (typeof handler !== "function") throw new Error(`Handler missing for ${method.toUpperCase()} ${path}`);
  return handler as (req: any, res: any) => Promise<unknown>;
}

function createMockResponse() {
  const state: { statusCode: number; body: unknown } = { statusCode: 200, body: null };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      state.body = payload;
      return res;
    }
  };
  return { res, state };
}

test("POST /tools/book-appointment propose mode returns deterministic slot contract", async () => {
  const handler = getRouteHandler(toolsRouter, "/book-appointment", "post");
  const originalFlags = {
    appointments: env.FEATURE_APPOINTMENTS_ENABLED,
    calendar: env.FEATURE_CALENDAR_OAUTH_ENABLED,
    allowlist: env.FEATURE_PHASE1_ORG_ALLOWLIST
  };
  const originalSettingsFindUnique = prisma.businessSettings.findUnique;
  const originalAppointmentsFindMany = prisma.appointment.findMany;

  env.FEATURE_APPOINTMENTS_ENABLED = "true";
  env.FEATURE_CALENDAR_OAUTH_ENABLED = "false";
  env.FEATURE_PHASE1_ORG_ALLOWLIST = "*";
  (prisma.businessSettings as any).findUnique = async () => ({
    hoursJson: JSON.stringify({
      timezone: "America/New_York",
      schedule: { mon: [{ start: "08:00", end: "17:00" }], tue: [{ start: "08:00", end: "17:00" }], wed: [{ start: "08:00", end: "17:00" }], thu: [{ start: "08:00", end: "17:00" }], fri: [{ start: "08:00", end: "17:00" }] }
    }),
    timezone: "America/New_York",
    appointmentDurationMinutes: 60,
    appointmentBufferMinutes: 15,
    bookingLeadTimeHours: 0,
    bookingMaxDaysAhead: 14
  });
  (prisma.appointment as any).findMany = async () => [];

  try {
    const { res, state } = createMockResponse();
    await handler(
      {
        body: {
          orgId: "org_1",
          customerName: "Alex",
          customerPhone: "+15165550000"
        }
      },
      res
    );
    assert.equal(state.statusCode, 200);
    assert.equal((state.body as any)?.ok, true);
    assert.equal(Array.isArray((state.body as any)?.data?.slots), true);
    assert.equal(((state.body as any)?.data?.slots || []).length <= 3, true);
  } finally {
    env.FEATURE_APPOINTMENTS_ENABLED = originalFlags.appointments;
    env.FEATURE_CALENDAR_OAUTH_ENABLED = originalFlags.calendar;
    env.FEATURE_PHASE1_ORG_ALLOWLIST = originalFlags.allowlist;
    (prisma.businessSettings as any).findUnique = originalSettingsFindUnique;
    (prisma.appointment as any).findMany = originalAppointmentsFindMany;
  }
});

test("POST /tools/book-appointment confirm mode returns failure contract on overlap", async () => {
  const handler = getRouteHandler(toolsRouter, "/book-appointment", "post");
  const originalFlags = {
    appointments: env.FEATURE_APPOINTMENTS_ENABLED,
    calendar: env.FEATURE_CALENDAR_OAUTH_ENABLED,
    allowlist: env.FEATURE_PHASE1_ORG_ALLOWLIST
  };
  const originalSettingsFindUnique = prisma.businessSettings.findUnique;
  const originalAppointmentsFindMany = prisma.appointment.findMany;
  const originalHoldCreate = prisma.appointmentHold.create;
  const originalHoldUpdate = prisma.appointmentHold.update;

  env.FEATURE_APPOINTMENTS_ENABLED = "true";
  env.FEATURE_CALENDAR_OAUTH_ENABLED = "false";
  env.FEATURE_PHASE1_ORG_ALLOWLIST = "*";
  (prisma.businessSettings as any).findUnique = async () => ({
    hoursJson: JSON.stringify({
      timezone: "America/New_York",
      schedule: { mon: [{ start: "08:00", end: "17:00" }], tue: [{ start: "08:00", end: "17:00" }], wed: [{ start: "08:00", end: "17:00" }], thu: [{ start: "08:00", end: "17:00" }], fri: [{ start: "08:00", end: "17:00" }] }
    }),
    timezone: "America/New_York",
    appointmentDurationMinutes: 60,
    appointmentBufferMinutes: 15,
    bookingLeadTimeHours: 0,
    bookingMaxDaysAhead: 14
  });
  (prisma.appointment as any).findMany = async () => [
    {
      id: "appt_busy",
      startAt: new Date("2026-03-09T15:00:00.000Z"),
      endAt: new Date("2026-03-09T16:00:00.000Z"),
      status: "CONFIRMED"
    }
  ];
  (prisma.appointmentHold as any).create = async ({ data }: any) => ({ id: "hold_1", ...data });
  (prisma.appointmentHold as any).update = async () => null;

  try {
    const { res, state } = createMockResponse();
    await handler(
      {
        body: {
          orgId: "org_1",
          customerName: "Alex",
          customerPhone: "+15165550000",
          requestedStartAt: "2026-03-09T15:00:00.000Z"
        }
      },
      res
    );
    assert.equal(state.statusCode, 409);
    assert.equal((state.body as any)?.ok, false);
    assert.equal((state.body as any)?.error?.code, "BOOKING_FAILED");
    assert.equal((state.body as any)?.data?.failureReason, "OVERLAP");
    assert.equal(Array.isArray((state.body as any)?.data?.nextSlots), true);
  } finally {
    env.FEATURE_APPOINTMENTS_ENABLED = originalFlags.appointments;
    env.FEATURE_CALENDAR_OAUTH_ENABLED = originalFlags.calendar;
    env.FEATURE_PHASE1_ORG_ALLOWLIST = originalFlags.allowlist;
    (prisma.businessSettings as any).findUnique = originalSettingsFindUnique;
    (prisma.appointment as any).findMany = originalAppointmentsFindMany;
    (prisma.appointmentHold as any).create = originalHoldCreate;
    (prisma.appointmentHold as any).update = originalHoldUpdate;
  }
});

test("POST /tools/book-appointment returns CALENDAR_UNAVAILABLE failure contract when calendar cannot commit", async () => {
  const handler = getRouteHandler(toolsRouter, "/book-appointment", "post");
  const originalFlags = {
    appointments: env.FEATURE_APPOINTMENTS_ENABLED,
    calendar: env.FEATURE_CALENDAR_OAUTH_ENABLED,
    pipeline: env.FEATURE_PIPELINE_STAGE_ENABLED,
    allowlist: env.FEATURE_PHASE1_ORG_ALLOWLIST
  };
  const originalSettingsFindUnique = prisma.businessSettings.findUnique;
  const originalAppointmentsFindMany = prisma.appointment.findMany;
  const originalAppointmentCreate = prisma.appointment.create;
  const originalAppointmentFindFirst = prisma.appointment.findFirst;
  const originalHoldCreate = prisma.appointmentHold.create;
  const originalHoldUpdate = prisma.appointmentHold.update;
  const originalTx = prisma.$transaction;
  const originalConnectionsFindFirst = prisma.calendarConnection.findFirst;

  env.FEATURE_APPOINTMENTS_ENABLED = "true";
  env.FEATURE_CALENDAR_OAUTH_ENABLED = "true";
  env.FEATURE_PIPELINE_STAGE_ENABLED = "false";
  env.FEATURE_PHASE1_ORG_ALLOWLIST = "*";
  (prisma.businessSettings as any).findUnique = async () => ({
    hoursJson: JSON.stringify({
      timezone: "America/New_York",
      schedule: { mon: [{ start: "08:00", end: "17:00" }], tue: [{ start: "08:00", end: "17:00" }], wed: [{ start: "08:00", end: "17:00" }], thu: [{ start: "08:00", end: "17:00" }], fri: [{ start: "08:00", end: "17:00" }] }
    }),
    timezone: "America/New_York",
    appointmentDurationMinutes: 60,
    appointmentBufferMinutes: 15,
    bookingLeadTimeHours: 0,
    bookingMaxDaysAhead: 14
  });
  (prisma.appointment as any).findMany = async () => [];
  (prisma.appointment as any).findFirst = async () => null;
  (prisma.appointment as any).create = async ({ data }: any) => ({
    id: "appt_pending",
    ...data
  });
  (prisma.appointmentHold as any).create = async ({ data }: any) => ({ id: "hold_2", ...data });
  (prisma.appointmentHold as any).update = async () => null;
  (prisma.calendarConnection as any).findFirst = async () => null;
  (prisma as any).$transaction = async (fn: (tx: any) => Promise<unknown>) => fn(prisma as any);

  try {
    const { res, state } = createMockResponse();
    await handler(
      {
        body: {
          orgId: "org_1",
          customerName: "Casey",
          customerPhone: "+15165550000",
          requestedStartAt: "2026-03-09T15:00:00.000Z"
        }
      },
      res
    );
    assert.equal(state.statusCode, 409);
    assert.equal((state.body as any)?.ok, false);
    assert.equal((state.body as any)?.error?.code, "CALENDAR_UNAVAILABLE");
    assert.equal((state.body as any)?.data?.failureReason, "CALENDAR_UNAVAILABLE");
    assert.equal(Array.isArray((state.body as any)?.data?.nextSlots), true);
  } finally {
    env.FEATURE_APPOINTMENTS_ENABLED = originalFlags.appointments;
    env.FEATURE_CALENDAR_OAUTH_ENABLED = originalFlags.calendar;
    env.FEATURE_PIPELINE_STAGE_ENABLED = originalFlags.pipeline;
    env.FEATURE_PHASE1_ORG_ALLOWLIST = originalFlags.allowlist;
    (prisma.businessSettings as any).findUnique = originalSettingsFindUnique;
    (prisma.appointment as any).findMany = originalAppointmentsFindMany;
    (prisma.appointment as any).findFirst = originalAppointmentFindFirst;
    (prisma.appointment as any).create = originalAppointmentCreate;
    (prisma.appointmentHold as any).create = originalHoldCreate;
    (prisma.appointmentHold as any).update = originalHoldUpdate;
    (prisma.calendarConnection as any).findFirst = originalConnectionsFindFirst;
    (prisma as any).$transaction = originalTx;
  }
});
