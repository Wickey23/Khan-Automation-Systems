import { cn } from "@/lib/utils";

type BadgeTone =
  | "success"
  | "warning"
  | "critical"
  | "neutral"
  | "automated"
  | "manual"
  | "booking"
  | "failed"
  | "pending";

const badgeToneClasses: Record<BadgeTone, string> = {
  success: "border-emerald-300 bg-emerald-50 text-emerald-800",
  warning: "border-amber-300 bg-amber-50 text-amber-800",
  critical: "border-rose-300 bg-rose-50 text-rose-800",
  neutral: "border-slate-300 bg-slate-50 text-slate-700",
  automated: "border-sky-300 bg-sky-50 text-sky-800",
  manual: "border-indigo-300 bg-indigo-50 text-indigo-800",
  booking: "border-violet-300 bg-violet-50 text-violet-800",
  failed: "border-rose-300 bg-rose-50 text-rose-800",
  pending: "border-amber-300 bg-amber-50 text-amber-800"
};

export function clientBadgeClass(tone: BadgeTone, className?: string) {
  return cn(badgeToneClasses[tone], className);
}

