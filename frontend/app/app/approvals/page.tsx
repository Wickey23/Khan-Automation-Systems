"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { approveAiAction, fetchAiApprovals, rejectAiAction, retryAiApprovalSend } from "@/lib/api";
import type { ApprovalRequest } from "@/lib/types";
import { PageShell, SectionShell } from "@/components/ui/page";
import { CommandHeader } from "@/components/ops";
import { buildReturnTo, buildWorkflowHref, normalizeReturnTo, sourceToLabel } from "@/lib/workflow-nav";
import { ContextualShortcutHints, QueueActionButton, QueueActionLink, QueueShortcutHint, QueueSurfaceStateCard } from "@/components/queue";
import { useQueueTriageEnrichment } from "@/lib/hooks/use-queue-triage-enrichment";
import { markDailyReviewDirty } from "@/lib/review-loop";
import { APPROVAL_FOCUS_LABELS, OPERATIONAL_LABELS, formatApprovalStatusLabel } from "@/lib/operational-language";
import { useOperationalShortcuts } from "@/lib/hooks/use-operational-shortcuts";
import { resolvePostActionFocus } from "@/lib/queue-focus";
import { WorkflowReturnBanner } from "@/components/queue/workflow-return-banner";
import { ActionQueueTable, KpiCard, SectionDisclosure, ageFromDate, priorityToSeverity, statusToOperatorState } from "@/components/ops";

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
  const inDeliveryCount = useMemo(() => approvals.filter((item) => isInDelivery(item)).length, [approvals]);
  const agingPendingCount = useMemo(
    () => approvals.filter((item) => item.status === "PENDING" && Date.now() - new Date(item.createdAt).getTime() >= 2 * 60 * 60 * 1000).length,
    [approvals]
  );
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
          isActive: previewApprovalId === approval.id,
          onRowSelect: () => setPreviewApprovalId(approval.id),
          onRowFocus: () => setPreviewApprovalId(approval.id),
          rowAriaLabel: `${approval.toolKey}. ${approval.status}.`
        };
      }),
    [actionBusyId, decide, localReturnTo, previewApprovalId, returnTo, retrySend, visibleApprovals]
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

  const approvalSummaryStrip = useMemo(
    () => [
      { label: "Pending now", value: pendingCount, note: "Decision required" },
      { label: "Aging pending", value: agingPendingCount, note: "Older than 2h" },
      { label: "Retryable failed", value: retryableFailedCount, note: "Can resend now" },
      { label: "In delivery", value: inDeliveryCount, note: "Monitor execution" }
    ],
    [agingPendingCount, inDeliveryCount, pendingCount, retryableFailedCount]
  );

  const primaryCta = useMemo(() => {
    if (previewApproval?.status === "PENDING") {
      return (
        <QueueActionButton
          size="sm"
          tone="primary"
          disabled={actionBusyId === previewApproval.id}
          onClick={() => void decide(previewApproval.id, "approve", "SEND_NOW")}
        >
          {actionBusyId === previewApproval.id ? "Approving..." : "Approve & send selected"}
        </QueueActionButton>
      );
    }
    const pending = visibleApprovals.find((item) => item.status === "PENDING") || approvals.find((item) => item.status === "PENDING") || null;
    if (pending) {
      return (
        <QueueActionLink
          size="sm"
          tone="primary"
          href={buildWorkflowHref(`/app/approvals?approvalId=${encodeURIComponent(pending.id)}&focus=needs_review`, {
            source: "approvals",
            returnTo: localReturnTo,
            returnLabel: "Approval Queue"
          })}
        >
          Open next pending approval
        </QueueActionLink>
      );
    }
    return (
      <QueueActionLink
        size="sm"
        tone="primary"
        href={buildWorkflowHref("/app/approvals?focus=needs_retry", {
          source: "approvals",
          returnTo: localReturnTo,
          returnLabel: "Approval Queue"
        })}
      >
        Review retryable failures
      </QueueActionLink>
    );
  }, [actionBusyId, approvals, decide, localReturnTo, previewApproval, visibleApprovals]);

  const previewRiskFlags = useMemo(() => {
    if (!previewApproval) return [] as string[];
    const flags: string[] = [];
    if (previewApproval.status === "PENDING") flags.push("Pending operator decision");
    if (isNeedsRetry(previewApproval)) flags.push("Delivery failed and retryable");
    if (previewApproval.status === "APPROVED" && previewApproval.deliveryStatus === "FAILED" && !previewApproval.retryable) {
      flags.push("Delivery failed and not retryable");
    }
    if (previewApproval.status === "EXPIRED") flags.push("Approval expired");
    if (previewApproval.status === "REJECTED") flags.push("Approval rejected");
    if (previewApproval.failureReason) flags.push(previewApproval.failureReason);
    return flags;
  }, [previewApproval]);

  return (
    <PageShell>
      <CommandHeader
        eyebrow="AI Operations"
        title="Approval Queue"
        description="Operator decision desk for pending, aging, and at-risk approval actions."
        actions={primaryCta}
      />

      <SectionShell>
        <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {approvalSummaryStrip.map((metric) => (
            <KpiCard key={metric.label} label={metric.label} value={String(metric.value)} detail={metric.note} />
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2">
            <WorkflowReturnBanner returnTo={returnTo} returnLabel={returnLabel} />
          </div>
          <SectionDisclosure title="Queue controls and shortcuts" storageKey="approvals-controls-shortcuts" defaultCollapsed className="mb-2">
            <QueueShortcutHint
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
          </SectionDisclosure>
          <div className="flex flex-wrap gap-2">
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
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <ActionQueueTable
                title="Approval Queue"
                rows={approvalRows}
                viewAllHref={buildWorkflowHref("/app/approvals", { source: "approvals", returnTo: localReturnTo, returnLabel: "Approval Queue" })}
              />
              <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                {previewApproval ? (
                  <>
                    <section className="space-y-1 border-b border-slate-200 pb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Selected approval</p>
                      <p className="text-sm font-semibold text-slate-900">{previewApproval.toolKey}</p>
                      <p className="text-xs text-slate-600">{`${previewApproval.actionType}${previewApproval.entityType ? ` · ${previewApproval.entityType}` : ""}`}</p>
                    </section>
                    <section className="space-y-1 border-b border-slate-200 pb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Recommended next action</p>
                      <p className="text-sm font-medium text-slate-900">{approvalDecisionHint(previewApproval)}</p>
                    </section>
                    <section className="space-y-2 border-b border-slate-200 pb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Decision and safety context</p>
                      <p className="text-xs text-slate-700">
                        Delivery: {formatApprovalStatusLabel(previewApproval.deliveryStatus)}
                        {previewApproval.deliveryProvider ? ` via ${previewApproval.deliveryProvider}` : ""}
                      </p>
                      <p className="text-xs text-slate-700">
                        Retry count: {previewApproval.retryCount}
                        {previewApproval.sentAt ? ` · sent ${new Date(previewApproval.sentAt).toLocaleString()}` : ""}
                        {previewApproval.failedAt ? ` · failed ${new Date(previewApproval.failedAt).toLocaleString()}` : ""}
                      </p>
                      {triage.data?.recommendation?.blockedReasons?.length ? (
                        <p className="text-xs text-slate-700">Blocked reasons: {triage.data.recommendation.blockedReasons.join(", ")}</p>
                      ) : null}
                    </section>
                    <section className="space-y-2 border-b border-slate-200 pb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workflow links</p>
                      <div className="flex flex-wrap gap-2">
                        {previewApproval.status === "PENDING" ? (
                          <QueueActionButton
                            size="sm"
                            tone="primary"
                            onClick={() => void decide(previewApproval.id, "approve", "SEND_NOW")}
                            disabled={actionBusyId === previewApproval.id}
                          >
                            {actionBusyId === previewApproval.id ? "Approving..." : "Approve & send"}
                          </QueueActionButton>
                        ) : null}
                        {previewApproval.status === "PENDING" ? (
                          <QueueActionButton
                            size="sm"
                            onClick={() => void decide(previewApproval.id, "approve", "APPROVE_ONLY")}
                            disabled={actionBusyId === previewApproval.id}
                          >
                            Approve only
                          </QueueActionButton>
                        ) : null}
                        {previewApproval.status === "PENDING" ? (
                          <QueueActionButton
                            size="sm"
                            tone="critical"
                            onClick={() => void decide(previewApproval.id, "reject")}
                            disabled={actionBusyId === previewApproval.id}
                          >
                            Reject
                          </QueueActionButton>
                        ) : null}
                        {isNeedsRetry(previewApproval) ? (
                          <QueueActionButton
                            size="sm"
                            tone="warning"
                            onClick={() => void retrySend(previewApproval.id)}
                            disabled={actionBusyId === previewApproval.id}
                          >
                            Retry send
                          </QueueActionButton>
                        ) : null}
                        {entityHref(previewApproval) ? (
                          <QueueActionLink
                            size="sm"
                            href={buildWorkflowHref(entityHref(previewApproval), {
                              source: "approvals",
                              returnTo: localReturnTo,
                              returnLabel: "Approval Queue"
                            })}
                          >
                            Open entity
                          </QueueActionLink>
                        ) : null}
                      </div>
                    </section>
                    <section className="space-y-1 border-b border-slate-200 pb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Risk or failure flags</p>
                      {previewRiskFlags.length ? (
                        <ul className="space-y-1 text-xs text-slate-700">
                          {previewRiskFlags.slice(0, 5).map((flag) => (
                            <li key={flag}>• {flag}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-600">No active risk flags.</p>
                      )}
                    </section>
                    <section className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Recent activity</p>
                      <p className="text-xs text-slate-600">
                        {triage.loading
                          ? "Loading activity..."
                          : triage.recentEvents.length
                            ? triage.recentEvents
                                .slice(0, 4)
                                .map((event) => `${event.label} · ${new Date(event.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`)
                                .join(" | ")
                            : "No recent history."}
                      </p>
                    </section>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Select an approval to review decision context.</p>
                )}
              </aside>
            </div>
            <SectionDisclosure title="Secondary Diagnostics and History" storageKey="approvals-focused-diagnostics" className="mt-4" defaultCollapsed>
              {previewApproval ? (
                <div className="space-y-3 text-sm text-slate-700">
                  <p><span className="font-semibold text-slate-900">Request:</span> {previewApproval.inputSummary || "No summary provided."}</p>
                  <p><span className="font-semibold text-slate-900">Reason:</span> {previewApproval.reason || "No additional reason."}</p>
                  <p><span className="font-semibold text-slate-900">Related state:</span> {triage.loading
                    ? "Loading entity context..."
                    : triage.data?.recommendation?.action
                      ? `${triage.data.recommendation.action}${triage.data.recommendation.priority ? ` (${triage.data.recommendation.priority})` : ""}`
                      : "No recommendation context available."}</p>
                  <p><span className="font-semibold text-slate-900">Attention / follow-up:</span> {`${triage.data?.attention?.attentionLevel || "-"} / open follow-up ${triage.data?.operationalMemory?.taskSnapshot.openFollowUpCount || 0}`}</p>
                  {triage.error ? <p><span className="font-semibold text-slate-900">Enrichment:</span> {triage.error}</p> : null}
                  <ContextualShortcutHints items={previewShortcutHints} />
                </div>
              ) : (
                <p className="text-sm text-slate-500">No focused approval.</p>
              )}
            </SectionDisclosure>
          </>
        ) : null}
      </SectionShell>
    </PageShell>
  );
}

