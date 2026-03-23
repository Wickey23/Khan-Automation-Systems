"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { approveAiAction, fetchAiApprovals, rejectAiAction, retryAiApprovalSend } from "@/lib/api";
import type { ApprovalRequest } from "@/lib/types";
import { PageShell, SectionShell } from "@/components/ui/page";
import { CommandHeader } from "@/components/ops";
import { buildReturnTo, buildWorkflowHref, normalizeReturnTo, sourceToLabel } from "@/lib/workflow-nav";
import { ContextualShortcutHints, QueueActionButton, QueueActionLink, QueueShortcutHint, QueueSurfaceStateCard, QueueTriagePanel } from "@/components/queue";
import { useQueueTriageEnrichment } from "@/lib/hooks/use-queue-triage-enrichment";
import { markDailyReviewDirty } from "@/lib/review-loop";
import { APPROVAL_FOCUS_LABELS, OPERATIONAL_LABELS, formatApprovalStatusLabel } from "@/lib/operational-language";
import { useOperationalShortcuts } from "@/lib/hooks/use-operational-shortcuts";
import { resolvePostActionFocus } from "@/lib/queue-focus";
import { WorkflowReturnBanner } from "@/components/queue/workflow-return-banner";
import { ActionQueueTable, RiskRailCard, SectionDisclosure, ageFromDate, priorityToSeverity, statusToOperatorState } from "@/components/ops";

type DraftEditState = {
  subject: string;
  content: string;
  mode: "SEND_NOW" | "APPROVE_ONLY";
};

type ApprovalFocusFilter = "all" | "needs_review" | "needs_retry" | "in_delivery" | "completed";

const approvalStatusValues = ["", "PENDING", "APPROVED", "REJECTED"] as const;
const approvalFocusValues: ApprovalFocusFilter[] = ["all", "needs_review", "needs_retry", "in_delivery", "completed"];

function parseApprovalStatusFilter(value: string | null) {
  if (!value) return "";
  return (approvalStatusValues as readonly string[]).includes(value) ? value : "";
}

function parseApprovalFocusFilter(value: string | null): ApprovalFocusFilter {
  if (!value) return "all";
  return approvalFocusValues.includes(value as ApprovalFocusFilter) ? (value as ApprovalFocusFilter) : "all";
}

function isNeedsRetry(approval: ApprovalRequest) {
  return approval.status === "APPROVED" && approval.deliveryStatus === "FAILED" && approval.retryable;
}

function isInDelivery(approval: ApprovalRequest) {
  return approval.status === "APPROVED" && (approval.deliveryStatus === "QUEUED" || approval.deliveryStatus === "SENDING");
}

function approvalRank(approval: ApprovalRequest) {
  if (approval.status === "PENDING") return 0;
  if (isNeedsRetry(approval)) return 1;
  if (approval.status === "APPROVED" && approval.deliveryStatus === "FAILED") return 2;
  if (isInDelivery(approval)) return 3;
  if (approval.status === "APPROVED") return 4;
  if (approval.status === "REJECTED") return 5;
  return 6;
}

function toApprovalRowStatus(approval: ApprovalRequest) {
  if (approval.status === "PENDING") return { label: OPERATIONAL_LABELS.needsReview, tone: "limited" as const };
  if (isNeedsRetry(approval)) return { label: OPERATIONAL_LABELS.needsRetry, tone: "requires_review" as const };
  if (approval.status === "APPROVED" && approval.deliveryStatus === "FAILED") {
    return { label: "Send failed", tone: "requires_review" as const };
  }
  if (isInDelivery(approval)) return { label: "In delivery", tone: "limited" as const };
  if (approval.status === "APPROVED" && approval.deliveryStatus === "SENT") return { label: "Sent", tone: "ready" as const };
  if (approval.status === "REJECTED" || approval.status === "EXPIRED") return { label: formatApprovalStatusLabel(approval.status), tone: "requires_review" as const };
  return { label: formatApprovalStatusLabel(approval.status), tone: "ready" as const };
}

function approvalDecisionHint(approval: ApprovalRequest) {
  if (approval.status === "PENDING") {
    return approval.deliveryChannel
      ? "Review content and choose Approve and send or Approve only."
      : "Review the request and approve only if entity context is still valid.";
  }
  if (isNeedsRetry(approval)) return "Delivery failed and is retryable. Use Retry send now after confirming context.";
  if (approval.status === "APPROVED" && approval.deliveryStatus === "FAILED") return "Delivery failed and is not marked retryable. Review failure details first.";
  if (isInDelivery(approval)) return "Delivery is in progress. No action needed unless it stalls.";
  if (approval.status === "APPROVED" && approval.deliveryStatus === "SENT") return "Completed successfully.";
  if (approval.status === "REJECTED") return "Rejected by operator.";
  return "No immediate action required.";
}

function parseDraft(approval: ApprovalRequest): DraftEditState {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = approval.inputSummary ? (JSON.parse(approval.inputSummary) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }

  const subject = approval.approvedSubject || (typeof parsed.subject === "string" ? parsed.subject : "");
  const content =
    approval.approvedContent ||
    (typeof parsed.content === "string"
      ? parsed.content
      : typeof parsed.draft === "string"
        ? parsed.draft
        : typeof parsed.body === "string"
          ? parsed.body
          : approval.inputSummary || "");

  return {
    subject,
    content,
    mode: "SEND_NOW"
  };
}

export default function ApprovalsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedApprovalId = searchParams.get("approvalId") || "";
  const statusFilter = parseApprovalStatusFilter(searchParams.get("status"));
  const focusFilter = parseApprovalFocusFilter(searchParams.get("focus"));
  const source = searchParams.get("source") || "";
  const returnTo = normalizeReturnTo(searchParams.get("returnTo"));
  const returnLabel = searchParams.get("returnLabel") || sourceToLabel(source);
  const [busy, setBusy] = useState(true);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [draftEdits, setDraftEdits] = useState<Record<string, DraftEditState>>({});
  const [previewApprovalId, setPreviewApprovalId] = useState(selectedApprovalId);
  const [queueUpdateNote, setQueueUpdateNote] = useState<string | null>(null);
  const [pendingFocusUpdate, setPendingFocusUpdate] = useState<{
    actionLabel: string;
    actedId: string;
    previousIds: string[];
  } | null>(null);
  const hasAppliedDeepLinkScroll = useRef(false);
  const visibleApprovalIdsRef = useRef<string[]>([]);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetchAiApprovals(statusFilter || undefined);
      setApprovals(response.approvals);
      setDraftEdits((current) => {
        const next = { ...current };
        for (const approval of response.approvals) {
          if (!next[approval.id]) {
            next[approval.id] = parseDraft(approval);
          }
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load approvals.");
    } finally {
      setBusy(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedApprovalId) return;
    if (hasAppliedDeepLinkScroll.current) return;
    const timeout = setTimeout(() => {
      const element = document.getElementById(`approval-${selectedApprovalId}`);
      if (!element) return;
      hasAppliedDeepLinkScroll.current = true;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => clearTimeout(timeout);
  }, [busy, selectedApprovalId, approvals.length]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!statusFilter) params.delete("status");
    if (focusFilter === "all") params.delete("focus");
    else params.set("focus", focusFilter);
    if (previewApprovalId) params.set("approvalId", previewApprovalId);
    else params.delete("approvalId");
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    const currentUrl = buildReturnTo(pathname, searchParams);
    if (nextUrl !== currentUrl) router.replace(nextUrl, { scroll: false });
  }, [focusFilter, pathname, previewApprovalId, router, searchParams, statusFilter]);

  function entityHref(approval: ApprovalRequest) {
    if (!approval.entityType || !approval.entityId) return "";
    if (approval.entityType === "call") return `/app/calls?callId=${encodeURIComponent(approval.entityId)}`;
    if (approval.entityType === "lead") return `/app/leads?leadId=${encodeURIComponent(approval.entityId)}`;
    if (approval.entityType === "message_thread") return `/app/messages?threadId=${encodeURIComponent(approval.entityId)}`;
    return "";
  }

  const decide = useCallback(async (approvalRequestId: string, mode: "approve" | "reject", approveMode?: "SEND_NOW" | "APPROVE_ONLY") => {
    if (actionBusyId) return;
    setActionBusyId(approvalRequestId);
    const previousIds = visibleApprovalIdsRef.current;
    try {
      if (mode === "approve") {
        const edit = draftEdits[approvalRequestId];
        await approveAiAction(approvalRequestId, {
          mode: approveMode || edit?.mode || "SEND_NOW",
          editedSubject: edit?.subject || undefined,
          editedContent: edit?.content || undefined
        });
      } else {
        await rejectAiAction(approvalRequestId);
      }
      markDailyReviewDirty("approvals");
      await load();
      setPendingFocusUpdate({
        actionLabel: mode === "approve" ? "Approval updated" : "Approval rejected",
        actedId: approvalRequestId,
        previousIds
      });
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Failed to update approval.");
    } finally {
      setActionBusyId(null);
    }
  }, [actionBusyId, draftEdits, load]);

  const retrySend = useCallback(async (approvalRequestId: string) => {
    if (actionBusyId) return;
    setActionBusyId(approvalRequestId);
    const previousIds = visibleApprovalIdsRef.current;
    try {
      await retryAiApprovalSend(approvalRequestId);
      markDailyReviewDirty("retry_send");
      await load();
      setPendingFocusUpdate({
        actionLabel: "Retry requested",
        actedId: approvalRequestId,
        previousIds
      });
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Failed to retry send.");
    } finally {
      setActionBusyId(null);
    }
  }, [actionBusyId, load]);

  const sortedApprovals = useMemo(
    () =>
      [...approvals].sort((a, b) => {
        const rankDiff = approvalRank(a) - approvalRank(b);
        if (rankDiff !== 0) return rankDiff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }),
    [approvals]
  );

  const visibleApprovals = useMemo(
    () =>
      sortedApprovals.filter((item) => {
        if (focusFilter === "all") return true;
        if (focusFilter === "needs_review") return item.status === "PENDING";
        if (focusFilter === "needs_retry") return isNeedsRetry(item);
        if (focusFilter === "in_delivery") return isInDelivery(item);
        return item.status === "APPROVED" || item.status === "REJECTED" || item.status === "EXPIRED";
      }),
    [focusFilter, sortedApprovals]
  );
  useEffect(() => {
    visibleApprovalIdsRef.current = visibleApprovals.map((item) => item.id);
  }, [visibleApprovals]);

  useEffect(() => {
    if (!pendingFocusUpdate) return;
    const nextIds = visibleApprovals.map((item) => item.id);
    const resolution = resolvePostActionFocus(pendingFocusUpdate.previousIds, nextIds, pendingFocusUpdate.actedId);
    setPreviewApprovalId(resolution.nextId);
    const message =
      resolution.outcome === "kept"
        ? `${pendingFocusUpdate.actionLabel}. Focus kept on current item.`
        : resolution.outcome === "moved"
          ? `${pendingFocusUpdate.actionLabel}. Focus moved to the next item in this view.`
          : `${pendingFocusUpdate.actionLabel}. No more matching items in this view.`;
    setQueueUpdateNote(message);
    window.setTimeout(() => setQueueUpdateNote(null), 2600);
    setPendingFocusUpdate(null);
  }, [pendingFocusUpdate, visibleApprovals]);

  useEffect(() => {
    if (!visibleApprovals.length) {
      setPreviewApprovalId("");
      return;
    }
    if (!previewApprovalId) {
      setPreviewApprovalId(selectedApprovalId || visibleApprovals[0].id);
      return;
    }
    if (!visibleApprovals.some((item) => item.id === previewApprovalId)) {
      setPreviewApprovalId(visibleApprovals[0].id);
    }
  }, [previewApprovalId, selectedApprovalId, visibleApprovals]);

  const localReturnTo = buildReturnTo(pathname, searchParams);
  const previewApproval = visibleApprovals.find((item) => item.id === previewApprovalId) || null;
  const pendingCount = useMemo(() => approvals.filter((item) => item.status === "PENDING").length, [approvals]);
  const retryableFailedCount = useMemo(() => approvals.filter((item) => isNeedsRetry(item)).length, [approvals]);
  const approvalRows = useMemo(
    () =>
      visibleApprovals.map((approval) => {
        const state = toApprovalRowStatus(approval);
        const primaryActionLabel =
          approval.status === "PENDING"
            ? "Approve & send"
            : isNeedsRetry(approval)
              ? "Retry send"
              : entityHref(approval)
                ? "Open entity"
                : "Open approval";
        return {
          id: approval.id,
          item: approval.toolKey,
          owner: approval.status === "PENDING" ? "Pending review" : "Operator reviewed",
          due: approval.status === "PENDING" ? "Now" : new Date(approval.updatedAt).toLocaleString(),
          ageLabel: ageFromDate(approval.createdAt),
          severity: priorityToSeverity(state.tone),
          status: statusToOperatorState(state.label),
          onPrimaryAction:
            approval.status === "PENDING"
              ? () => void decide(approval.id, "approve", "SEND_NOW")
              : isNeedsRetry(approval)
                ? () => void retrySend(approval.id)
                : undefined,
          primaryActionDisabled: actionBusyId === approval.id,
          href:
            approval.status === "PENDING"
              ? undefined
              : isNeedsRetry(approval)
                ? undefined
                : buildWorkflowHref(
                    entityHref(approval) || `/app/approvals?approvalId=${encodeURIComponent(approval.id)}`,
                    { source: "approvals", returnTo: returnTo || localReturnTo, returnLabel: "Approval Queue" }
                  ),
          primaryActionLabel,
          secondaryActions: [
            ...(approval.status === "PENDING"
              ? [
                  { label: "Approve only", onClick: () => void decide(approval.id, "approve", "APPROVE_ONLY") },
                  { label: "Reject", onClick: () => void decide(approval.id, "reject") }
                ]
              : []),
            ...(entityHref(approval)
              ? [
                  {
                    label: "Open entity",
                    href: buildWorkflowHref(entityHref(approval), {
                      source: "approvals",
                      returnTo: returnTo || localReturnTo,
                      returnLabel: "Approval Queue"
                    })
                  }
                ]
              : []),
            {
              label: "Open approval",
              href: buildWorkflowHref(`/app/approvals?approvalId=${encodeURIComponent(approval.id)}`, {
                source: "approvals",
                returnTo: returnTo || localReturnTo,
                returnLabel: "Approval Queue"
              })
            }
          ],
          detail: approvalDecisionHint(approval),
          onRowSelect: () => setPreviewApprovalId(approval.id),
          onRowFocus: () => setPreviewApprovalId(approval.id),
          rowAriaLabel: `${approval.toolKey}. ${approval.status}.`
        };
      }),
    [actionBusyId, decide, localReturnTo, returnTo, retrySend, visibleApprovals]
  );
  const approvalRiskItems = useMemo(
    () => [
      {
        id: "pending-review",
        title: "Pending review",
        detail: `${pendingCount} requests still awaiting operator decision.`,
        level: "warning" as const
      },
      {
        id: "failed-retry",
        title: "Retryable failures",
        detail: `${retryableFailedCount} delivery failures can be retried now.`,
        level: retryableFailedCount > 0 ? ("critical" as const) : ("warning" as const),
        meter: Math.min(100, retryableFailedCount * 20)
      }
    ],
    [pendingCount, retryableFailedCount]
  );
  const triage = useQueueTriageEnrichment(previewApproval?.entityType, previewApproval?.entityId);
  const visibleApprovalIds = useMemo(() => visibleApprovals.map((item) => item.id), [visibleApprovals]);
  const previewShortcutHints = useMemo(() => {
    if (!previewApproval) return [] as Array<{ keys: string; label: string }>;
    const hints: Array<{ keys: string; label: string }> = [];
    if (previewApproval.status === "PENDING" && !actionBusyId) {
      hints.push({ keys: "Alt+S", label: "Approve & send" });
      hints.push({ keys: "Alt+O", label: "Approve only" });
      hints.push({ keys: "Alt+X", label: "Reject" });
    }
    if (
      previewApproval.status === "APPROVED" &&
      previewApproval.retryable &&
      !actionBusyId &&
      (previewApproval.deliveryStatus === "FAILED" || previewApproval.deliveryStatus === "QUEUED")
    ) {
      hints.push({ keys: "Alt+R", label: "Retry send" });
    }
    if (entityHref(previewApproval)) {
      hints.push({ keys: "Enter", label: "Open related entity" });
    }
    return hints;
  }, [actionBusyId, previewApproval]);

  useOperationalShortcuts({
    itemIds: visibleApprovalIds,
    focusedId: previewApprovalId,
    setFocusedId: setPreviewApprovalId,
    onEnter: () => {
      if (!previewApproval) return;
      const href = entityHref(previewApproval);
      if (!href) return;
      router.push(buildWorkflowHref(href, { source: "approvals", returnTo: localReturnTo, returnLabel: "Approval Queue" }));
    },
    bindings: [
      {
        key: "s",
        altKey: true,
        onTrigger: () => {
          if (!previewApproval || previewApproval.status !== "PENDING" || actionBusyId) return;
          void decide(previewApproval.id, "approve", "SEND_NOW");
        }
      },
      {
        key: "o",
        altKey: true,
        onTrigger: () => {
          if (!previewApproval || previewApproval.status !== "PENDING" || actionBusyId) return;
          void decide(previewApproval.id, "approve", "APPROVE_ONLY");
        }
      },
      {
        key: "x",
        altKey: true,
        onTrigger: () => {
          if (!previewApproval || previewApproval.status !== "PENDING" || actionBusyId) return;
          void decide(previewApproval.id, "reject");
        }
      },
      {
        key: "r",
        altKey: true,
        onTrigger: () => {
          if (!previewApproval || previewApproval.status !== "APPROVED" || !previewApproval.retryable || actionBusyId) return;
          if (previewApproval.deliveryStatus !== "FAILED" && previewApproval.deliveryStatus !== "QUEUED") return;
          void retrySend(previewApproval.id);
        }
      }
    ]
  });

  return (
    <PageShell>
      <CommandHeader
        eyebrow="AI Operations"
        title="Approval Queue"
        description="Review and approve AI actions before external communication or sensitive mutations execute."
      />

      <SectionShell>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">
            {pendingCount} requests pending approval. {retryableFailedCount} failed delivery{retryableFailedCount === 1 ? "" : "s"} ready for retry.
          </p>
          <QueueShortcutHint
            className="mt-2"
            summary="Use row focus to review and act faster."
            items={[
              { keys: "J / K", label: "Move focus" },
              { keys: "Enter", label: "Open related entity" },
              { keys: "Alt+S", label: "Approve & send" },
              { keys: "Alt+O", label: "Approve only" },
              { keys: "Alt+X", label: "Reject" },
              { keys: "Alt+R", label: "Retry send (eligible)" }
            ]}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {(["", "PENDING", "APPROVED", "REJECTED"] as const).map((status) => (
              <Link
                key={status || "ALL"}
                href={buildWorkflowHref(status ? `/app/approvals?status=${status}` : "/app/approvals", { source, returnTo, returnLabel })}
                className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                  (status || "") === statusFilter ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"
                }`}
              >
                {status ? formatApprovalStatusLabel(status) : "All"}
              </Link>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                { key: "all", label: APPROVAL_FOCUS_LABELS.all },
                { key: "needs_review", label: APPROVAL_FOCUS_LABELS.needs_review },
                { key: "needs_retry", label: APPROVAL_FOCUS_LABELS.needs_retry },
                { key: "in_delivery", label: APPROVAL_FOCUS_LABELS.in_delivery },
                { key: "completed", label: APPROVAL_FOCUS_LABELS.completed }
              ] as Array<{ key: ApprovalFocusFilter; label: string }>
            ).map((entry) => (
              <Link
                key={entry.key}
                href={buildWorkflowHref(
                  entry.key === "all"
                    ? statusFilter
                      ? `/app/approvals?status=${encodeURIComponent(statusFilter)}`
                      : "/app/approvals"
                    : statusFilter
                      ? `/app/approvals?status=${encodeURIComponent(statusFilter)}&focus=${entry.key}`
                      : `/app/approvals?focus=${entry.key}`,
                  { source, returnTo, returnLabel }
                )}
                className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                  focusFilter === entry.key ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"
                }`}
              >
                {entry.label}
              </Link>
            ))}
          </div>
          <div className="mt-2">
            <WorkflowReturnBanner returnTo={returnTo} returnLabel={returnLabel} />
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        {queueUpdateNote ? (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            {queueUpdateNote}
          </div>
        ) : null}
        {busy ? <QueueSurfaceStateCard kind="loading" message="Loading approval requests..." /> : null}

        {!busy && error ? <QueueSurfaceStateCard kind="error" message={error} /> : null}

        {!busy && !error && visibleApprovals.length === 0 ? (
          <QueueSurfaceStateCard
            kind="empty"
            title={focusFilter === "needs_retry" ? "No retryable failures" : focusFilter === "needs_review" ? `No approvals ${OPERATIONAL_LABELS.needsReview.toLowerCase()}` : "Approval queue is clear"}
            message={
              focusFilter === "needs_retry"
                ? "There are currently no failed retryable sends. This queue will repopulate when a delivery fails and can be retried."
                : focusFilter === "needs_review"
                  ? "No pending approvals right now. New approval-gated actions will appear here."
                  : approvals.length === 0
                    ? "No approval-gated actions have occurred yet. Generate your first draft from calls, leads, or messages to start this queue."
                    : "No approvals match the current filter. Try broadening filters or return later."
            }
            actionLabel={
              focusFilter !== "all" || Boolean(statusFilter)
                ? "Reset approval filters"
                : approvals.length === 0
                  ? "Open Leads"
                  : "Refresh queue"
            }
            actionHref={
              focusFilter === "all" && !statusFilter && approvals.length === 0
                ? buildWorkflowHref("/app/leads", { source: "approvals", returnTo: localReturnTo, returnLabel: "Approval Queue" })
                : undefined
            }
            onAction={() => {
              if (focusFilter !== "all" || Boolean(statusFilter)) {
                router.replace("/app/approvals", { scroll: false });
                return;
              }
              if (approvals.length === 0) return;
              void load();
            }}
          />
        ) : null}

        {!busy && !error && visibleApprovals.length > 0 ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <ActionQueueTable
                title="Approval Queue"
                rows={approvalRows}
                viewAllHref={buildWorkflowHref("/app/approvals", { source: "approvals", returnTo: localReturnTo, returnLabel: "Approval Queue" })}
              />
              <RiskRailCard title="Approval Risk" items={approvalRiskItems} />
            </div>
            {previewApproval ? (
              <SectionDisclosure title="Focused Approval Diagnostics" storageKey="approvals-focused-diagnostics" className="mt-4">
              <QueueTriagePanel
                title={previewApproval.toolKey}
                subtitle={`${previewApproval.actionType}${previewApproval.entityType ? ` - ${previewApproval.entityType}` : ""}`}
                badges={[
                  {
                    label: previewApproval.status,
                    tone: previewApproval.status === "PENDING" ? "warning" : previewApproval.status === "APPROVED" ? "success" : "default"
                  },
                  ...(previewApproval.deliveryStatus
                    ? [
                        {
                          label: formatApprovalStatusLabel(previewApproval.deliveryStatus),
                          tone:
                            previewApproval.deliveryStatus === "FAILED"
                              ? ("critical" as const)
                              : previewApproval.deliveryStatus === "SENT"
                                ? ("success" as const)
                                : ("info" as const)
                        }
                      ]
                    : [])
                ]}
                sections={[
                  { title: "Request", content: previewApproval.inputSummary || "No summary provided." },
                  { title: "Reason", content: previewApproval.reason || "No additional reason." },
                  { title: "Decision guidance", content: approvalDecisionHint(previewApproval) },
                  {
                    title: "Linked entity",
                    content: previewApproval.entityType && previewApproval.entityId ? `${previewApproval.entityType} ${previewApproval.entityId}` : "No linked entity"
                  },
                  {
                    title: "Delivery",
                    content: `${formatApprovalStatusLabel(previewApproval.deliveryStatus)}${previewApproval.deliveryProvider ? ` via ${previewApproval.deliveryProvider}` : ""}${previewApproval.failureReason ? ` (${previewApproval.failureReason})` : ""}`
                  },
                  {
                    title: "Retry / send history",
                    content: `Retry count ${previewApproval.retryCount}${previewApproval.sentAt ? `, sent ${new Date(previewApproval.sentAt).toLocaleString()}` : ""}${previewApproval.failedAt ? `, failed ${new Date(previewApproval.failedAt).toLocaleString()}` : ""}`
                  },
                  {
                    title: "Related entity state",
                    content: triage.loading
                      ? "Loading entity context..."
                      : triage.data?.recommendation?.action
                        ? `${triage.data.recommendation.action}${triage.data.recommendation.priority ? ` (${triage.data.recommendation.priority})` : ""}`
                        : "No recommendation context available."
                  },
                  {
                    title: "Attention / follow-up",
                    content: `${triage.data?.attention?.attentionLevel || "-"} / open follow-up ${triage.data?.operationalMemory?.taskSnapshot.openFollowUpCount || 0}`
                  },
                  {
                    title: "Blocked / risk signals",
                    content: triage.loading
                      ? "Loading risk context..."
                      : triage.data?.recommendation?.blockedReasons?.length
                        ? triage.data.recommendation.blockedReasons.join(", ")
                        : triage.data?.operationalMemory?.riskFlags?.length
                          ? triage.data.operationalMemory.riskFlags.join(", ")
                          : "No blocking signals recorded."
                  },
                  {
                    title: "Recent history",
                    content: triage.loading
                      ? "Loading history..."
                      : triage.recentEvents.length
                        ? triage.recentEvents.map((event) => `${event.label} - ${new Date(event.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`).join(" | ")
                        : "No recent history."
                  },
                  ...(triage.error ? [{ title: "Enrichment", content: triage.error }] : [])
                ]}
                actions={
                  <>
                    {previewApproval.status === "PENDING" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void decide(previewApproval.id, "approve", "SEND_NOW")}
                          disabled={actionBusyId === previewApproval.id}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          Approve and send
                        </button>
                        <button
                          type="button"
                          onClick={() => void decide(previewApproval.id, "approve", "APPROVE_ONLY")}
                          disabled={actionBusyId === previewApproval.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                        >
                          Approve only
                        </button>
                        <button
                          type="button"
                          onClick={() => void decide(previewApproval.id, "reject")}
                          disabled={actionBusyId === previewApproval.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                    {previewApproval.status === "APPROVED" && (previewApproval.deliveryStatus === "FAILED" || previewApproval.deliveryStatus === "QUEUED") ? (
                      <QueueActionButton
                        onClick={() => void retrySend(previewApproval.id)}
                        disabled={actionBusyId === previewApproval.id || !previewApproval.retryable}
                        tone="primary"
                        size="sm"
                        className="gap-2"
                      >
                        Retry send now
                      </QueueActionButton>
                    ) : null}
                    {entityHref(previewApproval) ? (
                      <QueueActionLink
                        href={buildWorkflowHref(entityHref(previewApproval), {
                          source: "approvals",
                          returnTo: localReturnTo,
                          returnLabel: "Approval Queue"
                        })}
                        size="sm"
                      >
                        Open related entity
                      </QueueActionLink>
                    ) : null}
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

