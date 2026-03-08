import assert from "node:assert/strict";
import test from "node:test";
import { buildSmsBookingIdempotencyKey, parseSlotReply } from "../appointment-request-sms.service";

const offeredSlots = [
  {
    index: 1,
    startAt: "2026-03-10T19:30:00.000Z",
    endAt: "2026-03-10T20:30:00.000Z",
    label: "Tue 3:30 PM",
    offeredAt: "2026-03-06T23:00:00.000Z",
    slotHash: "slot_1"
  },
  {
    index: 2,
    startAt: "2026-03-11T15:00:00.000Z",
    endAt: "2026-03-11T16:00:00.000Z",
    label: "Wed 11:00 AM",
    offeredAt: "2026-03-06T23:00:00.000Z",
    slotHash: "slot_2"
  },
  {
    index: 3,
    startAt: "2026-03-12T18:15:00.000Z",
    endAt: "2026-03-12T19:15:00.000Z",
    label: "Thu 2:15 PM",
    offeredAt: "2026-03-06T23:00:00.000Z",
    slotHash: "slot_3"
  }
];

test("parseSlotReply matches numeric replies first", () => {
  const result = parseSlotReply({ body: "option 2 please", offeredSlots });
  assert.equal(result.kind, "matched_slot");
  if (result.kind === "matched_slot") assert.equal(result.slot.index, 2);
});

test("parseSlotReply matches ordinal replies", () => {
  const result = parseSlotReply({ body: "the first one", offeredSlots });
  assert.equal(result.kind, "matched_slot");
  if (result.kind === "matched_slot") assert.equal(result.slot.index, 1);
});

test("parseSlotReply marks out-of-range numeric replies invalid", () => {
  const result = parseSlotReply({ body: "4", offeredSlots });
  assert.equal(result.kind, "invalid");
});

test("parseSlotReply treats unmatched natural language as ambiguous instead of guessing", () => {
  const result = parseSlotReply({ body: "tomorrow afternoon", offeredSlots });
  assert.equal(result.kind, "ambiguous");
});

test("buildSmsBookingIdempotencyKey is stable for the same request offer and slot", () => {
  const first = buildSmsBookingIdempotencyKey({
    requestId: "req_1",
    offerVersion: "offer_1",
    slotHash: "slot_1"
  });
  const second = buildSmsBookingIdempotencyKey({
    requestId: "req_1",
    offerVersion: "offer_1",
    slotHash: "slot_1"
  });
  assert.equal(first, "sms-request:req_1:offer_1:slot_1");
  assert.equal(second, first);
});
