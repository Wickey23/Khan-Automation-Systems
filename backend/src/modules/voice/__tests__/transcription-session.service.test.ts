import assert from "node:assert/strict";
import test from "node:test";
import { buildSafeCallSummaryFallback } from "../transcription/transcription-session.service";

test("buildSafeCallSummaryFallback prefers transcript text when available", () => {
  const result = buildSafeCallSummaryFallback({
    transcript: "CALLER: My AC stopped working.\nAGENT: I can help with that.\nCALLER: I need someone today."
  });

  assert.match(result, /My AC stopped working/i);
  assert.doesNotMatch(result, /Call request captured for office review/i);
});

test("buildSafeCallSummaryFallback uses safe missed-call wording", () => {
  const result = buildSafeCallSummaryFallback({
    outcome: "MISSED"
  });

  assert.match(result, /still needs follow-up/i);
  assert.match(result, /missed call/i);
});

test("buildSafeCallSummaryFallback uses incomplete-data wording for answered calls", () => {
  const result = buildSafeCallSummaryFallback({
    outcome: "MESSAGE_TAKEN",
    answeredAt: new Date("2026-03-12T10:00:00.000Z")
  });

  assert.match(result, /structured extraction was incomplete/i);
  assert.match(result, /review the call record/i);
});
