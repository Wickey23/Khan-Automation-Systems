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
  if (tone === "critical") return "border-rose-300/80 bg-rose-50/90 text-rose-800";
  if (tone === "warning") return "border-amber-300/80 bg-amber-50/90 text-amber-800";
  if (tone === "success") return "border-emerald-300/80 bg-emerald-50/90 text-emerald-800";
  if (tone === "info") return "border-blue-300/80 bg-blue-50/90 text-blue-800";
  return "border-slate-300/80 bg-slate-100/90 text-slate-700";
}

export function QueueTriagePanel({ title, subtitle, badges = [], sections = [], actions, className, onClose }: QueueTriagePanelProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  return (
    <aside className={cn("rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white via-white to-slate-50/70 p-4 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.55)] xl:sticky xl:top-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold leading-5 text-slate-900">{title}</p>
          {subtitle ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtitle}</p> : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white/90 p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
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
              className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]", badgeTone(badge.tone))}
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
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            {mobileExpanded ? "Hide triage details" : "Show triage details"}
          </button>
        </div>
      )}

      <div className={cn("xl:block", !mobileExpanded && "hidden")}>
        {sections.length ? (
          <div className="mt-4 space-y-3">
            {sections.map((section) => (
              <div key={section.title} className="rounded-lg border border-slate-200/90 bg-white/80 p-3.5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{section.title}</p>
                <div className="mt-2 text-xs leading-relaxed text-slate-700">{section.content}</div>
              </div>
            ))}
          </div>
        ) : null}

        {actions ? <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </aside>
  );
}
