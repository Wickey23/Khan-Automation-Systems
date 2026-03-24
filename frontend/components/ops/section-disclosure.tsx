"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionDisclosure({
  title,
  storageKey,
  defaultCollapsed = true,
  className,
  children
}: {
  title: string;
  storageKey: string;
  defaultCollapsed?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw === "open") setCollapsed(false);
      if (raw === "closed") setCollapsed(true);
    } catch {
      // ignore storage errors
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, collapsed ? "closed" : "open");
    } catch {
      // ignore storage errors
    }
  }, [collapsed, storageKey]);

  const label = useMemo(() => (collapsed ? "Show details" : "Hide details"), [collapsed]);

  return (
    <section className={cn("rounded-2xl border glass-card inner-glow group overflow-hidden transition-all duration-300", className)}>
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        className="flex w-full items-center justify-between gap-6 px-6 py-4 text-left transition-all hover:bg-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <span className="text-[10px] font-black font-label uppercase tracking-[0.2em] text-on-surface-variant/60">{title}</span>
        <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-primary">
          {label}
          <div className={cn("flex items-center justify-center w-6 h-6 rounded-lg bg-primary/5 transition-transform duration-300", collapsed ? "" : "rotate-180")}>
            <ChevronDown className="h-4 w-4" />
          </div>
        </span>
      </button>
      {!collapsed ? <div className="border-t border-outline-variant/5 p-6 animate-fade-slide-up duration-200">{children}</div> : null}
    </section>
  );
}
