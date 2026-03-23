"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import { fetchAttentionQueue, fetchFollowUpQueue, getMe, retryAiApprovalSend } from "@/lib/api";
import type { AttentionQueueItem } from "@/lib/types";
import { PageShell, SectionShell } from "@/components/ui/page";
import { CommandHeader } from "@/components/ops";
import { buildReturnTo, buildWorkflowHref, normalizeReturnTo, sourceToLabel } from "@/lib/workflow-nav";
import { ContextualShortcutHints, QueueActionButton, QueueActionLink, QueueShortcutHint, QueueSurfaceStateCard, QueueTriagePanel } from "@/components/queue";
import { useQueueTriageEnrichment } from "@/lib/hooks/use-queue-triage-enrichment";
import { markDailyReviewDirty } from "@/lib/review-loop";
import { ATTENTION_RISK_LABELS } from "@/lib/operational-language";
import { useOperationalShortcuts } from "@/lib/hooks/use-operational-shortcuts";
import { resolvePostActionFocus } from "@/lib/queue-focus";
import { WorkflowReturnBanner } from "@/components/queue/workflow-return-banner";
import { ActionQueueTable, RiskRailCard, SectionDisclosure, ageFromDate, priorityToSeverity, statusToOperatorState } from "@/components/ops";

type AttentionLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type EntityTypeFilter = "all" | "call" | "lead" | "message_thread";
type BlockedFilter = "all" | "blocked" | "unblocked";
type StaleFilter = "all" | "stale" | "active";
type UnresolvedFilter = "all" | "unresolved" | "resolved";
type SortMode = "score" | "updatedAt";
type OwnershipFilter = "all" | "mine" | "unassigned";
type RiskFilter = "all" | "at_risk" | "critical_unowned";

function parseFilterValue<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  if (!value) return fallback;
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

type OwnershipSummary = {
  state: "mine" | "assigned_elsewhere" | "unassigned";
  ownerEmail?: string | null;
  overdueOpenCount: number;
};

function attentionRiskSignals(item: AttentionQueueItem, owner?: OwnershipSummary) {
  const signals: string[] = [];
  if ((item.attentionLevel === "CRITICAL" || item.attentionLevel === "HIGH") && owner?.state === "unassigned") {
    signals.push("high_or_critical_unowned");
  }
  if (item.stale && item.unresolved) signals.push("stale_unresolved");
  if (item.followUpContext.openCount > 0 && owner?.state === "unassigned") signals.push("follow_up_open_unowned");
  return signals;
}

function quickActions(item: AttentionQueueItem, context: { returnTo: string }) {
  const actions: Array<{ key: string; label: string; href?: string; retry?: boolean }> = [];
  const retryableSend =
    item.approvalContext.latestApprovalId &&
    item.approvalContext.deliveryStatus === "FAILED" &&
    item.approvalContext.retryable;
  if (retryableSend && !item.blocked) {
    actions.push({ key: "retry", label: "Retry send", retry: true });
  }
  if (item.approvalContext.pendingCount > 0) {
    actions.push({ key: "pending-approval", label: "Open pending approval", href: buildWorkflowHref(item.approvalsHref || "/app/approvals?status=PENDING", { source: "attention", returnTo: context.returnTo, returnLabel: "Needs Attention" }) });
  } else if (item.approvalContext.latestApprovalId) {
    actions.push({ key: "approval", label: "Open approval", href: buildWorkflowHref(item.approvalsHref || "/app/approvals", { source: "attention", returnTo: context.returnTo, returnLabel: "Needs Attention" }) });
  }
  if (item.followUpContext.overdueCount > 0) {
    actions.push({ key: "overdue-follow-up", label: "Open overdue follow-up", href: buildWorkflowHref(item.followUpHref || "/app/follow-up?status=overdue", { source: "attention", returnTo: context.returnTo, returnLabel: "Needs Attention" }) });
  } else if (item.followUpContext.openCount > 0) {
    actions.push({ key: "follow-up", label: "Open follow-up", href: buildWorkflowHref(item.followUpHref || "/app/follow-up", { source: "attention", returnTo: context.returnTo, returnLabel: "Needs Attention" }) });
  }
  if (!actions.length || (item.unresolved && !item.blocked)) {
    actions.push({ key: "entity", label: "Open entity", href: buildWorkflowHref(item.entityHref, { source: "attention", returnTo: context.returnTo, returnLabel: "Needs Attention" }) });
  }
  return actions.slice(0, 3);
}

export default function AttentionPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const source = searchParams.get("source") || "";
  const returnToQuery = normalizeReturnTo(searchParams.get("returnTo"));
  const returnLabel = searchParams.get("returnLabel") || sourceToLabel(source);
  const returnTo = useMemo(() => buildReturnTo(pathname, searchParams), [pathname, searchParams]);
  const [items, setItems] = useState<AttentionQueueItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const [ownershipByEntity, setOwnershipByEntity] = useState<Record<string, OwnershipSummary>>({});
  const [queueUpdateNote, setQueueUpdateNote] = useState<string | null>(null);
  const [pendingFocusUpdate, setPendingFocusUpdate] = useState<{
    actionLabel: string;
    actedId: string;
    previousIds: string[];
  } | null>(null);
  const visibleItemKeysRef = useRef<string[]>([]);

  const [levelFilter, setLevelFilter] = useState<AttentionLevel | "all">(parseFilterValue(searchParams.get("level"), ["all", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const, "all"));
  const [entityFilter, setEntityFilter] = useState<EntityTypeFilter>(parseFilterValue(searchParams.get("entity"), ["all", "call", "lead", "message_thread"] as const, "all"));
  const [blockedFilter, setBlockedFilter] = useState<BlockedFilter>(parseFilterValue(searchParams.get("blocked"), ["all", "blocked", "unblocked"] as const, "all"));
  const [staleFilter, setStaleFilter] = useState<StaleFilter>(parseFilterValue(searchParams.get("stale"), ["all", "stale", "active"] as const, "all"));
  const [unresolvedFilter, setUnresolvedFilter] = useState<UnresolvedFilter>(parseFilterValue(searchParams.get("unresolved"), ["all", "unresolved", "resolved"] as const, "all"));
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>(parseFilterValue(searchParams.get("owner"), ["all", "mine", "unassigned"] as const, "all"));
  const [riskFilter, setRiskFilter] = useState<RiskFilter>(parseFilterValue(searchParams.get("risk"), ["all", "at_risk", "critical_unowned"] as const, "all"));
  const [sortMode, setSortMode] = useState<SortMode>(parseFilterValue(searchParams.get("sort"), ["score", "updatedAt"] as const, "score"));

  const hasNarrowFilter =
    levelFilter !== "all" ||
    entityFilter !== "all" ||
    blockedFilter !== "all" ||
    staleFilter !== "all" ||
    unresolvedFilter !== "all" ||
    ownershipFilter !== "all" ||
    riskFilter !== "all";
  const emptyStateCopy = useMemo(() => {
    if (riskFilter === "critical_unowned") {
      return {
        title: "No critical or high unassigned items",
        message: "There are no high-priority attention items currently lacking follow-up ownership."
      };
    }
    if (levelFilter === "CRITICAL") {
      return {
        title: "No critical attention items",
        message: "Critical attention is currently clear. Keep monitoring high-priority queues."
      };
    }
    if (hasNarrowFilter) {
      return {
        title: "No items match these filters",
        message: "Try widening filters to see more items, or keep this view if you only want high-priority slices."
      };
    }
    return {
      title: items.length === 0 ? "No attention activity yet" : "Nothing urgent right now",
      message:
        items.length === 0
          ? "This workspace has not generated attention items yet. Start from calls, leads, or messages to create operational activity."
          : "The attention queue is currently clear. Continue monitoring calls, leads, and messages as activity comes in."
    };
  }, [hasNarrowFilter, items.length, levelFilter, riskFilter]);

  const loadAttention = useCallback(async () => {
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
  }, [levelFilter]);

  async function loadOwnershipContext() {
    try {
      const [me, followUp] = await Promise.all([getMe(), fetchFollowUpQueue()]);
      const meId = me.user.userId;
      const next: Record<string, OwnershipSummary> = {};
      for (const item of followUp.queue) {
        if (!item.entityType || !item.entityId || item.status !== "OPEN") continue;
        const key = `${item.entityType}:${item.entityId}`;
        const dueAt = item.task?.dueAt ? new Date(item.task.dueAt).getTime() : null;
        const overdue = Boolean(dueAt && dueAt < Date.now());
        const base = next[key] || { state: "unassigned" as const, ownerEmail: null, overdueOpenCount: 0 };
        if (overdue) base.overdueOpenCount += 1;
        if (item.task?.assignedToUserId) {
          base.state = item.task.assignedToUserId === meId ? "mine" : "assigned_elsewhere";
          base.ownerEmail = item.task.assignedToUser?.email || base.ownerEmail;
        }
        next[key] = base;
      }
      setOwnershipByEntity(next);
    } catch {
      setOwnershipByEntity({});
    }
  }

  useEffect(() => {
    void loadAttention();
    void loadOwnershipContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFilter]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (levelFilter === "all") params.delete("level"); else params.set("level", levelFilter);
    if (entityFilter === "all") params.delete("entity"); else params.set("entity", entityFilter);
    if (blockedFilter === "all") params.delete("blocked"); else params.set("blocked", blockedFilter);
    if (staleFilter === "all") params.delete("stale"); else params.set("stale", staleFilter);
    if (unresolvedFilter === "all") params.delete("unresolved"); else params.set("unresolved", unresolvedFilter);
    if (ownershipFilter === "all") params.delete("owner"); else params.set("owner", ownershipFilter);
    if (riskFilter === "all") params.delete("risk"); else params.set("risk", riskFilter);
    if (sortMode === "score") params.delete("sort"); else params.set("sort", sortMode);
    if (previewKey) {
      const [entityType, entityId] = previewKey.split(":");
      params.set("previewEntityType", entityType || "");
      params.set("previewEntityId", entityId || "");
    } else {
      params.delete("previewEntityType");
      params.delete("previewEntityId");
    }
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    const currentUrl = buildReturnTo(pathname, searchParams);
    if (nextUrl !== currentUrl) router.replace(nextUrl, { scroll: false });
  }, [blockedFilter, entityFilter, levelFilter, ownershipFilter, pathname, previewKey, riskFilter, router, searchParams, sortMode, staleFilter, unresolvedFilter]);

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (entityFilter !== "all" && item.entityType !== entityFilter) return false;
      if (blockedFilter === "blocked" && !item.blocked) return false;
      if (blockedFilter === "unblocked" && item.blocked) return false;
      if (staleFilter === "stale" && !item.stale) return false;
      if (staleFilter === "active" && item.stale) return false;
      if (unresolvedFilter === "unresolved" && !item.unresolved) return false;
      if (unresolvedFilter === "resolved" && item.unresolved) return false;
      const owner = ownershipByEntity[`${item.entityType}:${item.entityId}`];
      if (ownershipFilter === "mine" && owner?.state !== "mine") return false;
      if (ownershipFilter === "unassigned" && owner?.state === "mine") return false;
      if (ownershipFilter === "unassigned" && owner?.state === "assigned_elsewhere") return false;
      const risks = attentionRiskSignals(item, owner);
      if (riskFilter === "at_risk" && risks.length === 0) return false;
      if (riskFilter === "critical_unowned" && !risks.includes("high_or_critical_unowned")) return false;
      return true;
    });
    filtered.sort((a, b) => {
      if (sortMode === "score") return b.attentionScore - a.attentionScore;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return filtered;
  }, [blockedFilter, entityFilter, items, ownershipByEntity, ownershipFilter, riskFilter, sortMode, staleFilter, unresolvedFilter]);

  useEffect(() => {
    const deepPreview = `${searchParams.get("previewEntityType") || ""}:${searchParams.get("previewEntityId") || ""}`;
    if (deepPreview !== ":" && !previewKey) setPreviewKey(deepPreview);
  }, [previewKey, searchParams]);

  useEffect(() => {
    if (!visibleItems.length) {
      setPreviewKey("");
      return;
    }
    if (!previewKey) {
      setPreviewKey(`${visibleItems[0].entityType}:${visibleItems[0].entityId}`);
      return;
    }
    const exists = visibleItems.some((item) => `${item.entityType}:${item.entityId}` === previewKey);
    if (!exists) setPreviewKey(`${visibleItems[0].entityType}:${visibleItems[0].entityId}`);
  }, [previewKey, visibleItems]);

  const previewItem = useMemo(
    () => visibleItems.find((item) => `${item.entityType}:${item.entityId}` === previewKey) || null,
    [previewKey, visibleItems]
  );
  const onRetrySend = useCallback(async (item: AttentionQueueItem) => {
    if (!item.approvalContext.latestApprovalId || !item.approvalContext.retryable) return;
    const previousIds = visibleItemKeysRef.current;
    const actedId = `${item.entityType}:${item.entityId}`;
    setActionBusyId(item.entityType + item.entityId);
    setError(null);
    try {
      await retryAiApprovalSend(item.approvalContext.latestApprovalId);
      markDailyReviewDirty("retry_send");
      await loadAttention();
      setPendingFocusUpdate({
        actionLabel: "Attention item updated",
        actedId,
        previousIds
      });
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Failed to retry send.");
    } finally {
      setActionBusyId(null);
    }
  }, [loadAttention]);

  const attentionRows = useMemo(
    () =>
      visibleItems.map((item) => {
        const owner = ownershipByEntity[`${item.entityType}:${item.entityId}`];
        const actions = quickActions(item, { returnTo });
        const primary = actions.find((action) => !action.retry && action.href) || actions.find((action) => action.retry) || null;
        const secondaries = actions.filter((action) => action !== primary);
        return {
          id: `${item.entityType}:${item.entityId}`,
          item: item.label,
          owner:
            owner?.state === "mine"
              ? "You"
              : owner?.state === "assigned_elsewhere"
                ? owner.ownerEmail || "Assigned"
                : "Unassigned",
          due: item.followUpContext.overdueCount > 0 ? `${item.followUpContext.overdueCount} overdue` : "Within SLA",
          ageLabel: ageFromDate(item.updatedAt),
          severity: priorityToSeverity(item.attentionLevel),
          status: statusToOperatorState(item.unresolved ? "pending" : item.blocked ? "blocked" : "done"),
          href: primary?.retry ? undefined : primary?.href || buildWorkflowHref(item.entityHref, { source: "attention", returnTo, returnLabel: "Needs Attention" }),
          onPrimaryAction: primary?.retry ? () => void onRetrySend(item) : undefined,
          primaryActionDisabled: primary?.retry ? actionBusyId === item.entityType + item.entityId : false,
          primaryActionLabel: primary?.retry ? (actionBusyId === item.entityType + item.entityId ? "Retrying..." : "Retry send") : primary?.label || "Open entity",
          secondaryActions: secondaries.map((action) => ({
            label: action.label,
            href: action.href || buildWorkflowHref(item.entityHref, { source: "attention", returnTo, returnLabel: "Needs Attention" })
          })),
          detail: item.recommendedOwnerAction || item.topReasons[0] || "Review context and decide next step.",
          onRowSelect: () => setPreviewKey(`${item.entityType}:${item.entityId}`),
          onRowFocus: () => setPreviewKey(`${item.entityType}:${item.entityId}`),
          rowAriaLabel: `${item.label}. Owner ${
            owner?.state === "mine" ? "you" : owner?.state === "assigned_elsewhere" ? owner.ownerEmail || "assigned" : "unassigned"
          }.`
        };
      }),
    [actionBusyId, onRetrySend, ownershipByEntity, returnTo, visibleItems]
  );
  const attentionRiskItems = useMemo(
    () => [
      {
        id: "critical_unowned",
        title: "High/critical unowned",
        detail: "Items with high urgency and no assigned owner.",
        level: "critical" as const,
        meter: Math.min(100, Math.max(0, visibleItems.filter((item) => attentionRiskSignals(item, ownershipByEntity[`${item.entityType}:${item.entityId}`]).includes("high_or_critical_unowned")).length * 20))
      },
      {
        id: "stale_unresolved",
        title: "Stale unresolved",
        detail: "Attention items stale and unresolved.",
        level: "warning" as const
      }
    ],
    [ownershipByEntity, visibleItems]
  );
  const triage = useQueueTriageEnrichment(previewItem?.entityType, previewItem?.entityId);
  const visibleItemKeys = useMemo(() => visibleItems.map((item) => `${item.entityType}:${item.entityId}`), [visibleItems]);
  useEffect(() => {
    visibleItemKeysRef.current = visibleItemKeys;
  }, [visibleItemKeys]);
  const previewShortcutHints = useMemo(() => {
    if (!previewItem) return [] as Array<{ keys: string; label: string }>;
    const hints: Array<{ keys: string; label: string }> = [{ keys: "Enter", label: "Open entity" }];
    if (previewItem.approvalsHref) hints.push({ keys: "Alt+A", label: "Open approvals" });
    if (previewItem.followUpHref) hints.push({ keys: "Alt+F", label: "Open follow-up" });
    return hints;
  }, [previewItem]);

  useOperationalShortcuts({
    itemIds: visibleItemKeys,
    focusedId: previewKey,
    setFocusedId: setPreviewKey,
    onEnter: () => {
      if (!previewItem) return;
      router.push(buildWorkflowHref(previewItem.entityHref, { source: "attention", returnTo, returnLabel: "Needs Attention" }));
    },
    bindings: [
      {
        key: "a",
        altKey: true,
        onTrigger: () => {
          if (!previewItem?.approvalsHref) return;
          router.push(buildWorkflowHref(previewItem.approvalsHref, { source: "attention", returnTo, returnLabel: "Needs Attention" }));
        }
      },
      {
        key: "f",
        altKey: true,
        onTrigger: () => {
          if (!previewItem?.followUpHref) return;
          router.push(buildWorkflowHref(previewItem.followUpHref, { source: "attention", returnTo, returnLabel: "Needs Attention" }));
        }
      }
    ]
  });

  useEffect(() => {
    if (!pendingFocusUpdate) return;
    const nextIds = visibleItems.map((item) => `${item.entityType}:${item.entityId}`);
    const resolution = resolvePostActionFocus(pendingFocusUpdate.previousIds, nextIds, pendingFocusUpdate.actedId);
    setPreviewKey(resolution.nextId);
    const message =
      resolution.outcome === "kept"
        ? `${pendingFocusUpdate.actionLabel}. Focus kept on current item.`
        : resolution.outcome === "moved"
          ? `${pendingFocusUpdate.actionLabel}. Focus moved to the next item in this view.`
          : `${pendingFocusUpdate.actionLabel}. No more matching items in this view.`;
    setQueueUpdateNote(message);
    window.setTimeout(() => setQueueUpdateNote(null), 2600);
    setPendingFocusUpdate(null);
  }, [pendingFocusUpdate, visibleItems]);

  return (
    <PageShell>
      <CommandHeader
        eyebrow="AI Operations"
        title="Needs Attention"
        description="Prioritized operator queue across calls, leads, and messages using current recommendation, approval, delivery, and follow-up state."
      />

      <SectionShell>
        {queueUpdateNote ? (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            {queueUpdateNote}
          </div>
        ) : null}
        <div className="mb-3">
          <WorkflowReturnBanner returnTo={returnToQuery} returnLabel={returnLabel} />
        </div>
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
            value={ownershipFilter}
            onChange={(event) => setOwnershipFilter(event.target.value as OwnershipFilter)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
          >
            <option value="all">All ownership</option>
            <option value="mine">Mine</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
          >
            <option value="all">{ATTENTION_RISK_LABELS.all}</option>
            <option value="at_risk">{ATTENTION_RISK_LABELS.at_risk}</option>
            <option value="critical_unowned">{ATTENTION_RISK_LABELS.critical_unowned}</option>
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
            onClick={async () => {
              await Promise.all([loadAttention(), loadOwnershipContext()]);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
        <QueueShortcutHint
          className="mb-3"
          summary="Use shortcuts on the focused attention item."
          items={[
            { keys: "J / K", label: "Move focus" },
            { keys: "Enter", label: "Open entity" },
            { keys: "Alt+A", label: "Open approvals (if linked)" },
            { keys: "Alt+F", label: "Open follow-up (if linked)" }
          ]}
        />

        {busy ? <QueueSurfaceStateCard kind="loading" message="Loading attention queue..." /> : null}

        {!busy && error ? <QueueSurfaceStateCard kind="error" message={error} /> : null}

        {!busy && !error && visibleItems.length === 0 ? (
          <QueueSurfaceStateCard
            kind="empty"
            title={emptyStateCopy.title}
            message={emptyStateCopy.message}
            actionLabel={hasNarrowFilter ? "Reset filters" : items.length === 0 ? "Open Calls" : "Refresh queue"}
            actionHref={!hasNarrowFilter && items.length === 0 ? buildWorkflowHref("/app/calls", { source: "attention", returnTo, returnLabel: "Needs Attention" }) : undefined}
            onAction={
              hasNarrowFilter
                ? () => {
                    setLevelFilter("all");
                    setEntityFilter("all");
                    setBlockedFilter("all");
                    setStaleFilter("all");
                    setUnresolvedFilter("all");
                    setOwnershipFilter("all");
                    setRiskFilter("all");
                    setSortMode("score");
                  }
                : items.length === 0
                  ? undefined
                  : () => {
                      void Promise.all([loadAttention(), loadOwnershipContext()]);
                    }
            }
          />
        ) : null}

        {!busy && !error && visibleItems.length > 0 ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <ActionQueueTable
                title="Needs Attention Queue"
                rows={attentionRows}
                viewAllHref={buildWorkflowHref("/app/attention", { source: "attention", returnTo, returnLabel: "Needs Attention" })}
              />
              <RiskRailCard title="At Risk Summary" items={attentionRiskItems} />
            </div>
            {previewItem ? (
              <SectionDisclosure title="Focused Item Diagnostics" storageKey="attention-focused-diagnostics" className="mt-4">
                <QueueTriagePanel
                title={previewItem.label}
                subtitle={previewItem.title}
                badges={[
                  { label: `${previewItem.attentionLevel} ${previewItem.attentionScore}`, tone: previewItem.attentionLevel === "CRITICAL" ? "critical" : previewItem.attentionLevel === "HIGH" ? "warning" : "default" },
                  { label: previewItem.blocked ? "blocked" : "unblocked", tone: previewItem.blocked ? "warning" : "success" },
                  ...(previewItem.unresolved ? [{ label: "unresolved", tone: "info" as const }] : [])
                ]}
                sections={[
                  {
                    title: "Recommendation",
                    content: (
                      <div className="space-y-1">
                        <p>{triage.data?.recommendation?.action || previewItem.recommendedOwnerAction || "Review context and decide next action."}</p>
                        {triage.data?.recommendation?.why ? <p className="text-slate-500">{triage.data.recommendation.why}</p> : null}
                        {!triage.data?.recommendation && previewItem.recommendationSummary?.why ? <p className="text-slate-500">{previewItem.recommendationSummary.why}</p> : null}
                      </div>
                    )
                  },
                  { title: "Top reasons", content: previewItem.topReasons.length ? previewItem.topReasons.join(", ") : "None" },
                  { title: "Blocked reasons", content: previewItem.blockedReasons.length ? previewItem.blockedReasons.join(", ") : "None" },
                  {
                    title: "Latest approval / delivery",
                    content: `${triage.data?.approvals?.[0]?.status || previewItem.approvalContext.status || "-"} / ${triage.data?.approvals?.[0]?.deliveryStatus || previewItem.approvalContext.deliveryStatus || "-"}`
                  },
                  {
                    title: "Latest follow-up / task",
                    content: `Open ${previewItem.followUpContext.openCount}, overdue ${previewItem.followUpContext.overdueCount}, status ${previewItem.followUpContext.latestTaskStatus || "-"}`
                  },
                  {
                    title: "Ownership",
                    content: ownershipByEntity[`${previewItem.entityType}:${previewItem.entityId}`]
                      ? ownershipByEntity[`${previewItem.entityType}:${previewItem.entityId}`].state === "mine"
                        ? "Follow-up ownership: you"
                        : ownershipByEntity[`${previewItem.entityType}:${previewItem.entityId}`].state === "assigned_elsewhere"
                          ? `Follow-up owned by ${ownershipByEntity[`${previewItem.entityType}:${previewItem.entityId}`].ownerEmail || "teammate"}`
                          : "Open follow-up exists without an owner"
                      : "No linked follow-up ownership context."
                  },
                  {
                    title: "At risk intersection",
                    content: (() => {
                      const risks = attentionRiskSignals(
                        previewItem,
                        ownershipByEntity[`${previewItem.entityType}:${previewItem.entityId}`]
                      );
                      if (!risks.length) return "No additional at risk intersection signals.";
                      return risks
                        .map((risk) => {
                          if (risk === "high_or_critical_unowned") return "High/critical attention with no assigned owner";
                          if (risk === "stale_unresolved") return "Stale unresolved attention item";
                          return "Open follow-up exists without owner";
                        })
                        .join(", ");
                    })()
                  },
                  {
                    title: "Recent activity",
                    content: triage.loading
                      ? "Loading activity..."
                      : triage.recentEvents.length
                        ? triage.recentEvents.map((event) => `${event.label} - ${new Date(event.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`).join(" | ")
                        : "No recent events."
                  },
                  ...(triage.error ? [{ title: "Enrichment", content: triage.error }] : [])
                ]}
                actions={
                  <>
                    {quickActions(previewItem, { returnTo }).map((action) =>
                      action.retry ? (
                        <QueueActionButton
                          key={action.key}
                          disabled={actionBusyId === previewItem.entityType + previewItem.entityId}
                          onClick={() => void onRetrySend(previewItem)}
                          tone="warning"
                        >
                          {actionBusyId === previewItem.entityType + previewItem.entityId ? "Retrying..." : "Retry send"}
                        </QueueActionButton>
                      ) : (
                        <QueueActionLink
                          key={action.key}
                          href={action.href || buildWorkflowHref(previewItem.entityHref, { source: "attention", returnTo, returnLabel: "Needs Attention" })}
                        >
                          {action.label}
                        </QueueActionLink>
                      )
                    )}
                    <ContextualShortcutHints items={previewShortcutHints} />
                  </>
                }
              />
              </SectionDisclosure>
            ) : null}
          </>
        ) : null}
      </SectionShell>
    </PageShell>
  );
}
