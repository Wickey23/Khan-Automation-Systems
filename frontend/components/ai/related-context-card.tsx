"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type RelatedContextStat = {
  label: string;
  value: string;
  tone?: "default" | "warning" | "critical" | "success";
};

type RelatedContextLink = {
  label: string;
  href: string;
};

type RelatedContextFlag = {
  label: string;
  tone?: "default" | "warning" | "critical" | "success";
};

function toneClass(tone?: RelatedContextStat["tone"]) {
  if (tone === "critical") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-white text-slate-700";
}

export function RelatedContextCard({
  title = "Related Context",
  description,
  stats,
  links,
  flags = []
}: {
  title?: string;
  description?: string;
  stats: RelatedContextStat[];
  links: RelatedContextLink[];
  flags?: RelatedContextFlag[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{title}</h4>
        {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      </div>

      {flags.length ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {flags.map((flag) => (
            <span key={flag.label} className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", toneClass(flag.tone))}>
              {flag.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {stats.map((stat) => (
          <div key={stat.label} className={cn("rounded-lg border px-3 py-2", toneClass(stat.tone))}>
            <p className="text-[10px] font-bold uppercase tracking-wide opacity-75">{stat.label}</p>
            <p className="mt-0.5 text-xs font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      {links.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {links.map((link) => (
            <Link
              key={link.href + link.label}
              href={link.href}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
