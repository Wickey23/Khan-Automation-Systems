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
        "relative overflow-hidden rounded-2xl border p-4 transition-colors duration-200 hover-lift inner-glow",
        emphasis === "risk"
          ? "border-error/25 bg-error/5"
          : "glass-card",
        className
      )}
    >
      <div className="relative z-10">
        <p className={cn(
          "mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]",
          emphasis === "risk" ? "text-error" : "text-slate-600"
        )}>
          {label}
        </p>
        
        <div className="flex items-center justify-between">
          <p className={cn(
            "text-3xl font-semibold tracking-tight tabular-nums leading-none",
            emphasis === "risk" ? "text-error" : "text-slate-900"
          )}>
            {value}
          </p>
          
          <span className={cn("material-symbols-outlined text-[18px]", emphasis === "risk" ? "text-error/70" : "text-slate-400")}>
            {emphasis === "risk" ? "priority_high" : "analytics"}
          </span>
        </div>
        
        {detail ? (
          <p className={cn(
            "mt-2 text-[11px] leading-relaxed",
            emphasis === "risk" ? "text-error/80" : "text-slate-600"
          )}>
            {detail}
          </p>
        ) : null}
      </div>
    </article>
  );
}
