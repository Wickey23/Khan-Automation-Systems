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
          <h1>{title}</h1>
          {description ? <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
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
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl">{title}</h2>
          {description ? <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  );
}
