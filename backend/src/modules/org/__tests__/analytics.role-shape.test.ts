import assert from "node:assert/strict";
import test from "node:test";
import { shapeOrgAnalyticsForRole } from "../analytics.service";

const base = {
  range: "7d",
  start: "2026-03-01T00:00:00.000Z",
  end: "2026-03-07T23:59:59.999Z",
  kpis: {
    totalCalls: 10
  },
  charts: {
    callsPerDay: [{ day: "2026-03-01", value: 2 }],
    leadsPerDay: [{ day: "2026-03-01", value: 1 }],
    outcomeBreakdown: [{ outcome: "APPOINTMENT_REQUEST", value: 3 }]
  }
};

test("viewer role gets summary-only analytics charts", () => {
  const shaped = shapeOrgAnalyticsForRole(base, "CLIENT");
  assert.equal(shaped.charts.callsPerDay.length, 0);
  assert.equal(shaped.charts.leadsPerDay.length, 0);
  assert.equal(shaped.charts.outcomeBreakdown.length, 0);
});

test("manager/admin roles keep full analytics charts", () => {
  const manager = shapeOrgAnalyticsForRole(base, "CLIENT_STAFF");
  assert.equal(manager.charts.callsPerDay.length, 1);
  assert.equal(manager.charts.leadsPerDay.length, 1);
  assert.equal(manager.charts.outcomeBreakdown.length, 1);

  const admin = shapeOrgAnalyticsForRole(base, "CLIENT_ADMIN");
  assert.equal(admin.charts.callsPerDay.length, 1);
  assert.equal(admin.charts.leadsPerDay.length, 1);
  assert.equal(admin.charts.outcomeBreakdown.length, 1);
});

