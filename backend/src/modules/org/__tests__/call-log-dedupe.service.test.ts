import assert from "node:assert/strict";
import test from "node:test";
import { dedupeOrgCallRows, type CallRowForDedupe } from "../call-log-dedupe.service";

function buildCall(overrides: Partial<CallRowForDedupe>): CallRowForDedupe {
  return {
    id: "call_1",
    startedAt: new Date("2026-03-03T03:10:00.000Z"),
    fromNumber: "+15163067876",
    outcome: "MESSAGE_TAKEN",
    durationSec: null,
    recordingUrl: null,
    transcript: null,
    aiSummary: null,
    endedAt: null,
    completedAt: null,
    leadId: null,
    ...overrides
  };
}

test("suppresses low-signal duplicate when a stronger sibling exists", () => {
  const lowSignal = buildCall({ id: "a" });
  const strongSignal = buildCall({
    id: "b",
    startedAt: new Date("2026-03-03T03:10:02.000Z"),
    durationSec: 119,
    recordingUrl: "https://example.com/rec.mp3",
    aiSummary: "Caller requested furnace service."
  });

  const rows = dedupeOrgCallRows([strongSignal, lowSignal]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.id, "b");
});

test("keeps distinct calls outside dedupe time window", () => {
  const first = buildCall({
    id: "a",
    startedAt: new Date("2026-03-03T03:10:00.000Z"),
    durationSec: 120
  });
  const second = buildCall({
    id: "b",
    startedAt: new Date("2026-03-03T03:10:10.000Z")
  });

  const rows = dedupeOrgCallRows([second, first]);
  assert.equal(rows.length, 2);
});

test("does not suppress when both rows contain call signal", () => {
  const first = buildCall({
    id: "a",
    durationSec: 32,
    aiSummary: "Summary one"
  });
  const second = buildCall({
    id: "b",
    startedAt: new Date("2026-03-03T03:10:03.000Z"),
    durationSec: 40,
    transcript: "Caller spoke with assistant"
  });

  const rows = dedupeOrgCallRows([second, first]);
  assert.equal(rows.length, 2);
});
