export type ClientStatusTone = "success" | "warning" | "critical" | "neutral" | "automated" | "manual" | "booking" | "failed" | "pending";

export function connectedNumberProviderLabel(value: string | null | undefined) {
  if (value === "TWILIO") return "Connected line";
  if (value === "VAPI") return "Connected line";
  return "Number setup";
}

export function connectedNumberProviderDetail(value: string | null | undefined) {
  if (value === "TWILIO") return "Live line connected";
  if (value === "VAPI") return "Live line connected";
  return "Setup needed";
}

export function messagingReadinessLabel(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "READY") return "Ready";
  if (normalized === "BLOCKED") return "Needs attention";
  if (normalized === "PENDING") return "In progress";
  return "Needs review";
}

export function messagingReadinessTone(value: string | null | undefined): ClientStatusTone {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "READY") return "success";
  if (normalized === "BLOCKED") return "critical";
  if (normalized === "PENDING") return "pending";
  return "warning";
}

export function healthLevelLabel(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "RED") return "Needs attention";
  if (normalized === "YELLOW") return "Watch closely";
  return "Ready";
}

export function healthLevelTone(value: string | null | undefined): ClientStatusTone {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "RED") return "critical";
  if (normalized === "YELLOW") return "warning";
  return "success";
}

export function subscriptionStatusLabel(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "not_active") return "Not active";
  if (normalized === "trialing") return "Trialing";
  if (normalized === "active") return "Active";
  if (normalized === "past_due") return "Needs attention";
  if (normalized === "payment_failed" || normalized === "unpaid" || normalized === "incomplete") return "Blocked";
  return normalized.replaceAll("_", " ");
}

export function setupReadinessLabel(ready: boolean, inProgress?: boolean) {
  if (ready) return "Ready";
  if (inProgress) return "In progress";
  return "Not configured";
}

export function setupReadinessTone(ready: boolean, inProgress?: boolean): ClientStatusTone {
  if (ready) return "success";
  if (inProgress) return "pending";
  return "warning";
}
