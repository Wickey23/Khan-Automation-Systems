"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { RefreshCcw } from "lucide-react";
import { approveAiAction, fetchAiApprovals, rejectAiAction, retryAiApprovalSend } from "@/lib/api";
import type { ApprovalRequest } from "@/lib/types";
import { CommandHeader } from "@/components/ops";
import { buildReturnTo, buildWorkflowHref, normalizeReturnTo, sourceToLabel } from "@/lib/workflow-nav";
import { ContextualShortcutHints, QueueActionButton, QueueActionLink, QueueShortcutHint, QueueSurfaceStateCard } from "@/components/queue";
import { useQueueTriageEnrichment } from "@/lib/hooks/use-queue-triage-enrichment";
import { markDailyReviewDirty } from "@/lib/review-loop";
import { APPROVAL_FOCUS_LABELS, OPERATIONAL_LABELS, formatApprovalStatusLabel } from "@/lib/operational-language";
import { useOperationalShortcuts } from "@/lib/hooks/use-operational-shortcuts";
import { resolvePostActionFocus } from "@/lib/queue-focus";
import { ActionQueueTable, KpiCard, SectionDisclosure, ageFromDate, priorityToSeverity, statusToOperatorState } from "@/components/ops";
import { cn } from "@/lib/utils";

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

function approvalConsequence(approval: ApprovalRequest) {
  if (approval.status === "PENDING") return "Requested action will not execute until a decision is made.";
  if (isNeedsRetry(approval)) return "Customer-facing delivery remains failed until retried.";
  if (approval.status === "APPROVED" && approval.deliveryStatus === "FAILED") return "Delivery failed and may require manual recovery.";
  if (isInDelivery(approval)) return "Action is in flight. Monitor completion state.";
  return "No immediate operator risk.";
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
        const agingPending = approval.status === "PENDING" && Date.now() - new Date(approval.createdAt).getTime() >= 2 * 60 * 60 * 1000;
        const decisionState =
          approval.status === "PENDING" ? "Decision required" : isNeedsRetry(approval) ? "Retry required" : "Decision recorded";
        const dueState =
          approval.status === "PENDING"
            ? agingPending
              ? "Aging > 2h"
              : "Review now"
            : isNeedsRetry(approval)
              ? "Retry now"
              : "No pending action";
        const severityTone = isNeedsRetry(approval) || agingPending ? "high" : state.tone;
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
          item: `${approval.actionType.replaceAll("_", " ").toLowerCase()} - ${approval.toolKey}`,
          owner: decisionState,
          due: dueState,
          ageLabel: ageFromDate(approval.createdAt),
          severity: priorityToSeverity(severityTone),
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
          detail: `${approvalDecisionHint(approval)} ${approvalConsequence(approval)}`,
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

  return (
    <div className="space-y-10 pb-12">
      <CommandHeader
        eyebrow="AI Operations"
        title="Decision Desk"
        description="Approve, reject, and retry with clear consequence context for every request."
        actions={
          <div className="flex items-center gap-3 w-full md:w-auto">
            {primaryCta}
          </div>
        }
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {approvalSummaryStrip.map((metric) => (
          <KpiCard 
            key={metric.label} 
            label={metric.label} 
            value={String(metric.value)} 
            detail={metric.note}
            emphasis={metric.label.includes("Retryable") || metric.label.includes("Aging") ? "risk" : "default"}
          />
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-5 animate-fade-slide-up [animation-delay:100ms]">
          {/* Controls and Filters */}
          <div className="glass-card inner-glow rounded-2xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: "all", label: APPROVAL_FOCUS_LABELS.all },
                    { key: "needs_review", label: APPROVAL_FOCUS_LABELS.needs_review },
                    { key: "needs_retry", label: APPROVAL_FOCUS_LABELS.needs_retry }
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
                    className={cn(
                      "px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] rounded-xl transition-all border",
                      focusFilter === entry.key 
                        ? "bg-slate-100 text-slate-900 border-slate-200" 
                        : "bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:text-slate-600"
                    )}
                  >
                    {entry.label}
                  </Link>
                ))}
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void load()}
                  className="p-2 bg-slate-50 text-slate-400 hover:text-primary transition-colors rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  title="Refresh items"
                  aria-label="Refresh approvals"
                >
                  <RefreshCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            <SectionDisclosure title="Advanced filters" storageKey="approvals-controls-shortcuts" defaultCollapsed>
              <div className="pt-3 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(["", "PENDING", "APPROVED", "REJECTED"] as const).map((status) => (
                    <Link
                      key={status || "ALL"}
                      href={buildWorkflowHref(status ? `/app/approvals?status=${status}` : "/app/approvals", { source, returnTo, returnLabel })}
                      className={cn(
                        "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all border",
                        (status || "") === statusFilter 
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm" 
                          : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                      )}
                    >
                      {status ? formatApprovalStatusLabel(status) : "All statuses"}
                    </Link>
                  ))}
                </div>
                <QueueShortcutHint
                  summary="Row shortcuts"
                  items={[
                    { keys: "J / K", label: "Move focus" },
                    { keys: "Enter", label: "Open entity" },
                    { keys: "Alt+S", label: "Approve & send" },
                    { keys: "Alt+O", label: "Approve only" },
                    { keys: "Alt+X", label: "Reject" }
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Loading approvals...</p>
            </div>
          ) : error ? (
            <QueueSurfaceStateCard kind="error" message={error} />
          ) : visibleApprovals.length === 0 ? (
            <QueueSurfaceStateCard
              kind="empty"
              title={focusFilter === "needs_retry" ? "No retryable failures" : focusFilter === "needs_review" ? `No approvals pending review` : "Approval queue is clear"}
              message={
                 focusFilter === "needs_retry"
                   ? "There are currently no failed retryable sends. This queue will repopulate when a delivery fails and can be retried."
                   : focusFilter === "needs_review"
                     ? "Nothing is waiting on a decision right now. New gated actions will appear here."
                     : approvals.length === 0
                       ? "No decision-gated actions have occurred yet."
                       : "No approvals match this decision view."
              }
              onAction={() => {
                if (focusFilter !== "all" || Boolean(statusFilter)) {
                  router.replace("/app/approvals", { scroll: false });
                  return;
                }
                void load();
              }}
            />
          ) : (
            <div className="glass-card inner-glow rounded-[2rem] overflow-hidden">
              <ActionQueueTable
                title="Approval Management"
                rows={approvalRows}
                viewAllHref={buildWorkflowHref("/app/approvals", { source: "approvals", returnTo, returnLabel: "Approval Queue" })}
              />
            </div>
          )}
        </div>

        {/* Focus / Sidebar Preview Panel */}
        <aside className="lg:col-span-4 space-y-6 animate-fade-slide-up [animation-delay:200ms]">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
              <span className="material-symbols-outlined text-[120px]">assignment_turned_in</span>
            </div>
            
            {previewApproval ? (
              <div className="relative z-10 space-y-5">
                <header>
                  <p className="text-[10px] font-semibold text-primary/60 uppercase tracking-[0.12em] mb-2">Focused Approval</p>
                  <h4 className="text-xl font-semibold font-headline text-on-surface tracking-tight leading-tight uppercase">{previewApproval.toolKey}</h4>
                  <p className="mt-1 text-xs font-semibold text-on-surface-variant/60">{`${previewApproval.actionType}${previewApproval.entityType ? ` - ${previewApproval.entityType}` : ""}`}</p>
                </header>

                <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100/50 space-y-3">
                  <p className="text-[10px] font-semibold text-on-surface-variant/40 uppercase tracking-[0.12em]">Operator Decision Hint</p>
                  <p className="text-sm font-semibold text-on-surface leading-tight">
                    {approvalDecisionHint(previewApproval)}
                  </p>
                  <p className="text-xs font-semibold text-slate-600">
                    {approvalConsequence(previewApproval)}
                  </p>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-semibold text-on-surface-variant/40 uppercase tracking-[0.12em]">Workflow Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {previewApproval.status === "PENDING" ? (
                      <>
                        <QueueActionButton
                          size="sm"
                          className="px-5 py-2.5 bg-slate-900 text-white text-[10px] font-semibold uppercase tracking-[0.12em] rounded-xl hover:bg-primary transition-all shadow-md"
                          disabled={actionBusyId === previewApproval.id}
                          onClick={() => void decide(previewApproval.id, "approve", "SEND_NOW")}
                        >
                          {actionBusyId === previewApproval.id ? "Working..." : "Approve & send"}
                        </QueueActionButton>
                        <QueueActionButton
                          size="sm"
                          className="px-5 py-2.5 bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-xl hover:bg-slate-200 transition-all"
                          disabled={actionBusyId === previewApproval.id}
                          onClick={() => void decide(previewApproval.id, "approve", "APPROVE_ONLY")}
                        >
                          Approve only
                        </QueueActionButton>
                        <QueueActionButton
                          size="sm"
                          className="px-5 py-2.5 bg-rose-50 text-rose-600 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-xl hover:bg-rose-100 transition-all"
                          disabled={actionBusyId === previewApproval.id}
                          onClick={() => void decide(previewApproval.id, "reject")}
                        >
                          Reject
                        </QueueActionButton>
                      </>
                    ) : null}
                    
                    {isNeedsRetry(previewApproval) ? (
                      <QueueActionButton
                        size="sm"
                        className="px-5 py-2.5 bg-amber-500 text-white text-[10px] font-semibold uppercase tracking-[0.12em] rounded-xl hover:bg-amber-600 transition-all"
                        disabled={actionBusyId === previewApproval.id}
                        onClick={() => void retrySend(previewApproval.id)}
                      >
                         Retry send
                      </QueueActionButton>
                    ) : null}

                    {entityHref(previewApproval) ? (
                      <QueueActionLink
                        size="sm"
                        className="px-5 py-2.5 bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-xl hover:bg-slate-200 transition-all"
                        href={buildWorkflowHref(entityHref(previewApproval), { source: "approvals", returnTo: localReturnTo, returnLabel: "Approval Queue" })}
                      >
                        Open entity
                      </QueueActionLink>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-semibold text-on-surface-variant/40 uppercase tracking-[0.12em]">Status Context</p>
                  <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-slate-500 uppercase">
                    <div className="space-y-1">
                      <p>Delivery</p>
                      <p className="text-on-surface">{formatApprovalStatusLabel(previewApproval.deliveryStatus)}</p>
                    </div>
                    <div className="space-y-1">
                      <p>Provider</p>
                      <p className="text-on-surface">{previewApproval.deliveryProvider || "Not available"}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Select an approval to<br />load context</p>
              </div>
            )}
          </div>
          
          <SectionDisclosure title="Secondary Diagnostics" storageKey="approvals-focused-diagnostics" defaultCollapsed>
            <div className="pt-4 space-y-4">
              {previewApproval ? (
                <div className="space-y-3 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                  <div className="space-y-1">
                    <p>Request Payload</p>
                    <p className="text-on-surface normal-case font-medium line-clamp-3">{previewApproval.inputSummary || "No approval summary available."}</p>
                  </div>
                  <div className="flex justify-between"><span>Retries</span> <span className="text-on-surface">{previewApproval.retryCount}</span></div>
                  <div className="flex justify-between"><span>Latest event</span> <span className="text-on-surface text-right">{triage.recentEvents[0]?.label || "-"}</span></div>
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





