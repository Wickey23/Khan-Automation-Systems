"use client";

import type { ComponentType } from "react";
import { AlertTriangle, Loader2, Lock, ShieldCheck, RefreshCw, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type StateVariant = "loading" | "empty" | "error" | "locked" | "setup" | "retry";

const STATE_META: Record<
  StateVariant,
  { icon: ComponentType<{ className?: string }>; title: string; description: string; tone: string }
> = {
  loading: {
    icon: Loader2,
    title: "Loading data",
    description: "Please wait while we refresh the content.",
    tone: "text-slate-600"
  },
  empty: {
    icon: Info,
    title: "Nothing to show yet",
    description: "No records match the current filters.",
    tone: "text-slate-500"
  },
  error: {
    icon: AlertTriangle,
    title: "Unable to load data",
    description: "Something went wrong. Retry the action or refresh the page.",
    tone: "text-rose-600"
  },
  locked: {
    icon: Lock,
    title: "Feature locked",
    description: "This capability is gated. Contact your admin when ready to unlock.",
    tone: "text-slate-600"
  },
  setup: {
    icon: ShieldCheck,
    title: "Setup required",
    description: "Complete the prerequisite steps before enabling this workflow.",
    tone: "text-amber-600"
  },
  retry: {
    icon: RefreshCw,
    title: "Retry required",
    description: "An error happened. Retry the operation or check the logs.",
    tone: "text-amber-600"
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
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 text-sm text-slate-700 shadow-sm">
      <div className="flex items-center gap-3">
        <IconComponent className={cn("h-5 w-5", meta.tone)} />
        <div>
          <p className={cn("font-semibold tracking-[0.18em] uppercase text-xs", meta.tone)}>{title || meta.title}</p>
          <p className="text-xs text-slate-500">{description || meta.description}</p>
        </div>
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
