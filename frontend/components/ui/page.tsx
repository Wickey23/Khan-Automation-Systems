import * as React from "react";
import { HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  className,
  eyebrow,
  title,
  description,
  actions
}: {
  className?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className={cn("page-header", className)}>
      <div className="page-header-copy">
        {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
        <div className="space-y-2">
          <h1 className="max-w-3xl text-[30px] font-black leading-[1.02] tracking-[-0.04em] text-slate-950 sm:text-[40px]">
            {title}
          </h1>
          {description ? <p className="max-w-2xl text-[14px] leading-6 text-slate-500">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="page-header-actions self-start md:self-end">{actions}</div> : null}
    </div>
  );
}

export function SectionHeading({
  className,
  eyebrow,
  title,
  description,
  actions
}: {
  className?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="space-y-2">
        {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
        <div className="space-y-1.5">
          <h2 className="text-[24px] font-black tracking-[-0.03em] text-slate-950 sm:text-[30px]">{title}</h2>
          {description ? <p className="max-w-2xl text-[14px] leading-6 text-slate-500">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  );
}

export function WorkflowHint({
  className,
  title = "What to do here",
  items
}: {
  className?: string;
  title?: string;
  items: Array<{ label: string; text: string }>;
}) {
  return (
    <div className={cn("rounded-[12px] border border-slate-200 bg-white/75 px-5 py-4 text-sm text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]", className)}>
      <p className="page-eyebrow">{title}</p>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="space-y-1.5 border-l border-slate-200 pl-4 first:border-l-0 first:pl-0 lg:first:border-l lg:first:pl-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
            <p className="leading-6 text-slate-700">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageHelpFab({
  className,
  title = "How to use this page",
  items
}: {
  className?: string;
  title?: string;
  items: Array<{ label: string; text: string }>;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-slate-900 bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-[0_14px_28px_rgba(15,23,42,0.22)] transition-colors hover:bg-slate-800",
          className
        )}
      >
        <HelpCircle className="h-4 w-4" />
        <span>How to use this page</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-950/28 backdrop-blur-[1px]">
          <div className="absolute bottom-5 right-5 w-[min(420px,calc(100vw-2rem))] rounded-[16px] border border-slate-300 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="page-eyebrow">Page help</p>
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">{title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-950"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <div key={item.label} className="rounded-[12px] border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-700">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function PageShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("page-shell", className)}>{children}</div>;
}

export function SectionShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("section-shell", className)}>{children}</section>;
}
