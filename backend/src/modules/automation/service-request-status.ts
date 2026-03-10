export const serviceRequestStatuses = [
  "NEW",
  "NEEDS_REVIEW",
  "NEEDS_SCHEDULING",
  "FOLLOW_UP_SENT",
  "RESOLVED",
  "DISMISSED"
] as const;

export type ServiceRequestStatus = (typeof serviceRequestStatuses)[number];

export const terminalServiceRequestStatuses = new Set<ServiceRequestStatus>(["RESOLVED", "DISMISSED"]);
