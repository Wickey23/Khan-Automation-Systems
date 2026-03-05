import assert from "node:assert/strict";
import test from "node:test";
import type { Router } from "express";
import { env } from "../../../config/env";
import { prisma } from "../../../lib/prisma";
import { orgRouter } from "../org.routes";

function getRouteHandler(router: Router, path: string, method: "get" | "post" | "patch") {
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

test("POST /appointments/availability returns exact top-level slots array shape", async () => {
  const handler = getRouteHandler(orgRouter, "/appointments/availability", "post");
  const originalFlags = {
    appointments: env.FEATURE_APPOINTMENTS_ENABLED,
    calendar: env.FEATURE_CALENDAR_OAUTH_ENABLED,
    allowlist: env.FEATURE_PHASE1_ORG_ALLOWLIST
  };
  const originalBusinessSettings = prisma.businessSettings.findUnique;
  const originalAppointmentsFindMany = prisma.appointment.findMany;

  env.FEATURE_APPOINTMENTS_ENABLED = "true";
  env.FEATURE_CALENDAR_OAUTH_ENABLED = "false";
  env.FEATURE_PHASE1_ORG_ALLOWLIST = "*";
  (prisma.businessSettings as any).findUnique = async () => ({
    hoursJson: JSON.stringify({ timezone: "America/New_York", schedule: {} }),
    timezone: "America/New_York",
    appointmentDurationMinutes: 60,
    appointmentBufferMinutes: 15,
    bookingLeadTimeHours: 2,
    bookingMaxDaysAhead: 14
  });
  (prisma.appointment as any).findMany = async () => [];

  try {
    const { res, state } = createMockResponse();
    await handler(
      {
        body: {},
        auth: { orgId: "org_1", role: "CLIENT_ADMIN", userId: "user_1" }
      },
      res
    );
    assert.equal(state.statusCode, 200);
    assert.deepEqual(state.body, { slots: [] });
  } finally {
    env.FEATURE_APPOINTMENTS_ENABLED = originalFlags.appointments;
    env.FEATURE_CALENDAR_OAUTH_ENABLED = originalFlags.calendar;
    env.FEATURE_PHASE1_ORG_ALLOWLIST = originalFlags.allowlist;
    (prisma.businessSettings as any).findUnique = originalBusinessSettings;
    (prisma.appointment as any).findMany = originalAppointmentsFindMany;
  }
});

test("POST /calendar/select-primary enforces single primary and persists selectedCalendarId", async () => {
  const handler = getRouteHandler(orgRouter, "/calendar/select-primary", "post");
  const originalFlags = {
    calendar: env.FEATURE_CALENDAR_OAUTH_ENABLED,
    allowlist: env.FEATURE_PHASE1_ORG_ALLOWLIST
  };
  const originalTx = prisma.$transaction;
  const originalFindFirst = prisma.calendarConnection.findFirst;
  const originalFindUnique = prisma.calendarConnection.findUnique;

  const calls: Array<{ type: string; payload: unknown }> = [];
  env.FEATURE_CALENDAR_OAUTH_ENABLED = "true";
  env.FEATURE_PHASE1_ORG_ALLOWLIST = "*";
  (prisma.calendarConnection as any).findFirst = async () => ({
    id: "conn_google",
    orgId: "org_1",
    provider: "GOOGLE"
  });
  (prisma as any).$transaction = async (fn: (tx: any) => Promise<unknown>) =>
    fn({
      calendarConnection: {
        updateMany: async (args: unknown) => {
          calls.push({ type: "updateMany", payload: args });
          return { count: 2 };
        },
        update: async (args: unknown) => {
          calls.push({ type: "update", payload: args });
          return null;
        }
      }
    });
  (prisma.calendarConnection as any).findUnique = async () => ({
    id: "conn_google",
    orgId: "org_1",
    provider: "GOOGLE",
    isPrimary: true,
    selectedCalendarId: "primary"
  });

  try {
    const { res, state } = createMockResponse();
    await handler(
      {
        body: { connectionId: "conn_google" },
        auth: { orgId: "org_1", role: "CLIENT_ADMIN", userId: "user_1" }
      },
      res
    );
    assert.equal(state.statusCode, 200);
    assert.equal((state.body as any)?.ok, true);
    assert.equal((state.body as any)?.data?.provider?.selectedCalendarId, "primary");
    assert.equal(calls.length, 2);
    assert.equal((calls[0] as any).type, "updateMany");
    assert.equal((calls[1] as any).type, "update");
  } finally {
    env.FEATURE_CALENDAR_OAUTH_ENABLED = originalFlags.calendar;
    env.FEATURE_PHASE1_ORG_ALLOWLIST = originalFlags.allowlist;
    (prisma as any).$transaction = originalTx;
    (prisma.calendarConnection as any).findFirst = originalFindFirst;
    (prisma.calendarConnection as any).findUnique = originalFindUnique;
  }
});

test("POST /calendar/select-primary rejects explicitly empty selectedCalendarId", async () => {
  const handler = getRouteHandler(orgRouter, "/calendar/select-primary", "post");
  const originalFlags = {
    calendar: env.FEATURE_CALENDAR_OAUTH_ENABLED,
    allowlist: env.FEATURE_PHASE1_ORG_ALLOWLIST
  };
  const originalFindFirst = prisma.calendarConnection.findFirst;

  env.FEATURE_CALENDAR_OAUTH_ENABLED = "true";
  env.FEATURE_PHASE1_ORG_ALLOWLIST = "*";
  (prisma.calendarConnection as any).findFirst = async () => ({
    id: "conn_google",
    orgId: "org_1",
    provider: "GOOGLE"
  });

  try {
    const { res, state } = createMockResponse();
    await handler(
      {
        body: { connectionId: "conn_google", selectedCalendarId: "   " },
        auth: { orgId: "org_1", role: "CLIENT_ADMIN", userId: "user_1" }
      },
      res
    );
    assert.equal(state.statusCode, 400);
    assert.equal((state.body as any)?.ok, false);
  } finally {
    env.FEATURE_CALENDAR_OAUTH_ENABLED = originalFlags.calendar;
    env.FEATURE_PHASE1_ORG_ALLOWLIST = originalFlags.allowlist;
    (prisma.calendarConnection as any).findFirst = originalFindFirst;
  }
});
