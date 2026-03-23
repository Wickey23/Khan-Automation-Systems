"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type OperationalSignalKey =
  | "urgent"
  | "needs_attention"
  | "outbound_blocked"
  | "stale"
  | "needs_action"
  | "follow_up"
  | "booking"
  | "inbox_linked"
  | "lead_linked"
  | "thread_linked"
  | "classification";

export type OperationalSignal = {
  key: OperationalSignalKey;
  label?: string;
};

export type OperationalQuickActionKey = "open" | "approvals" | "follow_up" | "thread" | "lead";

export type OperationalQuickAction = {
  key: OperationalQuickActionKey;
  label?: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export type OperationalSummaryItem = {
  key: string;
  label: string;
  value: string;
  tone?: "default" | "warning" | "critical" | "success";
};

const signalPriority: Record<OperationalSignalKey, number> = {
  // Keep this ordered by operator urgency so rows stay consistently scannable.
  urgent: 1,
  needs_attention: 2,
  outbound_blocked: 3,
  stale: 4,
  needs_action: 5,
  follow_up: 6,
  booking: 7,
  inbox_linked: 8,
  lead_linked: 9,
  thread_linked: 10,
  classification: 11
};

const signalDefaults: Record<OperationalSignalKey, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "border-red-200 bg-red-50 text-red-700" },
  needs_attention: { label: "Needs attention", className: "border-red-200 bg-red-50 text-red-700" },
  outbound_blocked: { label: "Outbound blocked", className: "border-red-200 bg-red-50 text-red-700" },
  stale: { label: "Stale", className: "border-rose-200 bg-rose-50 text-rose-700" },
  needs_action: { label: "Needs action", className: "border-amber-200 bg-amber-50 text-amber-700" },
  follow_up: { label: "Follow-up", className: "border-amber-200 bg-amber-50 text-amber-700" },
  booking: { label: "Booking", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  inbox_linked: { label: "Inbox linked", className: "border-blue-200 bg-blue-50 text-blue-700" },
  lead_linked: { label: "Lead linked", className: "border-blue-200 bg-blue-50 text-blue-700" },
  thread_linked: { label: "Thread linked", className: "border-blue-200 bg-blue-50 text-blue-700" },
  classification: { label: "Classified", className: "border-slate-200 bg-slate-100 text-slate-700" }
};

const actionPriority: Record<OperationalQuickActionKey, number> = {
  open: 1,
  approvals: 2,
  follow_up: 3,
  thread: 4,
  lead: 5
};

const actionDefaults: Record<OperationalQuickActionKey, string> = {
  open: "Open",
  approvals: "Approvals",
  follow_up: "Follow-up",
  thread: "Thread",
  lead: "Lead"
};

export function normalizeOperationalSignals(signals: OperationalSignal[], limit = 3) {
  const deduped = Array.from(new Map(signals.map((signal) => [signal.key, signal])).values());
  return deduped.sort((a, b) => signalPriority[a.key] - signalPriority[b.key]).slice(0, limit);
}

export function normalizeOperationalQuickActions(actions: OperationalQuickAction[], limit = 4) {
  return [...actions].sort((a, b) => actionPriority[a.key] - actionPriority[b.key]).slice(0, limit);
}

export function OperationalSignalChips({ signals }: { signals: OperationalSignal[] }) {
  if (!signals.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {signals.map((signal) => {
        const defaults = signalDefaults[signal.key];
        return (
          <span
            key={`${signal.key}-${signal.label || defaults.label}`}
            className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold", defaults.className)}
          >
            {signal.label || defaults.label}
          </span>
        );
      })}
    </div>
  );
}

export function OperationalQuickActions({ actions }: { actions: OperationalQuickAction[] }) {
  if (!actions.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
      {actions.map((action) => {
        const label = action.label || actionDefaults[action.key];
        if (action.href) {
          return (
            <Link
              key={`${action.key}-${label}`}
              href={action.href}
              className={cn(
                "inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50",
                action.disabled && "pointer-events-none opacity-50"
              )}
            >
              {label}
            </Link>
          );
        }
        return (
          <button
            key={`${action.key}-${label}`}
            type="button"
            disabled={action.disabled}
            onClick={action.onClick}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function summaryToneClass(tone: OperationalSummaryItem["tone"]) {
  if (tone === "critical") return "text-red-700";
  if (tone === "warning") return "text-amber-700";
  if (tone === "success") return "text-emerald-700";
  return "text-slate-500";
}

export function OperationalRowSummary({ items }: { items: OperationalSummaryItem[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
      {items.map((item, index) => (
        <span key={item.key} className={cn("inline-flex items-center gap-1", summaryToneClass(item.tone))}>
          <span className="font-semibold uppercase tracking-wide text-slate-400">{item.label}</span>
          <span className="font-semibold">{item.value}</span>
          {index < items.length - 1 ? <span className="text-slate-300">|</span> : null}
        </span>
      ))}
    </div>
  );
}
