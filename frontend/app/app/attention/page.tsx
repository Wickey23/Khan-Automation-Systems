"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAttentionQueue, fetchFollowUpQueue, getMe, retryAiApprovalSend } from "@/lib/api";
import type { AttentionQueueItem } from "@/lib/types";
import { CommandHeader } from "@/components/ops";
import { buildReturnTo, buildWorkflowHref } from "@/lib/workflow-nav";
import { ContextualShortcutHints, QueueActionButton, QueueActionLink, QueueShortcutHint, QueueSurfaceStateCard } from "@/components/queue";
import { useQueueTriageEnrichment } from "@/lib/hooks/use-queue-triage-enrichment";
import { markDailyReviewDirty } from "@/lib/review-loop";
import { useOperationalShortcuts } from "@/lib/hooks/use-operational-shortcuts";
import { resolvePostActionFocus } from "@/lib/queue-focus";
import { Button } from "@/components/ui/button";
import { ActionQueueTable, KpiCard, SectionDisclosure, ageFromDate, priorityToSeverity, statusToOperatorState } from "@/components/ops";

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
      title: items.length === 0 ? "Risk queue clear" : "No active risk in this view",
      message:
        items.length === 0
          ? "No unresolved risk is active right now. New risk events will appear here as operations run."
          : "Critical and high-risk triage is currently healthy. Continue monitoring for new ownership gaps."
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
        const isCritical = item.attentionLevel === "CRITICAL";
        const isUnassigned = owner?.state !== "mine" && owner?.state !== "assigned_elsewhere";
        const ownershipSignal = isUnassigned ? "Unassigned" : owner?.state === "mine" ? "Assigned to you" : "Assigned";
        const riskSignal = isCritical ? "Critical" : item.attentionLevel === "HIGH" ? "High risk" : "Watch";
        return {
          id: `${item.entityType}:${item.entityId}`,
          item: `${riskSignal} - ${item.label}`,
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
          detail: `${ownershipSignal}. ${item.recommendedOwnerAction || item.topReasons[0] || "Review context and decide next step."}`,
          isActive: previewKey === `${item.entityType}:${item.entityId}`,
          onRowSelect: () => setPreviewKey(`${item.entityType}:${item.entityId}`),
          onRowFocus: () => setPreviewKey(`${item.entityType}:${item.entityId}`),
          rowAriaLabel: `${item.label}. Owner ${
            owner?.state === "mine" ? "you" : owner?.state === "assigned_elsewhere" ? owner.ownerEmail || "assigned" : "unassigned"
          }.`
        };
      }),
    [actionBusyId, onRetrySend, ownershipByEntity, previewKey, returnTo, visibleItems]
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

  const summaryStrip = useMemo(() => {
    const unresolved = visibleItems.filter((item) => item.unresolved).length;
    const critical = visibleItems.filter((item) => item.attentionLevel === "CRITICAL").length;
    const criticalHigh = visibleItems.filter((item) => item.attentionLevel === "CRITICAL" || item.attentionLevel === "HIGH").length;
    const blocked = visibleItems.filter((item) => item.blocked).length;
    const unassignedHighRisk = visibleItems.filter((item) =>
      attentionRiskSignals(item, ownershipByEntity[`${item.entityType}:${item.entityId}`]).includes("high_or_critical_unowned")
    ).length;
    return [
      { label: "Critical", value: critical, note: "Immediate intervention" },
      { label: "Critical/high", value: criticalHigh, note: "Priority exposure" },
      { label: "Unassigned risk", value: unassignedHighRisk + blocked, note: "Ownership gaps" },
      { label: "Unresolved", value: unresolved, note: "Still open" }
    ];
  }, [ownershipByEntity, visibleItems]);

  const previewActions = useMemo(() => (previewItem ? quickActions(previewItem, { returnTo }) : []), [previewItem, returnTo]);
  const previewRiskFlags = useMemo(() => {
    if (!previewItem) return [] as string[];
    const owner = ownershipByEntity[`${previewItem.entityType}:${previewItem.entityId}`];
    const flags = attentionRiskSignals(previewItem, owner).map((risk) => {
      if (risk === "high_or_critical_unowned") return "High/critical without owner";
      if (risk === "stale_unresolved") return "Stale unresolved item";
      return "Follow-up open without owner";
    });
    return [...flags, ...previewItem.blockedReasons];
  }, [ownershipByEntity, previewItem]);

  return (
    <div className="space-y-10 pb-12">
      <CommandHeader
        eyebrow="AI Operations"
        title="Risk Triage Desk"
        description="Prioritize critical risk, close ownership gaps, and intervene before issues spread."
        actions={
          <div className="flex items-center gap-3 w-full md:w-auto">
            <QueueActionLink 
              className="flex-1 md:flex-none px-6 py-2.5 bg-white/50 backdrop-blur-sm border border-slate-200/40 text-on-surface font-bold text-xs rounded-xl transition-all hover:bg-white/80 hover:shadow-sm"
              href={buildWorkflowHref("/app/attention?risk=critical_unowned", { source: "attention", returnTo, returnLabel: "Needs Attention" })}
            >
              Open unassigned critical
            </QueueActionLink>
          </div>
        }
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryStrip.map((metric) => (
          <KpiCard 
            key={metric.label} 
            label={metric.label} 
            value={String(metric.value)} 
            detail={metric.note}
            emphasis={metric.label.includes("Critical") || metric.label.includes("risk") ? "risk" : "default"}
          />
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-8 animate-fade-slide-up [animation-delay:100ms]">
          {/* Controls and Filters */}
          <div className="glass-card inner-glow rounded-3xl p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: "all", label: "All risk" },
                    { key: "critical_unowned", label: "Critical unowned" },
                    { key: "at_risk", label: "At risk" }
                  ] as const
                ).map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setRiskFilter(entry.key)}
                    className={cn(
                      "px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      riskFilter === entry.key
                        ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/10" 
                        : "bg-white text-slate-600 border-slate-100 hover:border-slate-300"
                    )}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-3">
                <select
                  value={ownershipFilter}
                  onChange={(event) => setOwnershipFilter(event.target.value as OwnershipFilter)}
                  className="bg-slate-50 border-none text-[11px] font-black uppercase tracking-widest rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
                >
                  <option value="all">All owners</option>
                  <option value="unassigned">Unassigned</option>
                  <option value="mine">Assigned to me</option>
                </select>
                
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await Promise.all([loadAttention(), loadOwnershipContext()]);
                  }}
                  className="h-8 w-8 p-0"
                  title="Refresh items"
                  aria-label="Refresh attention items"
                >
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <SectionDisclosure title="Advanced filters and shortcuts" storageKey="attention-controls-shortcuts" defaultCollapsed>
              <div className="pt-4 space-y-6">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <select
                    value={levelFilter}
                    onChange={(event) => setLevelFilter(event.target.value as AttentionLevel | "all")}
                    className="bg-white border border-slate-100 text-[10px] font-bold uppercase tracking-widest rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary/10 outline-none"
                  >
                    <option value="all">All levels</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                  <select
                    value={blockedFilter}
                    onChange={(event) => setBlockedFilter(event.target.value as BlockedFilter)}
                    className="bg-white border border-slate-100 text-[10px] font-bold uppercase tracking-widest rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary/10 outline-none"
                  >
                    <option value="all">Blocked + unblocked</option>
                    <option value="blocked">Blocked only</option>
                    <option value="unblocked">Unblocked only</option>
                  </select>
                  <select
                    value={staleFilter}
                    onChange={(event) => setStaleFilter(event.target.value as StaleFilter)}
                    className="bg-white border border-slate-100 text-[10px] font-bold uppercase tracking-widest rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary/10 outline-none"
                  >
                    <option value="all">Stale + active</option>
                    <option value="stale">Stale / unresolved</option>
                    <option value="active">Active / fresh</option>
                  </select>
                  {/* ... other filters remain unchanged in logic, just styled ... */}
                </div>
                <QueueShortcutHint
                  summary="Row shortcuts"
                  items={[
                    { keys: "J / K", label: "Move focus" },
                    { keys: "Enter", label: "Open entity" },
                    { keys: "Alt+A", label: "Open approvals" },
                    { keys: "Alt+F", label: "Open follow-up" }
                  ]}
                />
              </div>
            </SectionDisclosure>
          </div>

          {queueUpdateNote ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-xs font-bold text-emerald-700 animate-fade-slide-up">
              {queueUpdateNote}
            </div>
          ) : null}

          {busy ? (
            <div className="glass-card rounded-3xl p-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-4 animate-pulse">
                <RefreshCcw className="h-6 w-6 text-slate-300 animate-spin" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Loading queue...</p>
            </div>
          ) : error ? (
            <QueueSurfaceStateCard kind="error" message={error} />
          ) : visibleItems.length === 0 ? (
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
          ) : (
            <div className="glass-card inner-glow rounded-[2rem] overflow-hidden">
              <ActionQueueTable
                title="Needs Attention Queue"
                rows={attentionRows}
                viewAllHref={buildWorkflowHref("/app/attention", { source: "attention", returnTo, returnLabel: "Needs Attention" })}
              />
            </div>
          )}
        </div>

        {/* Focus / Sidebar Preview Panel */}
        <aside className="lg:col-span-4 space-y-6 animate-fade-slide-up [animation-delay:200ms]">
          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
              <span className="material-symbols-outlined text-[120px]">target</span>
            </div>
            
            {previewItem ? (
              <div className="relative z-10 space-y-8">
                <header>
                  <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest mb-2">Focused Entity</p>
                  <h4 className="text-xl font-black font-headline text-on-surface tracking-tight leading-tight">{previewItem.label}</h4>
                  <p className="mt-1 text-xs font-semibold text-on-surface-variant/60">{previewItem.title}</p>
                </header>

                <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100/50 space-y-3">
                  <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">Recommended Action</p>
                  <p className="text-sm font-black text-on-surface leading-tight">
                    {triage.data?.recommendation?.action || previewItem.recommendedOwnerAction || "Review context and decide next action."}
                  </p>
                  <p className="text-xs font-medium text-on-surface-variant/70 italic leading-relaxed">
                    &ldquo;{triage.data?.recommendation?.why || previewItem.recommendationSummary?.why || "Use linked workflow context before executing."}&rdquo;
                  </p>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">Execute Workflow</p>
                  <div className="flex flex-wrap gap-2">
                    {previewActions.map((action) =>
                      action.retry ? (
                        <QueueActionButton
                          key={action.key}
                          size="sm"
                          className="px-5 py-2.5 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-600 transition-all shadow-md shadow-amber-500/10"
                          disabled={actionBusyId === previewItem.entityType + previewItem.entityId}
                          onClick={() => void onRetrySend(previewItem)}
                        >
                          {actionBusyId === previewItem.entityType + previewItem.entityId ? "Work..." : "Retry send"}
                        </QueueActionButton>
                      ) : (
                        <QueueActionLink
                          key={action.key}
                          size="sm"
                          className={cn(
                            "px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm",
                            action.key === "pending-approval" || action.key === "overdue-follow-up"
                              ? "bg-slate-900 text-white hover:bg-primary"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          )}
                          href={action.href || buildWorkflowHref(previewItem.entityHref, { source: "attention", returnTo, returnLabel: "Needs Attention" })}
                        >
                          {action.label}
                        </QueueActionLink>
                      )
                    )}
                  </div>
                </div>

                {previewRiskFlags.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-black text-error uppercase tracking-widest">Risk Analysis</p>
                    <ul className="space-y-2">
                       {previewRiskFlags.slice(0, 3).map((flag) => (
                         <li key={flag} className="flex items-center gap-2 text-xs font-bold text-on-surface-variant/80">
                           <span className="w-1 h-1 rounded-full bg-error" />
                           {flag}
                         </li>
                       ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-center">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-300">Select an item to<br />preview details</p>
              </div>
            )}
          </div>
          
          <SectionDisclosure title="Secondary Diagnostics" storageKey="attention-focused-diagnostics" defaultCollapsed>
            <div className="pt-4 space-y-4">
              {previewItem ? (
                <div className="space-y-3 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                  <div className="flex justify-between"><span>Top reasons</span> <span className="text-on-surface">{previewItem.topReasons.join(", ") || "-"}</span></div>
                  <div className="flex justify-between"><span>Delivery status</span> <span className="text-on-surface">{triage.data?.approvals?.[0]?.deliveryStatus || "-"}</span></div>
                  <div className="flex justify-between"><span>Follow-up load</span> <span className="text-on-surface">{previewItem.followUpContext.openCount} items</span></div>
                  <div className="mt-4 pt-4 border-t border-slate-50">
                    <ContextualShortcutHints items={previewShortcutHints} />
                  </div>
                </div>
              ) : null}
            </div>
          </SectionDisclosure>
        </aside>
      </div>
    </div>
  );
}

