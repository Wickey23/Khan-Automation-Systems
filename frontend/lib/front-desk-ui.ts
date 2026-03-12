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
    return "rounded-[26px] border border-slate-200/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(245,249,255,0.98)_62%,rgba(231,241,252,0.96)_100%)] shadow-[0_22px_48px_rgba(15,23,42,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_26px_54px_rgba(15,23,42,0.15)]";
  }
  if (kind === "muted") {
    return "rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.95)_0%,rgba(241,245,249,0.95)_100%)] shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-colors hover:bg-[linear-gradient(180deg,rgba(245,248,252,0.98)_0%,rgba(237,242,247,0.98)_100%)]";
  }
  return "rounded-[24px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] shadow-[0_16px_36px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(15,23,42,0.10)]";
}

export function frontDeskContextPanelClass() {
  return "rounded-[26px] border border-slate-200/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(244,248,253,0.98)_70%,rgba(233,241,251,0.95)_100%)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]";
}

export function frontDeskEmptyStateClass() {
  return "rounded-[24px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(243,248,253,0.96)_100%)] px-5 py-7 text-sm leading-6 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]";
}

export function frontDeskLoadingCardClass() {
  return "rounded-[24px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,249,252,0.98)_100%)] px-4 py-4 shadow-[0_16px_36px_rgba(15,23,42,0.06)]";
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
      return "border-sky-200/90 bg-[linear-gradient(180deg,rgba(240,249,255,0.96)_0%,rgba(224,242,254,0.9)_100%)]";
    case "booked":
      return "border-emerald-200/90 bg-[linear-gradient(180deg,rgba(240,253,244,0.96)_0%,rgba(220,252,231,0.9)_100%)]";
    case "resolved":
      return "border-slate-200/90 bg-[linear-gradient(180deg,rgba(248,250,252,0.95)_0%,rgba(241,245,249,0.92)_100%)] opacity-90";
    default:
      return "border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)]";
  }
}

export function frontDeskWorkspaceCardClass(kind: "default" | "hero" | "subtle" = "default") {
  if (kind === "hero") {
    return "rounded-[30px] border border-slate-200/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(239,246,255,0.96)_46%,rgba(219,234,254,0.90)_100%)] shadow-[0_24px_52px_rgba(15,23,42,0.12)]";
  }
  if (kind === "subtle") {
    return "rounded-[26px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(244,247,251,0.96)_100%)] shadow-[0_16px_34px_rgba(15,23,42,0.08)]";
  }
  return "rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,249,252,0.98)_100%)] shadow-[0_20px_44px_rgba(15,23,42,0.10)]";
}

export function frontDeskMetricCardClass() {
  return "rounded-[24px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(243,248,252,0.98)_100%)] shadow-[0_16px_32px_rgba(15,23,42,0.08)]";
}

export function frontDeskActionStripClass() {
  return "inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.06)]";
}
