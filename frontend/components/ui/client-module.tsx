import * as React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { frontDeskMetricCardClass, frontDeskWorkspaceCardClass } from "@/lib/front-desk-ui";
import { clientBadgeClass } from "@/lib/client-badges";
import type { ClientStatusTone } from "@/lib/client-status-language";

export function ClientStatusGrid({
  items
}: {
  items: Array<{ label: string; value: React.ReactNode; detail?: React.ReactNode; tone?: ClientStatusTone }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className={frontDeskMetricCardClass()}>
          <div className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="page-eyebrow">{item.label}</p>
              {item.tone ? <Badge className={clientBadgeClass(item.tone)}>{String(item.value)}</Badge> : null}
            </div>
            {!item.tone ? <p className="text-3xl font-semibold tracking-tight text-slate-900">{item.value}</p> : null}
            {item.detail ? <p className="text-sm leading-6 text-slate-600">{item.detail}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ClientGateCard({
  title,
  description,
  badgeLabel,
  badgeTone = "pending",
  actions
}: {
  title: string;
  description: string;
  badgeLabel?: string;
  badgeTone?: ClientStatusTone;
  actions?: Array<{ href: string; label: string }>;
}) {
  return (
    <div className={`${frontDeskWorkspaceCardClass("subtle")} border-amber-200/90 bg-[linear-gradient(135deg,rgba(255,251,235,0.98)_0%,rgba(254,243,199,0.92)_100%)]`}>
      <div className="flex flex-col gap-4 px-5 py-5 text-sm text-amber-950 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex gap-3">
          <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-300/80 bg-white/80">
            <Lock className="h-4 w-4" />
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{title}</p>
              {badgeLabel ? <Badge className={clientBadgeClass(badgeTone)}>{badgeLabel}</Badge> : null}
            </div>
            <p className="max-w-3xl leading-6 text-amber-900/90">{description}</p>
          </div>
        </div>
        {actions?.length ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button key={action.href} asChild variant="outline" className="border-amber-300 bg-white/85 text-amber-950 hover:bg-white">
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ClientModuleTabs<T extends string>({
  items,
  value,
  onChange
}: {
  items: Array<{ value: T; label: string; badge?: React.ReactNode; disabled?: boolean; title?: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          disabled={item.disabled}
          title={item.title}
          onClick={() => onChange(item.value)}
          className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${
            value === item.value
              ? "border-blue-200 bg-blue-50 text-blue-950 shadow-[inset_3px_0_0_0_rgb(30,64,175)]"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <span>{item.label}</span>
          {item.badge ? (
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${value === item.value ? "border-blue-200 bg-white text-blue-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
              {item.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
