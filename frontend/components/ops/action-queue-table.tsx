import Link from "next/link";
import { cn } from "@/lib/utils";
import { RowActionMenu } from "@/components/ops/row-action-menu";

export type ActionQueueRow = {
  id: string;
  item: string;
  owner: string;
  due: string;
  severity: "critical" | "high" | "medium" | "low";
  href?: string;
  primaryActionLabel?: string;
  secondaryActions?: Array<{ label: string; href?: string; onClick?: () => void }>;
  detail?: string;
};

function severityTone(severity: ActionQueueRow["severity"]) {
  if (severity === "critical") return "border-rose-300 bg-rose-50 text-rose-800";
  if (severity === "high") return "border-amber-300 bg-amber-50 text-amber-800";
  if (severity === "medium") return "border-sky-300 bg-sky-50 text-sky-800";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

export function ActionQueueTable({
  title,
  rows,
  viewAllHref,
  className
}: {
  title: string;
  rows: ActionQueueRow[];
  viewAllHref?: string;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white", className)}>
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
        {viewAllHref ? (
          <Link href={viewAllHref} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            View all tasks
          </Link>
        ) : null}
      </div>
      <div className="divide-y divide-slate-200">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-900">{row.item}</p>
              <p className="mt-1 truncate text-sm text-slate-500">{row.detail || `Owner: ${row.owner}`}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", severityTone(row.severity))}>{row.severity}</span>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Due</p>
                <p className="text-sm font-semibold text-slate-900">{row.due}</p>
              </div>
              {row.href && row.primaryActionLabel ? (
                <Link href={row.href} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                  {row.primaryActionLabel}
                </Link>
              ) : null}
              {row.secondaryActions?.length ? <RowActionMenu actions={row.secondaryActions} /> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
