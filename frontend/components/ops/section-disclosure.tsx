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
    <section className={cn("rounded-2xl border border-slate-200 bg-white", className)}>
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">{title}</span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
          {label}
          <ChevronDown className={cn("h-4 w-4 transition-transform", collapsed ? "" : "rotate-180")} />
        </span>
      </button>
      {!collapsed ? <div className="border-t border-slate-200 p-4">{children}</div> : null}
    </section>
  );
}
