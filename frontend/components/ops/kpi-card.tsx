import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  detail,
  emphasis = "default",
  className
}: {
  label: string;
  value: string;
  detail?: string;
  emphasis?: "default" | "risk";
  className?: string;
}) {
  return (
    <article
      className={cn(
        "rounded-lg border px-3 py-2.5",
        emphasis === "risk"
          ? "border-rose-200 bg-rose-50/60"
          : "border-slate-200 bg-white",
        className
      )}
    >
      <p className={cn("text-[10px] font-semibold uppercase tracking-[0.14em]", emphasis === "risk" ? "text-rose-700" : "text-slate-500")}>{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tracking-tight", emphasis === "risk" ? "text-rose-800" : "text-slate-900")}>{value}</p>
      {detail ? <p className={cn("text-xs", emphasis === "risk" ? "text-rose-700" : "text-slate-600")}>{detail}</p> : null}
    </article>
  );
}
