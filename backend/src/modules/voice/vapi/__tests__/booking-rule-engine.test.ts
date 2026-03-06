import assert from "node:assert/strict";
import test from "node:test";
import { evaluateBookingRuleEngine } from "../booking-rule-engine";
import { evaluateBookingState } from "../booking-state-machine";

test("structured intent wins with high confidence", () => {
  const result = evaluateBookingRuleEngine({
    structured: { bookingIntent: true, customerName: "Samir Khan", customerPhone: "+15163067876" },
    transcript: ""
  });
  assert.equal(result.bookingIntent, true);
  assert.equal(result.source, "STRUCTURED");
  assert.equal(result.confidence, 0.95);
  assert.equal(result.extracted.customerName, "Samir Khan");
});

test("transcript fallback infers intent and address", () => {
  const result = evaluateBookingRuleEngine({
    transcript: "Hi my name is John Doe. I need to schedule service at 42 Fairfax Ave Brooklyn NY."
  });
  assert.equal(result.bookingIntent, true);
  assert.equal(result.source, "TRANSCRIPT");
  assert.equal(result.extracted.customerName, "John Doe");
  assert.ok(String(result.extracted.serviceAddress || "").includes("42 Fairfax"));
});

test("state machine confirms only with valid future datetime", () => {
  const now = new Date("2026-03-06T12:00:00.000Z");
  const confirmed = evaluateBookingState({
    customerName: "Samir Khan",
    customerPhone: "+15163067876",
    requestedStartAt: new Date("2026-03-06T14:00:00.000Z"),
    now
  });
  assert.equal(confirmed.decision, "CONFIRM_ATTEMPT");

  const needsScheduling = evaluateBookingState({
    customerName: "Samir Khan",
    customerPhone: "+15163067876",
    requestedStartAt: null,
    now
  });
  assert.equal(needsScheduling.decision, "NEEDS_SCHEDULING");
});

