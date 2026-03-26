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
        "group relative overflow-hidden rounded-[2rem] border p-6 transition-all duration-500 hover-lift inner-glow",
        emphasis === "risk"
          ? "border-error/20 bg-error/5 ring-1 ring-error/10"
          : "glass-card border-white/40",
        className
      )}
    >
      {/* Background Decorative Element */}
      <div className={cn(
        "absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 transition-transform duration-700 group-hover:scale-150",
        emphasis === "risk" ? "bg-error/10" : "bg-primary/5"
      )} />
      
      <div className="relative z-10">
        <p className={cn(
          "text-[10px] font-black font-label uppercase tracking-[0.2em] mb-4",
          emphasis === "risk" ? "text-error" : "text-primary/60"
        )}>
          {label}
        </p>
        
        <div className="flex items-center justify-between">
          <p className={cn(
            "text-4xl font-black font-headline tracking-tighter tabular-nums leading-none",
            emphasis === "risk" ? "text-error" : "text-on-surface"
          )}>
            {value}
          </p>
          
          {emphasis === "risk" ? (
            <span className="w-8 h-8 rounded-full bg-error text-on-error flex items-center justify-center animate-pulse shadow-lg shadow-error/20">
              <span className="material-symbols-outlined text-[18px]">priority_high</span>
            </span>
          ) : (
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant/20 group-hover:text-primary/40 transition-colors">
              analytics
            </span>
          )}
        </div>
        
        {detail ? (
          <p className={cn(
            "mt-4 text-[11px] font-bold leading-relaxed",
            emphasis === "risk" ? "text-error/80" : "text-on-surface-variant/60"
          )}>
            {detail}
          </p>
        ) : null}
      </div>
    </article>
  );
}
