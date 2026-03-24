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
    <header className={cn("flex flex-wrap items-start justify-between gap-6 rounded-[2rem] border p-8 glass-card inner-glow animate-fade-slide-up", className)}>
      <div className="min-w-0 space-y-1">
        <p className="text-[10px] font-black font-label uppercase tracking-[0.2em] text-primary/60 ml-0.5">{eyebrow}</p>
        <h1 className="text-3xl font-black font-headline tracking-tighter text-on-surface bg-gradient-to-br from-on-surface to-primary/40 bg-clip-text text-transparent">{title}</h1>
        {description ? <p className="text-sm font-medium text-on-surface-variant/70 leading-relaxed max-w-2xl">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
