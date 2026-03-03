import assert from "node:assert/strict";
import test from "node:test";
import { evaluateComplianceTier0 } from "../compliance.service";

function baseOrg() {
  return {
    status: "LIVE",
    live: true
  } as any;
}

test("compliance blocks paused org", () => {
  const decision = evaluateComplianceTier0({
    org: { ...baseOrg(), status: "PAUSED" },
    phone: { e164Number: "+15555550123", status: "ACTIVE", provider: "TWILIO" } as any,
    aiAssistantId: "asst_1"
  });
  assert.equal(decision?.reasonCode, "ORG_NOT_ACTIVE");
});

test("compliance blocks when assistant missing", () => {
  const decision = evaluateComplianceTier0({
    org: baseOrg(),
    phone: { e164Number: "+15555550123", status: "ACTIVE", provider: "TWILIO" } as any,
    aiAssistantId: null
  });
  assert.equal(decision?.reasonCode, "AI_ASSISTANT_NOT_CONFIGURED");
});

test("compliance passes for healthy context", () => {
  const decision = evaluateComplianceTier0({
    org: baseOrg(),
    phone: { e164Number: "+15555550123", status: "ACTIVE", provider: "TWILIO" } as any,
    aiAssistantId: "asst_1"
  });
  assert.equal(decision, null);
});

