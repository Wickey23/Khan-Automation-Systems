"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Siren } from "lucide-react";
import type { ActionNeededItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clientBadgeClass } from "@/lib/client-badges";

function severityTone(severity: ActionNeededItem["severity"]) {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "warning";
  return "neutral";
}

function sourceLabel(source: ActionNeededItem["sourceModule"]) {
  switch (source) {
    case "appointments":
      return "Appointments";
    case "conversations":
      return "Calls";
    case "leads":
      return "Leads";
    case "messages":
      return "Messages";
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
  if (severity === "critical") return "border-rose-200 bg-rose-50/70 hover:bg-rose-50";
  if (severity === "warning") return "border-amber-200 bg-amber-50/70 hover:bg-amber-50";
  return "border-border bg-muted/20 hover:bg-muted/35";
}

function itemSurfaceDark(severity: ActionNeededItem["severity"]) {
  if (severity === "critical") return "border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/14";
  if (severity === "warning") return "border-amber-400/25 bg-amber-400/10 hover:bg-amber-400/14";
  return "border-white/10 bg-white/6 hover:bg-white/10";
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
    <Card className={className}>
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
                  className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 transition-colors duration-150 ${dark ? itemSurfaceDark(item.severity) : itemSurface(item.severity)}`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`mt-0.5 rounded-lg p-2 shadow-sm ${dark ? "bg-white/10 text-slate-200" : "bg-white/80 text-muted-foreground"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <p className={`text-sm font-medium leading-5 ${dark ? "text-white" : "text-foreground"}`}>{item.label}</p>
                      {item.detail ? <p className={`text-sm leading-5 ${dark ? "text-slate-300" : "text-muted-foreground"}`}>{item.detail}</p> : null}
                      <div className={`flex flex-wrap items-center gap-2 text-xs ${dark ? "text-slate-400" : "text-muted-foreground"}`}>
                        <Badge className={clientBadgeClass(severityTone(item.severity))}>{item.severity}</Badge>
                        <span>{sourceLabel(item.sourceModule)}</span>
                        {item.timestamp ? <span>{new Date(item.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span> : null}
                      </div>
                      <p className={`text-xs font-medium ${dark ? "text-slate-200" : "text-foreground/80"}`}>{itemActionLabel(item)}</p>
                    </div>
                  </div>
                  <ArrowRight className={`mt-1 h-4 w-4 shrink-0 ${dark ? "text-slate-400" : "text-muted-foreground"}`} />
                </Link>
              );
            })()
          ))
        ) : (
          <div className={`py-8 text-sm ${dark ? "rounded-xl border border-white/10 bg-white/5 text-slate-300" : "empty-state"}`}>Nothing needs attention right now.</div>
        )}
      </CardContent>
    </Card>
  );
}
