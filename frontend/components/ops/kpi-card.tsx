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
        "rounded-xl border p-4",
        emphasis === "risk"
          ? "border-l-4 border-l-rose-600 border-rose-200 bg-rose-50/50"
          : "border-slate-200 bg-white",
        className
      )}
    >
      <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", emphasis === "risk" ? "text-rose-700" : "text-slate-500")}>{label}</p>
      <p className={cn("mt-2 text-4xl font-semibold tracking-tight", emphasis === "risk" ? "text-rose-800" : "text-slate-900")}>{value}</p>
      {detail ? <p className={cn("mt-2 text-xs font-semibold", emphasis === "risk" ? "text-rose-700" : "text-slate-600")}>{detail}</p> : null}
    </article>
  );
}
