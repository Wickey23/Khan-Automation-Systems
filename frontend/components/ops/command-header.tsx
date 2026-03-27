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
    <header className={cn("flex flex-col gap-3 md:flex-row md:items-end md:justify-between animate-fade-slide-up mb-4", className)}>
      <div className="min-w-0 space-y-1">
        <p className="ml-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 md:w-auto">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
