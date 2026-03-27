"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Phone,
  Search,
  X
} from "lucide-react";
import { fetchOrgCalls, getMe, repopulateOrgCalls, retryAiApprovalSend, updateLeadPipelineStage } from "@/lib/api";
import type { FrontDeskPriority, OrgCallRecord } from "@/lib/types";
import { AskAiInline } from "@/components/ai/ask-ai-inline";
import { AiWorkflowActions } from "@/components/ai/workflow-actions";
import { EntityTimelineCard } from "@/components/ai/entity-timeline-card";
import { RecommendedNextActionPanel } from "@/components/ai/recommended-next-action-panel";
import { RelatedContextCard } from "@/components/ai/related-context-card";
import { RecentActivityCard } from "@/components/ai/recent-activity-card";
import { useEntityAiState } from "@/lib/hooks/use-entity-ai-state";
import { clientBadgeClass } from "@/lib/client-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageShell, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAccessSummary } from "@/context/access-summary";
import { buildReturnTo, buildWorkflowHref, normalizeReturnTo, sourceToLabel } from "@/lib/workflow-nav";
import { QueueEmptyState } from "@/components/queue/queue-empty-state";
import { WorkflowReturnBanner } from "@/components/queue/workflow-return-banner";
import { CommandHeader, SectionDisclosure } from "@/components/ops";

const stateFilters = ["ALL", "needs_follow_up", "contacted", "booked", "closed", "spam"] as const;
type QueueState = (typeof stateFilters)[number];
type PipelineStage = "NEEDS_SCHEDULING" | "SCHEDULED" | "COMPLETED";

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "FD";
}

function callerName(call: OrgCallRecord) {
  return String(call.frontDesk?.callerName || call.displayName || call.fromNumber || "Caller record").trim();
}

function dispositionLabel(call: OrgCallRecord) {
  if (call.frontDesk?.followUpState === "needs_follow_up") return "Needs follow-up";
  if (call.frontDesk?.followUpState === "contacted") return "Contacted";
  if (call.frontDesk?.followUpState === "booked") return "Resolved";
  if (call.frontDesk?.followUpState === "closed") return "Resolved";
  if (call.frontDesk?.followUpState === "spam") return "Spam";
  if (call.outcome === "APPOINTMENT_REQUEST") return "Booking Request";
  if (call.outcome === "MESSAGE_TAKEN") return "Voicemail";
  if (call.outcome === "TRANSFERRED") return "Transferred";
  if (call.outcome === "SPAM") return "Spam";
  return "Reviewed";
}

function dispositionTone(call: OrgCallRecord) {
  const label = dispositionLabel(call);
  if (label === "Booking Request") return "bg-emerald-100 text-emerald-700";
  if (label === "Voicemail") return "bg-amber-100 text-amber-700";
  if (label === "Transferred") return "bg-blue-100 text-blue-700";
  if (label === "Spam") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function priorityLabel(priority: FrontDeskPriority | undefined) {
  if (priority === "urgent") return "Urgent";
  if (priority === "high") return "High";
  if (priority === "normal") return "Normal";
  return "Standard";
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatCallDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function followUpLabel(call: OrgCallRecord) {
  const state = call.frontDesk?.followUpState || "closed";
  if (state === "needs_follow_up") return "Follow-up needed";
  if (state === "contacted") return "Contacted";
  if (state === "booked") return "Booked";
  if (state === "spam") return "Spam";
  return "Closed";
}

function callSummarySnippet(call: OrgCallRecord) {
  return call.frontDesk?.summary || call.aiSummary || call.summary || "Summary pending for this call.";
}

function transcriptLines(call: OrgCallRecord) {
  const transcript = String(call.transcript || "").trim();
  if (!transcript) return [];
  return transcript.split(/\n+/).filter(Boolean).slice(0, 8);
}

function quickActions(call: OrgCallRecord | null): Array<{ label: string; stage: PipelineStage; tone: "default" | "outline" }> {
  if (!call?.leadId) return [];
  if (call.frontDesk?.followUpState === "booked") {
    return [
      { label: "Mark booked", stage: "SCHEDULED", tone: "default" },
      { label: "Mark resolved", stage: "COMPLETED", tone: "outline" }
    ];
  }
  return [
    { label: "Schedule appointment", stage: "NEEDS_SCHEDULING", tone: "default" },
    { label: "Mark resolved", stage: "COMPLETED", tone: "outline" }
  ];
}

export default function AppCallsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const deepLinkedCallId = searchParams.get("callId") || "";
  const source = searchParams.get("source") || "";
  const returnTo = normalizeReturnTo(searchParams.get("returnTo"));
  const returnLabel = searchParams.get("returnLabel") || sourceToLabel(source);
  const localReturnTo = useMemo(() => buildReturnTo(pathname, searchParams), [pathname, searchParams]);
  const accessSummary = useAccessSummary();
  const callsAccess = accessSummary?.features.calls;
  const gatingStatus = callsAccess?.status;
  const shouldShowCallQueue = !callsAccess || gatingStatus === "ready";
  const callReadinessSteps = (accessSummary?.readinessChecklist || []).filter((check) =>
    ["phoneRouting", "transferRouting", "opsApproval"].includes(check.key)
  );
  const [calls, setCalls] = useState<OrgCallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [stateFilter, setStateFilter] = useState<QueueState>((searchParams.get("state") as QueueState) || "ALL");
  const [canEditPipeline, setCanEditPipeline] = useState(false);
  const [savingLeadStage, setSavingLeadStage] = useState<PipelineStage | null>(null);
  const [retryBusy, setRetryBusy] = useState(false);
  const [callAiState, setCallAiState] = useState<{
    summary?: string;
    intent?: string;
    urgency?: string;
    action?: string;
    callbackDraft?: string;
  }>({});

  const loadCalls = useCallback(async (search: string) => {
    const result = await fetchOrgCalls({
      page: 1,
      pageSize: 30,
      ...(search.trim() ? { query: search.trim() } : {}),
      ...(deepLinkedCallId ? { callId: deepLinkedCallId } : {})
    });
    setCalls(result.calls || []);
    if (deepLinkedCallId) {
      setSelectedCallId(deepLinkedCallId);
    } else if (!selectedCallId && result.calls?.[0]) {
      setSelectedCallId(result.calls[0].id);
    } else if (selectedCallId && !result.calls?.some((call) => call.id === selectedCallId)) {
      setSelectedCallId(result.calls?.[0]?.id || null);
    }
  }, [deepLinkedCallId, selectedCallId]);

  useEffect(() => {
    void getMe()
      .then((me) => setCanEditPipeline(["CLIENT_STAFF", "CLIENT_ADMIN", "ADMIN", "SUPER_ADMIN"].includes(me.user.role)))
      .catch(() => setCanEditPipeline(false));
  }, []);

  useEffect(() => {
    if (!shouldShowCallQueue) {
      setCalls([]);
      setError(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void loadCalls(query)
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load call log.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadCalls, query, shouldShowCallQueue]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedCallId) params.set("callId", selectedCallId);
    if (stateFilter === "ALL") params.delete("state");
    else params.set("state", stateFilter);
    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    const currentUrl = buildReturnTo(pathname, searchParams);
    if (nextUrl !== currentUrl) router.replace(nextUrl, { scroll: false });
  }, [pathname, query, router, searchParams, selectedCallId, stateFilter]);

  const visibleCalls = useMemo(() => {
    return calls.filter((call) => {
      if (stateFilter === "ALL") return true;
      return (call.frontDesk?.followUpState || "closed") === stateFilter;
    });
  }, [calls, stateFilter]);

  useEffect(() => {
    if (!visibleCalls.length) {
      setSelectedCallId(null);
      return;
    }
    if (!selectedCallId || !visibleCalls.some((call) => call.id === selectedCallId)) {
      setSelectedCallId(visibleCalls[0].id);
    }
  }, [selectedCallId, visibleCalls]);

  const selectedCall = useMemo(
    () => visibleCalls.find((call) => call.id === selectedCallId) || calls.find((call) => call.id === selectedCallId) || visibleCalls[0] || calls[0] || null,
    [calls, selectedCallId, visibleCalls]
  );
  const selectedNeedsFollowUp = Boolean(selectedCall && selectedCall.frontDesk?.followUpState === "needs_follow_up");
  const selectedUrgent = Boolean(
    selectedCall &&
      (selectedCall.frontDesk?.frontDeskPriority === "urgent" ||
        selectedCall.outcome === "MISSED" ||
        selectedCall.outcome === "ABANDONED")
  );
  const selectedOutcomeText = selectedCall ? dispositionLabel(selectedCall) : "-";
  const selectedWhatMattersText = selectedCall
    ? selectedUrgent
      ? "High callback risk"
      : selectedNeedsFollowUp
        ? "Follow-up task is open"
        : "Disposition is stable"
    : "-";
  const selectedNextStepText = selectedCall
    ? selectedUrgent
      ? "Queue callback now"
      : selectedNeedsFollowUp
        ? "Create follow-up task"
        : "Review transcript and close"
    : "-";
  const { data: entityState, loading: entityStateBusy, error: entityStateError, refresh: refreshEntityState } = useEntityAiState(
    selectedCall ? "call" : undefined,
    selectedCall?.id
  );
  const callSummaryStrip = useMemo(
    () => [
      { label: "Needs follow-up", value: visibleCalls.filter((call) => call.frontDesk?.followUpState === "needs_follow_up").length, note: "Action required" },
      { label: "Missed/abandoned", value: visibleCalls.filter((call) => call.outcome === "MISSED" || call.outcome === "ABANDONED").length, note: "Callback risk" },
      { label: "Pending approvals", value: (entityState?.approvals || []).filter((item) => item.status === "PENDING").length, note: "Decision gate" },
      { label: "Open follow-up", value: entityState?.operationalMemory?.taskSnapshot.openFollowUpCount || 0, note: "Linked workload" }
    ],
    [entityState?.approvals, entityState?.operationalMemory?.taskSnapshot.openFollowUpCount, visibleCalls]
  );

  useEffect(() => {
    if (!selectedCall) {
      setCallAiState({});
      return;
    }
    setCallAiState((current) => ({
      ...current,
      summary: selectedCall.frontDesk?.summary || selectedCall.aiSummary || selectedCall.summary || current.summary
    }));
  }, [selectedCall]);

  async function refreshQueue() {
    if (!shouldShowCallQueue) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      await repopulateOrgCalls();
      await loadCalls(query);
    } catch (refreshFailure) {
      setRefreshError(refreshFailure instanceof Error ? refreshFailure.message : "Refresh failed. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleQuickAction(stage: PipelineStage) {
    if (!selectedCall?.leadId || !canEditPipeline) return;
    setSavingLeadStage(stage);
    try {
      await updateLeadPipelineStage(selectedCall.leadId, stage);
      await loadCalls(query);
    } finally {
      setSavingLeadStage(null);
    }
  }

  const latestApproval = useMemo(() => entityState?.approvals?.[0] || null, [entityState?.approvals]);
  const pendingApproval = useMemo(() => entityState?.approvals?.find((item) => item.status === "PENDING") || null, [entityState?.approvals]);
  const failedRetryableApproval = useMemo(
    () => entityState?.approvals?.find((item) => item.deliveryStatus === "FAILED" && item.retryable) || null,
    [entityState?.approvals]
  );
  const contextSnapshot = useMemo(() => entityState?.memory?.contextJson || {}, [entityState?.memory?.contextJson]);
  const followUpHref = useMemo(() => {
    const queueItemId = typeof contextSnapshot.latestFollowUpItemId === "string" ? contextSnapshot.latestFollowUpItemId : "";
    const taskId = typeof contextSnapshot.latestTaskId === "string" ? contextSnapshot.latestTaskId : "";
    if (queueItemId) return buildWorkflowHref(`/app/follow-up?queueItemId=${encodeURIComponent(queueItemId)}`, { source: "calls", returnTo: localReturnTo, returnLabel: "Calls" });
    if (taskId) return buildWorkflowHref(`/app/follow-up?taskId=${encodeURIComponent(taskId)}`, { source: "calls", returnTo: localReturnTo, returnLabel: "Calls" });
    return buildWorkflowHref("/app/follow-up", { source: "calls", returnTo: localReturnTo, returnLabel: "Calls" });
  }, [contextSnapshot.latestFollowUpItemId, contextSnapshot.latestTaskId, localReturnTo]);
  const approvalHref = useMemo(() => {
    if (pendingApproval?.id) return buildWorkflowHref(`/app/approvals?approvalId=${encodeURIComponent(pendingApproval.id)}&status=PENDING`, { source: "calls", returnTo: localReturnTo, returnLabel: "Calls" });
    if (latestApproval?.id) return buildWorkflowHref(`/app/approvals?approvalId=${encodeURIComponent(latestApproval.id)}`, { source: "calls", returnTo: localReturnTo, returnLabel: "Calls" });
    return buildWorkflowHref("/app/approvals", { source: "calls", returnTo: localReturnTo, returnLabel: "Calls" });
  }, [latestApproval?.id, localReturnTo, pendingApproval?.id]);

  const onRetryFailedApproval = useCallback(async () => {
    if (!failedRetryableApproval?.id || retryBusy) return;
    setRetryBusy(true);
    try {
      await retryAiApprovalSend(failedRetryableApproval.id);
      await refreshEntityState();
    } finally {
      setRetryBusy(false);
    }
  }, [failedRetryableApproval?.id, refreshEntityState, retryBusy]);

  const recommendationActions = useMemo(() => {
    const actions: Array<{
      key: string;
      label: string;
      href?: string;
      onClick?: () => void;
      disabled?: boolean;
      variant?: "default" | "outline";
      tone?: "default" | "warning";
    }> = [];
    const blockedReasons = entityState?.recommendation?.blockedReasons || [];
    const riskFlags = entityState?.operationalMemory?.riskFlags || [];
    const outboundBlocked = entityState?.operationalMemory?.outboundBlocked || false;
    const hasOpenFollowUp = (entityState?.operationalMemory?.taskSnapshot.openFollowUpCount || 0) > 0;
    const noAiOutput = !entityState?.operationalMemory?.latestSummary && !entityState?.operationalMemory?.latestClassification;
    const dncLike = outboundBlocked || blockedReasons.some((reason) => /dnc|opt[_\s-]?out/i.test(reason)) || riskFlags.some((flag) => /dnc|opt[_\s-]?out/i.test(flag));
    const overdueFollowUp = riskFlags.some((flag) => /overdue/i.test(flag));
    const urgentCall = selectedCall?.frontDesk?.frontDeskPriority === "urgent" || selectedCall?.outcome === "MISSED" || selectedCall?.outcome === "ABANDONED";

    if (failedRetryableApproval?.id) {
      actions.push({ key: "retry-send", label: retryBusy ? "Retrying send..." : "Retry failed send", onClick: () => void onRetryFailedApproval(), disabled: retryBusy, variant: "default", tone: "warning" });
    }
    if (pendingApproval?.id) {
      actions.push({ key: "open-pending-approval", label: "Open pending approval", href: approvalHref, variant: "default" });
    }
    if (overdueFollowUp || hasOpenFollowUp) {
      actions.push({ key: "open-follow-up", label: overdueFollowUp ? "Resolve overdue follow-up" : "Open follow-up", href: followUpHref, variant: "default" });
    }
    if (dncLike) {
      actions.push({ key: "internal-review", label: "Review blocked outbound context", href: followUpHref, tone: "warning" });
    } else if (urgentCall) {
      actions.push({ key: "queue-callback", label: "Queue callback approval", href: "#call-ai-workflow", variant: "outline" });
    }
    if (noAiOutput) {
      actions.push({ key: "run-ai", label: "Run call AI workflow", href: "#call-ai-workflow", variant: "outline" });
    }
    if (selectedCall?.recoverySmsThreadId) {
      actions.push({ key: "open-thread", label: "Open inbox thread", href: buildWorkflowHref(`/app/messages?threadId=${encodeURIComponent(selectedCall.recoverySmsThreadId)}`, { source: "calls", returnTo: localReturnTo, returnLabel: "Calls" }) });
    }
    if (!actions.length) {
      actions.push({ key: "refresh-state", label: "Refresh recommendation state", onClick: () => void refreshEntityState() });
    }
    return actions;
  }, [
    approvalHref,
    entityState?.operationalMemory?.latestClassification,
    entityState?.operationalMemory?.latestSummary,
    entityState?.operationalMemory?.outboundBlocked,
    entityState?.operationalMemory?.riskFlags,
    entityState?.operationalMemory?.taskSnapshot.openFollowUpCount,
    entityState?.recommendation?.blockedReasons,
    failedRetryableApproval?.id,
    followUpHref,
    refreshEntityState,
    pendingApproval?.id,
    retryBusy,
    selectedCall?.frontDesk?.frontDeskPriority,
    selectedCall?.outcome,
    selectedCall?.recoverySmsThreadId,
    localReturnTo,
    onRetryFailedApproval
  ]);

  const relatedContext = useMemo(() => {
    if (!selectedCall) return null;
    const stats = [
      {
        label: "Linked lead",
        value: selectedCall.leadId ? "Linked" : "Not linked",
        tone: selectedCall.leadId ? ("success" as const) : ("default" as const)
      },
      {
        label: "Approval state",
        value: pendingApproval ? "Pending review" : latestApproval?.deliveryStatus || latestApproval?.status || "None",
        tone: pendingApproval ? ("warning" as const) : latestApproval?.deliveryStatus === "FAILED" ? ("critical" as const) : ("default" as const)
      },
      {
        label: "Follow-up",
        value: `${entityState?.operationalMemory?.taskSnapshot.openFollowUpCount || 0} open`,
        tone: (entityState?.operationalMemory?.taskSnapshot.openFollowUpCount || 0) > 0 ? ("warning" as const) : ("default" as const)
      },
      {
        label: "Attention",
        value: entityState?.attention?.attentionLevel || "None",
        tone:
          entityState?.attention?.attentionLevel === "CRITICAL"
            ? ("critical" as const)
            : entityState?.attention?.attentionLevel === "HIGH"
              ? ("warning" as const)
              : ("default" as const)
      }
    ];
    const links: Array<{ label: string; href: string }> = [];
    if (selectedCall.leadId) {
      links.push({
        label: "Open linked lead",
        href: buildWorkflowHref(`/app/leads?leadId=${encodeURIComponent(selectedCall.leadId)}`, { source: "calls", returnTo: localReturnTo, returnLabel: "Calls" })
      });
    }
    if (selectedCall.recoverySmsThreadId) {
      links.push({
        label: "Open linked thread",
        href: buildWorkflowHref(`/app/messages?threadId=${encodeURIComponent(selectedCall.recoverySmsThreadId)}`, { source: "calls", returnTo: localReturnTo, returnLabel: "Calls" })
      });
    }
    if (selectedCall.appointmentRequestId) {
      links.push({
        label: "Open booking request",
        href: buildWorkflowHref(`/app/appointments?requestId=${encodeURIComponent(selectedCall.appointmentRequestId)}`, { source: "calls", returnTo: localReturnTo, returnLabel: "Calls" })
      });
    }
    links.push({ label: "Open approvals", href: approvalHref });
    links.push({ label: "Open follow-up", href: followUpHref });
    const flags = [
      ...(entityState?.operationalMemory?.outboundBlocked ? [{ label: "Outbound blocked", tone: "critical" as const }] : []),
      ...(selectedCall.outcome === "MISSED" || selectedCall.outcome === "ABANDONED" ? [{ label: "Missed/abandoned", tone: "warning" as const }] : [])
    ];
    return { stats, links, flags };
  }, [
    approvalHref,
    entityState?.attention?.attentionLevel,
    entityState?.operationalMemory?.outboundBlocked,
    entityState?.operationalMemory?.taskSnapshot.openFollowUpCount,
    followUpHref,
    latestApproval?.deliveryStatus,
    latestApproval?.status,
    localReturnTo,
    pendingApproval,
    selectedCall
  ]);

  if (callsAccess && callsAccess.status !== "ready") {
    const cardVariant = callsAccess.status === "setup_required" ? "setup" : "locked";
    const actionHref = callsAccess.status === "blocked" ? "/app/billing" : "/app/settings#settings-telephony";
    const actionLabel = callsAccess.status === "blocked" ? "Open billing" : "Open telephony settings";
    return (
      <PageShell className="space-y-6">
        <SectionShell className="surface-panel space-y-4">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Call handling access</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{callsAccess.label} not ready</h1>
              <p className="text-sm text-slate-500">{callsAccess.reason}</p>
            </div>
            <StatusBadge kind="feature" state={callsAccess.status} size="sm" />
          </div>
          <StateCard
            variant={cardVariant}
            title="Call queue blocked"
            description={callsAccess.reason}
            action={
              <Link href={actionHref}>
                <Button variant="outline">{actionLabel}</Button>
              </Link>
            }
          />
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">What to fix now</p>
            <div className="mt-3 space-y-2">
              {callsAccess.status === "blocked" ? (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-sm text-slate-700">Billing must be active for call handling.</p>
                  <Link href="/app/billing" className="text-xs font-semibold text-slate-700 underline underline-offset-2">
                    Open billing
                  </Link>
                </div>
              ) : null}
              {callReadinessSteps.map((check) => (
                <div key={check.key} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{check.label}</p>
                    <p className="text-xs text-slate-600">{check.description}</p>
                  </div>
                  <Link
                    href={
                      check.key === "opsApproval"
                        ? "/app/activation"
                        : "/app/settings#settings-telephony"
                    }
                    className="text-xs font-semibold text-slate-700 underline underline-offset-2"
                  >
                    Open
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </SectionShell>
      </PageShell>
    );
  }

  return (
    <div className="space-y-5">
      <CommandHeader
        eyebrow="AI Operations"
        title="Calls"
        description="Review call outcomes, disposition follow-up, and take the next call action."
        actions={
          <Button asChild size="sm">
            <Link href={buildWorkflowHref("/app/calls?state=needs_follow_up", { source: "calls", returnTo: localReturnTo, returnLabel: "Calls" })}>
              Open follow-up calls
            </Link>
          </Button>
        }
      />
      <WorkflowReturnBanner returnTo={returnTo} returnLabel={returnLabel} />
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {callSummaryStrip.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{metric.value}</p>
            <p className="text-xs text-slate-500">{metric.note}</p>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex min-h-[calc(100vh-15rem)] overflow-hidden bg-white">
        <div className="flex min-w-0 flex-1 overflow-hidden">
          <section className="flex min-w-0 flex-[2] flex-col overflow-hidden border-r border-slate-200">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4">
              <div className="flex items-center gap-4">
                <h1 className="text-lg font-bold text-slate-900">Call Log</h1>
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                  {stateFilters.map((filter) => (
                    <button
                      type="button"
                      key={filter}
                      onClick={() => setStateFilter(filter)}
                      className={cn(
                        "rounded-md px-3 py-1 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        stateFilter === filter ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      {filter === "ALL" ? "All" : filter.replaceAll("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search calls..."
                    className="h-8 w-52 rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={() => void refreshQueue()}>
                  {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {refreshError ? (
                <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{refreshError}</p>
              ) : null}
              {loading ? (
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">Loading call log...</div>
              ) : error ? (
                <StateCard variant="error" title="Call log unavailable" description={error} />
              ) : visibleCalls.length ? (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {visibleCalls.map((call) => {
                    const needsFollowUp = call.frontDesk?.followUpState === "needs_follow_up";
                    const urgent =
                      call.frontDesk?.frontDeskPriority === "urgent" || call.outcome === "MISSED" || call.outcome === "ABANDONED";
                    const priorityClass = urgent
                      ? "border-l-2 border-l-rose-400 bg-rose-50/30"
                      : needsFollowUp
                        ? "border-l-2 border-l-amber-400 bg-amber-50/30"
                        : "";
                    return (
                      <button
                        key={call.id}
                        type="button"
                        onClick={() => setSelectedCallId(call.id)}
                        className={cn(
                          "w-full border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          selectedCallId === call.id ? "bg-primary/5" : "",
                          priorityClass
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-slate-900">{callerName(call)}</p>
                              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]", dispositionTone(call))}>
                                {dispositionLabel(call)}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-[11px] text-slate-600">{callSummarySnippet(call)}</p>
                          </div>
                          <span className="shrink-0 text-[10px] font-semibold text-slate-500">{formatCallDateTime(call.startedAt)}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="secondary" className="px-2 py-0.5 text-[10px] text-slate-600">
                            {priorityLabel(call.frontDesk?.frontDeskPriority)}
                          </Badge>
                          <Badge variant="secondary" className="px-2 py-0.5 text-[10px] text-slate-600">
                            {followUpLabel(call)}
                          </Badge>
                          {needsFollowUp ? (
                            <Badge variant="secondary" className="border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                              Follow-up needed
                            </Badge>
                          ) : null}
                          {urgent ? (
                            <Badge variant="secondary" className="border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700">
                              Callback risk
                            </Badge>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <QueueEmptyState
                  title="No calls match this filter"
                  description="Try selecting All, or clear your search to load the full call log."
                />
              )}
            </div>
          </section>

          <section className="flex min-w-0 flex-[1.5] flex-col overflow-hidden bg-slate-50/30">
            {selectedCall ? (
              <>
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                      {initials(callerName(selectedCall))}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{callerName(selectedCall)}</h3>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {dispositionLabel(selectedCall)} - {formatTime(selectedCall.startedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]", dispositionTone(selectedCall))}>
                      {dispositionLabel(selectedCall)}
                    </span>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                      {followUpLabel(selectedCall)}
                    </span>
                    <button
                      type="button"
                      aria-label="Close selected call details"
                      title="Close selected call details"
                      onClick={() => setSelectedCallId(null)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-red-200 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-6">
                    <section className="rounded-lg border border-slate-200 bg-slate-50/40 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold tracking-[0.08em] text-slate-500">Next call action</p>
                          <p className="mt-1 text-xs text-slate-700">
                            {selectedUrgent
                              ? "Callback risk detected. Prioritize callback and route follow-up."
                              : selectedNeedsFollowUp
                                ? "This call needs follow-up. Choose the next disposition action."
                                : "Call reviewed. Confirm the final disposition and next step."}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={selectedNeedsFollowUp ? "default" : "outline"}
                            onClick={() => document.getElementById("call-callback-composer")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                          >
                            Callback
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <a href="#call-ai-workflow">Queue approval</a>
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link href={followUpHref}>Create follow-up</Link>
                          </Button>
                          {selectedCall.recoverySmsThreadId ? (
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                            >
                              <Link
                                href={buildWorkflowHref(`/app/messages?threadId=${encodeURIComponent(selectedCall.recoverySmsThreadId)}`, {
                                  source: "calls",
                                  returnTo: localReturnTo,
                                  returnLabel: "Calls"
                                })}
                              >
                                Open linked thread
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">What happened</p>
                          <p className="mt-1 text-xs font-semibold text-slate-900">{selectedOutcomeText}</p>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">What matters</p>
                          <p className="mt-1 text-xs font-semibold text-slate-900">{selectedWhatMattersText}</p>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Do next</p>
                          <p className="mt-1 text-xs font-semibold text-slate-900">{selectedNextStepText}</p>
                        </div>
                      </div>
                    </section>

                    <section className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Disposition</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{dispositionLabel(selectedCall)}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Urgency</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{priorityLabel(selectedCall.frontDesk?.frontDeskPriority)}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Follow-up state</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{followUpLabel(selectedCall)}</p>
                      </div>
                    </section>

                    <section className="rounded-lg border border-slate-200 bg-white p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Call transcript</h4>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{formatCallDateTime(selectedCall.startedAt)}</p>
                      </div>
                      <div className="space-y-4">
                        {transcriptLines(selectedCall).length ? (
                          transcriptLines(selectedCall).map((line, index) => {
                            const speaker = line.includes(":") ? line.split(":")[0]?.trim() : index % 2 === 0 ? callerName(selectedCall) : "AI";
                            const text = line.includes(":") ? line.slice(line.indexOf(":") + 1).trim() : line;
                            const ai = speaker.toUpperCase() === "AI";
                            return (
                              <div key={`${speaker}-${index}`} className="flex gap-3">
                                <span className={cn("mt-1 w-16 shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em]", ai ? "text-primary" : "text-slate-400")}>
                                  {speaker}:
                                </span>
                                <p className={cn("text-sm leading-relaxed", ai ? "text-slate-700" : "text-slate-600")}>{text}</p>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-slate-500">No transcript available for this call.</p>
                        )}
                      </div>
                    </section>

                    <RecommendedNextActionPanel
                      title="Call Decision Support"
                      source={source}
                      loading={entityStateBusy}
                      error={entityStateError}
                      recommendation={entityState?.recommendation || null}
                      operationalMemory={entityState?.operationalMemory || null}
                      attention={entityState?.attention || null}
                      latestApproval={latestApproval}
                      quickActions={recommendationActions}
                      onRefresh={() => {
                        void refreshEntityState();
                      }}
                      refreshing={entityStateBusy}
                    />

                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <Phone className="h-4 w-4 text-primary" />
                        <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">AI Summary</h4>
                      </div>
                      <p className="text-sm font-medium leading-relaxed text-slate-700">
                        {selectedCall.frontDesk?.summary || selectedCall.aiSummary || selectedCall.summary || "Structured summary is still pending for this call."}
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Service Type</p>
                          <p className="text-xs font-bold text-slate-900">{selectedCall.frontDesk?.serviceRequested || dispositionLabel(selectedCall)}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Preferred Date</p>
                          <p className="text-xs font-bold text-slate-900">
                            {selectedCall.frontDesk?.appointmentRequested ? "Appointment requested" : "Not captured"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Intent</p>
                          <p className="text-xs font-bold text-slate-900">{callAiState.intent || "Classification pending"}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Urgency</p>
                          <p className="text-xs font-bold text-slate-900">{callAiState.urgency || "Detection pending"}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Next action</p>
                          <p className="text-xs font-bold text-slate-900">{callAiState.action || "Suggestion pending"}</p>
                        </div>
                      </div>
                    </div>

                    <SectionDisclosure title="Call workflow detail" storageKey="calls-deep-workflow-detail" defaultCollapsed>
                      <div id="call-ai-workflow">
                        <AiWorkflowActions
                          title="Front Desk Workflow"
                          description="Run call-specific AI actions with persisted results."
                          agentKey="front_desk"
                          entityType="call"
                          entityId={selectedCall.id}
                          actions={[
                            { key: "summarize", label: "Summarize Call", toolKey: "summarize_call", buildInput: () => ({ callId: selectedCall.id }) },
                            { key: "extract", label: "Extract Details", toolKey: "extract_call_details", buildInput: () => ({ callId: selectedCall.id }) },
                            { key: "intent", label: "Classify Intent", toolKey: "classify_call_intent", buildInput: () => ({ callId: selectedCall.id }) },
                            { key: "urgency", label: "Detect Urgency", toolKey: "detect_urgency", buildInput: () => ({ callId: selectedCall.id }) },
                            { key: "action", label: "Suggest Action", toolKey: "suggest_front_desk_action", buildInput: () => ({ callId: selectedCall.id }) },
                            { key: "callback", label: "Draft Callback", toolKey: "draft_callback", buildInput: () => ({ callId: selectedCall.id }) },
                            {
                              key: "task",
                              label: "Create Follow-up Task",
                              toolKey: "create_followup_task",
                              buildInput: () => ({ title: `Follow up missed call ${selectedCall.fromNumber}`, description: "Generated from call workflow", priority: "HIGH" })
                            },
                            {
                              key: "approval",
                              label: "Queue Callback Approval",
                              toolKey: "queue_sms",
                              buildInput: () => ({ content: callAiState.callbackDraft || `Callback requested for ${selectedCall.fromNumber}` })
                            }
                          ]}
                          onToolResult={(toolKey, payload) => {
                            setCallAiState((current) => ({
                              ...current,
                              summary: toolKey === "summarize_call" ? String(payload?.summary || current.summary || "") : current.summary,
                              intent: toolKey === "classify_call_intent" ? String(payload?.intent || current.intent || "") : current.intent,
                              urgency: toolKey === "detect_urgency" ? String(payload?.urgency || current.urgency || "") : current.urgency,
                              action: toolKey === "suggest_front_desk_action" ? String(payload?.action || current.action || "") : current.action,
                              callbackDraft: toolKey === "draft_callback" ? String(payload?.draft || current.callbackDraft || "") : current.callbackDraft
                            }));
                            void refreshEntityState();
                          }}
                        />
                      </div>
                      {callAiState.callbackDraft ? (
                        <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-700">
                          <p className="mb-1 font-semibold text-slate-900">Callback draft</p>
                          <p>{callAiState.callbackDraft}</p>
                        </div>
                      ) : null}
                      <div className="px-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Timeline detail</p>
                      </div>
                      <EntityTimelineCard
                        entityType="call"
                        entityId={selectedCall.id}
                        timelineData={entityState}
                        loading={entityStateBusy}
                        error={entityStateError}
                      />
                    </SectionDisclosure>

                    <SectionDisclosure title="Secondary call context" storageKey="calls-secondary-context" defaultCollapsed>
                      <div className="grid gap-4 lg:grid-cols-2">
                        {relatedContext ? (
                          <RelatedContextCard
                            title="Related Context"
                            description="Linked records and nearby operational state for this call."
                            stats={relatedContext.stats}
                            links={relatedContext.links}
                            flags={relatedContext.flags}
                          />
                        ) : null}
                        <RecentActivityCard timelineData={entityState} loading={entityStateBusy} error={entityStateError} />
                      </div>
                    </SectionDisclosure>

                    <div id="call-callback-composer" className="border-t border-slate-200 pt-8">
                      <h4 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Callback Draft</h4>
                      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-sm text-slate-700">
                          {callAiState.callbackDraft || "No callback draft yet. Run \"Draft Callback\" in Call workflow to generate one."}
                        </p>
                        <p className="mt-2 text-[11px] text-slate-500">Send via callback approval workflow.</p>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">Use <span className="font-semibold">Queue Callback Approval</span> in Front Desk Workflow to send safely through approvals.</p>
                      {selectedCall.leadId && canEditPipeline ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {quickActions(selectedCall).map((action) => (
                            <Button
                              key={action.stage}
                              size="sm"
                              variant={action.tone}
                              disabled={savingLeadStage === action.stage}
                              onClick={() => void handleQuickAction(action.stage)}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedCall.recoverySmsThreadId ? (
                          <Link href={buildWorkflowHref(`/app/messages?threadId=${encodeURIComponent(selectedCall.recoverySmsThreadId)}`, { source: "calls", returnTo: localReturnTo, returnLabel: "Calls" })}>
                            <Badge className={clientBadgeClass("pending")}>Open inbox thread</Badge>
                          </Link>
                        ) : null}
                        {selectedCall.appointmentRequestId ? (
                          <Link href={buildWorkflowHref(`/app/appointments?requestId=${encodeURIComponent(selectedCall.appointmentRequestId)}`, { source: "calls", returnTo: localReturnTo, returnLabel: "Calls" })}>
                            <Badge className={clientBadgeClass("booking")}>Open booking</Badge>
                          </Link>
                        ) : null}
                        {selectedCall.recordingUrl ? (
                          <a href={selectedCall.recordingUrl} target="_blank" rel="noreferrer">
                            <Badge className={clientBadgeClass("neutral")}>Open recording</Badge>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8">
                <QueueEmptyState
                  title="No Call Selected"
                  description="Select a call from the log to review disposition, transcript, and next actions."
                />
              </div>
            )}
          </section>
        </div>
      </div>
      </div>
      <SectionDisclosure title="Ask AI Assistance" storageKey="calls-ask-ai" defaultCollapsed>
        <AskAiInline page="calls" entityType={selectedCall ? "call" : undefined} entityId={selectedCall?.id} defaultAgentKey="front_desk" />
      </SectionDisclosure>
    </div>
  );
}

