import assert from "node:assert/strict";
import test from "node:test";
import { evaluateScaleGateSnapshot } from "../system-ops.service";

test("low incident warning is true for fewer than 3 P1 incidents", () => {
  const result = evaluateScaleGateSnapshot({
    webhookSuccessRate: 1,
    leadLinkageRate: 1,
    p1AckTimeP95Ms: null,
    p1ResolutionTimeP95Ms: null,
    orgExposurePercent: 0,
    trafficExposurePercent: 0,
    orgExposureThreshold: 0.5,
    trafficExposureThreshold: 0.5,
    p1IncidentCount14d: 2,
    evaluationTimestamp: "2026-03-02T00:00:00.000Z",
    cooldownStatus: "PASS"
  });
  assert.equal(result.warnings.lowIncidentVolumeWarning, true);
  assert.equal(result.result, "PASS");
});

test("traffic exposure above threshold fails gate", () => {
  const result = evaluateScaleGateSnapshot({
    webhookSuccessRate: 1,
    leadLinkageRate: 1,
    p1AckTimeP95Ms: null,
    p1ResolutionTimeP95Ms: null,
    orgExposurePercent: 0.1,
    trafficExposurePercent: 0.8,
    orgExposureThreshold: 0.5,
    trafficExposureThreshold: 0.5,
    p1IncidentCount14d: 5,
    evaluationTimestamp: "2026-03-02T00:00:00.000Z",
    cooldownStatus: "PASS"
  });
  assert.equal(result.result, "FAIL");
  assert.ok(result.failingCriteria.includes("TRAFFIC_EXPOSURE_THRESHOLD_EXCEEDED"));
});

test("cooldown fail is non-systemic and does not set systemic trigger alone", () => {
  const result = evaluateScaleGateSnapshot({
    webhookSuccessRate: 1,
    leadLinkageRate: 1,
    p1AckTimeP95Ms: null,
    p1ResolutionTimeP95Ms: null,
    orgExposurePercent: 0.1,
    trafficExposurePercent: 0.1,
    orgExposureThreshold: 0.5,
    trafficExposureThreshold: 0.5,
    p1IncidentCount14d: 5,
    evaluationTimestamp: "2026-03-02T00:00:00.000Z",
    cooldownStatus: "FAIL"
  });
  assert.equal(result.result, "FAIL");
  assert.ok(result.failingCriteria.includes("SYSTEMIC_COOLDOWN_ACTIVE"));
  assert.equal(result.systemicFailTriggered, false);
});

test("same fixed evaluation snapshot produces deterministic output", () => {
  const input = {
    webhookSuccessRate: 0.99,
    leadLinkageRate: 0.97,
    p1AckTimeP95Ms: 16 * 60 * 1000,
    p1ResolutionTimeP95Ms: 3 * 60 * 60 * 1000,
    orgExposurePercent: 0.2,
    trafficExposurePercent: 0.3,
    orgExposureThreshold: 0.5,
    trafficExposureThreshold: 0.5,
    p1IncidentCount14d: 1,
    evaluationTimestamp: "2026-03-02T00:00:00.000Z",
    cooldownStatus: "PASS" as const
  };
  const a = evaluateScaleGateSnapshot(input);
  const b = evaluateScaleGateSnapshot(input);
  assert.deepEqual(a, b);
});
