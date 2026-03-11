type FrontDeskPriority = "urgent" | "high" | "normal" | "low";
type FrontDeskFollowUpState = "needs_follow_up" | "contacted" | "booked" | "closed" | "spam";
type FrontDeskRecommendedAction =
  | "Call back now"
  | "Review request"
  | "Offer times"
  | "Confirm booking"
  | "Monitor replies"
  | "No action needed"
  | "Ignore";

type FrontDeskActivityType = "call" | "message" | "appointment_request" | "appointment" | "lead" | null;

type FrontDeskLeadLike = {
  name?: string | null;
  phone?: string | null;
  serviceRequested?: string | null;
  urgency?: string | null;
  serviceAddress?: string | null;
  appointmentRequested?: boolean | null;
  status?: string | null;
  pipelineStage?: string | null;
  classification?: string | null;
  createdAt?: Date | string | null;
  message?: string | null;
};

type FrontDeskServiceRequestLike = {
  customerName?: string | null;
  phone?: string | null;
  serviceType?: string | null;
  urgency?: string | null;
  serviceAddress?: string | null;
  appointmentRequested?: boolean | null;
  status?: string | null;
  notes?: string | null;
  followUpSentAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

type FrontDeskAppointmentRequestLike = {
  status?: string | null;
  issueSummary?: string | null;
  serviceAddress?: string | null;
  lastEventAt?: Date | string | null;
  requestedStartAt?: Date | string | null;
};

type FrontDeskMessageThreadLike = {
  lastMessageAt?: Date | string | null;
};

type FrontDeskCallLike = {
  displayName?: string | null;
  fromNumber: string;
  outcome?: string | null;
  aiSummary?: string | null;
  transcript?: string | null;
  appointmentRequested?: boolean | null;
  unansweredTransfer?: boolean | null;
  startedAt?: Date | string | null;
  recoverySmsSentAt?: Date | string | null;
};

export type OrgCallFrontDesk = {
  callerName: string | null;
  callerPhone: string;
  serviceRequested: string | null;
  urgency: string | null;
  serviceLocation: string | null;
  appointmentRequested: boolean;
  summary: string;
  needsFollowUp: boolean;
  followUpState: FrontDeskFollowUpState;
  frontDeskPriority: FrontDeskPriority;
  recommendedAction: FrontDeskRecommendedAction;
};

export type LeadFrontDesk = {
  state: FrontDeskFollowUpState;
  needsFollowUp: boolean;
  frontDeskPriority: FrontDeskPriority;
  recommendedAction: FrontDeskRecommendedAction;
  lastActivityAt: string | null;
  lastActivityType: FrontDeskActivityType;
  summary: string;
};

function clean(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function isPlaceholderName(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return !normalized || ["unknown", "unknown caller", "unknown contact"].includes(normalized);
}

function normalizeSummaryFallback(transcript: string | null | undefined) {
  const text = String(transcript || "")
    .split("\n")
    .map((line) => line.replace(/^[A-Z_]+:\s*/i, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 220) : null;
}

function urgencyLooksUrgent(value: string | null | undefined) {
  const text = String(value || "").toLowerCase();
  return ["emergency", "urgent", "asap", "immediately", "same day", "today"].some((token) => text.includes(token));
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function maxIso(values: Array<Date | string | null | undefined>) {
  const parsed = values
    .map((value) => toIso(value))
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return parsed[0] || null;
}

function summaryFromOutcome(outcome: string | null | undefined) {
  const normalized = String(outcome || "").toUpperCase();
  if (normalized === "MISSED") return "Customer called and still needs a callback.";
  if (normalized === "ABANDONED") return "Customer did not complete the call and still may need follow-up.";
  if (normalized === "TRANSFERRED") return "Call was transferred and should be confirmed.";
  if (normalized === "APPOINTMENT_REQUEST") return "Customer requested an appointment.";
  if (normalized === "SPAM") return "Call marked as spam.";
  return "Customer request captured for office review.";
}

function deriveCallState(input: {
  call: FrontDeskCallLike;
  lead?: FrontDeskLeadLike | null;
  serviceRequest?: FrontDeskServiceRequestLike | null;
  appointmentRequest?: FrontDeskAppointmentRequestLike | null;
}): FrontDeskFollowUpState {
  if (String(input.call.outcome || "").toUpperCase() === "SPAM") return "spam";
  if (String(input.appointmentRequest?.status || "").toUpperCase() === "SCHEDULED") return "booked";
  if (["RESOLVED", "DISMISSED"].includes(String(input.serviceRequest?.status || "").toUpperCase())) return "closed";
  if (String(input.serviceRequest?.status || "").toUpperCase() === "FOLLOW_UP_SENT") return "contacted";
  if (
    ["MISSED", "ABANDONED"].includes(String(input.call.outcome || "").toUpperCase()) ||
    input.call.unansweredTransfer ||
    ["NEW", "NEEDS_REVIEW"].includes(String(input.serviceRequest?.status || "").toUpperCase()) ||
    ["PENDING_REVIEW", "SLOT_OFFERED"].includes(String(input.appointmentRequest?.status || "").toUpperCase())
  ) {
    return "needs_follow_up";
  }
  if (input.call.recoverySmsSentAt) return "contacted";
  return "needs_follow_up";
}

function deriveLeadState(input: {
  lead: FrontDeskLeadLike;
  latestCall?: FrontDeskCallLike | null;
  serviceRequest?: FrontDeskServiceRequestLike | null;
  appointmentRequest?: FrontDeskAppointmentRequestLike | null;
}): FrontDeskFollowUpState {
  if (
    String(input.lead.classification || "").toUpperCase() === "SPAM" ||
    String(input.latestCall?.outcome || "").toUpperCase() === "SPAM"
  ) {
    return "spam";
  }
  if (
    String(input.lead.pipelineStage || "").toUpperCase() === "SCHEDULED" ||
    String(input.appointmentRequest?.status || "").toUpperCase() === "SCHEDULED"
  ) {
    return "booked";
  }
  if (
    String(input.lead.pipelineStage || "").toUpperCase() === "COMPLETED" ||
    ["WON", "LOST"].includes(String(input.lead.status || "").toUpperCase())
  ) {
    return "closed";
  }
  if (
    String(input.lead.status || "").toUpperCase() === "CONTACTED" ||
    String(input.serviceRequest?.status || "").toUpperCase() === "FOLLOW_UP_SENT"
  ) {
    return "contacted";
  }
  return "needs_follow_up";
}

function derivePriority(input: {
  state: FrontDeskFollowUpState;
  urgency: string | null;
  missedLike: boolean;
  appointmentRequested: boolean;
  appointmentRequestStatus?: string | null;
}): FrontDeskPriority {
  if (input.state === "spam" || input.state === "closed" || input.state === "booked") return "low";
  if (urgencyLooksUrgent(input.urgency)) return "urgent";
  if (
    input.missedLike ||
    (input.appointmentRequested && String(input.appointmentRequestStatus || "").toUpperCase() !== "SCHEDULED") ||
    String(input.appointmentRequestStatus || "").toUpperCase() === "PENDING_REVIEW"
  ) {
    return "high";
  }
  return "normal";
}

function deriveRecommendedAction(input: {
  state: FrontDeskFollowUpState;
  missedLike: boolean;
  appointmentRequestStatus?: string | null;
  appointmentRequested: boolean;
  serviceRequestStatus?: string | null;
}): FrontDeskRecommendedAction {
  if (input.state === "spam") return "Ignore";
  if (input.state === "booked") return "Confirm booking";
  if (input.state === "closed") return "No action needed";
  if (input.missedLike) return "Call back now";
  const requestStatus = String(input.appointmentRequestStatus || "").toUpperCase();
  if (requestStatus === "PENDING_REVIEW") return "Review request";
  if (requestStatus === "APPROVED" || String(input.serviceRequestStatus || "").toUpperCase() === "NEEDS_SCHEDULING" || input.appointmentRequested) {
    return "Offer times";
  }
  if (input.state === "contacted") return "Monitor replies";
  return "Review request";
}

export function buildOrgCallFrontDesk(input: {
  call: FrontDeskCallLike;
  lead?: FrontDeskLeadLike | null;
  serviceRequest?: FrontDeskServiceRequestLike | null;
  appointmentRequest?: FrontDeskAppointmentRequestLike | null;
}): OrgCallFrontDesk {
  const callerName =
    clean(input.serviceRequest?.customerName) ||
    (!isPlaceholderName(input.lead?.name) ? clean(input.lead?.name) : null) ||
    (!isPlaceholderName(input.call.displayName) ? clean(input.call.displayName) : null);
  const serviceRequested =
    clean(input.serviceRequest?.serviceType) ||
    clean(input.lead?.serviceRequested) ||
    clean(input.appointmentRequest?.issueSummary) ||
    clean(input.call.aiSummary);
  const urgency = clean(input.serviceRequest?.urgency) || clean(input.lead?.urgency);
  const serviceLocation =
    clean(input.serviceRequest?.serviceAddress) ||
    clean(input.lead?.serviceAddress) ||
    clean(input.appointmentRequest?.serviceAddress);
  const appointmentRequested =
    input.serviceRequest?.appointmentRequested === true ||
    input.lead?.appointmentRequested === true ||
    Boolean(input.appointmentRequest?.status) ||
    input.call.appointmentRequested === true;
  const summary =
    clean(input.call.aiSummary) ||
    clean(input.serviceRequest?.notes) ||
    clean(input.appointmentRequest?.issueSummary) ||
    normalizeSummaryFallback(input.call.transcript) ||
    summaryFromOutcome(input.call.outcome);
  const missedLike =
    ["MISSED", "ABANDONED"].includes(String(input.call.outcome || "").toUpperCase()) || Boolean(input.call.unansweredTransfer);
  const followUpState = deriveCallState(input);
  return {
    callerName,
    callerPhone: input.call.fromNumber,
    serviceRequested,
    urgency,
    serviceLocation,
    appointmentRequested,
    summary,
    needsFollowUp: followUpState === "needs_follow_up",
    followUpState,
    frontDeskPriority: derivePriority({
      state: followUpState,
      urgency,
      missedLike,
      appointmentRequested,
      appointmentRequestStatus: input.appointmentRequest?.status
    }),
    recommendedAction: deriveRecommendedAction({
      state: followUpState,
      missedLike,
      appointmentRequestStatus: input.appointmentRequest?.status,
      appointmentRequested,
      serviceRequestStatus: input.serviceRequest?.status
    })
  };
}

export function buildLeadFrontDesk(input: {
  lead: FrontDeskLeadLike;
  latestCall?: FrontDeskCallLike | null;
  serviceRequest?: FrontDeskServiceRequestLike | null;
  appointmentRequest?: FrontDeskAppointmentRequestLike | null;
  latestMessageThread?: FrontDeskMessageThreadLike | null;
}): LeadFrontDesk {
  const state = deriveLeadState(input);
  const summary =
    clean(input.serviceRequest?.serviceType) ||
    clean(input.serviceRequest?.notes) ||
    clean(input.lead.serviceRequested) ||
    clean(input.lead.message) ||
    clean(input.latestCall?.aiSummary) ||
    summaryFromOutcome(input.latestCall?.outcome);
  const missedLike =
    ["MISSED", "ABANDONED"].includes(String(input.latestCall?.outcome || "").toUpperCase()) ||
    Boolean(input.latestCall?.unansweredTransfer);
  const appointmentRequested =
    input.serviceRequest?.appointmentRequested === true ||
    input.lead.appointmentRequested === true ||
    Boolean(input.appointmentRequest?.status);
  const lastActivityAt = maxIso([
    input.latestMessageThread?.lastMessageAt,
    input.appointmentRequest?.lastEventAt,
    input.serviceRequest?.updatedAt,
    input.latestCall?.startedAt,
    input.lead.createdAt
  ]);
  let lastActivityType: FrontDeskActivityType = null;
  if (lastActivityAt) {
    if (toIso(input.latestMessageThread?.lastMessageAt) === lastActivityAt) lastActivityType = "message";
    else if (toIso(input.appointmentRequest?.lastEventAt) === lastActivityAt) lastActivityType = "appointment_request";
    else if (toIso(input.serviceRequest?.updatedAt) === lastActivityAt) lastActivityType = "appointment_request";
    else if (toIso(input.latestCall?.startedAt) === lastActivityAt) lastActivityType = "call";
    else lastActivityType = "lead";
  }
  return {
    state,
    needsFollowUp: state === "needs_follow_up",
    frontDeskPriority: derivePriority({
      state,
      urgency: clean(input.serviceRequest?.urgency) || clean(input.lead.urgency),
      missedLike,
      appointmentRequested,
      appointmentRequestStatus: input.appointmentRequest?.status
    }),
    recommendedAction: deriveRecommendedAction({
      state,
      missedLike,
      appointmentRequestStatus: input.appointmentRequest?.status,
      appointmentRequested,
      serviceRequestStatus: input.serviceRequest?.status
    }),
    lastActivityAt,
    lastActivityType,
    summary
  };
}
