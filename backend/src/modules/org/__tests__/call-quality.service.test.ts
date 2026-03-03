import assert from "node:assert/strict";
import test from "node:test";
import { computeCallQualityBreakdown } from "../call-quality.service";

test("call quality scoring is deterministic and clamped", () => {
  const breakdown = computeCallQualityBreakdown({
    durationSec: 35,
    appointmentRequested: true,
    leadId: "lead_1",
    rawJson: { analysis: { successEvaluation: 0.9, sentiment: 0.6 } }
  });
  assert.equal(breakdown.version, "v1");
  assert.ok(breakdown.total >= 0);
  assert.ok(breakdown.total <= 100);
});

test("short hangup is penalized", () => {
  const breakdown = computeCallQualityBreakdown({
    durationSec: 5,
    appointmentRequested: false,
    leadId: null,
    rawJson: {}
  });
  assert.ok(breakdown.components.shortHangupScore < 0);
});

