"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, BellRing, Wrench } from "lucide-react";
import type { ActionNeededItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clientBadgeClass } from "@/lib/client-badges";

type GroupKey = ActionNeededItem["type"];

const groupMeta: Record<
  GroupKey,
  { title: string; icon: typeof AlertTriangle; empty: string }
> = {
  NEEDS_REVIEW: {
    title: "Needs Review",
    icon: AlertTriangle,
    empty: "No conversations or requests need review."
  },
  NEEDS_FOLLOW_UP: {
    title: "Needs Follow-Up",
    icon: BellRing,
    empty: "No follow-up work is waiting."
  },
  NEEDS_FIX: {
    title: "Needs Fix",
    icon: Wrench,
    empty: "No system or routing issues need attention."
  }
};

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
      return "Conversations";
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
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Action Needed</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {(Object.keys(groupMeta) as GroupKey[]).map((group) => {
          const meta = groupMeta[group];
          const Icon = meta.icon;
          const groupItems = items.filter((item) => item.type === group);

          return (
            <section key={group} className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{meta.title}</h3>
              </div>
              {groupItems.length ? (
                <div className="space-y-2">
                  {groupItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="block rounded-lg border p-3 transition hover:bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{item.label}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge className={clientBadgeClass(severityTone(item.severity))}>
                              {item.severity.toUpperCase()}
                            </Badge>
                            <span>{sourceLabel(item.sourceModule)}</span>
                            {item.timestamp ? (
                              <span>{new Date(item.timestamp).toLocaleString()}</span>
                            ) : null}
                          </div>
                        </div>
                        <ArrowRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  {meta.empty}
                </p>
              )}
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}

