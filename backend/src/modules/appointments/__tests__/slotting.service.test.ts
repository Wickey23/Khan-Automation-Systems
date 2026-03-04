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

