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

export function frontDeskOutcomeBadgeMeta(kind: "saved" | "booked" | "resolved") {
  switch (kind) {
    case "saved":
      return { label: "Saved lead", tone: "pending" as const };
    case "booked":
      return { label: "Booked outcome", tone: "booking" as const };
    case "resolved":
      return { label: "Resolved", tone: "success" as const };
  }
}

export function frontDeskCardClass(kind: "default" | "muted" | "focus" = "default") {
  if (kind === "focus") {
    return "rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_14px_32px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-px hover:shadow-[0_18px_36px_rgba(15,23,42,0.10)]";
  }
  if (kind === "muted") {
    return "rounded-2xl border border-border/80 bg-muted/[0.16] shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition-colors hover:bg-muted/[0.24]";
  }
  return "rounded-2xl border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-px hover:shadow-[0_16px_34px_rgba(15,23,42,0.08)]";
}

export function frontDeskContextPanelClass() {
  return "rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]";
}

export function frontDeskEmptyStateClass() {
  return "rounded-2xl border border-dashed border-slate-300 bg-slate-50/90 px-4 py-6 text-sm text-slate-600";
}

export function frontDeskLoadingCardClass() {
  return "rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]";
}

export function frontDeskSkeletonLineClass(width: "full" | "lg" | "md" | "sm" = "full") {
  const sizeClass =
    width === "lg"
      ? "w-3/4"
      : width === "md"
        ? "w-1/2"
        : width === "sm"
          ? "w-1/3"
          : "w-full";
  return `h-2.5 animate-pulse rounded-full bg-slate-200/90 ${sizeClass}`;
}
