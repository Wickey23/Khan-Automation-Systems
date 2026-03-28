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
    <section className={cn("group overflow-hidden rounded-lg border border-slate-200 bg-white transition-all duration-200", className)}>
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        className="flex w-full items-center justify-between gap-4 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      >
        <span className="text-[11px] font-semibold tracking-[0.08em] text-slate-600">{title}</span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
          {label}
          <div className={cn("flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 bg-white transition-transform duration-200", collapsed ? "" : "rotate-180")}>
            <ChevronDown className="h-4 w-4" />
          </div>
        </span>
      </button>
      {!collapsed ? <div className="animate-fade-slide-up border-t border-slate-200 p-3.5 duration-200">{children}</div> : null}
    </section>
  );
}
