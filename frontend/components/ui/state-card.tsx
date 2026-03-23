"use client";

import type { ComponentType } from "react";
import { AlertTriangle, Loader2, Lock, ShieldCheck, RefreshCw, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type StateVariant = "loading" | "empty" | "error" | "locked" | "setup" | "retry";

const STATE_META: Record<
  StateVariant,
  { icon: ComponentType<{ className?: string }>; title: string; description: string; tone: string; surface: string }
> = {
  loading: {
    icon: Loader2,
    title: "Loading data",
    description: "Please wait while we refresh the content.",
    tone: "text-sky-700",
    surface: "border-sky-200/80 bg-[linear-gradient(145deg,rgba(239,246,255,0.9)_0%,rgba(255,255,255,0.96)_100%)]"
  },
  empty: {
    icon: Info,
    title: "Nothing to show yet",
    description: "No records match the current filters.",
    tone: "text-slate-600",
    surface: "border-slate-200/80 bg-[linear-gradient(145deg,rgba(248,250,252,0.9)_0%,rgba(255,255,255,0.96)_100%)]"
  },
  error: {
    icon: AlertTriangle,
    title: "Unable to load data",
    description: "Something went wrong. Retry the action or refresh the page.",
    tone: "text-rose-700",
    surface: "border-rose-200/80 bg-[linear-gradient(145deg,rgba(255,241,242,0.9)_0%,rgba(255,255,255,0.96)_100%)]"
  },
  locked: {
    icon: Lock,
    title: "Feature locked",
    description: "This capability is gated. Contact your admin when ready to unlock.",
    tone: "text-slate-700",
    surface: "border-slate-200/80 bg-[linear-gradient(145deg,rgba(248,250,252,0.9)_0%,rgba(255,255,255,0.96)_100%)]"
  },
  setup: {
    icon: ShieldCheck,
    title: "Setup required",
    description: "Complete the prerequisite steps before enabling this workflow.",
    tone: "text-amber-700",
    surface: "border-amber-200/80 bg-[linear-gradient(145deg,rgba(255,251,235,0.9)_0%,rgba(255,255,255,0.96)_100%)]"
  },
  retry: {
    icon: RefreshCw,
    title: "Retry required",
    description: "An error happened. Retry the operation or check the logs.",
    tone: "text-amber-700",
    surface: "border-amber-200/80 bg-[linear-gradient(145deg,rgba(255,251,235,0.9)_0%,rgba(255,255,255,0.96)_100%)]"
  }
};

export function StateCard({
  variant,
  title,
  description,
  action
}: {
  variant: StateVariant;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const meta = STATE_META[variant];
  const IconComponent = meta.icon;
  return (
    <div className={cn("rounded-2xl border p-6 text-sm text-slate-700 shadow-[0_18px_34px_-26px_rgba(15,23,42,0.38)]", meta.surface)}>
      <div className="flex items-center gap-3">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/75 bg-white/75 shadow-[0_10px_18px_-14px_rgba(15,23,42,0.4)]">
          <IconComponent className={cn("h-4 w-4", meta.tone)} />
        </div>
        <div>
          <p className={cn("font-semibold tracking-[0.18em] uppercase text-xs", meta.tone)}>{title || meta.title}</p>
          <p className="text-xs text-slate-500">{description || meta.description}</p>
        </div>
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
