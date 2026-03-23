"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Calendar, Mail, Phone, Sparkles, UserPlus } from "lucide-react";
import {
  fetchAiApprovals,
  fetchAttentionQueue,
  fetchAppointmentRequests,
  fetchFollowUpQueue,
  getMe,
  fetchOrgProfile,
  fetchManagerInsights,
  fetchOperationsFeed,
  fetchOrgCalls,
  fetchOrgLeads,
  fetchOrgOnboarding
} from "@/lib/api";
import { AskAiInline } from "@/components/ai/ask-ai-inline";
import { OperationsFeedList } from "@/components/ai/operations-feed-list";
import type {
  AppointmentRequest,
  ApprovalRequest,
  AttentionQueueItem,
  FollowUpQueueItem,
  Lead,
  ManagerInsightSummary,
  OperationsFeedEvent,
  OrgAccessSummary,
  OrgCallRecord
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { buildReturnTo, buildWorkflowHref } from "@/lib/workflow-nav";
import { consumeDailyReviewDirtyReasons } from "@/lib/review-loop";
import { OPERATIONAL_LABELS } from "@/lib/operational-language";

type DashboardState = {
  calls: OrgCallRecord[];
  leads: Lead[];
  requests: AppointmentRequest[];
  attention: AttentionQueueItem[];
  approvals: ApprovalRequest[];
  followUps: FollowUpQueueItem[];
  insights: ManagerInsightSummary | null;
  operations: OperationsFeedEvent[];
  onboardingStatus: string | null;
  meId: string | null;
  accessSummary: OrgAccessSummary | null;
};

function formatRelative(value: string | null | undefined) {
  if (!value) return "Just now";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
}

function entityLabel(entityType: string) {
  if (entityType === "call") return "Call";
  if (entityType === "lead") return "Lead";
  if (entityType === "message_thread") return "Message";
  return entityType;
}

function deliveryTone(status?: string | null) {
  if (status === "FAILED") return "text-red-700 bg-red-50";
  if (status === "SENT") return "text-emerald-700 bg-emerald-50";
  if (status === "PENDING" || status === "QUEUED") return "text-amber-700 bg-amber-50";
  return "text-slate-700 bg-slate-100";
}

function itemAgeHours(createdAt: string) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 3_600_000);
}

export default function AppOverviewPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = useMemo(() => buildReturnTo(pathname, searchParams), [pathname, searchParams]);
  const [state, setState] = useState<DashboardState>({
    calls: [],
    leads: [],
    requests: [],
    attention: [],
    approvals: [],
    followUps: [],
    insights: null,
    operations: [],
    onboardingStatus: null,
    meId: null,
    accessSummary: null
  });
  const [loading, setLoading] = useState(true);
  const [reviewRefreshNote, setReviewRefreshNote] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    const [calls, leads, requests, onboarding, attention, approvals, followUps, insights, operations, me, profile] = await Promise.all([
      fetchOrgCalls({ page: 1, pageSize: 10 }),
      fetchOrgLeads(),
      fetchAppointmentRequests(),
      fetchOrgOnboarding(),
      fetchAttentionQueue({ limit: 6 }),
      fetchAiApprovals("PENDING"),
      fetchFollowUpQueue("OPEN"),
      fetchManagerInsights(),
      fetchOperationsFeed({ limit: 12 }),
      getMe(),
      fetchOrgProfile().catch(() => null)
    ]);
    setState({
      calls: calls.calls || [],
      leads: leads.leads || [],
      requests: requests.requests || [],
      attention: attention.items || [],
      approvals: approvals.approvals || [],
      followUps: followUps.queue || [],
      insights: insights || null,
      operations: operations.events || [],
      onboardingStatus: onboarding.submission?.status || null,
      meId: me.user.userId,
      accessSummary: profile?.access || null
    });
  }, []);

  useEffect(() => {
    let active = true;
    void loadDashboard()
      .catch(() => undefined)
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadDashboard]);

  useEffect(() => {
    const onFocusRefresh = () => {
      if (document.visibilityState === "hidden") return;
      const reasons = consumeDailyReviewDirtyReasons();
      if (!reasons.length) return;
      void loadDashboard();
      setReviewRefreshNote("Daily review queues updated from recent actions.");
      window.setTimeout(() => setReviewRefreshNote(null), 2800);
    };
    window.addEventListener("focus", onFocusRefresh);
    document.addEventListener("visibilitychange", onFocusRefresh);
    onFocusRefresh();
    return () => {
      window.removeEventListener("focus", onFocusRefresh);
      document.removeEventListener("visibilitychange", onFocusRefresh);
    };
  }, [loadDashboard]);

  const metrics = useMemo(() => {
    const callsToday = state.calls.filter((call) => new Date(call.startedAt).toDateString() === new Date().toDateString()).length;
    const activeLeads = state.leads.filter((lead) => lead.frontDesk?.needsFollowUp || lead.pipelineStage !== "COMPLETED").length;
    const bookings = state.insights?.bookingRequests ?? state.requests.filter((request) => request.status === "SCHEDULED" || request.status === "APPROVED").length;
    const missed = state.insights?.callsMissed ?? state.calls.filter((call) => call.outcome === "MISSED").length;
    const unresolved = state.attention.filter((item) => item.unresolved).length;
    return [
      { label: "Total Calls", value: String(state.insights?.callsTotal ?? state.calls.length), trend: callsToday > 0 ? `+${callsToday} today` : "No calls today", icon: Phone, color: "text-emerald-500", path: "M0,15 Q25,5 50,15 T100,5" },
      { label: "Active Leads", value: String(activeLeads), trend: state.leads.length ? `${state.leads.length} in queue` : "No leads yet", icon: UserPlus, color: "text-emerald-500", path: "M0,18 Q30,15 45,5 T80,12 T100,2" },
      { label: "Bookings", value: String(bookings), trend: state.requests.length ? `${state.requests.length} requests` : "No bookings yet", icon: Calendar, color: "text-emerald-500", path: "M0,10 Q10,20 30,5 T70,15 T100,5" },
      { label: "Missed Calls", value: String(missed), trend: missed > 0 ? "Needs callback review" : OPERATIONAL_LABELS.healthy, icon: AlertCircle, color: missed > 0 ? "text-amber-600" : "text-emerald-500", path: "M0,12 Q20,2 40,13 T80,7 T100,10" },
      { label: "Pending Approvals", value: String(state.insights?.pendingApprovals ?? state.approvals.length), trend: state.approvals.length ? "Operator review required" : "Nothing pending", icon: Mail, color: state.approvals.length ? "text-amber-600" : "text-emerald-500", path: "M0,10 Q20,14 40,6 T100,8" },
      { label: "Needs Attention", value: String(unresolved), trend: unresolved > 0 ? "Prioritized by urgency" : "No critical queue", icon: Sparkles, color: unresolved > 0 ? "text-amber-600" : "text-emerald-500", path: "M0,9 Q25,5 50,12 T100,6" }
    ];
  }, [state.approvals.length, state.attention, state.calls, state.insights, state.leads, state.requests]);

  const attentionItems = useMemo(() => state.attention.slice(0, 5), [state.attention]);
  const topPendingApproval = useMemo(() => state.approvals[0] || null, [state.approvals]);
  const overdueFollowUps = useMemo(() => state.followUps.filter((item) => item.task?.dueAt && new Date(item.task.dueAt).getTime() < Date.now()), [state.followUps]);
  const topOverdueFollowUp = useMemo(() => overdueFollowUps[0] || null, [overdueFollowUps]);
  const followUpOwnerSnapshot = useMemo(() => {
    const mine = state.followUps.filter((item) => state.meId && item.task?.assignedToUserId === state.meId).length;
    const unassigned = state.followUps.filter((item) => !item.task?.assignedToUserId).length;
    const overdueMine = overdueFollowUps.filter((item) => state.meId && item.task?.assignedToUserId === state.meId).length;
    const overdueUnassigned = overdueFollowUps.filter((item) => !item.task?.assignedToUserId).length;
    return { mine, unassigned, overdueMine, overdueUnassigned };
  }, [overdueFollowUps, state.followUps, state.meId]);
  const atRiskSnapshot = useMemo(() => {
    const overdueUnassigned = state.followUps.filter((item) => {
      const overdue = Boolean(item.task?.dueAt && new Date(item.task.dueAt).getTime() < Date.now());
      return overdue && !item.task?.assignedToUserId;
    }).length;
    const staleAssigned = state.followUps.filter((item) => {
      const overdue = Boolean(item.task?.dueAt && new Date(item.task.dueAt).getTime() < Date.now());
      return overdue && Boolean(item.task?.assignedToUserId) && itemAgeHours(item.createdAt) >= 24;
    }).length;
    const pendingApprovalsAging = state.approvals.filter((approval) => {
      if (approval.status !== "PENDING") return false;
      return Date.now() - new Date(approval.createdAt).getTime() >= 2 * 60 * 60 * 1000;
    }).length;
    const ownerByEntity = new Map<string, "mine" | "assigned_elsewhere" | "unassigned">();
    for (const followUp of state.followUps) {
      if (!followUp.entityType || !followUp.entityId || followUp.status !== "OPEN") continue;
      const key = `${followUp.entityType}:${followUp.entityId}`;
      if (!followUp.task?.assignedToUserId) {
        ownerByEntity.set(key, ownerByEntity.get(key) || "unassigned");
      } else if (state.meId && followUp.task.assignedToUserId === state.meId) {
        ownerByEntity.set(key, "mine");
      } else if (!ownerByEntity.has(key)) {
        ownerByEntity.set(key, "assigned_elsewhere");
      }
    }
    const criticalUnownedAttention = state.attention.filter((item) => {
      const key = `${item.entityType}:${item.entityId}`;
      const owner = ownerByEntity.get(key);
      return (item.attentionLevel === "CRITICAL" || item.attentionLevel === "HIGH") && owner === "unassigned";
    }).length;
    const criticalHighAttention = state.attention.filter(
      (item) => item.attentionLevel === "CRITICAL" || item.attentionLevel === "HIGH"
    ).length;
    return { overdueUnassigned, staleAssigned, pendingApprovalsAging, criticalUnownedAttention, criticalHighAttention };
  }, [state.approvals, state.attention, state.followUps, state.meId]);
  const reviewTodaySnapshot = useMemo(() => {
    const failedRetryableSends = state.operations.filter((event) => {
      const eventType = event.eventType || "";
      const retryable = Boolean((event.metadata as { retryable?: boolean } | null)?.retryable);
      return retryable && (eventType === "delivery_failed" || eventType === "retry_delivery_failed");
    }).length;
    const needsReviewTodayCount =
      atRiskSnapshot.criticalUnownedAttention +
      atRiskSnapshot.overdueUnassigned +
      atRiskSnapshot.pendingApprovalsAging +
      failedRetryableSends;
    return {
      failedRetryableSends,
      needsReviewTodayCount
    };
  }, [atRiskSnapshot.criticalUnownedAttention, atRiskSnapshot.overdueUnassigned, atRiskSnapshot.pendingApprovalsAging, state.operations]);
  const isReviewQuiet = reviewTodaySnapshot.needsReviewTodayCount === 0;
  const isLowActivityWorkspace = useMemo(() => {
    const primaryActivity = state.calls.length + state.leads.length + state.requests.length + state.operations.length;
    return primaryActivity < 6 && state.attention.length === 0 && state.approvals.length === 0 && state.followUps.length === 0;
  }, [state.approvals.length, state.attention.length, state.calls.length, state.followUps.length, state.leads.length, state.operations.length, state.requests.length]);
  const readinessStatus = useMemo(() => {
    const access = state.accessSummary;
    if (!access) {
      return {
        mode: "unknown" as const,
        missingCount: 0
      };
    }
    const featureNeedsSetup = Object.values(access.features).filter(
      (feature) => feature.status === "setup_required" || feature.status === "gated" || feature.status === "blocked"
    ).length;
    const checklistNeedsSetup = access.readinessChecklist.filter((check) => check.status !== "ready").length;
    const missingCount = featureNeedsSetup + checklistNeedsSetup;
    if (missingCount > 0) {
      return {
        mode: "setup_required" as const,
        missingCount
      };
    }
    return {
      mode: "configured" as const,
      missingCount: 0
    };
  }, [state.accessSummary]);

  const onboardingReady = state.onboardingStatus && ["SUBMITTED", "REVIEWED", "APPROVED"].includes(state.onboardingStatus);

  return (
    <div className="flex-1 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-100">
      <div className="grid h-full xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-y-auto bg-slate-100 p-4 md:p-6 xl:p-8">
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Operational Command</p>
                <h2 className="mt-1 text-4xl font-bold tracking-[-0.04em] text-slate-900">Daily Triage</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                >
                  Export Manifest
                </button>
                <Link
                  href={buildWorkflowHref("/app/attention", { source: "dashboard", returnTo, returnLabel: "Dashboard" })}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
                >
                  Start New Operation
                </Link>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {onboardingReady
                ? "Queues are live. Monitor risk and clear work items during this shift."
                : "Finish setup so calls, messages, and bookings route correctly before full rollout."}
            </p>
            <div className="mt-4">
              <AskAiInline page="dashboard" defaultAgentKey="manager_analytics" placeholder="Ask for a manager summary, risks, or recommended next actions..." />
            </div>
          </div>

          <div className="mb-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Active Throughput</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">{loading ? "-" : state.calls.length + state.leads.length + state.requests.length}</p>
              <p className="mt-2 text-xs font-semibold text-emerald-700">{metrics[0]?.trend || "Stable"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Mean Triage Time</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">{loading ? "-" : `${Math.max(2.1, Number(((state.followUps.length + state.approvals.length) / 5).toFixed(1)))}m`}</p>
              <p className="mt-2 text-xs font-semibold text-rose-700">{overdueFollowUps.length > 0 ? `${overdueFollowUps.length} overdue tasks` : "Within expected range"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Open Approvals</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">{loading ? "-" : state.approvals.length}</p>
              <p className="mt-2 text-xs font-semibold text-slate-600">{topPendingApproval?.toolKey || "Steady"}</p>
            </div>
            <div className="rounded-xl border-l-4 border-l-rose-600 border-t border-r border-b border-rose-200 bg-rose-50/50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-700">Blocked Items</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-rose-800">{loading ? "-" : atRiskSnapshot.overdueUnassigned + atRiskSnapshot.criticalUnownedAttention}</p>
              <p className="mt-2 text-xs font-semibold text-rose-700">Escalation required</p>
            </div>
          </div>

          <div className="mb-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Action Now</h2>
                <Link href="/app/attention" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
                  View all tasks
                </Link>
              </div>
              <div className="divide-y divide-slate-200">
                <Link
                  href={buildWorkflowHref("/app/attention", { source: "dashboard", returnTo, returnLabel: "Dashboard" })}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-slate-50"
                >
                  <div>
                    <p className="text-base font-semibold text-slate-900">Needs Attention Queue</p>
                    <p className="mt-1 text-sm text-slate-500">{attentionItems[0]?.topReasons?.[0] || "No critical items right now"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Due</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{loading ? "-" : attentionItems.length}</p>
                  </div>
                </Link>
                <Link
                  href={buildWorkflowHref("/app/approvals?focus=needs_review", { source: "dashboard", returnTo, returnLabel: "Dashboard" })}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-slate-50"
                >
                  <div>
                    <p className="text-base font-semibold text-slate-900">Approval Required</p>
                    <p className="mt-1 text-sm text-slate-500">{topPendingApproval?.toolKey || "No pending approvals"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Due</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{loading ? "-" : state.approvals.length}</p>
                  </div>
                </Link>
                <Link
                  href={buildWorkflowHref("/app/follow-up?status=at_risk", { source: "dashboard", returnTo, returnLabel: "Dashboard" })}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-slate-50"
                >
                  <div>
                    <p className="text-base font-semibold text-slate-900">Follow-up At Risk</p>
                    <p className="mt-1 text-sm text-slate-500">{topOverdueFollowUp?.task?.title || "No overdue follow-up tasks"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Due</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{loading ? "-" : overdueFollowUps.length + atRiskSnapshot.staleAssigned}</p>
                  </div>
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border-t-4 border-t-rose-700 border border-slate-200 bg-white p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-700">At Risk Items</h3>
              <div className="mt-3 space-y-3">
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">Critical/high unassigned</p>
                    <span className="text-[11px] font-semibold uppercase text-rose-700">Critical</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">Needs ownership assignment now.</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-rose-100">
                    <div
                      className="h-full rounded-full bg-rose-600"
                      style={{ width: `${Math.min(100, (atRiskSnapshot.criticalUnownedAttention || 0) * 20)}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">Stale assigned follow-up</p>
                    <span className="text-[11px] font-semibold uppercase text-amber-700">Warning</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">Response times are beyond target window.</p>
                </div>
              </div>
              <Link
                href={buildWorkflowHref("/app/insights", { source: "dashboard", returnTo, returnLabel: "Dashboard" })}
                className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 transition-colors hover:bg-slate-100"
              >
                View full audit log
              </Link>
            </div>
          </div>

        <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Needs Attention Queue</h2>
              <p className="text-xs text-slate-500">Highest-priority entities with recommended owner actions</p>
            </div>
            <Link href="/app/attention" className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50">
              View all
            </Link>
          </div>
          <div className="space-y-3 p-4 md:hidden">
            {loading ? <p className="text-sm text-slate-500">Loading attention queue...</p> : null}
            {!loading && !attentionItems.length ? (
              <p className="text-sm text-slate-500">
                {isLowActivityWorkspace
                  ? "No attention items yet. Start with calls, leads, or messages to activate this queue."
                  : "No priority attention items right now."}
              </p>
            ) : null}
            {!loading
              ? attentionItems.map((item) => {
                  const tone =
                    item.attentionLevel === "CRITICAL"
                      ? "bg-red-100 text-red-700"
                      : item.attentionLevel === "HIGH"
                        ? "bg-orange-100 text-orange-700"
                        : item.attentionLevel === "MEDIUM"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700";
                  return (
                    <div key={`${item.entityType}-${item.entityId}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", tone)}>{item.attentionLevel}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{item.recommendedOwnerAction}</p>
                      <Link
                        href={buildWorkflowHref(item.entityHref, {
                          source: "dashboard",
                          returnTo,
                          returnLabel: "Dashboard"
                        })}
                        className="mt-2 inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                      >
                        Open
                      </Link>
                    </div>
                  );
                })
              : null}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[820px] w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <th className="px-6 py-3">Entity</th>
                  <th className="px-6 py-3">Level</th>
                  <th className="px-6 py-3">Top Reason</th>
                  <th className="px-6 py-3">Recommended Action</th>
                  <th className="px-6 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td className="px-6 py-8 text-sm text-slate-500" colSpan={5}>Loading attention queue...</td>
                  </tr>
                ) : attentionItems.length ? (
                  attentionItems.map((item) => {
                    const tone =
                      item.attentionLevel === "CRITICAL"
                        ? "bg-red-100 text-red-700"
                        : item.attentionLevel === "HIGH"
                          ? "bg-orange-100 text-orange-700"
                          : item.attentionLevel === "MEDIUM"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-700";
                    return (
                      <tr key={`${item.entityType}-${item.entityId}`} className="cursor-pointer transition-colors hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">{entityLabel(item.entityType)}</span>
                            <span className="text-sm font-medium text-slate-900">{item.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", tone)}>{item.attentionLevel}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{item.topReasons[0] || "-"}</td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-700">{item.recommendedOwnerAction}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={buildWorkflowHref(item.entityHref, {
                              source: "dashboard",
                              returnTo,
                              returnLabel: "Dashboard"
                            })}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-6 py-8 text-sm text-slate-500" colSpan={5}>
                      {isLowActivityWorkspace
                        ? "No attention items yet. Start with calls, leads, or messages to activate this queue."
                        : "No priority attention items right now."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {reviewRefreshNote ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            {reviewRefreshNote}
          </div>
        ) : null}
        {isLowActivityWorkspace ? (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-800">Getting Started</p>
            <p className="mt-1 text-xs text-blue-700">
              {readinessStatus.mode === "setup_required"
                ? `Setup is not complete (${readinessStatus.missingCount} readiness item${readinessStatus.missingCount === 1 ? "" : "s"}). Finish setup first, then run a live workflow.`
                : readinessStatus.mode === "configured"
                  ? "Setup looks ready. Activity is low because workflows have not run recently."
                  : "Activity is still low. Start with one live workflow so attention, approvals, follow-up, and operations views populate."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {readinessStatus.mode === "setup_required" ? (
                <Link href={buildWorkflowHref("/app/settings", { source: "dashboard", returnTo, returnLabel: "Dashboard" })} className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700">
                  Open Settings readiness
                </Link>
              ) : (
                <>
                  <Link href={buildWorkflowHref("/app/calls", { source: "dashboard", returnTo, returnLabel: "Dashboard" })} className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700">
                    Open Calls
                  </Link>
                  <Link href={buildWorkflowHref("/app/leads", { source: "dashboard", returnTo, returnLabel: "Dashboard" })} className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700">
                    Open Leads
                  </Link>
                  <Link href={buildWorkflowHref("/app/messages", { source: "dashboard", returnTo, returnLabel: "Dashboard" })} className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700">
                    Open Messages
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}

        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">Daily Review</h3>
              <p className="text-sm text-slate-500">Fast check of critical, aging, unassigned, and failed work that needs action today.</p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
              Needs review today: {reviewTodaySnapshot.needsReviewTodayCount}
            </span>
          </div>
          {isReviewQuiet ? (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              {isLowActivityWorkspace
                ? readinessStatus.mode === "setup_required"
                  ? `Daily review is ${OPERATIONAL_LABELS.quiet.toLowerCase()} because setup is still incomplete. Finish readiness setup first.`
                  : `Daily review is ${OPERATIONAL_LABELS.quiet.toLowerCase()} because activity is still ${OPERATIONAL_LABELS.lowActivity.toLowerCase()}. Start a first workflow to populate review queues.`
                : "Nothing urgent right now. Daily review queues are clear."}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Ownerless critical work</p>
              <p className="mt-1 text-2xl font-black text-rose-800">{atRiskSnapshot.criticalUnownedAttention}</p>
              <Link
                href={buildWorkflowHref("/app/attention?risk=critical_unowned", { source: "dashboard", returnTo, returnLabel: "Daily Review" })}
                className="mt-2 inline-flex items-center rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100/70"
              >
                Open critical unassigned attention
              </Link>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Overdue unassigned follow-up</p>
              <p className="mt-1 text-2xl font-black text-red-800">{atRiskSnapshot.overdueUnassigned}</p>
              <Link
                href={buildWorkflowHref("/app/follow-up?status=overdue_unassigned", { source: "dashboard", returnTo, returnLabel: "Daily Review" })}
                className="mt-2 inline-flex items-center rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100/70"
              >
                Open overdue unassigned follow-up
              </Link>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Stale assigned follow-up</p>
              <p className="mt-1 text-2xl font-black text-amber-800">{atRiskSnapshot.staleAssigned}</p>
              <Link
                href={buildWorkflowHref("/app/follow-up?status=at_risk", { source: "dashboard", returnTo, returnLabel: "Daily Review" })}
                className="mt-2 inline-flex items-center rounded-md border border-amber-200 bg-white px-2.5 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100/70"
              >
                Open at risk follow-up
              </Link>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Oldest pending approvals (2h+)</p>
              <p className="mt-1 text-2xl font-black text-slate-800">{atRiskSnapshot.pendingApprovalsAging}</p>
              <Link
                href={buildWorkflowHref("/app/approvals?focus=needs_review", { source: "dashboard", returnTo, returnLabel: "Daily Review" })}
                className="mt-2 inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                Open approvals needing review
              </Link>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Failed sends needing retry</p>
              <p className="mt-1 text-2xl font-black text-red-800">{reviewTodaySnapshot.failedRetryableSends}</p>
              <Link
                href={buildWorkflowHref("/app/insights?feedFilter=failures", { source: "dashboard", returnTo, returnLabel: "Daily Review" })}
                className="mt-2 inline-flex items-center rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100/70"
              >
                Open failure feed
              </Link>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Critical/high attention</p>
              <p className="mt-1 text-2xl font-black text-blue-800">{atRiskSnapshot.criticalHighAttention}</p>
              <Link
                href={buildWorkflowHref("/app/attention?level=CRITICAL", { source: "dashboard", returnTo, returnLabel: "Daily Review" })}
                className="mt-2 inline-flex items-center rounded-md border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100/70"
              >
                Open critical attention
              </Link>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={buildWorkflowHref("/app/attention?risk=critical_unowned", { source: "dashboard", returnTo, returnLabel: "Daily Review" })}
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700"
            >
              Unassigned critical work
            </Link>
            <Link
              href={buildWorkflowHref("/app/follow-up?status=at_risk", { source: "dashboard", returnTo, returnLabel: "Daily Review" })}
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
            >
              At risk follow-up
            </Link>
            <Link
              href={buildWorkflowHref("/app/approvals?focus=needs_retry", { source: "dashboard", returnTo, returnLabel: "Daily Review" })}
              className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
            >
              Failed sends needing retry
            </Link>
            <Link
              href={buildWorkflowHref("/app/approvals?focus=needs_review", { source: "dashboard", returnTo, returnLabel: "Daily Review" })}
              className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
            >
              Approvals needing review
            </Link>
          </div>
        </div>

        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:hidden md:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Recent Operations</h3>
            <Link href="/app/insights" className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50">
              Open insights
            </Link>
          </div>
          <OperationsFeedList
            events={state.operations.slice(0, 8)}
            loading={loading}
            emptyMessage={`No recent operations yet. The workspace is currently ${OPERATIONAL_LABELS.quiet.toLowerCase()}.`}
            source="dashboard"
            returnLabel="Dashboard"
            onActionComplete={loadDashboard}
          />
        </div>

        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Supporting operational modules</h2>
            <span className="text-xs text-slate-400">Secondary context</span>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Pending Approvals</h3>
              <Link
                href={buildWorkflowHref("/app/approvals?status=PENDING", { source: "dashboard", returnTo, returnLabel: "Dashboard" })}
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Open queue
              </Link>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{loading ? "-" : state.approvals.length}</p>
            <p className="mt-1 text-xs text-slate-500">Awaiting operator decision before outbound send or sensitive actions.</p>
            {topPendingApproval ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <p className="font-semibold text-slate-900">{topPendingApproval.toolKey}</p>
                <p className="mt-1">{topPendingApproval.outputSummary || topPendingApproval.inputSummary || "Approval pending review."}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", deliveryTone(topPendingApproval.deliveryStatus || topPendingApproval.status))}>
                    {topPendingApproval.deliveryStatus || topPendingApproval.status}
                  </span>
                  <span className="text-[11px] text-slate-500">{formatRelative(topPendingApproval.updatedAt)}</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                {isLowActivityWorkspace
                  ? readinessStatus.mode === "setup_required"
                    ? "No approvals yet. Complete readiness setup, then create first drafts from Calls, Leads, or Messages."
                    : "No approvals yet. Approval-gated actions appear after first drafts are created."
                  : "No approvals need review right now."}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Follow-up Queue</h3>
              <Link
                href={buildWorkflowHref("/app/follow-up", { source: "dashboard", returnTo, returnLabel: "Dashboard" })}
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Open queue
              </Link>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{loading ? "-" : state.followUps.length}</p>
            <p className="mt-1 text-xs text-slate-500">
              {overdueFollowUps.length} overdue, {Math.max(0, state.followUps.length - overdueFollowUps.length)} active.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">Mine {followUpOwnerSnapshot.mine}</span>
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600">Unassigned {followUpOwnerSnapshot.unassigned}</span>
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">Overdue mine {followUpOwnerSnapshot.overdueMine}</span>
              <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-700">Overdue unassigned {followUpOwnerSnapshot.overdueUnassigned}</span>
            </div>
            {topOverdueFollowUp ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <p className="font-semibold">{topOverdueFollowUp.task?.title || topOverdueFollowUp.reason}</p>
                <p className="mt-1">Due {topOverdueFollowUp.task?.dueAt ? formatRelative(topOverdueFollowUp.task.dueAt) : "date not set"}</p>
                <Link
                  href={buildWorkflowHref(`/app/follow-up?queueItemId=${encodeURIComponent(topOverdueFollowUp.id)}`, {
                    source: "dashboard",
                    returnTo,
                    returnLabel: "Dashboard"
                  })}
                  className="mt-2 inline-flex items-center rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-100/70"
                >
                  Open overdue follow-up
                </Link>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                {isLowActivityWorkspace
                  ? readinessStatus.mode === "setup_required"
                    ? "No follow-up items yet. Complete readiness setup, then run workflows that create tasks."
                    : "No follow-up items yet. Follow-up appears after calls, messages, or lead actions create tasks."
                  : "No overdue follow-up items at the moment."}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">At Risk Work</h3>
              <Link
                href={buildWorkflowHref("/app/attention?risk=at_risk", { source: "dashboard", returnTo, returnLabel: "Dashboard" })}
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Review risk
              </Link>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2">
                <span className="font-semibold text-red-800">Overdue unassigned follow-up</span>
                <span className="font-bold text-red-800">{atRiskSnapshot.overdueUnassigned}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <span className="font-semibold text-amber-800">Overdue assigned but stale</span>
                <span className="font-bold text-amber-800">{atRiskSnapshot.staleAssigned}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
                <span className="font-semibold text-rose-800">Critical/high attention unassigned</span>
                <span className="font-bold text-rose-800">{atRiskSnapshot.criticalUnownedAttention}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="font-semibold text-slate-700">Pending approvals aging 2h+</span>
                <span className="font-bold text-slate-700">{atRiskSnapshot.pendingApprovalsAging}</span>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>

      <aside className="hidden border-l border-slate-200 bg-slate-50 xl:flex xl:flex-col">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900">Operations Feed</h2>
          <p className="text-xs text-slate-500">Live activity across approvals, delivery, handoffs, and follow-up updates.</p>
        </div>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          <OperationsFeedList
            events={state.operations}
            loading={loading}
            emptyMessage="No recent operations yet. Activity will appear after approvals, sends, and queue updates."
            source="dashboard"
            returnLabel="Dashboard"
            onActionComplete={loadDashboard}
          />
        </div>
        <div className="border-t border-slate-200 p-6">
          <Link href="/app/insights" className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100">
            Open insights
          </Link>
        </div>
      </aside>
      </div>
    </div>
  );
}
