import assert from "node:assert/strict";
import test from "node:test";
import { overlapsLocked, overlapsWithBufferLocked } from "../overlap.service";

test("locked overlap predicate excludes boundary-touching windows", () => {
  const existingStart = new Date("2026-03-03T10:00:00.000Z");
  const existingEnd = new Date("2026-03-03T11:00:00.000Z");
  const touchingAtEndStart = overlapsLocked(
    existingStart,
    existingEnd,
    new Date("2026-03-03T11:00:00.000Z"),
    new Date("2026-03-03T12:00:00.000Z")
  );
  const touchingAtStartEnd = overlapsLocked(
    existingStart,
    existingEnd,
    new Date("2026-03-03T09:00:00.000Z"),
    new Date("2026-03-03T10:00:00.000Z")
  );
  assert.equal(touchingAtEndStart, false);
  assert.equal(touchingAtStartEnd, false);
});

test("locked overlap predicate detects true overlap", () => {
  const result = overlapsLocked(
    new Date("2026-03-03T10:00:00.000Z"),
    new Date("2026-03-03T11:00:00.000Z"),
    new Date("2026-03-03T10:30:00.000Z"),
    new Date("2026-03-03T11:30:00.000Z")
  );
  assert.equal(result, true);
});

test("buffer overlap expands only around existing appointments", () => {
  const result = overlapsWithBufferLocked(
    new Date("2026-03-03T10:00:00.000Z"),
    new Date("2026-03-03T11:00:00.000Z"),
    new Date("2026-03-03T11:10:00.000Z"),
    new Date("2026-03-03T11:40:00.000Z"),
    15
  );
  assert.equal(result, true);
});

