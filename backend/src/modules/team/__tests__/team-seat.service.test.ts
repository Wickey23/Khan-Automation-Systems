import assert from "node:assert/strict";
import test from "node:test";
import { buildSeatSnapshot, canAcceptSeat, canInviteSeat } from "../team-seat.service";

test("standard plan includes one seat", () => {
  const snapshot = buildSeatSnapshot({
    isPro: false,
    purchasedSeats: 0,
    activeMembers: 1,
    pendingInvites: 0
  });
  assert.equal(snapshot.allowedSeats, 1);
  assert.equal(canInviteSeat(snapshot), false);
});

test("pro plan includes three seats and supports pending invites in enforcement", () => {
  const snapshot = buildSeatSnapshot({
    isPro: true,
    purchasedSeats: 1,
    activeMembers: 2,
    pendingInvites: 2
  });
  assert.equal(snapshot.allowedSeats, 4);
  assert.equal(snapshot.activeMembers + snapshot.pendingInvites, 4);
  assert.equal(canInviteSeat(snapshot), false);
  assert.equal(snapshot.upgradeHint.length > 0, true);
});

test("seat enforcement allows invite below boundary", () => {
  const snapshot = buildSeatSnapshot({
    isPro: true,
    purchasedSeats: 0,
    activeMembers: 1,
    pendingInvites: 1
  });
  assert.equal(snapshot.allowedSeats, 3);
  assert.equal(canInviteSeat(snapshot), true);
});

test("acceptance enforcement allows boundary and blocks only when active + pending exceeds seats", () => {
  const boundary = buildSeatSnapshot({
    isPro: false,
    purchasedSeats: 0,
    activeMembers: 1,
    pendingInvites: 0
  });
  assert.equal(canAcceptSeat(boundary), true);

  const available = buildSeatSnapshot({
    isPro: true,
    purchasedSeats: 0,
    activeMembers: 2,
    pendingInvites: 1
  });
  assert.equal(canAcceptSeat(available), true);

  const drifted = buildSeatSnapshot({
    isPro: true,
    purchasedSeats: 0,
    activeMembers: 3,
    pendingInvites: 1
  });
  assert.equal(drifted.allowedSeats, 3);
  assert.equal(canAcceptSeat(drifted), false);
});
