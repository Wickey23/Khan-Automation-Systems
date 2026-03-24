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
        "rounded-2xl border p-4 transition-all duration-300 hover-lift inner-glow",
        emphasis === "risk"
          ? "border-error/20 bg-error/5"
          : "glass-card",
        className
      )}
    >
      <p className={cn("text-[10px] font-black font-label uppercase tracking-[0.2em] mb-3", emphasis === "risk" ? "text-error" : "text-primary/60")}>{label}</p>
      <div className="flex items-end justify-between">
        <p className={cn("text-3xl font-black font-headline tracking-tighter tabular-nums", emphasis === "risk" ? "text-error" : "text-on-surface")}>{value}</p>
        <span className="material-symbols-outlined text-[18px] opacity-20">analytics</span>
      </div>
      {detail ? <p className={cn("mt-2 text-[10px] font-bold", emphasis === "risk" ? "text-error" : "text-on-surface-variant/70")}>{detail}</p> : null}
    </article>
  );
}
