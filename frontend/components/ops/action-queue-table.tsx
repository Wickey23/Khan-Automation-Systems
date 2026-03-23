import Link from "next/link";
import { cn } from "@/lib/utils";
import { RowActionMenu } from "@/components/ops/row-action-menu";

export type ActionQueueRow = {
  id: string;
  item: string;
  owner: string;
  due: string;
  ageLabel?: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "blocked" | "pending" | "in_progress" | "done";
  href?: string;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  primaryActionDisabled?: boolean;
  secondaryActions?: Array<{ label: string; href?: string; onClick?: () => void }>;
  detail?: string;
  rowAriaLabel?: string;
  onRowFocus?: () => void;
  onRowSelect?: () => void;
};

function statusTone(status: ActionQueueRow["status"]) {
  if (status === "blocked") return "border-rose-300 bg-rose-50 text-rose-800";
  if (status === "pending") return "border-amber-300 bg-amber-50 text-amber-800";
  if (status === "in_progress") return "border-sky-300 bg-sky-50 text-sky-800";
  return "border-emerald-300 bg-emerald-50 text-emerald-800";
}

function statusLabel(status: ActionQueueRow["status"]) {
  if (status === "blocked") return "Blocked";
  if (status === "pending") return "Needs action";
  if (status === "in_progress") return "At risk";
  return "Resolved";
}

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
          <div
            key={row.id}
            tabIndex={0}
            aria-label={row.rowAriaLabel || row.item}
            onFocus={row.onRowFocus}
            onClick={row.onRowSelect}
            onKeyDown={(event) => {
              if (!row.onRowSelect) return;
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              row.onRowSelect();
            }}
            className={cn(
              "flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-inset",
              row.onRowSelect ? "cursor-pointer" : ""
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-slate-900">{row.item}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-600">Owner: {row.owner}</span>
                {row.ageLabel ? (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="text-xs text-slate-500">Age: {row.ageLabel}</span>
                  </>
                ) : null}
                <span className="text-slate-300">|</span>
                <span className="text-xs text-slate-500">Due: {row.due}</span>
              </div>
              <p className="mt-1 truncate text-xs text-slate-500">{row.detail || "No additional detail."}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", severityTone(row.severity))}>{row.severity}</span>
              <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", statusTone(row.status))}>
                {statusLabel(row.status)}
              </span>
              {row.href && row.primaryActionLabel ? (
                <Link
                  href={row.href}
                  aria-label={`${row.primaryActionLabel} for ${row.item}`}
                  onClick={(event) => event.stopPropagation()}
                  className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                >
                  {row.primaryActionLabel}
                </Link>
              ) : row.onPrimaryAction && row.primaryActionLabel ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    row.onPrimaryAction?.();
                  }}
                  aria-label={`${row.primaryActionLabel} for ${row.item}`}
                  disabled={row.primaryActionDisabled}
                  className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {row.primaryActionLabel}
                </button>
              ) : null}
              {row.secondaryActions?.length ? (
                <div onClick={(event) => event.stopPropagation()}>
                  <RowActionMenu actions={row.secondaryActions} triggerLabel={`More actions for ${row.item}`} />
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
