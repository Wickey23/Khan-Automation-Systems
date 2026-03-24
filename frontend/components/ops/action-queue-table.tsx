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
  rowId?: string;
  isActive?: boolean;
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
    <section className={cn("overflow-hidden rounded-[2rem] border glass-card inner-glow animate-fade-slide-up [animation-delay:150ms] fill-mode-both", className)}>
      <div className="flex items-center justify-between border-b border-outline-variant/5 px-8 py-6">
        <h2 className="text-xl font-black font-headline tracking-tighter text-on-surface">{title}</h2>
        {viewAllHref ? (
          <Link href={viewAllHref} className="text-[10px] font-black text-primary uppercase tracking-[0.2em] hover:text-primary-dim transition-colors">
            View all tasks
          </Link>
        ) : null}
      </div>
      <div className="hidden grid-cols-[minmax(0,1fr)_110px_90px_100px_100px_150px] gap-2 border-b border-outline-variant/5 bg-on-surface/5 px-8 py-3 text-[10px] font-black font-label uppercase tracking-[0.2em] text-on-surface-variant/60 lg:grid">
        <span>Subject / item</span>
        <span>Owner</span>
        <span>Due / age</span>
        <span>Severity</span>
        <span>Status</span>
        <span className="text-right">Action</span>
      </div>
      <div className="divide-y divide-outline-variant/5">
        {rows.map((row) => (
          <div
            key={row.id}
            id={row.rowId}
            aria-label={row.rowAriaLabel || row.item}
            aria-current={row.isActive ? "true" : undefined}
            onFocusCapture={row.onRowFocus}
            onClick={row.onRowSelect}
            className={cn(
              "flex items-center justify-between gap-6 px-8 py-5 transition-all duration-300 hover:bg-white/50 focus-within:ring-2 focus-within:ring-primary/20",
              row.isActive ? "bg-white/60 shadow-inner" : "",
              row.onRowSelect ? "cursor-pointer" : ""
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-on-surface tracking-tight group-hover:text-primary transition-colors">{row.item}</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">Owner: {row.owner}</span>
                <span className="w-1 h-1 rounded-full bg-outline-variant/20"></span>
                <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">Due: {row.due}</span>
                {row.ageLabel ? (
                  <>
                    <span className="w-1 h-1 rounded-full bg-outline-variant/20"></span>
                    <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">Age: {row.ageLabel}</span>
                  </>
                ) : null}
              </div>
              <p className="mt-2 truncate text-xs font-medium text-on-surface-variant/70 leading-relaxed">{row.detail || "No additional detail."}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
              <span className={cn("rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] shadow-sm", severityTone(row.severity))}>{row.severity}</span>
              <span className={cn("rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] shadow-sm", statusTone(row.status))}>
                {statusLabel(row.status)}
              </span>
              {row.href && row.primaryActionLabel ? (
                <Link
                  href={row.href}
                  aria-label={`${row.primaryActionLabel} for ${row.item}`}
                  onClick={(event) => event.stopPropagation()}
                  className="rounded-xl bg-on-surface text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-all shadow-md active:scale-95"
                >
                  {row.primaryActionLabel}
                </Link>
              ) : row.onPrimaryAction && row.primaryActionLabel ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    row.onRowSelect?.();
                    row.onPrimaryAction?.();
                  }}
                  aria-label={`${row.primaryActionLabel} for ${row.item}`}
                  disabled={row.primaryActionDisabled}
                  className="rounded-xl bg-on-surface text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-all shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
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
