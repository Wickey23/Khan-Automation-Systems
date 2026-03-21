"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCcw } from "lucide-react";
import { fetchAttentionQueue, retryAiApprovalSend } from "@/lib/api";
import type { AttentionQueueItem } from "@/lib/types";
import { PageHeader, PageShell, SectionShell } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";

type AttentionLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type EntityTypeFilter = "all" | "call" | "lead" | "message_thread";
type BlockedFilter = "all" | "blocked" | "unblocked";
type StaleFilter = "all" | "stale" | "active";
type UnresolvedFilter = "all" | "unresolved" | "resolved";
type SortMode = "score" | "updatedAt";

function levelTone(level: AttentionLevel) {
  if (level === "CRITICAL") return "border-red-200 bg-red-50 text-red-700";
  if (level === "HIGH") return "border-orange-200 bg-orange-50 text-orange-700";
  if (level === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function entityLabel(entityType: string) {
  if (entityType === "call") return "Call";
  if (entityType === "lead") return "Lead";
  if (entityType === "message_thread") return "Message";
  return entityType;
}

function withSource(href: string, source: string) {
  const [path, search = ""] = href.split("?");
  const params = new URLSearchParams(search);
  params.set("source", source);
  return `${path}?${params.toString()}`;
}

export default function AttentionPage() {
  const [items, setItems] = useState<AttentionQueueItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const [levelFilter, setLevelFilter] = useState<AttentionLevel | "all">("all");
  const [entityFilter, setEntityFilter] = useState<EntityTypeFilter>("all");
  const [blockedFilter, setBlockedFilter] = useState<BlockedFilter>("all");
  const [staleFilter, setStaleFilter] = useState<StaleFilter>("all");
  const [unresolvedFilter, setUnresolvedFilter] = useState<UnresolvedFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("score");

  async function loadAttention() {
    setBusy(true);
    setError(null);
    try {
      const result = await fetchAttentionQueue({
        limit: 80,
        ...(levelFilter !== "all" ? { levels: [levelFilter] } : {})
      });
      setItems(result.items || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load attention queue.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadAttention();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFilter]);

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (entityFilter !== "all" && item.entityType !== entityFilter) return false;
      if (blockedFilter === "blocked" && !item.blocked) return false;
      if (blockedFilter === "unblocked" && item.blocked) return false;
      if (staleFilter === "stale" && !item.stale) return false;
      if (staleFilter === "active" && item.stale) return false;
      if (unresolvedFilter === "unresolved" && !item.unresolved) return false;
      if (unresolvedFilter === "resolved" && item.unresolved) return false;
      return true;
    });
    filtered.sort((a, b) => {
      if (sortMode === "score") return b.attentionScore - a.attentionScore;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return filtered;
  }, [blockedFilter, entityFilter, items, sortMode, staleFilter, unresolvedFilter]);

  async function onRetrySend(item: AttentionQueueItem) {
    if (!item.approvalContext.latestApprovalId || !item.approvalContext.retryable) return;
    setActionBusyId(item.entityType + item.entityId);
    setError(null);
    try {
      await retryAiApprovalSend(item.approvalContext.latestApprovalId);
      await loadAttention();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Failed to retry send.");
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="AI Operations"
        title="Needs Attention"
        description="Prioritized operator queue across calls, leads, and messages using current recommendation, approval, delivery, and follow-up state."
      />

      <SectionShell>
        <div className="mb-4 flex flex-wrap gap-2">
          {(["all", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setLevelFilter(entry)}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold ${levelFilter === entry ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}
            >
              {entry}
            </button>
          ))}
          <select
            value={entityFilter}
            onChange={(event) => setEntityFilter(event.target.value as EntityTypeFilter)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
          >
            <option value="all">All entities</option>
            <option value="call">Calls</option>
            <option value="lead">Leads</option>
            <option value="message_thread">Messages</option>
          </select>
          <select
            value={blockedFilter}
            onChange={(event) => setBlockedFilter(event.target.value as BlockedFilter)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
          >
            <option value="all">Blocked + unblocked</option>
            <option value="blocked">Blocked only</option>
            <option value="unblocked">Unblocked only</option>
          </select>
          <select
            value={staleFilter}
            onChange={(event) => setStaleFilter(event.target.value as StaleFilter)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
          >
            <option value="all">Stale + active</option>
            <option value="stale">Stale / unresolved</option>
            <option value="active">Active / fresh</option>
          </select>
          <select
            value={unresolvedFilter}
            onChange={(event) => setUnresolvedFilter(event.target.value as UnresolvedFilter)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
          >
            <option value="all">Unresolved + resolved</option>
            <option value="unresolved">Unresolved only</option>
            <option value="resolved">Resolved only</option>
          </select>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
          >
            <option value="score">Sort by score</option>
            <option value="updatedAt">Sort by updated</option>
          </select>
          <button
            type="button"
            onClick={() => void loadAttention()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {busy ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading attention queue...
          </div>
        ) : null}

        {!busy && error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        {!busy && !error && visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No items currently match the selected attention filters.</div>
        ) : null}

        {!busy && !error && visibleItems.length > 0 ? (
          <div className="space-y-3">
            {visibleItems.map((item) => (
              <div key={`${item.entityType}-${item.entityId}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${levelTone(item.attentionLevel)}`}>
                      {item.attentionLevel} {item.attentionScore}
                    </span>
                    <StatusBadge kind="feature" state={item.blocked ? "blocked" : "ready"} label={item.blocked ? "blocked" : "unblocked"} size="xs" />
                    {item.stale ? <StatusBadge kind="feature" state="limited" label="stale" size="xs" /> : null}
                    {item.unresolved ? <StatusBadge kind="feature" state="setup_required" label="unresolved" size="xs" /> : null}
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">Recommended action</p>
                  <p className="mt-1">{item.recommendedOwnerAction || "Review record context and decide next step."}</p>
                  {item.recommendationSummary?.why ? <p className="mt-1 text-slate-600">{item.recommendationSummary.why}</p> : null}
                </div>

                {item.topReasons.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.topReasons.map((reason) => (
                      <span key={reason} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
                        {reason}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                  <p>Entity: {entityLabel(item.entityType)}</p>
                  <p>Updated: {new Date(item.updatedAt).toLocaleString()}</p>
                  <p>Blocked reasons: {item.blockedReasons.length ? item.blockedReasons.join(", ") : "none"}</p>
                  <p>Approvals: {item.approvalContext.pendingCount} pending</p>
                  <p>Delivery: {item.approvalContext.deliveryStatus || "-"}</p>
                  <p>Follow-up open/overdue: {item.followUpContext.openCount}/{item.followUpContext.overdueCount}</p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={withSource(item.entityHref, "attention")}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                  >
                    Open entity
                  </Link>
                  <Link
                    href={withSource(item.approvalsHref || "/app/approvals", "attention")}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                  >
                    Open approvals
                  </Link>
                  <Link
                    href={withSource(item.followUpHref || "/app/follow-up", "attention")}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                  >
                    Open follow-up
                  </Link>
                  {item.approvalContext.latestApprovalId && item.approvalContext.deliveryStatus === "FAILED" && item.approvalContext.retryable ? (
                    <button
                      type="button"
                      disabled={actionBusyId === item.entityType + item.entityId}
                      onClick={() => void onRetrySend(item)}
                      className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 disabled:opacity-60"
                    >
                      {actionBusyId === item.entityType + item.entityId ? "Retrying..." : "Retry send"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </SectionShell>
    </PageShell>
  );
}
