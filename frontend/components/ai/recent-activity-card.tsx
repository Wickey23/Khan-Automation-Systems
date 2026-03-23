"use client";

import type { EntityAiTimelineResponse } from "@/lib/types";

type RecentActivityCardProps = {
  title?: string;
  timelineData?: EntityAiTimelineResponse | null;
  loading?: boolean;
  error?: string | null;
  maxItems?: number;
};

type ActivityItem = {
  key: string;
  label: string;
  detail?: string;
  at: string;
  tone?: "default" | "warning" | "critical" | "success";
};

function relativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function toneClass(tone?: ActivityItem["tone"]) {
  if (tone === "critical") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function toActivityItems(data: EntityAiTimelineResponse | null | undefined): ActivityItem[] {
  if (!data) return [];
  const items: ActivityItem[] = [];

  for (const approval of data.approvals || []) {
    if (approval.status === "PENDING") {
      items.push({
        key: `approval-pending-${approval.id}`,
        label: "Approval created",
        detail: approval.toolKey,
        at: approval.updatedAt,
        tone: "warning"
      });
    } else if (approval.status === "REJECTED") {
      items.push({
        key: `approval-rejected-${approval.id}`,
        label: "Approval rejected",
        detail: approval.toolKey,
        at: approval.updatedAt,
        tone: "critical"
      });
    } else if (approval.status === "APPROVED") {
      items.push({
        key: `approval-approved-${approval.id}`,
        label: "Approval approved",
        detail: approval.toolKey,
        at: approval.updatedAt,
        tone: "success"
      });
    }
    if (approval.deliveryStatus === "FAILED") {
      items.push({
        key: `delivery-failed-${approval.id}`,
        label: "Send failed",
        detail: approval.failureReason || approval.toolKey,
        at: approval.failedAt || approval.updatedAt,
        tone: "critical"
      });
    } else if (approval.deliveryStatus === "SENT") {
      items.push({
        key: `delivery-sent-${approval.id}`,
        label: "Send succeeded",
        detail: approval.toolKey,
        at: approval.sentAt || approval.updatedAt,
        tone: "success"
      });
    }
  }

  for (const handoff of data.handoffs || []) {
    items.push({
      key: `handoff-${handoff.id}`,
      label: handoff.suppressed ? "Handoff suppressed" : "Handoff executed",
      detail: handoff.reason || `${handoff.sourceAgent || "agent"} -> ${handoff.targetAgent || "agent"}`,
      at: handoff.at,
      tone: handoff.suppressed ? "warning" : "default"
    });
  }

  const rec = data.recommendation;
  if (rec?.blockedReasons?.length) {
    items.push({
      key: "blocked-reasons",
      label: "Blocked outbound context",
      detail: rec.blockedReasons.slice(0, 2).join(" | "),
      at: rec.refreshedAt,
      tone: "warning"
    });
  }

  for (const audit of data.audit || []) {
    const action = audit.action.toLowerCase();
    if (!/(approval|delivery|follow.?up|task|handoff|opt.?out|suppression|retry)/.test(action)) continue;
    items.push({
      key: `audit-${audit.id}`,
      label: audit.action.replaceAll("_", " "),
      at: audit.createdAt
    });
  }

  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .filter((item, index, arr) => arr.findIndex((candidate) => candidate.key === item.key) === index);
}

export function RecentActivityCard({
  title = "Recent Activity",
  timelineData,
  loading,
  error,
  maxItems = 4
}: RecentActivityCardProps) {
  const items = toActivityItems(timelineData).slice(0, maxItems);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{title}</h4>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading recent activity...</p> : null}
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      {!loading && !error && !items.length ? <p className="mt-2 text-xs text-slate-500">No recent high-signal activity on this record.</p> : null}
      {!loading && !error && items.length ? (
        <div className="mt-2 space-y-2">
          {items.map((item) => (
            <div key={item.key} className={`rounded-lg border px-3 py-2 text-xs ${toneClass(item.tone)}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{item.label}</p>
                <span className="text-[11px] opacity-75">{relativeTime(item.at)}</span>
              </div>
              {item.detail ? <p className="mt-1 leading-5 opacity-80">{item.detail}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
