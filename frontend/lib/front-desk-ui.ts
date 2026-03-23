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
    return "rounded-xl border border-sky-200 bg-white transition-colors duration-150 hover:border-sky-300";
  }
  if (kind === "muted") {
    return "rounded-xl border border-slate-200 bg-slate-50 shadow-none transition-colors hover:border-slate-300 hover:bg-white";
  }
  return "rounded-xl border border-slate-200 bg-white shadow-none transition-colors duration-150 hover:border-slate-300";
}

export function frontDeskContextPanelClass() {
  return "rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-none";
}

export function frontDeskEmptyStateClass() {
  return "rounded-[12px] border border-dashed border-slate-300 bg-white/70 px-5 py-7 text-sm leading-6 text-slate-700";
}

export function frontDeskLoadingCardClass() {
  return "rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm";
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

export function frontDeskOutcomeSurfaceClass(kind: "active" | "saved" | "booked" | "resolved") {
  switch (kind) {
    case "saved":
      return "border-sky-200 bg-sky-50/65";
    case "booked":
      return "border-emerald-200 bg-emerald-50/65";
    case "resolved":
      return "border-slate-200 bg-slate-50/75";
    default:
      return "border-slate-200 bg-white";
  }
}

export function frontDeskWorkspaceCardClass(kind: "default" | "hero" | "subtle" = "default") {
  if (kind === "hero") {
    return "rounded-xl border border-slate-200 bg-white shadow-none";
  }
  if (kind === "subtle") {
    return "rounded-xl border border-slate-200 bg-slate-50 shadow-none";
  }
  return "rounded-xl border border-slate-200 bg-white shadow-none";
}

export function frontDeskMetricCardClass() {
  return "rounded-xl border border-slate-200 bg-white shadow-none";
}

export function frontDeskActionStripClass() {
  return "inline-flex items-center gap-2 rounded-full border border-slate-400 bg-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-800";
}
