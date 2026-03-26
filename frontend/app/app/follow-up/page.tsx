"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { executeAiTool, fetchFollowUpQueue, getMe, updateAiTask, updateFollowUpQueueItem } from "@/lib/api";
import { RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FollowUpQueueItem } from "@/lib/types";
import { CommandHeader } from "@/components/ops";
import { buildReturnTo, buildWorkflowHref, normalizeReturnTo } from "@/lib/workflow-nav";
import { ContextualShortcutHints, QueueActionButton, QueueActionLink, QueueBulkActionBar, QueueSurfaceStateCard } from "@/components/queue";
import { useQueueTriageEnrichment } from "@/lib/hooks/use-queue-triage-enrichment";
import { markDailyReviewDirty } from "@/lib/review-loop";
import { FOLLOW_UP_FILTER_LABELS } from "@/lib/operational-language";
import { useOperationalShortcuts } from "@/lib/hooks/use-operational-shortcuts";
import { resolvePostActionFocus } from "@/lib/queue-focus";
import { ActionQueueTable, KpiCard, SectionDisclosure, ageFromDate, dueLabel, priorityToSeverity, statusToOperatorState } from "@/components/ops";

type FollowUpFilter =
  | "all"
  | "at_risk"
  | "overdue"
  | "today"
  | "soon"
  | "assigned"
  | "unassigned"
  | "mine"
  | "overdue_mine"
  | "overdue_unassigned";

const followUpFilterValues: FollowUpFilter[] = [
  "all",
  "at_risk",
  "overdue",
  "today",
  "soon",
  "assigned",
  "unassigned",
  "mine",
  "overdue_mine",
  "overdue_unassigned"
];

function parseFollowUpFilter(value: string | null): FollowUpFilter {
  if (!value) return "all";
  const normalized = value.toLowerCase();
  if ((followUpFilterValues as string[]).includes(normalized)) return normalized as FollowUpFilter;
  return "all";
}

const followUpFilterLabels: Record<FollowUpFilter, string> = FOLLOW_UP_FILTER_LABELS;

function ownershipState(item: FollowUpQueueItem, meId: string | null) {
  const assigneeId = item.task?.assignedToUserId;
  if (!assigneeId) return "unassigned" as const;
  if (meId && assigneeId === meId) return "mine" as const;
  return "assigned_elsewhere" as const;
}

function itemAgeHours(item: FollowUpQueueItem) {
  return Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 3_600_000);
}

function riskFlags(item: FollowUpQueueItem, meId: string | null) {
  const overdue = Boolean(item.task?.dueAt && new Date(item.task.dueAt).getTime() < Date.now());
  const owner = ownershipState(item, meId);
  const ageHours = itemAgeHours(item);
  const flags: string[] = [];
  if (overdue && owner === "unassigned") flags.push("overdue_unassigned");
  if (overdue && owner !== "unassigned" && ageHours >= 24) flags.push("overdue_assigned_stale");
  if (item.status === "OPEN" && ageHours >= 72) flags.push("open_too_long");
  if (overdue && /escalat/i.test(item.reason || "")) flags.push("escalated_overdue");
  return flags;
}

export default function FollowUpPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedQueueItemId = searchParams.get("queueItemId") || "";
  const selectedTaskId = searchParams.get("taskId") || "";
  const returnTo = normalizeReturnTo(searchParams.get("returnTo"));
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<FollowUpQueueItem[]>([]);
  const [filter, setFilter] = useState<FollowUpFilter>(parseFollowUpFilter(searchParams.get("status")));
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [previewQueueItemId, setPreviewQueueItemId] = useState(searchParams.get("queueItemId") || "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [queueUpdateNote, setQueueUpdateNote] = useState<string | null>(null);
  const [pendingFocusUpdate, setPendingFocusUpdate] = useState<{
    actionLabel: string;
    actedId: string;
    previousIds: string[];
  } | null>(null);
  const hasAppliedDeepLinkScroll = useRef(false);

  const loadQueue = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [response, me] = await Promise.all([fetchFollowUpQueue(), getMe()]);
      setQueue(response.queue);
      setMeId(me.user.userId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load follow-up queue.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === "all") params.delete("status");
    else params.set("status", filter);
    if (previewQueueItemId) params.set("queueItemId", previewQueueItemId);
    else params.delete("queueItemId");
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    const currentUrl = buildReturnTo(pathname, searchParams);
    if (nextUrl !== currentUrl) router.replace(nextUrl, { scroll: false });
  }, [filter, pathname, previewQueueItemId, router, searchParams]);

  const localReturnTo = buildReturnTo(pathname, searchParams);

  const visibleQueue = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    return queue.filter((item) => {
      const due = item.task?.dueAt ? new Date(item.task.dueAt).getTime() : null;
      if (filter === "all") return true;
      if (selectedQueueItemId && item.id === selectedQueueItemId) return true;
      if (selectedTaskId && item.task?.id === selectedTaskId) return true;
      if (filter === "assigned") return Boolean(item.task?.assignedToUserId);
      if (filter === "unassigned") return !item.task?.assignedToUserId;
      if (filter === "at_risk") return riskFlags(item, meId).length > 0;
      if (filter === "mine") return Boolean(meId && item.task?.assignedToUserId === meId);
      if (filter === "overdue_mine") return Boolean(meId && item.task?.assignedToUserId === meId && due && due < now);
      if (filter === "overdue_unassigned") return Boolean(!item.task?.assignedToUserId && due && due < now);
      if (!due) return false;
      if (filter === "overdue") return due < now;
      if (filter === "today") return due >= todayStart.getTime() && due < todayEnd.getTime();
      if (filter === "soon") return due >= now && due < now + 3 * 24 * 60 * 60 * 1000;
      return true;
    });
  }, [filter, meId, queue, selectedQueueItemId, selectedTaskId]);

  useEffect(() => {
    const targetId = selectedQueueItemId || selectedTaskId;
    if (!targetId) return;
    if (hasAppliedDeepLinkScroll.current) return;
    const timeout = setTimeout(() => {
      const element = document.getElementById(`followup-${targetId}`);
      if (!element) {
        if (selectedTaskId) {
          const linked = visibleQueue.find((item) => item.task?.id === selectedTaskId);
          if (linked) setPreviewQueueItemId(linked.id);
        }
        return;
      }
      hasAppliedDeepLinkScroll.current = true;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => clearTimeout(timeout);
  }, [busy, selectedQueueItemId, selectedTaskId, visibleQueue]);

  useEffect(() => {
    if (!visibleQueue.length) {
      setPreviewQueueItemId("");
      return;
    }
    if (!previewQueueItemId) {
      setPreviewQueueItemId(selectedQueueItemId || visibleQueue[0].id);
      return;
    }
    const exists = visibleQueue.some((item) => item.id === previewQueueItemId);
    if (!exists) setPreviewQueueItemId(visibleQueue[0].id);
  }, [previewQueueItemId, selectedQueueItemId, visibleQueue]);

  const previewItem = useMemo(
    () => visibleQueue.find((item) => item.id === previewQueueItemId) || null,
    [previewQueueItemId, visibleQueue]
  );
  const triage = useQueueTriageEnrichment(previewItem?.entityType, previewItem?.entityId);
  const visibleQueueIds = useMemo(() => visibleQueue.map((item) => item.id), [visibleQueue]);
  const previewShortcutHints = useMemo(() => {
    if (!previewItem) return [] as Array<{ keys: string; label: string }>;
    const hints: Array<{ keys: string; label: string }> = [];
    if (queueEntityHref(previewItem)) hints.push({ keys: "Enter", label: "Open entity" });
    if (!actionBusyId) {
      hints.push({ keys: "Alt+D", label: previewItem.status === "OPEN" ? "Mark done" : "Reopen" });
      if (previewItem.task?.id) hints.push({ keys: "Alt+A", label: "Assign to me" });
      if (previewItem.task?.id && isItemOverdue(previewItem)) hints.push({ keys: "Alt+E", label: "Escalate overdue" });
    }
    return hints;
  }, [actionBusyId, previewItem]);

  function queueEntityHref(item: FollowUpQueueItem) {
    if (!item.entityType || !item.entityId) return "";
    if (item.entityType === "message_thread") return `/app/messages?threadId=${encodeURIComponent(item.entityId)}`;
    if (item.entityType === "call") return `/app/calls?callId=${encodeURIComponent(item.entityId)}`;
    return `/app/leads?leadId=${encodeURIComponent(item.entityId)}`;
  }

  useOperationalShortcuts({
    itemIds: visibleQueueIds,
    focusedId: previewQueueItemId,
    setFocusedId: setPreviewQueueItemId,
    onEnter: () => {
      if (!previewItem) return;
      const href = queueEntityHref(previewItem);
      if (!href) return;
      router.push(buildWorkflowHref(href, { source: "follow-up", returnTo: localReturnTo, returnLabel: "Follow-up Queue" }));
    },
    bindings: [
      {
        key: "d",
        altKey: true,
        onTrigger: () => {
          if (!previewItem || actionBusyId) return;
          void runQueueAction(previewItem, previewItem.status === "OPEN" ? "done" : "open");
        }
      },
      {
        key: "a",
        altKey: true,
        onTrigger: () => {
          if (!previewItem || actionBusyId || !previewItem.task?.id) return;
          void runQueueAction(previewItem, "assignMe");
        }
      },
      {
        key: "e",
        altKey: true,
        onTrigger: () => {
          if (!previewItem || actionBusyId || !previewItem.task?.id || !isItemOverdue(previewItem)) return;
          void runQueueAction(previewItem, "escalate");
        }
      }
    ]
  });

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => visibleQueue.some((item) => item.id === id)));
  }, [visibleQueue]);

  const selectedItems = useMemo(
    () => visibleQueue.filter((item) => selectedIds.includes(item.id)),
    [selectedIds, visibleQueue]
  );
  const hasNarrowFilter = filter !== "all";
  const emptyStateCopy = useMemo(() => {
    if (filter === "mine") {
      return {
        title: "No items assigned to you",
        message: "You currently have no follow-up ownership in this queue."
      };
    }
    if (filter === "unassigned") {
      return {
        title: "No unassigned follow-up work",
        message: "All current follow-up items have an owner."
      };
    }
    if (filter === "overdue_mine") {
      return {
        title: "No overdue items assigned to you",
        message: "Your assigned follow-up work is currently not overdue."
      };
    }
    if (filter === "overdue_unassigned") {
      return {
        title: "No overdue unassigned follow-up",
        message: "There is no unassigned overdue work in this queue right now."
      };
    }
    if (filter === "at_risk") {
      return {
        title: "No at risk follow-up items",
        message: "No overdue-unassigned, stale, or escalated-open follow-up work is currently present."
      };
    }
    if (hasNarrowFilter) {
      return {
        title: "No follow-up items in this filter",
        message: "This queue slice is currently clear. Try another ownership/risk filter to keep reviewing."
      };
    }
    return {
      title: queue.length === 0 ? "No follow-up activity yet" : "No follow-up work queued",
      message:
        queue.length === 0
          ? "No tasks have been created yet. Start with calls, leads, or messages and run the first workflow to generate follow-up items."
          : "No tasks need follow-up right now. New items appear as calls, messages, and lead workflows create tasks."
    };
  }, [filter, hasNarrowFilter, queue.length]);

  function isItemOverdue(item: FollowUpQueueItem) {
    if (!item.task?.dueAt) return false;
    return new Date(item.task.dueAt).getTime() < Date.now();
  }

  const ownershipSnapshot = useMemo(() => {
    const all = queue.length;
    const mine = queue.filter((item) => ownershipState(item, meId) === "mine").length;
    const unassigned = queue.filter((item) => ownershipState(item, meId) === "unassigned").length;
    const overdueMine = queue.filter((item) => ownershipState(item, meId) === "mine" && isItemOverdue(item)).length;
    const overdueUnassigned = queue.filter((item) => ownershipState(item, meId) === "unassigned" && isItemOverdue(item)).length;
    const atRisk = queue.filter((item) => riskFlags(item, meId).length > 0).length;
    return { all, mine, unassigned, overdueMine, overdueUnassigned, atRisk };
  }, [meId, queue]);

  const performQueueAction = useCallback(async (item: FollowUpQueueItem, action: "done" | "open" | "assignMe" | "escalate") => {
    if (action === "done") {
      await updateFollowUpQueueItem(item.id, "DONE");
      if (item.task?.id) await updateAiTask(item.task.id, { status: "DONE" });
      return;
    }
    if (action === "open") {
      await updateFollowUpQueueItem(item.id, "OPEN");
      if (item.task?.id && item.task.status === "DONE") {
        await updateAiTask(item.task.id, { status: "OPEN" });
      }
      return;
    }
    if (action === "assignMe") {
      if (!item.task?.id || !meId) return;
      await updateAiTask(item.task.id, { assignedToUserId: meId, status: "IN_PROGRESS" });
      return;
    }
    if (!item.task?.id || !isItemOverdue(item)) return;
    await executeAiTool({
      toolKey: "escalate_overdue_item",
      agentKey: "task_followup",
      entityType: "task",
      entityId: item.task.id,
      input: { taskId: item.task.id }
    });
  }, [meId]);

  const runQueueAction = useCallback(async (item: FollowUpQueueItem, action: "done" | "open" | "assignMe" | "escalate") => {
    if (actionBusyId) return;
    setActionBusyId(item.id);
    setError(null);
    const previousIds = visibleQueue.map((entry) => entry.id);
    try {
      await performQueueAction(item, action);
      markDailyReviewDirty("follow_up");
      await loadQueue();
      setPendingFocusUpdate({
        actionLabel: "Follow-up updated",
        actedId: item.id,
        previousIds
      });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to update queue item.");
    } finally {
      setActionBusyId(null);
    }
  }, [actionBusyId, loadQueue, performQueueAction, visibleQueue]);

  const followUpRows = useMemo(
    () =>
      visibleQueue.map((item) => {
        const ownerState = ownershipState(item, meId);
        const ownerLabel =
          ownerState === "mine" ? "You" : ownerState === "assigned_elsewhere" ? item.task?.assignedToUser?.email?.split('@')[0] || "Assigned" : "Unassigned";
        const isOverdue = isItemOverdue(item);
        const risks = riskFlags(item, meId);
        const rowSeverity = isOverdue || risks.length ? "high" : item.task?.priority || "medium";
        const relatedEntityHref = queueEntityHref(item);
        const relatedApprovalsHref =
          item.entityType && item.entityLength
            ? buildWorkflowHref(
                "/app/approvals?status=PENDING",
                { source: "follow-up", returnTo: localReturnTo, returnLabel: "Follow-up Queue" },
                item.entityType === "message_thread"
                  ? { threadId: item.entityId }
                  : item.entityType === "call"
                    ? { callId: item.entityId }
                    : { leadId: item.entityId }
              )
            : "";

        return {
          id: item.id,
          rowId: `followup-${item.id}`,
          item: item.task?.title || item.reason,
          owner: ownerLabel,
          due: dueLabel(item.task?.dueAt),
          ageLabel: ageFromDate(item.createdAt),
          severity: priorityToSeverity(rowSeverity),
          status: statusToOperatorState(item.status === "OPEN" ? (isOverdue ? "in_progress" : "pending") : "done"),
          primaryActionLabel: item.status === "OPEN" ? "Mark done" : "Reopen",
          onPrimaryAction: () => void runQueueAction(item, item.status === "OPEN" ? "done" : "open"),
          primaryActionDisabled: actionBusyId === item.id,
          secondaryActions: [
            ...(relatedEntityHref
              ? [
                  {
                    label: "Open entity",
                    href: buildWorkflowHref(relatedEntityHref, { source: "follow-up", returnTo: localReturnTo, returnLabel: "Follow-up Queue" })
                  }
                ]
              : []),
            ...(relatedApprovalsHref ? [{ label: "Open approvals", href: relatedApprovalsHref }] : []),
            ...(item.task?.id && ownerState !== "mine" ? [{ label: "Assign to me", onClick: () => void runQueueAction(item, "assignMe") }] : []),
            ...(item.task?.id && isOverdue ? [{ label: "Escalate overdue", onClick: () => void runQueueAction(item, "escalate") }] : [])
          ],
          detail: item.reason,
          isActive: previewQueueItemId === item.id,
          onRowSelect: () => setPreviewQueueItemId(item.id),
          onRowFocus: () => setPreviewQueueItemId(item.id),
          rowAriaLabel: `${item.task?.title || item.reason}. ${ownerLabel}.`
        };
      }),
    [actionBusyId, localReturnTo, meId, previewQueueItemId, runQueueAction, visibleQueue]
  );

  const followUpSummaryStrip = useMemo(
    () => [
      { label: "Open items", value: visibleQueue.filter((item) => item.status === "OPEN").length, note: "Active commitments" },
      { label: "Overdue", value: visibleQueue.filter((item) => isItemOverdue(item) && item.status === "OPEN").length, note: "Needs immediate action" },
      { label: "Unassigned overdue", value: ownershipSnapshot.overdueUnassigned, note: "Ownership risk" },
      { label: "Mine overdue", value: ownershipSnapshot.overdueMine, note: "Your urgent load" }
    ],
    [ownershipSnapshot.overdueMine, ownershipSnapshot.overdueUnassigned, visibleQueue]
  );

  async function runBulkAction(action: "done" | "open" | "assignMe" | "escalate") {
    if (!selectedItems.length || bulkBusy) return;
    setBulkBusy(true);
    setError(null);
    try {
      const failures: string[] = [];
      for (const item of selectedItems) {
        if (action === "assignMe" && (!item.task?.id || !meId)) continue;
        if (action === "escalate" && (!item.task?.id || !isItemOverdue(item))) continue;
        try {
          await performQueueAction(item, action);
          markDailyReviewDirty("follow_up");
        } catch {
          failures.push(item.id);
        }
      }
      setSelectedIds([]);
      await loadQueue();
      setQueueUpdateNote("Bulk update applied to follow-up queue.");
      window.setTimeout(() => setQueueUpdateNote(null), 2400);
      if (failures.length) {
        setError(`Bulk action completed with ${failures.length} failure(s).`);
      }
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : "Bulk action failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  useEffect(() => {
    if (!pendingFocusUpdate) return;
    const nextIds = visibleQueue.map((item) => item.id);
    const resolution = resolvePostActionFocus(pendingFocusUpdate.previousIds, nextIds, pendingFocusUpdate.actedId);
    setPreviewQueueItemId(resolution.nextId);
    const message =
      resolution.outcome === "kept"
        ? `${pendingFocusUpdate.actionLabel}. Focus kept on current item.`
        : resolution.outcome === "moved"
          ? `${pendingFocusUpdate.actionLabel}. Focus moved to the next item in this view.`
          : `${pendingFocusUpdate.actionLabel}. No more matching items in this view.`;
    setQueueUpdateNote(message);
    window.setTimeout(() => setQueueUpdateNote(null), 2600);
    setPendingFocusUpdate(null);
  }, [pendingFocusUpdate, visibleQueue]);

  return (
    <div className="space-y-10 pb-12">
      <CommandHeader
        eyebrow="AI Operations"
        title="Follow-Up Queue"
        description="Operational follow-up items created by AI workflows and human actions."
        actions={
          <div className="flex items-center gap-3 w-full md:w-auto">
            <QueueActionLink 
              className="px-5 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary transition-all shadow-md"
              href={buildWorkflowHref("/app/follow-up?status=overdue", { source: "follow-up", returnTo: localReturnTo, returnLabel: "Follow-up Queue" })}
            >
              Open overdue items
            </QueueActionLink>
          </div>
        }
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {followUpSummaryStrip.map((metric) => (
          <KpiCard 
            key={metric.label} 
            label={metric.label} 
            value={String(metric.value)} 
            detail={metric.note}
            emphasis={metric.label.includes("Overdue") || metric.label.includes("Risk") ? "risk" : "default"}
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
                    "all",
                    "at_risk",
                    "mine"
                  ] as const
                ).map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setFilter(entry)}
                    className={cn(
                      "px-4 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all border",
                      filter === entry 
                        ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/10" 
                        : "bg-white text-slate-600 border-slate-100 hover:border-slate-300"
                    )}
                  >
                    {followUpFilterLabels[entry]}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void loadQueue()}
                  className="p-2 bg-slate-50 text-slate-400 hover:text-primary transition-colors rounded-xl"
                  title="Refresh items"
                >
                  <RefreshCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            <SectionDisclosure title="Advanced controls & bulk tools" storageKey="follow-up-controls-shortcuts" defaultCollapsed>
              <div className="pt-4 space-y-6">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      "unassigned",
                      "overdue",
                      "today",
                      "soon",
                      "assigned"
                    ] as const
                  ).map((entry) => (
                    <button
                      key={entry}
                      type="button"
                      onClick={() => setFilter(entry)}
                      className={cn(
                        "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all border",
                        filter === entry 
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm" 
                          : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                      )}
                    >
                      {followUpFilterLabels[entry]}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-md border border-slate-100 bg-white/50 px-2 py-1 text-slate-400 font-bold uppercase tracking-tighter">Total {ownershipSnapshot.all}</span>
                  <span className="rounded-md border border-amber-100 bg-amber-50/50 px-2 py-1 text-amber-600 font-bold uppercase tracking-tighter">At Risk {ownershipSnapshot.atRisk}</span>
                </div>

                <QueueBulkActionBar
                  selectedCount={selectedIds.length}
                  onClear={() => setSelectedIds([])}
                  actions={[
                    { key: "bulk-done", label: bulkBusy ? "Working..." : "Mark done", disabled: bulkBusy, onClick: () => void runBulkAction("done") },
                    { key: "bulk-assign", label: bulkBusy ? "Working..." : "Assign to me", disabled: bulkBusy || !meId, onClick: () => void runBulkAction("assignMe") }
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
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Loading follow-up queue...</p>
            </div>
          ) : error ? (
            <QueueSurfaceStateCard kind="error" message={error} />
          ) : visibleQueue.length === 0 ? (
            <QueueSurfaceStateCard
              kind="empty"
              title={emptyStateCopy.title}
              message={emptyStateCopy.message}
              onAction={() => {
                if (hasNarrowFilter) {
                  setFilter("all");
                  return;
                }
                void loadQueue();
              }}
            />
          ) : (
            <div className="glass-card inner-glow rounded-[2rem] overflow-hidden">
              <ActionQueueTable
                title="Follow-Up Management"
                rows={followUpRows}
                viewAllHref={buildWorkflowHref("/app/follow-up", { source: "follow-up", returnTo, returnLabel: "Follow-up Queue" })}
              />
            </div>
          )}
        </div>

        {/* Focus / Sidebar Preview Panel */}
        <aside className="lg:col-span-4 space-y-6 animate-fade-slide-up [animation-delay:200ms]">
          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
              <span className="material-symbols-outlined text-[120px]">flag</span>
            </div>
            
            {previewItem ? (
              <div className="relative z-10 space-y-8">
                <header>
                  <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest mb-2">Focused Item</p>
                  <h4 className="text-xl font-black font-headline text-on-surface tracking-tight leading-tight uppercase line-clamp-2">{previewItem.task?.title || previewItem.reason}</h4>
                  <p className="mt-1 text-xs font-semibold text-on-surface-variant/60">{previewItem.reason}</p>
                </header>

                <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100/50 space-y-3">
                  <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">Recommended Action</p>
                  <p className="text-sm font-black text-on-surface leading-tight">
                    {triage.data?.recommendation?.action || (previewItem.status === "OPEN" ? "Complete follow-up now" : "Reopen if unresolved")}
                  </p>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">Ownership & Timing</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Owner</p>
                      <p className="text-[11px] font-black text-slate-700">{previewItem.task?.assignedToUser?.email?.split('@')[0] || "Unassigned"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Due</p>
                      <p className="text-[11px] font-black text-slate-700">{dueLabel(previewItem.task?.dueAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">Actions</p>
                  <div className="flex flex-wrap gap-2">
                    <QueueActionButton
                      size="sm"
                      className="px-5 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary transition-all shadow-md"
                      disabled={actionBusyId === previewItem.id}
                      onClick={() => void runQueueAction(previewItem, previewItem.status === "OPEN" ? "done" : "open")}
                    >
                      {previewItem.status === "OPEN" ? "Mark resolved" : "Reopen item"}
                    </QueueActionButton>
                    
                    {previewItem.entityType && previewItem.entityId ? (
                      <QueueActionLink
                        size="sm"
                        className="px-5 py-2.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all font-bold"
                        href={buildWorkflowHref(queueEntityHref(previewItem), { source: "follow-up", returnTo: localReturnTo, returnLabel: "Follow-up Queue" })}
                      >
                        Open entity
                      </QueueActionLink>
                    ) : null}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-50">
                  <ContextualShortcutHints items={previewShortcutHints} />
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-center">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-300">Select an item to<br />load context</p>
              </div>
            )}
          </div>
          
          <SectionDisclosure title="Focused Diagnostics" storageKey="follow-up-focused-diagnostics" defaultCollapsed>
            <div className="pt-4 space-y-4">
              {previewItem ? (
                <div className="space-y-3 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                  <div className="flex justify-between"><span>Status</span> <span className={cn("text-on-surface", previewItem.status === "OPEN" ? "text-amber-600" : "text-emerald-600")}>{previewItem.status}</span></div>
                  <div className="flex justify-between"><span>Priority</span> <span className="text-on-surface">{previewItem.task?.priority || "MEDIUM"}</span></div>
                  <div className="flex justify-between"><span>Latest event</span> <span className="text-on-surface text-right">{triage.recentEvents[0]?.label || "-"}</span></div>
                </div>
              ) : null}
            </div>
          </SectionDisclosure>
        </aside>
      </div>
    </div>
  );
}
