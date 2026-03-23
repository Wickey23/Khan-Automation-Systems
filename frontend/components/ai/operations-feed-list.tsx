"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Mail, Phone, Sparkles, UserPlus } from "lucide-react";
import { retryAiApprovalSend } from "@/lib/api";
import type { OperationsFeedEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { buildReturnTo, buildWorkflowHref } from "@/lib/workflow-nav";
import { QueueActionButton, QueueActionLink } from "@/components/queue";
import { markDailyReviewDirty } from "@/lib/review-loop";

type OperationsFeedListProps = {
  events: OperationsFeedEvent[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  source?: string;
  returnLabel?: string;
  onActionComplete?: () => Promise<void> | void;
};

function formatRelative(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))}h ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function statusTone(status: OperationsFeedEvent["status"]) {
  if (status === "critical") return "border-red-200 text-red-700 bg-red-50";
  if (status === "warning") return "border-amber-200 text-amber-700 bg-amber-50";
  if (status === "success") return "border-emerald-200 text-emerald-700 bg-emerald-50";
  return "border-slate-200 text-slate-700 bg-slate-100";
}

function iconForEventType(eventType: string) {
  if (eventType.includes("approval")) return <Mail size={14} />;
  if (eventType.includes("delivery") || eventType.includes("retry")) return <CheckCircle2 size={14} />;
  if (eventType.includes("handoff")) return <Sparkles size={14} />;
  if (eventType.includes("follow_up") || eventType.includes("task")) return <UserPlus size={14} />;
  if (eventType.includes("call")) return <Phone size={14} />;
  return <AlertCircle size={14} />;
}

function iconTone(status: OperationsFeedEvent["status"]) {
  if (status === "critical") return "bg-red-100 text-red-600";
  if (status === "warning") return "bg-amber-100 text-amber-700";
  if (status === "success") return "bg-emerald-100 text-emerald-600";
  return "bg-slate-100 text-slate-500";
}

export function OperationsFeedList({
  events,
  loading = false,
  emptyMessage = "No recent operations.",
  className,
  source,
  returnLabel,
  onActionComplete
}: OperationsFeedListProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = buildReturnTo(pathname, searchParams);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  async function onRetrySend(event: OperationsFeedEvent) {
    const retryable = Boolean((event.metadata as { retryable?: boolean } | null)?.retryable);
    if (!retryable || !event.id.startsWith("approval-")) return;
    const approvalId = event.id.slice("approval-".length);
    if (!approvalId) return;
    setActionBusyId(event.id);
    try {
      await retryAiApprovalSend(approvalId);
      markDailyReviewDirty("retry_send");
      await onActionComplete?.();
    } finally {
      setActionBusyId(null);
    }
  }

  function primaryActionLabel(event: OperationsFeedEvent) {
    if (event.eventType.includes("approval")) return "View approval";
    if (event.eventType.includes("follow_up") || event.eventType.includes("task")) return "View follow-up";
    if (event.eventType.includes("delivery") || event.eventType.includes("retry")) return "View delivery";
    return "Open";
  }
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {loading ? <p className="text-sm text-slate-500">Loading recent operations...</p> : null}
      {!loading && events.length === 0 ? <p className="text-sm text-slate-500">{emptyMessage}</p> : null}
      {!loading
        ? events.map((event, index) => (
            <div key={event.id} className={cn("relative flex items-start gap-3 rounded-xl px-1 py-1", index < events.length - 1 ? "pb-5" : "")}>
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  iconTone(event.status)
                )}
              >
                {iconForEventType(event.eventType)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{event.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{formatRelative(event.createdAt)}</p>
                <p className={cn("mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", statusTone(event.status))}>
                  {event.status}
                </p>
                <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">{event.summary}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {event.href ? (
                    <QueueActionLink
                      href={buildWorkflowHref(
                        event.href,
                        {
                          source: source || "operations-feed",
                          returnTo,
                          returnLabel: returnLabel || "Recent Operations"
                        }
                      )}
                      tone="primary"
                    >
                      {primaryActionLabel(event)}
                    </QueueActionLink>
                  ) : null}
                  {(event.eventType === "delivery_failed" || event.eventType === "retry_delivery_failed") &&
                  Boolean((event.metadata as { retryable?: boolean } | null)?.retryable) ? (
                    <QueueActionButton
                      disabled={actionBusyId === event.id}
                      onClick={() => void onRetrySend(event)}
                      tone="warning"
                    >
                      {actionBusyId === event.id ? "Retrying..." : "Retry send"}
                    </QueueActionButton>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        : null}
    </div>
  );
}
