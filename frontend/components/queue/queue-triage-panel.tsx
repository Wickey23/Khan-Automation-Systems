"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type QueueTriagePanelProps = {
  title: string;
  subtitle?: string;
  badges?: Array<{ label: string; tone?: "default" | "info" | "warning" | "critical" | "success" }>;
  sections?: Array<{ title: string; content: ReactNode }>;
  actions?: ReactNode;
  className?: string;
  onClose?: () => void;
};

type BadgeTone = "default" | "info" | "warning" | "critical" | "success" | undefined;

function badgeTone(tone: BadgeTone) {
  if (tone === "critical") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "info") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function QueueTriagePanel({ title, subtitle, badges = [], sections = [], actions, className, onClose }: QueueTriagePanelProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  return (
    <aside className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold leading-5 text-slate-900">{title}</p>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 p-1 text-slate-500 transition-colors hover:bg-slate-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {badges.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              key={badge.label}
              className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", badgeTone(badge.tone))}
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}

      {(sections.length || actions) && (
        <div className="mt-3 xl:hidden">
          <button
            type="button"
            onClick={() => setMobileExpanded((current) => !current)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            {mobileExpanded ? "Hide triage details" : "Show triage details"}
          </button>
        </div>
      )}

      <div className={cn("xl:block", !mobileExpanded && "hidden")}>
        {sections.length ? (
          <div className="mt-4 space-y-2.5">
            {sections.map((section) => (
              <div key={section.title} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{section.title}</p>
                <div className="mt-1.5 text-xs text-slate-700">{section.content}</div>
              </div>
            ))}
          </div>
        ) : null}

        {actions ? <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </aside>
  );
}
