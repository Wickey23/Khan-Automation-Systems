import assert from "node:assert/strict";
import test from "node:test";
import { computeRoutingDecision } from "../routing.service";

function baseInput() {
  return {
    org: { status: "LIVE", live: true } as any,
    phone: { e164Number: "+15555550123", status: "ACTIVE", provider: "TWILIO" } as any,
    aiConfig: { vapiAgentId: "asst_1", transferRulesJson: "{}" } as any,
    settings: {
      afterHoursMode: "TAKE_MESSAGE",
      transferNumbersJson: "[\"+15555550124\"]",
      policiesJson: "{}",
      hoursJson:
        "{\"timezone\":\"America/New_York\",\"schedule\":{\"sun\":[{\"start\":\"00:00\",\"end\":\"23:59\"}],\"mon\":[{\"start\":\"00:00\",\"end\":\"23:59\"}],\"tue\":[{\"start\":\"00:00\",\"end\":\"23:59\"}],\"wed\":[{\"start\":\"00:00\",\"end\":\"23:59\"}],\"thu\":[{\"start\":\"00:00\",\"end\":\"23:59\"}],\"fri\":[{\"start\":\"00:00\",\"end\":\"23:59\"}],\"sat\":[{\"start\":\"00:00\",\"end\":\"23:59\"}]}}"
    } as any,
    callerProfile: null,
    callVolumeLast5m: 0
  };
}

test("tier 0 compliance wins over lower tiers", () => {
  const decision = computeRoutingDecision({
    ...baseInput(),
    org: { status: "PAUSED", live: false } as any
  });
  assert.equal(decision.tier, 0);
  assert.equal(decision.reasonCode, "ORG_NOT_ACTIVE");
});

test("overflow routes before repeat caller tier", () => {
  const decision = computeRoutingDecision({
    ...baseInput(),
    callVolumeLast5m: 99,
    settings: {
      ...baseInput().settings,
      policiesJson: "{\"overflowThresholdPer5m\":5}"
    } as any,
    callerProfile: { totalCalls: 10, lastCallAt: new Date(), flaggedVIP: false } as any
  });
  assert.equal(decision.tier, 4);
  assert.equal(decision.reasonCode, "CALL_VOLUME_THRESHOLD_EXCEEDED");
});

test("repeat caller falls to tier 5 when higher tiers not matched", () => {
  const decision = computeRoutingDecision({
    ...baseInput(),
    callerProfile: { totalCalls: 3, lastCallAt: new Date(), flaggedVIP: false } as any
  });
  assert.equal(decision.tier, 5);
  assert.equal(decision.reasonCode, "REPEAT_CALLER_RECENT");
});
