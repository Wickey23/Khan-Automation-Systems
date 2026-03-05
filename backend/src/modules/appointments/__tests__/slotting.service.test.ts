import assert from "node:assert/strict";
import test from "node:test";
import { generateAvailabilitySlots, validateSlotWithinBusinessHours } from "../slotting.service";

const HOURS_JSON = JSON.stringify({
  timezone: "America/New_York",
  schedule: {
    mon: [{ start: "08:00", end: "17:00" }]
  }
});

test("rejects slot when slot end exceeds business close", () => {
  const result = validateSlotWithinBusinessHours({
    hoursJson: HOURS_JSON,
    timezone: "America/New_York",
    slotStartAt: new Date("2026-03-02T16:30:00-05:00"),
    appointmentDurationMinutes: 60
  });
  assert.equal(result.ok, false);
});

test("accepts latest boundary slot that ends exactly at close", () => {
  const result = validateSlotWithinBusinessHours({
    hoursJson: HOURS_JSON,
    timezone: "America/New_York",
    slotStartAt: new Date("2026-03-02T16:00:00-05:00"),
    appointmentDurationMinutes: 60
  });
  assert.equal(result.ok, true);
});

test("15-minute step alignment plus close constraint returns deterministic valid slot", () => {
  const slots = generateAvailabilitySlots({
    hoursJson: HOURS_JSON,
    timezone: "America/New_York",
    appointmentDurationMinutes: 60,
    appointmentBufferMinutes: 0,
    bookingLeadTimeHours: 0,
    bookingMaxDaysAhead: 1,
    now: new Date("2026-03-02T15:57:00-05:00"),
    maxSlots: 10
  });

  assert.equal(slots.length > 0, true);
  const first = slots[0];
  assert.equal(first.startAt.toISOString(), "2026-03-02T21:00:00.000Z");
  assert.equal(first.endAt.toISOString(), "2026-03-02T22:00:00.000Z");
  assert.equal(slots.some((slot) => slot.startAt.toISOString() === "2026-03-02T21:15:00.000Z"), false);
});

test("excludes overlapping slots using locked overlap predicate and keeps boundary non-overlap", () => {
  const slots = generateAvailabilitySlots({
    hoursJson: HOURS_JSON,
    timezone: "America/New_York",
    appointmentDurationMinutes: 60,
    appointmentBufferMinutes: 0,
    bookingLeadTimeHours: 0,
    bookingMaxDaysAhead: 1,
    now: new Date("2026-03-02T08:00:00-05:00"),
    existingAppointments: [
      {
        startAt: new Date("2026-03-02T10:00:00-05:00"),
        endAt: new Date("2026-03-02T11:00:00-05:00"),
        status: "CONFIRMED"
      }
    ]
  });

  const starts = slots.map((slot) => slot.startAt.toISOString());
  assert.equal(starts.includes("2026-03-02T15:00:00.000Z"), false); // 10:00 local blocked
  assert.equal(starts.includes("2026-03-02T16:00:00.000Z"), true); // 11:00 local allowed boundary
});

test("returns max 10 slots sorted ascending", () => {
  const slots = generateAvailabilitySlots({
    hoursJson: HOURS_JSON,
    timezone: "America/New_York",
    appointmentDurationMinutes: 15,
    appointmentBufferMinutes: 0,
    bookingLeadTimeHours: 0,
    bookingMaxDaysAhead: 10,
    now: new Date("2026-03-02T08:00:00-05:00"),
    maxSlots: 10
  });
  assert.equal(slots.length, 10);
  for (let i = 1; i < slots.length; i += 1) {
    assert.equal(slots[i - 1].startAt.getTime() <= slots[i].startAt.getTime(), true);
  }
});

test("returns deterministic slot ordering for identical input", () => {
  const input = {
    hoursJson: HOURS_JSON,
    timezone: "America/New_York",
    appointmentDurationMinutes: 60,
    appointmentBufferMinutes: 15,
    bookingLeadTimeHours: 1,
    bookingMaxDaysAhead: 2,
    now: new Date("2026-03-02T08:07:00-05:00"),
    existingAppointments: [
      {
        startAt: new Date("2026-03-02T12:00:00-05:00"),
        endAt: new Date("2026-03-02T13:00:00-05:00"),
        status: "CONFIRMED"
      }
    ],
    maxSlots: 10
  };

  const runA = generateAvailabilitySlots(input).map((slot) => `${slot.startAt.toISOString()}|${slot.endAt.toISOString()}`);
  const runB = generateAvailabilitySlots(input).map((slot) => `${slot.startAt.toISOString()}|${slot.endAt.toISOString()}`);
  assert.deepEqual(runA, runB);
});

test("includes external busy windows and buffer expansion before merge", () => {
  const slots = generateAvailabilitySlots({
    hoursJson: HOURS_JSON,
    timezone: "America/New_York",
    appointmentDurationMinutes: 60,
    appointmentBufferMinutes: 15,
    bookingLeadTimeHours: 0,
    bookingMaxDaysAhead: 1,
    now: new Date("2026-03-02T08:00:00-05:00"),
    externalBusyBlocks: [
      {
        startAt: new Date("2026-03-02T10:00:00-05:00"),
        endAt: new Date("2026-03-02T11:00:00-05:00")
      }
    ],
    maxSlots: 40
  });

  const starts = slots.map((slot) => slot.startAt.toISOString());
  // 10:00 and 11:00 local are blocked when 15m buffer expands both sides.
  assert.equal(starts.includes("2026-03-02T15:00:00.000Z"), false);
  assert.equal(starts.includes("2026-03-02T16:00:00.000Z"), false);
  assert.equal(starts.includes("2026-03-02T16:15:00.000Z"), true);
});

test("end-of-day boundary allows final slot even when appointment buffer is configured", () => {
  const slots = generateAvailabilitySlots({
    hoursJson: HOURS_JSON,
    timezone: "America/New_York",
    appointmentDurationMinutes: 60,
    appointmentBufferMinutes: 15,
    bookingLeadTimeHours: 0,
    bookingMaxDaysAhead: 1,
    now: new Date("2026-03-02T08:00:00-05:00"),
    maxSlots: 40
  });

  const starts = slots.map((slot) => slot.startAt.toISOString());
  // 16:00 local should still be offered; buffer is between appointments only.
  assert.equal(starts.includes("2026-03-02T21:00:00.000Z"), true);
});
