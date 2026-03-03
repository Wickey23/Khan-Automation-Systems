import assert from "node:assert/strict";
import test from "node:test";
import { computeReadinessReport } from "../readiness.service";

test("readiness blocks go-live when billing is inactive", async () => {
  const prisma = {
    subscription: { findFirst: async () => ({ status: "past_due" }) },
    onboardingSubmission: { findUnique: async () => ({ status: "APPROVED" }) },
    businessSettings: {
      findUnique: async () => ({
        timezone: "America/New_York",
        hoursJson: "{\"timezone\":\"America/New_York\",\"schedule\":{\"mon\":[{\"start\":\"08:00\",\"end\":\"17:00\"}]}}",
        transferNumbersJson: "[\"+15555550123\"]",
        notificationEmailsJson: "[\"owner@example.com\"]",
        notificationPhonesJson: "[]"
      })
    },
    phoneNumber: { findFirst: async () => ({ e164Number: "+15555550123", status: "ACTIVE" }) },
    aiAgentConfig: { findFirst: async () => ({ id: "ai_1", status: "ACTIVE" }) },
    provisioningChecklist: { findUnique: async () => ({ stepsJson: "[]" }) },
    testScenario: {
      findMany: async () => [
        { id: "s1", tagsJson: "[\"after_hours\"]", testRuns: [{ status: "PASS", createdAt: new Date() }] },
        { id: "s2", tagsJson: "[\"transfer\"]", testRuns: [{ status: "PASS", createdAt: new Date() }] },
        { id: "s3", tagsJson: "[\"intake\"]", testRuns: [{ status: "PASS", createdAt: new Date() }] },
        { id: "s4", tagsJson: "[\"intake\"]", testRuns: [{ status: "PASS", createdAt: new Date() }] },
        { id: "s5", tagsJson: "[\"intake\"]", testRuns: [{ status: "PASS", createdAt: new Date() }] }
      ]
    }
  } as any;

  const report = await computeReadinessReport({
    prisma,
    org: { id: "org_1", status: "PROVISIONING", live: false } as any,
    env: { VAPI_TOOL_SECRET: "1234" }
  });

  assert.equal(report.checks.billingActive.ok, false);
  assert.equal(report.canGoLive, false);
});
