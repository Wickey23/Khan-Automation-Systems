"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { buildReturnTo, buildWorkflowHref } from "@/lib/workflow-nav";
import { consumeDailyReviewDirtyReasons } from "@/lib/review-loop";
import { OPERATIONAL_LABELS } from "@/lib/operational-language";
import { CommandHeader, KpiCard, RiskRailCard, SectionDisclosure } from "@/components/ops";

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

  const attentionItems = useMemo(() => state.attention.slice(0, 5), [state.attention]);
  const topPendingApproval = useMemo(() => state.approvals[0] || null, [state.approvals]);
  const overdueFollowUps = useMemo(() => state.followUps.filter((item) => item.task?.dueAt && new Date(item.task.dueAt).getTime() < Date.now()), [state.followUps]);
  const topOverdueFollowUp = useMemo(() => overdueFollowUps[0] || null, [overdueFollowUps]);
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
  const activeThroughput = state.calls.length + state.leads.length + state.requests.length;
  const meanTriageTime = `${Math.max(2.1, Number(((state.followUps.length + state.approvals.length) / 5).toFixed(1)))}m`;
  const blockedItems = atRiskSnapshot.overdueUnassigned + atRiskSnapshot.criticalUnownedAttention;
  const riskItems = [
    {
      id: "critical-unassigned",
      title: "Critical/high unassigned",
      detail: "Needs ownership assignment now.",
      level: "critical" as const,
      meter: Math.min(100, atRiskSnapshot.criticalUnownedAttention * 20)
    },
    {
      id: "stale-assigned",
      title: "Stale assigned follow-up",
      detail: "Response times are beyond target window.",
      level: "warning" as const
    }
  ];

  return (
    <div className="flex-1 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-100">
      <div className="grid h-full xl:grid-cols-1">
        <div className="overflow-y-auto bg-slate-100 p-4 md:p-6 xl:p-8">
          <CommandHeader
            className="mb-6"
            title="Daily Triage"
            description={
              onboardingReady
                ? "Queues are live. Monitor risk and clear work items during this shift."
                : "Finish setup so calls, messages, and bookings route correctly before full rollout."
            }
            actions={
              <Link
                href={buildWorkflowHref("/app/attention", { source: "dashboard", returnTo, returnLabel: "Dashboard" })}
                className="inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
              >
                Run Priority Triage
              </Link>
            }
          />

          <div className="mb-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Active Throughput" value={loading ? "-" : String(activeThroughput)} detail={activeThroughput > 0 ? "Live workflow volume" : "No live volume yet"} />
            <KpiCard label="Mean Triage Time" value={loading ? "-" : meanTriageTime} detail={overdueFollowUps.length > 0 ? `${overdueFollowUps.length} overdue tasks` : "Within expected range"} />
            <KpiCard label="Open Approvals" value={loading ? "-" : String(state.approvals.length)} detail={topPendingApproval?.toolKey || "Steady"} />
            <KpiCard label="Blocked Items" value={loading ? "-" : String(blockedItems)} detail="Escalation required" emphasis="risk" />
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

            <RiskRailCard
              title="At Risk Items"
              items={riskItems}
              ctaHref={buildWorkflowHref("/app/insights", { source: "dashboard", returnTo, returnLabel: "Dashboard" })}
              ctaLabel="View full audit log"
            />
          </div>
          <SectionDisclosure
            title="Operational Detail"
            storageKey="dashboard-operational-detail"
            defaultCollapsed
          >
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

            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 md:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Daily Review</h3>
                  <p className="text-xs text-slate-500">Critical and aging queues that need operator attention today.</p>
                </div>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Needs review: {reviewTodaySnapshot.needsReviewTodayCount}
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
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Link href={buildWorkflowHref("/app/attention?risk=critical_unowned", { source: "dashboard", returnTo, returnLabel: "Daily Review" })} className="rounded-lg border border-rose-200 bg-rose-50 p-3 transition-colors hover:bg-rose-100/60">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Unassigned critical work</p>
                  <p className="mt-1 text-2xl font-bold text-rose-800">{atRiskSnapshot.criticalUnownedAttention}</p>
                </Link>
                <Link href={buildWorkflowHref("/app/follow-up?status=overdue_unassigned", { source: "dashboard", returnTo, returnLabel: "Daily Review" })} className="rounded-lg border border-red-200 bg-red-50 p-3 transition-colors hover:bg-red-100/60">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">Overdue unassigned follow-up</p>
                  <p className="mt-1 text-2xl font-bold text-red-800">{atRiskSnapshot.overdueUnassigned}</p>
                </Link>
                <Link href={buildWorkflowHref("/app/follow-up?status=at_risk", { source: "dashboard", returnTo, returnLabel: "Daily Review" })} className="rounded-lg border border-amber-200 bg-amber-50 p-3 transition-colors hover:bg-amber-100/60">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Stale assigned follow-up</p>
                  <p className="mt-1 text-2xl font-bold text-amber-800">{atRiskSnapshot.staleAssigned}</p>
                </Link>
                <Link href={buildWorkflowHref("/app/approvals?focus=needs_review", { source: "dashboard", returnTo, returnLabel: "Daily Review" })} className="rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors hover:bg-slate-100">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Pending approvals aging 2h+</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{atRiskSnapshot.pendingApprovalsAging}</p>
                </Link>
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Recent Operations</h3>
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

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">AI Assistant</h3>
                <span className="text-xs text-slate-500">Supportive, not primary</span>
              </div>
              <AskAiInline page="dashboard" defaultAgentKey="manager_analytics" placeholder="Ask for a manager summary, risks, or recommended next actions..." />
            </div>
          </SectionDisclosure>
        </div>
      </div>
    </div>
  );
}

