import * as React from "react";
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
          <h1 className="max-w-3xl text-[32px] font-semibold leading-[1.04] tracking-[-0.035em] text-slate-950 sm:text-[38px]">
            {title}
          </h1>
          {description ? <p className="max-w-2xl text-[15px] leading-6 text-slate-600">{description}</p> : null}
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
          <h2 className="text-[26px] tracking-[-0.03em] text-slate-950 sm:text-[32px]">{title}</h2>
          {description ? <p className="max-w-2xl text-[15px] leading-6 text-slate-600">{description}</p> : null}
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
    <div className={cn("rounded-[16px] border border-slate-300 bg-slate-50 px-5 py-4 text-sm text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.04)]", className)}>
      <p className="page-eyebrow">{title}</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
            <p className="leading-6 text-slate-700">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
