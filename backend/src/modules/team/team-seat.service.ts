export type SeatSnapshot = {
  seatPolicy: "activeMembers + pendingInvites <= allowedSeats";
  includedSeats: number;
  purchasedSeats: number;
  allowedSeats: number;
  activeMembers: number;
  pendingInvites: number;
  upgradeHint: string;
};

export function buildSeatSnapshot(input: {
  isPro: boolean;
  purchasedSeats: number;
  activeMembers: number;
  pendingInvites: number;
}): SeatSnapshot {
  const includedSeats = input.isPro ? 3 : 1;
  const purchasedSeats = Math.max(0, Math.floor(input.purchasedSeats || 0));
  const activeMembers = Math.max(0, Math.floor(input.activeMembers || 0));
  const pendingInvites = Math.max(0, Math.floor(input.pendingInvites || 0));
  const allowedSeats = includedSeats + purchasedSeats;
  const reached = activeMembers + pendingInvites >= allowedSeats;
  return {
    seatPolicy: "activeMembers + pendingInvites <= allowedSeats",
    includedSeats,
    purchasedSeats,
    allowedSeats,
    activeMembers,
    pendingInvites,
    upgradeHint: reached ? "Seat limit reached. Upgrade plan or add seat add-ons to invite more users." : ""
  };
}

export function canInviteSeat(snapshot: Pick<SeatSnapshot, "activeMembers" | "pendingInvites" | "allowedSeats">) {
  return snapshot.activeMembers + snapshot.pendingInvites < snapshot.allowedSeats;
}

export function canAcceptSeat(snapshot: Pick<SeatSnapshot, "activeMembers" | "pendingInvites" | "allowedSeats">) {
  return snapshot.activeMembers + snapshot.pendingInvites <= snapshot.allowedSeats;
}
