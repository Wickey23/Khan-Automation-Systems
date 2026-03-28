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
        "relative overflow-hidden rounded-lg border bg-white p-3.5 transition-colors duration-150",
        emphasis === "risk"
          ? "border-rose-200 bg-rose-50/40"
          : "border-slate-200",
        className
      )}
    >
      <div className="relative z-10">
        <p className={cn(
          "mb-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
          emphasis === "risk" ? "text-rose-700" : "text-slate-500"
        )}>
          {label}
        </p>
        
        <div className="flex items-center justify-between">
          <p className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums leading-none",
            emphasis === "risk" ? "text-rose-700" : "text-slate-900"
          )}>
            {value}
          </p>
          
          <span className={cn("material-symbols-outlined text-[17px]", emphasis === "risk" ? "text-rose-500" : "text-slate-400")}>
            {emphasis === "risk" ? "priority_high" : "analytics"}
          </span>
        </div>
        
        {detail ? (
          <p className={cn(
            "mt-1.5 text-[11px] leading-relaxed",
            emphasis === "risk" ? "text-rose-700/80" : "text-slate-600"
          )}>
            {detail}
          </p>
        ) : null}
      </div>
    </article>
  );
}
