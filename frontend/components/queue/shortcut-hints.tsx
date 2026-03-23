"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type ShortcutHintItem = {
  keys: string;
  label: string;
};

function Keycap({ keys }: { keys: string }) {
  return (
    <span className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]">
      {keys}
    </span>
  );
}

export function QueueShortcutHint({
  summary,
  items,
  className
}: {
  summary: string;
  items: ShortcutHintItem[];
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const inlinePreview = useMemo(() => items.slice(0, 3), [items]);

  return (
    <div className={cn("rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-700">Keyboard shortcuts available.</span>
        <span>{summary}</span>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="ml-auto font-semibold text-slate-700 underline-offset-2 hover:underline"
        >
          {expanded ? "Hide" : "Show"}
        </button>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {inlinePreview.map((item) => (
          <span key={`${item.keys}-${item.label}`} className="inline-flex items-center gap-1">
            <Keycap keys={item.keys} />
            <span>{item.label}</span>
          </span>
        ))}
      </div>
      {expanded ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 pt-2">
          {items.map((item) => (
            <span key={`${item.keys}-${item.label}`} className="inline-flex items-center gap-1">
              <Keycap keys={item.keys} />
              <span>{item.label}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ContextualShortcutHints({
  title = "Available now",
  items,
  className
}: {
  title?: string;
  items: ShortcutHintItem[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div className={cn("mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500", className)}>
      <span className="font-semibold text-slate-600">{title}:</span>
      {items.map((item) => (
        <span key={`${item.keys}-${item.label}`} className="inline-flex items-center gap-1">
          <Keycap keys={item.keys} />
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}
