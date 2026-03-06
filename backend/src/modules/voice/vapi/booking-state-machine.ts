export type BookingStateDecision = "IGNORE" | "CONFIRM_ATTEMPT" | "NEEDS_SCHEDULING";

export function evaluateBookingState(input: {
  customerName: string;
  customerPhone: string;
  requestedStartAt?: Date | null;
  now?: Date;
}) {
  const now = input.now || new Date();
  const hasName = Boolean(String(input.customerName || "").trim());
  const hasPhone = Boolean(String(input.customerPhone || "").trim());

  if (!hasName || !hasPhone) {
    return {
      decision: "IGNORE" as BookingStateDecision,
      reason: "missing_required_identity"
    };
  }

  const requested = input.requestedStartAt || null;
  if (requested && requested.getTime() > now.getTime()) {
    return {
      decision: "CONFIRM_ATTEMPT" as BookingStateDecision,
      reason: "has_valid_future_datetime"
    };
  }

  return {
    decision: "NEEDS_SCHEDULING" as BookingStateDecision,
    reason: requested ? "datetime_not_future" : "missing_datetime"
  };
}

