import assert from "node:assert/strict";
import test from "node:test";
import { getOrgSlaSeverity, runSlaMonitorTick } from "../sla-monitor.service";

test("default SLA severity is INFO", () => {
  assert.equal(getOrgSlaSeverity("org_missing"), "INFO");
});

test("SLA monitor tick runs with empty metrics", async () => {
  const prisma = {
    organization: { findMany: async () => [{ id: "org_1" }] },
    webhookEventLog: { groupBy: async () => [] },
    message: { groupBy: async () => [] },
    auditLog: { create: async () => ({}) }
  } as any;

  await runSlaMonitorTick(prisma);
  assert.ok(["INFO", "WARN", "CRITICAL"].includes(getOrgSlaSeverity("org_1")));
});

