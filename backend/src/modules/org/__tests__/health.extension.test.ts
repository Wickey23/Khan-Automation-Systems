import assert from "node:assert/strict";
import test from "node:test";
import { computeOrgHealth } from "../health.service";

test("health includes additive quality and SLA checks", async () => {
  const now = new Date();
  const prisma = {
    subscription: { findFirst: async () => ({ status: "active" }) },
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
    aiAgentConfig: { findFirst: async () => ({ id: "ai_1" }) },
    provisioningChecklist: { findUnique: async () => ({ stepsJson: "[]" }) },
    testScenario: {
      findMany: async () => [
        {
          id: "s1",
          tagsJson: "[\"after_hours\",\"transfer\"]",
          testRuns: [{ status: "PASS", createdAt: now }]
        },
        {
          id: "s2",
          tagsJson: "[\"intake\"]",
          testRuns: [{ status: "PASS", createdAt: now }]
        },
        {
          id: "s3",
          tagsJson: "[\"intake\"]",
          testRuns: [{ status: "PASS", createdAt: now }]
        },
        {
          id: "s4",
          tagsJson: "[\"intake\"]",
          testRuns: [{ status: "PASS", createdAt: now }]
        },
        {
          id: "s5",
          tagsJson: "[\"intake\"]",
          testRuns: [{ status: "PASS", createdAt: now }]
        }
      ]
    },
    callLog: {
      findMany: async () => [{ outcome: "MESSAGE_TAKEN", callQualityScore: 80 }],
      findFirst: async () => ({ startedAt: now })
    },
    lead: { findFirst: async () => ({ createdAt: now }) },
    message: { findFirst: async () => ({ createdAt: now }) }
  } as any;

  const health = await computeOrgHealth({
    prisma,
    org: { id: "org_1", status: "LIVE", live: true } as any,
    env: { VAPI_TOOL_SECRET: "1234", CALL_QUALITY_MIN_SCORE: "75" }
  });

  assert.equal(typeof health.checks.callQualityAverage.ok, "boolean");
  assert.equal(typeof health.checks.slaDegradation.ok, "boolean");
});

