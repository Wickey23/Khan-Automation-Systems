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
          <h1 className="max-w-3xl text-[34px] font-semibold leading-[1.02] tracking-[-0.04em] text-slate-950 sm:text-[42px]">
            {title}
          </h1>
          {description ? <p className="max-w-2xl text-[15px] leading-7 text-slate-600">{description}</p> : null}
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
          <h2 className="text-[28px] tracking-[-0.03em] text-slate-950 sm:text-[34px]">{title}</h2>
          {description ? <p className="max-w-2xl text-[15px] leading-7 text-slate-600">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  );
}
