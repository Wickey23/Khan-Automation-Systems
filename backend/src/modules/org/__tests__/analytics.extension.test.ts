import assert from "node:assert/strict";
import test from "node:test";
import { computeOrgAnalytics } from "../analytics.service";

test("analytics includes additive KPIs for call quality and auto recovery", async () => {
  const now = new Date();
  const prisma = {
    callLog: {
      findMany: async () => [
        {
          id: "c1",
          startedAt: now,
          durationSec: 40,
          outcome: "MESSAGE_TAKEN",
          appointmentRequested: false,
          leadId: null,
          callQualityScore: 80
        }
      ]
    },
    lead: {
      findMany: async () => [],
      count: async () => 0
    },
    messageThread: { findMany: async () => [{ id: "t1", createdAt: now }] },
    message: {
      findMany: async () => [
        { threadId: "t1", direction: "OUTBOUND", createdAt: now, metadataJson: "{\"recovery\":true}", leadId: null },
        { threadId: "t1", direction: "INBOUND", createdAt: now, metadataJson: "{}", leadId: "lead_1" }
      ]
    },
    appointment: { count: async () => 0 },
    callClassificationLog: { count: async () => 0 },
    businessSettings: { findUnique: async () => ({ averageJobValueUsd: 650 }) }
  } as any;

  const data = await computeOrgAnalytics(prisma, "org_1", { range: "7d" });
  assert.equal(typeof data.kpis.callQualityAverage, "number");
  assert.equal(typeof data.kpis.autoRecoverySent, "number");
  assert.equal(typeof data.kpis.autoRecoveryLeadConversions, "number");
  assert.equal(typeof data.kpis.estimatedRevenueOpportunityUsd, "number");
  assert.equal(data.kpis.estimatedRevenueOpportunityUsd, 0);
  assert.equal(typeof data.kpis.conversionRate, "number");
  assert.equal(data.kpis.conversionRate, 0);
});

test("analytics computes conversion and revenue opportunity from appointments and average job value", async () => {
  const now = new Date();
  const prisma = {
    callLog: { findMany: async () => [] },
    lead: {
      findMany: async () => [],
      count: async () => 4
    },
    messageThread: { findMany: async () => [] },
    message: { findMany: async () => [] },
    appointment: { count: async () => 3 },
    callClassificationLog: { count: async () => 2 },
    businessSettings: { findUnique: async () => ({ averageJobValueUsd: 700 }) }
  } as any;

  const data = await computeOrgAnalytics(prisma, "org_1", { range: "7d" });
  assert.equal(data.kpis.appointmentsBooked, 3);
  assert.equal(data.kpis.qualifiedLeads, 4);
  assert.equal(data.kpis.conversionRate, 0.75);
  assert.equal(data.kpis.averageJobValueUsd, 700);
  assert.equal(data.kpis.estimatedRevenueOpportunityUsd, 2100);
  assert.equal(data.kpis.missedCallsRecovered, 2);
  assert.equal(typeof now.getTime(), "number");
});
