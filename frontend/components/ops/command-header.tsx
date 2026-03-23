import { cn } from "@/lib/utils";

export function CommandHeader({
  eyebrow = "Operational Command",
  title,
  description,
  actions,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("rounded-xl border border-slate-200 bg-white px-4 py-3 md:px-5 md:py-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{eyebrow}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {description ? <p className="mt-1.5 text-sm text-slate-600">{description}</p> : null}
    </header>
  );
}
