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
    return "rounded-[26px] border border-slate-200/95 bg-[linear-gradient(135deg,rgba(255,255,255,0.99)_0%,rgba(242,247,255,0.99)_58%,rgba(227,238,251,0.97)_100%)] shadow-[0_24px_50px_rgba(15,23,42,0.13)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_28px_56px_rgba(15,23,42,0.16)]";
  }
  if (kind === "muted") {
    return "rounded-[24px] border border-slate-200/95 bg-[linear-gradient(180deg,rgba(249,251,253,0.98)_0%,rgba(239,244,249,0.98)_100%)] shadow-[0_12px_28px_rgba(15,23,42,0.07)] transition-colors hover:bg-[linear-gradient(180deg,rgba(247,250,253,0.99)_0%,rgba(235,241,247,0.99)_100%)]";
  }
  return "rounded-[24px] border border-slate-200/95 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(245,249,252,0.99)_100%)] shadow-[0_18px_38px_rgba(15,23,42,0.10)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_46px_rgba(15,23,42,0.12)]";
}

export function frontDeskContextPanelClass() {
  return "rounded-[26px] border border-slate-200/95 bg-[linear-gradient(135deg,rgba(255,255,255,0.99)_0%,rgba(242,247,253,0.99)_68%,rgba(229,238,249,0.97)_100%)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.10)]";
}

export function frontDeskEmptyStateClass() {
  return "rounded-[24px] border border-dashed border-slate-300/95 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(241,246,252,0.98)_100%)] px-5 py-7 text-sm leading-6 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]";
}

export function frontDeskLoadingCardClass() {
  return "rounded-[24px] border border-slate-200/95 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(244,248,252,0.99)_100%)] px-4 py-4 shadow-[0_18px_36px_rgba(15,23,42,0.08)]";
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
      return "border-sky-300/90 bg-[linear-gradient(180deg,rgba(235,246,255,0.98)_0%,rgba(218,237,255,0.94)_100%)]";
    case "booked":
      return "border-emerald-300/90 bg-[linear-gradient(180deg,rgba(237,252,243,0.98)_0%,rgba(213,245,224,0.94)_100%)]";
    case "resolved":
      return "border-slate-300/90 bg-[linear-gradient(180deg,rgba(246,249,252,0.97)_0%,rgba(235,241,247,0.94)_100%)]";
    default:
      return "border-slate-200/95 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(244,248,252,0.99)_100%)]";
  }
}

export function frontDeskWorkspaceCardClass(kind: "default" | "hero" | "subtle" = "default") {
  if (kind === "hero") {
    return "rounded-[30px] border border-slate-200/95 bg-[linear-gradient(135deg,rgba(255,255,255,0.99)_0%,rgba(234,243,255,0.98)_44%,rgba(214,230,250,0.95)_100%)] shadow-[0_26px_56px_rgba(15,23,42,0.14)]";
  }
  if (kind === "subtle") {
    return "rounded-[26px] border border-slate-200/95 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(241,246,251,0.98)_100%)] shadow-[0_18px_36px_rgba(15,23,42,0.10)]";
  }
  return "rounded-[28px] border border-slate-200/95 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(243,248,252,0.99)_100%)] shadow-[0_22px_46px_rgba(15,23,42,0.12)]";
}

export function frontDeskMetricCardClass() {
  return "rounded-[24px] border border-slate-200/95 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(240,246,251,0.99)_100%)] shadow-[0_18px_34px_rgba(15,23,42,0.10)]";
}

export function frontDeskActionStripClass() {
  return "inline-flex items-center gap-2 rounded-full border border-slate-300/90 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800 shadow-[0_10px_18px_rgba(15,23,42,0.08)]";
}
