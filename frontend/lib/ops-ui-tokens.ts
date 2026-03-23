export const opsTone = {
  pageBg: "bg-slate-100",
  surface: "border border-slate-200 bg-white",
  subtleSurface: "border border-slate-200 bg-slate-50",
  textPrimary: "text-slate-900",
  textSecondary: "text-slate-600",
  textTertiary: "text-slate-500",
  actionPrimary: "border border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
  actionSecondary: "border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
} as const;

export type OpsPriority = "critical" | "high" | "medium" | "low";
export type OpsWorkState = "blocked" | "pending" | "in_progress" | "done";

export function priorityClasses(priority: OpsPriority) {
  if (priority === "critical") return "border-rose-300 bg-rose-50 text-rose-800";
  if (priority === "high") return "border-amber-300 bg-amber-50 text-amber-800";
  if (priority === "medium") return "border-sky-300 bg-sky-50 text-sky-800";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

export function workStateLabel(state: OpsWorkState) {
  if (state === "blocked") return "Blocked";
  if (state === "pending") return "Needs action";
  if (state === "in_progress") return "At risk";
  return "Resolved";
}
