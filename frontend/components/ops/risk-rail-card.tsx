import Link from "next/link";
import { cn } from "@/lib/utils";

type RiskItem = {
  id: string;
  title: string;
  detail: string;
  level: "critical" | "warning";
  meter?: number;
};

export function RiskRailCard({
  title = "At Risk Items",
  items,
  ctaHref,
  ctaLabel = "View full audit log",
  className
}: {
  title?: string;
  items: RiskItem[];
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
}) {
  return (
    <aside className={cn("rounded-xl border border-slate-200 bg-white p-3", className)}>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">{title}</h3>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div key={item.id} className={cn("rounded-md border px-2.5 py-2", item.level === "critical" ? "border-rose-200 bg-rose-50/70" : "border-amber-200 bg-amber-50/70")}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <span className={cn("text-[11px] font-semibold uppercase", item.level === "critical" ? "text-rose-700" : "text-amber-700")}>{item.level}</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
            {typeof item.meter === "number" ? (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-rose-100">
                <div className="h-full rounded-full bg-rose-600" style={{ width: `${Math.min(100, Math.max(0, item.meter))}%` }} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {ctaHref ? (
        <Link href={ctaHref} className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100">
          {ctaLabel}
        </Link>
      ) : null}
    </aside>
  );
}
