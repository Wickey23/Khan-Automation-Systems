"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

export function ActionNeededPanel({
  items,
  className
}: {
  items: ActionNeededItem[];
  className?: string;
}) {
  const visibleItems = items.slice(0, 4);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Next actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-start justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/35"
            >
              <div className="space-y-2">
                <p className="text-sm font-medium leading-5 text-foreground">{item.label}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge className={clientBadgeClass(severityTone(item.severity))}>{item.severity}</Badge>
                  <span>{sourceLabel(item.sourceModule)}</span>
                  {item.timestamp ? <span>{new Date(item.timestamp).toLocaleDateString()}</span> : null}
                </div>
              </div>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))
        ) : (
          <div className="empty-state py-8">Nothing urgent needs attention right now.</div>
        )}
      </CardContent>
    </Card>
  );
}
