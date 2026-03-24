"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Siren } from "lucide-react";
import type { ActionNeededItem } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { frontDeskActionBadgeClass, frontDeskCardClass, frontDeskEmptyStateClass, frontDeskWorkspaceCardClass } from "@/lib/front-desk-ui";

function sourceLabel(source: ActionNeededItem["sourceModule"]) {
  switch (source) {
    case "appointments":
      return "Booking Queue";
    case "conversations":
      return "Call Queue";
    case "leads":
      return "Lead Queue";
    case "messages":
      return "Inbox";
    default:
      return "System";
  }
}

function severityIcon(severity: ActionNeededItem["severity"]) {
  if (severity === "critical") return Siren;
  if (severity === "warning") return AlertTriangle;
  return AlertTriangle;
}

function itemSurface(severity: ActionNeededItem["severity"]) {
  if (severity === "critical") return "border-rose-200 bg-white hover:border-rose-300";
  if (severity === "warning") return "border-amber-200 bg-white hover:border-amber-300";
  return "border-border bg-white hover:border-slate-300";
}

function itemSurfaceDark(severity: ActionNeededItem["severity"]) {
  if (severity === "critical") return "border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/14";
  if (severity === "warning") return "border-amber-400/25 bg-amber-400/10 hover:bg-amber-400/14";
  return "border-white/10 bg-white/[0.06] hover:bg-white/10";
}

function itemActionLabel(item: ActionNeededItem) {
  if (item.ctaLabel) return item.ctaLabel;
  switch (item.sourceModule) {
    case "conversations":
      return "Open call";
    case "leads":
      return "Open lead";
    case "appointments":
      return "Open booking";
    case "messages":
      return "Open thread";
    default:
      return "Open";
  }
}

export function ActionNeededPanel({
  items,
  className,
  dark = false
}: {
  items: ActionNeededItem[];
  className?: string;
  dark?: boolean;
}) {
  const visibleItems = items.slice(0, 4);

  return (
    <Card className={className || frontDeskWorkspaceCardClass("subtle")}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-lg ${dark ? "text-white" : ""}`}>Needs attention</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {visibleItems.length ? (
          visibleItems.map((item) => (
            (() => {
              const Icon = severityIcon(item.severity);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex flex-col gap-3 px-4 py-3 transition-colors duration-150 sm:flex-row sm:items-start sm:justify-between ${dark ? `rounded-lg ${itemSurfaceDark(item.severity)}` : `${frontDeskCardClass("muted")} ${itemSurface(item.severity)}`}`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`mt-0.5 rounded-lg p-2 shadow-sm ${dark ? "bg-white/10 text-slate-200" : "bg-white/80 text-muted-foreground"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <p className={`text-sm font-medium leading-5 ${dark ? "text-white" : "text-foreground"}`}>{item.label}</p>
                      {item.detail ? <p className={`text-sm leading-5 ${dark ? "text-slate-300" : "text-muted-foreground"}`}>{item.detail}</p> : null}
                      <div className={`flex flex-wrap items-center gap-2 text-xs ${dark ? "text-slate-400" : "text-muted-foreground"}`}>
                        <span className="font-medium text-slate-700">{sourceLabel(item.sourceModule)}</span>
                        <span aria-hidden="true">-</span>
                        <span className={dark ? "" : "text-slate-500"}>{item.severity}</span>
                        {item.timestamp ? <span>{new Date(item.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span> : null}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${frontDeskActionBadgeClass(itemActionLabel(item))}`}>
                          {itemActionLabel(item)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className={`h-4 w-4 shrink-0 self-end sm:mt-1 sm:self-auto ${dark ? "text-slate-400" : "text-muted-foreground"}`} />
                </Link>
              );
            })()
          ))
        ) : (
          <div className={`py-8 text-sm ${dark ? "rounded-lg border border-white/10 bg-white/5 text-slate-300" : frontDeskEmptyStateClass()}`}>
            Nothing needs attention right now. New call work, customer replies, and booking issues will show up here when the office needs to act next.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
