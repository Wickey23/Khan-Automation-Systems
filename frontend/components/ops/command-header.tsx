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
    <header className={cn("flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-slide-up mb-8", className)}>
      <div className="space-y-1 min-w-0">
        <p className="text-[11px] font-black font-label uppercase tracking-[0.2em] text-primary/70 mb-1 ml-0.5">
          {eyebrow}
        </p>
        <h1 className="text-5xl font-black font-headline text-on-surface tracking-tighter leading-[0.9] bg-gradient-to-br from-on-surface via-on-surface to-primary/50 bg-clip-text text-transparent">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 text-sm font-medium text-on-surface-variant/70 leading-relaxed max-w-2xl">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center space-x-3 w-full md:w-auto shrink-0">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
