export const OPERATIONAL_LABELS = {
  needsReview: "Needs review",
  needsRetry: "Needs retry",
  atRisk: "At risk",
  unassigned: "Unassigned",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  criticalAttention: "Critical attention",
  highAttention: "High attention",
  blockedOutbound: "Blocked outbound",
  dncOptOut: "DNC / opt-out",
  overdue: "Overdue",
  stale: "Stale",
  healthy: "Healthy",
  quiet: "Quiet",
  lowActivity: "Low activity",
  notYetActivated: "Not yet activated"
} as const;

export const APPROVAL_FOCUS_LABELS = {
  all: "All priorities",
  needs_review: OPERATIONAL_LABELS.needsReview,
  needs_retry: OPERATIONAL_LABELS.needsRetry,
  in_delivery: "In delivery",
  completed: "Completed"
} as const;

export const FOLLOW_UP_FILTER_LABELS = {
  all: "All",
  at_risk: OPERATIONAL_LABELS.atRisk,
  mine: "My items",
  unassigned: OPERATIONAL_LABELS.unassigned,
  overdue_mine: "Overdue mine",
  overdue_unassigned: "Overdue unassigned",
  overdue: OPERATIONAL_LABELS.overdue,
  today: "Due today",
  soon: "Due soon",
  assigned: "Assigned"
} as const;

export const ATTENTION_RISK_LABELS = {
  all: "All risk groups",
  at_risk: "At risk items",
  critical_unowned: "Critical/high + unassigned"
} as const;

export function formatApprovalStatusLabel(status?: string | null) {
  if (status === "PENDING") return OPERATIONAL_LABELS.pending;
  if (status === "APPROVED") return OPERATIONAL_LABELS.approved;
  if (status === "REJECTED") return OPERATIONAL_LABELS.rejected;
  if (status === "EXPIRED") return "Expired";
  if (status === "QUEUED") return "Queued";
  if (status === "SENDING") return "Sending";
  if (status === "SENT") return "Sent";
  if (status === "FAILED") return "Failed";
  return status || "-";
}
