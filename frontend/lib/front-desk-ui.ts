import { clientBadgeClass } from "@/lib/client-badges";
import type { FrontDeskPriority } from "@/lib/types";

export function frontDeskPriorityMeta(priority: FrontDeskPriority | undefined) {
  if (priority === "urgent") return { label: "Urgent", tone: "critical" as const };
  if (priority === "high") return { label: "High priority", tone: "warning" as const };
  if (priority === "low") return { label: "Low priority", tone: "neutral" as const };
  return { label: "Normal priority", tone: "neutral" as const };
}

export function frontDeskActionMeta(action: string | null | undefined) {
  switch (action) {
    case "Call back now":
      return { label: action, tone: "warning" as const };
    case "Review request":
    case "Review reply":
      return { label: action, tone: "pending" as const };
    case "Offer times":
      return { label: action, tone: "booking" as const };
    case "Monitor replies":
      return { label: action, tone: "automated" as const };
    case "Confirm booking":
      return { label: action, tone: "success" as const };
    case "Ignore":
      return { label: action, tone: "critical" as const };
    case "No action needed":
      return { label: action, tone: "neutral" as const };
    default:
      return { label: action || "Review request", tone: "pending" as const };
  }
}

export function frontDeskPriorityBadgeClass(priority: FrontDeskPriority | undefined) {
  return clientBadgeClass(frontDeskPriorityMeta(priority).tone);
}

export function frontDeskActionBadgeClass(action: string | null | undefined) {
  return clientBadgeClass(frontDeskActionMeta(action).tone);
}
