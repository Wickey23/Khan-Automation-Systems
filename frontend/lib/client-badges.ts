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
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  automated: "border-sky-200 bg-sky-50 text-sky-700",
  manual: "border-blue-200 bg-blue-50 text-blue-700",
  booking: "border-blue-200 bg-blue-50 text-blue-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
  pending: "border-sky-200 bg-sky-50 text-sky-700"
};

export function clientBadgeClass(tone: BadgeTone, className?: string) {
  return cn(badgeToneClasses[tone], className);
}
