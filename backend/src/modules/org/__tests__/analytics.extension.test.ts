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
    lead: { findMany: async () => [] },
    messageThread: { findMany: async () => [{ id: "t1", createdAt: now }] },
    message: {
      findMany: async () => [
        { threadId: "t1", direction: "OUTBOUND", createdAt: now, metadataJson: "{\"recovery\":true}", leadId: null },
        { threadId: "t1", direction: "INBOUND", createdAt: now, metadataJson: "{}", leadId: "lead_1" }
      ]
    }
  } as any;

  const data = await computeOrgAnalytics(prisma, "org_1", { range: "7d" });
  assert.equal(typeof data.kpis.callQualityAverage, "number");
  assert.equal(typeof data.kpis.autoRecoverySent, "number");
  assert.equal(typeof data.kpis.autoRecoveryLeadConversions, "number");
});

