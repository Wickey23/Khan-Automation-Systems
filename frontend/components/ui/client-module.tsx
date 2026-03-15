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
