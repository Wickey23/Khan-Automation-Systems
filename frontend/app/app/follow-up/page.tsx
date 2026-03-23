"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { executeAiTool, fetchFollowUpQueue, getMe, updateAiTask, updateFollowUpQueueItem } from "@/lib/api";
import type { FollowUpQueueItem } from "@/lib/types";
import { PageShell, SectionShell } from "@/components/ui/page";
import { CommandHeader } from "@/components/ops";
import { buildReturnTo, buildWorkflowHref, normalizeReturnTo, sourceToLabel } from "@/lib/workflow-nav";
import { ContextualShortcutHints, QueueActionButton, QueueActionLink, QueueBulkActionBar, QueueShortcutHint, QueueSurfaceStateCard, QueueTriagePanel } from "@/components/queue";
import { useQueueTriageEnrichment } from "@/lib/hooks/use-queue-triage-enrichment";
import { markDailyReviewDirty } from "@/lib/review-loop";
import { FOLLOW_UP_FILTER_LABELS } from "@/lib/operational-language";
import { useOperationalShortcuts } from "@/lib/hooks/use-operational-shortcuts";
import { resolvePostActionFocus } from "@/lib/queue-focus";
import { WorkflowReturnBanner } from "@/components/queue/workflow-return-banner";
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
  const source = searchParams.get("source") || "";
  const returnTo = normalizeReturnTo(searchParams.get("returnTo"));
  const returnLabel = searchParams.get("returnLabel") || sourceToLabel(source);
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
          ownerState === "mine" ? "You" : ownerState === "assigned_elsewhere" ? item.task?.assignedToUser?.email || "Assigned" : "Unassigned";
        const isOverdue = isItemOverdue(item);
        const risks = riskFlags(item, meId);
        const rowSeverity = isOverdue || risks.length ? "high" : item.task?.priority || "medium";
        const relatedEntityHref = queueEntityHref(item);
        const relatedApprovalsHref =
          item.entityType && item.entityId
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
    <PageShell>
      <CommandHeader
        eyebrow="AI Operations"
        title="Follow-Up Queue"
        description="Operational follow-up items created by AI workflows and human actions."
        actions={
          <QueueActionLink href={buildWorkflowHref("/app/follow-up?status=overdue", { source: "follow-up", returnTo: localReturnTo, returnLabel: "Follow-up Queue" })}>
            Open overdue follow-up
          </QueueActionLink>
        }
      />

      <SectionShell>
        {queueUpdateNote ? (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            {queueUpdateNote}
          </div>
        ) : null}
        <div className="mb-3">
          <WorkflowReturnBanner returnTo={returnTo} returnLabel={returnLabel} />
        </div>
        <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {followUpSummaryStrip.map((metric) => (
            <KpiCard key={metric.label} label={metric.label} value={String(metric.value)} detail={metric.note} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              "all",
              "at_risk",
              "mine",
              "unassigned",
              "overdue"
            ] as const
          ).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setFilter(entry)}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold ${filter === entry ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}
            >
              {followUpFilterLabels[entry]}
            </button>
          ))}
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
            onClick={() => void loadQueue()}
          >
            Refresh
          </button>
        </div>
        <SectionDisclosure title="Advanced controls and bulk tools" storageKey="follow-up-controls-shortcuts" defaultCollapsed className="mb-3">
          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                "overdue_mine",
                "overdue_unassigned",
                "today",
                "soon",
                "assigned"
              ] as const
            ).map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setFilter(entry)}
                className={`rounded-lg border px-3 py-1 text-xs font-semibold ${filter === entry ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}
              >
                {followUpFilterLabels[entry]}
              </button>
            ))}
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
              onClick={async () => {
                await executeAiTool({ toolKey: "build_callback_queue", agentKey: "task_followup", entityType: "organization", input: { limit: 30 } });
                await loadQueue();
              }}
            >
              Build callback queue
            </button>
            {visibleQueue.length ? (
              <>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                  onClick={() => setSelectedIds(visibleQueue.map((item) => item.id))}
                >
                  Select visible
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                  disabled={!selectedIds.length}
                  onClick={() => setSelectedIds([])}
                >
                  Clear selection
                </button>
              </>
            ) : null}
          </div>
          <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600">All {ownershipSnapshot.all}</span>
            <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">Mine {ownershipSnapshot.mine}</span>
            <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600">Unassigned {ownershipSnapshot.unassigned}</span>
            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">Overdue mine {ownershipSnapshot.overdueMine}</span>
            <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-700">Overdue unassigned {ownershipSnapshot.overdueUnassigned}</span>
            <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">At risk {ownershipSnapshot.atRisk}</span>
          </div>
          <QueueBulkActionBar
            selectedCount={selectedIds.length}
            onClear={() => setSelectedIds([])}
            actions={[
              { key: "bulk-done", label: bulkBusy ? "Working..." : "Mark done", disabled: bulkBusy, onClick: () => void runBulkAction("done") },
              { key: "bulk-open", label: bulkBusy ? "Working..." : "Reopen", disabled: bulkBusy, onClick: () => void runBulkAction("open") },
              {
                key: "bulk-assign",
                label: bulkBusy ? "Working..." : "Assign to me",
                disabled: bulkBusy || !meId || !selectedItems.some((item) => item.task?.id),
                onClick: () => void runBulkAction("assignMe")
              },
              {
                key: "bulk-escalate",
                label: bulkBusy ? "Working..." : "Escalate overdue",
                tone: "warning",
                disabled: bulkBusy || !selectedItems.some((item) => item.task?.id && isItemOverdue(item)),
                onClick: () => void runBulkAction("escalate")
              }
            ]}
          />
          <QueueShortcutHint
            summary="Shortcuts apply to the focused queue item."
            items={[
              { keys: "J / K", label: "Move focus" },
              { keys: "Enter", label: "Open linked entity" },
              { keys: "Alt+D", label: "Mark done / reopen" },
              { keys: "Alt+A", label: "Assign to me (eligible)" },
              { keys: "Alt+E", label: "Escalate overdue (eligible)" }
            ]}
          />
        </SectionDisclosure>
        {busy ? <QueueSurfaceStateCard kind="loading" message="Loading follow-up items..." /> : null}

        {!busy && error ? <QueueSurfaceStateCard kind="error" message={error} /> : null}

        {!busy && !error && visibleQueue.length === 0 ? (
          <QueueSurfaceStateCard
            kind="empty"
            title={emptyStateCopy.title}
            message={emptyStateCopy.message}
            actionLabel={hasNarrowFilter ? "View all follow-up" : queue.length === 0 ? "Open Calls" : "Build callback queue"}
            actionHref={!hasNarrowFilter && queue.length === 0 ? buildWorkflowHref("/app/calls", { source: "follow-up", returnTo: localReturnTo, returnLabel: "Follow-up Queue" }) : undefined}
            onAction={() => {
              if (hasNarrowFilter) {
                setFilter("all");
                return;
              }
              if (queue.length === 0) return;
              void (async () => {
                await executeAiTool({ toolKey: "build_callback_queue", agentKey: "task_followup", entityType: "organization", input: { limit: 30 } });
                await loadQueue();
              })();
            }}
          />
        ) : null}

        {!busy && !error && visibleQueue.length > 0 ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <ActionQueueTable
                title="Follow-Up Queue"
                rows={followUpRows}
                viewAllHref={buildWorkflowHref("/app/follow-up", { source: "follow-up", returnTo: localReturnTo, returnLabel: "Follow-up Queue" })}
              />
              <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                {previewItem ? (
                  <>
                    <section className="space-y-1 border-b border-slate-200 pb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Selected follow-up</p>
                      <p className="text-sm font-semibold text-slate-900">{previewItem.task?.title || previewItem.reason}</p>
                      <p className="text-xs text-slate-600">{previewItem.reason}</p>
                    </section>
                    <section className="space-y-1 border-b border-slate-200 pb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Owner and due context</p>
                      <p className="text-xs text-slate-700">
                        Owner: {previewItem.task?.assignedToUser?.email || "Unassigned"}
                      </p>
                      <p className="text-xs text-slate-700">Due: {dueLabel(previewItem.task?.dueAt)}</p>
                    </section>
                    <section className="space-y-1 border-b border-slate-200 pb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Recommended next action</p>
                      <p className="text-sm font-medium text-slate-900">
                        {triage.data?.recommendation?.action || (previewItem.status === "OPEN" ? "Complete follow-up now" : "Reopen if unresolved")}
                      </p>
                    </section>
                    <section className="space-y-2 border-b border-slate-200 pb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Related workflow context</p>
                      <div className="flex flex-wrap gap-2">
                        {previewItem.entityType && previewItem.entityId ? (
                          <QueueActionLink
                            size="sm"
                            href={buildWorkflowHref(
                              previewItem.entityType === "message_thread"
                                ? `/app/messages?threadId=${encodeURIComponent(previewItem.entityId)}`
                                : previewItem.entityType === "call"
                                  ? `/app/calls?callId=${encodeURIComponent(previewItem.entityId)}`
                                  : `/app/leads?leadId=${encodeURIComponent(previewItem.entityId)}`,
                              { source: "follow-up", returnTo: localReturnTo, returnLabel: "Follow-up Queue" }
                            )}
                          >
                            Open entity
                          </QueueActionLink>
                        ) : null}
                        <QueueActionButton
                          size="sm"
                          disabled={actionBusyId === previewItem.id}
                          onClick={() => void runQueueAction(previewItem, previewItem.status === "OPEN" ? "done" : "open")}
                        >
                          {previewItem.status === "OPEN" ? "Mark done" : "Reopen"}
                        </QueueActionButton>
                      </div>
                    </section>
                    <section className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Recent activity</p>
                      <p className="text-xs text-slate-600">
                        {triage.loading
                          ? "Loading activity..."
                          : triage.recentEvents.length
                            ? triage.recentEvents
                                .slice(0, 4)
                                .map((event) => `${event.label} - ${new Date(event.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`)
                                .join(" | ")
                            : "No recent events."}
                      </p>
                    </section>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Select a follow-up item to load context.</p>
                )}
              </aside>
            </div>
          {previewItem ? (
            <SectionDisclosure title="Focused Follow-Up Diagnostics" storageKey="follow-up-focused-diagnostics" className="mt-4">
            <QueueTriagePanel
              title={previewItem.task?.title || previewItem.reason}
              subtitle={previewItem.reason}
              badges={[
                { label: previewItem.status, tone: previewItem.status === "OPEN" ? "warning" : "success" },
                { label: previewItem.task?.priority || "MEDIUM", tone: previewItem.task?.priority === "URGENT" ? "critical" : "default" },
                ...(previewItem.task?.dueAt && new Date(previewItem.task.dueAt).getTime() < Date.now() ? [{ label: "overdue", tone: "critical" as const }] : [])
              ]}
                sections={[
                { title: "Task / queue state", content: `Status ${previewItem.status}, assignee ${previewItem.task?.assignedToUser?.email || "unassigned"}` },
                {
                  title: "Ownership",
                  content:
                    ownershipState(previewItem, meId) === "mine"
                      ? "Assigned to you."
                      : ownershipState(previewItem, meId) === "unassigned"
                        ? "No owner assigned yet."
                        : `Assigned to ${previewItem.task?.assignedToUser?.email || "teammate"}.`
                },
                {
                  title: "At risk signals",
                  content: (() => {
                    const flags = riskFlags(previewItem, meId);
                    if (!flags.length) return "No at risk flags.";
                    const labels = flags.map((flag) => {
                      if (flag === "overdue_unassigned") return "Overdue and unassigned";
                      if (flag === "overdue_assigned_stale") return "Overdue and assigned but stale";
                      if (flag === "open_too_long") return "Open too long without movement";
                      if (flag === "escalated_overdue") return "Escalated overdue item";
                      return flag;
                    });
                    return labels.join(", ");
                  })()
                },
                { title: "Due", content: previewItem.task?.dueAt ? new Date(previewItem.task.dueAt).toLocaleString() : "No due date" },
                { title: "Linked entity", content: previewItem.entityType && previewItem.entityId ? `${previewItem.entityType} ${previewItem.entityId}` : "Not linked" },
                {
                  title: "Entity recommendation",
                  content: triage.loading
                    ? "Loading recommendation..."
                    : triage.data?.recommendation?.action
                      ? `${triage.data.recommendation.action}${triage.data.recommendation.priority ? ` (${triage.data.recommendation.priority})` : ""}`
                      : "No recommendation available."
                },
                {
                  title: "Attention / approvals",
                  content: `${triage.data?.attention?.attentionLevel || "-"} / pending approvals ${(triage.data?.approvals || []).filter((item) => item.status === "PENDING").length}`
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
                  {previewItem.entityType && previewItem.entityId ? (
                    <QueueActionLink
                      href={buildWorkflowHref(
                        previewItem.entityType === "message_thread"
                          ? `/app/messages?threadId=${encodeURIComponent(previewItem.entityId)}`
                          : previewItem.entityType === "call"
                            ? `/app/calls?callId=${encodeURIComponent(previewItem.entityId)}`
                            : `/app/leads?leadId=${encodeURIComponent(previewItem.entityId)}`,
                        { source: "follow-up", returnTo: localReturnTo, returnLabel: "Follow-up Queue" }
                      )}
                    >
                      Open entity
                    </QueueActionLink>
                  ) : null}
                  {previewItem.entityType && previewItem.entityId ? (
                    <QueueActionLink
                      href={buildWorkflowHref(
                        "/app/approvals?status=PENDING",
                        { source: "follow-up", returnTo: localReturnTo, returnLabel: "Follow-up Queue" },
                        previewItem.entityType === "message_thread"
                          ? { threadId: previewItem.entityId }
                          : previewItem.entityType === "call"
                            ? { callId: previewItem.entityId }
                          : { leadId: previewItem.entityId }
                      )}
                    >
                      Open approvals
                    </QueueActionLink>
                  ) : null}
                  <QueueActionButton
                    disabled={actionBusyId === previewItem.id}
                    onClick={() => void runQueueAction(previewItem, previewItem.status === "OPEN" ? "done" : "open")}
                  >
                    {previewItem.status === "OPEN" ? "Mark done" : "Reopen"}
                  </QueueActionButton>
                  <QueueActionButton
                    disabled={actionBusyId === previewItem.id || !previewItem.task?.id}
                    onClick={() => void runQueueAction(previewItem, "assignMe")}
                  >
                    Assign to me
                  </QueueActionButton>
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


