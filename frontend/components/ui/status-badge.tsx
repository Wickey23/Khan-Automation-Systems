import { ShieldCheck, CheckCircle2, AlertTriangle, Loader2, Lock, Info, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusVariant = "success" | "warning" | "danger" | "processing" | "neutral" | "locked" | "info" | "refresh";
export type StatusKind =
  | "call"
  | "job"
  | "transcript"
  | "booking"
  | "sms"
  | "feature"
  | "integration"
  | "lead"
  | "generic";

const VARIANT_META: Record<
  StatusVariant,
  { classes: string; icon: LucideIcon; labelSuffix?: string }
> = {
  success: { classes: "border-emerald-300 bg-emerald-50 text-emerald-800", icon: CheckCircle2 },
  warning: { classes: "border-amber-300 bg-amber-50 text-amber-800", icon: ShieldCheck },
  danger: { classes: "border-rose-300 bg-rose-50 text-rose-800", icon: AlertTriangle },
  processing: { classes: "border-slate-300 bg-slate-100 text-slate-700", icon: Loader2 },
  neutral: { classes: "border-slate-300 bg-slate-100 text-slate-700", icon: Info },
  locked: { classes: "border-slate-400 bg-slate-100 text-slate-600", icon: Lock },
  info: { classes: "border-sky-300 bg-sky-50 text-sky-800", icon: ShieldCheck },
  refresh: { classes: "border-indigo-300 bg-indigo-50 text-indigo-800", icon: RefreshCw }
};

const KIND_OVERRIDES: Record<StatusKind, Record<string, StatusVariant>> = {
  call: {
    appointment_request: "success",
    transferred: "info",
    message_taken: "success",
    missed: "danger",
    abandoned: "danger",
    spam: "danger",
    abandoned_call: "danger"
  },
  job: {
    completed: "success",
    success: "success",
    processed: "success",
    retired: "success",
    failed: "danger",
    error: "danger",
    retrying: "warning",
    queued: "processing",
    processing: "processing",
    pending: "processing",
    stuck: "warning"
  },
  transcript: {
    generated: "success",
    ready: "success",
    done: "success",
    pending: "processing",
    processing: "processing",
    error: "danger",
    failed: "danger"
  },
  booking: {
    queued: "processing",
    processing: "processing",
    started: "processing",
    completed: "success",
    success: "success",
    failed: "danger",
    error: "danger"
  },
  sms: {
    inbound: "info",
    received: "info",
    outbound: "success",
    sent: "success",
    delivered: "success",
    failed: "danger",
    opt_out: "danger",
    blocked: "warning",
    automation: "warning",
    review: "warning"
  },
  feature: {
    locked: "locked",
    gated: "locked",
    "setup required": "warning",
    limited: "warning",
    enabled: "success",
    available: "success",
    disabled: "neutral"
  },
  integration: {
    connected: "success",
    healthy: "success",
    degraded: "warning",
    down: "danger",
    pending: "processing",
    required: "warning",
    missing: "locked"
  },
  lead: {
    new: "neutral",
    contacted: "warning",
    qualified: "success",
    won: "success",
    lost: "danger"
  },
  generic: {}
};

function normalizeStatus(value?: string | null) {
  return (
    String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/_/g, " ")
      .toLowerCase()
  );
}

function resolveVariant(kind: StatusKind, state?: string | null) {
  const normalized = normalizeStatus(state);
  if (!normalized) return "neutral";
  const overrides = KIND_OVERRIDES[kind] || KIND_OVERRIDES.generic;
  if (overrides && overrides[normalized]) return overrides[normalized];
  if (normalized.includes("fail") || normalized.includes("error") || normalized.includes("miss")) return "danger";
  if (normalized.includes("pending") || normalized.includes("processing") || normalized.includes("queued")) return "processing";
  if (normalized.includes("retry") || normalized.includes("stuck") || normalized.includes("waiting")) return "warning";
  if (normalized.includes("lock") || normalized.includes("gate") || normalized.includes("closed")) return "locked";
  if (normalized.includes("done") || normalized.includes("ready") || normalized.includes("success") || normalized.includes("complete")) return "success";
  if (normalized.includes("warn") || normalized.includes("attention")) return "warning";
  return "neutral";
}

export function StatusBadge({
  state,
  label,
  kind = "generic",
  size = "sm"
}: {
  state?: string | null;
  label?: string | null;
  kind?: StatusKind;
  size?: "xs" | "sm";
}) {
  const variant = resolveVariant(kind, state);
  const meta = VARIANT_META[variant];
  const display = label || (state ? state.replace(/\b\w/g, (char) => char.toUpperCase()) : "Unknown");
  const IconComponent = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.02em]",
        meta.classes,
        size === "xs" ? "gap-1 px-2 py-0.5 text-[10px]" : ""
      )}
    >
      <IconComponent className={cn("h-3.5 w-3.5", variant === "processing" || variant === "refresh" ? "animate-spin" : "")} />
      {display}
    </span>
  );
}
