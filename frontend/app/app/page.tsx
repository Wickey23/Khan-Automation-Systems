"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { StateCard } from "@/components/ui/state-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { OperationsFeedList } from "@/components/ai/operations-feed-list";
import { cn } from "@/lib/utils";

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

function QueueRow({
  title,
  description,
  href,
  volume,
  priority,
  ctaLabel,
  statusLabel,
  spotlight = false,
  order = "secondary"
}: {
  title: string;
  description: string;
  href: string;
  volume: number;
  priority: "critical" | "high" | "normal";
  ctaLabel: string;
  statusLabel: string;
  spotlight?: boolean;
  order?: "primary" | "secondary";
}) {
  const priorityClasses =
    priority === "critical"
      ? "border-rose-300 bg-rose-50/80"
      : priority === "high"
        ? "border-amber-300 bg-amber-50/70"
        : "border-slate-200 bg-white";

  const priorityPillClasses =
    priority === "critical"
      ? "border-rose-300 bg-rose-100 text-rose-800"
      : priority === "high"
        ? "border-amber-300 bg-amber-100 text-amber-800"
        : "border-slate-300 bg-slate-100 text-slate-700";

  const priorityLabel = priority === "critical" ? "Critical" : priority === "high" ? "High" : "Normal";
  const badgeState = priority === "critical" ? "failed" : priority === "high" ? "review" : "ready";

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-start justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors hover:bg-slate-50",
        priorityClasses,
        spotlight ? "ring-2 ring-rose-200 shadow-[0_8px_18px_-10px_rgba(225,29,72,0.45)]" : "",
        order === "primary" ? "shadow-[0_8px_16px_-14px_rgba(15,23,42,0.35)]" : "opacity-95"
      )}
    >
      {priority === "critical" ? <span className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-rose-500" /> : null}
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]", priorityPillClasses)}>
            {priorityLabel}
          </span>
          <StatusBadge kind="generic" state={badgeState} label={statusLabel} size="xs" />
        </div>
        {description ? <p className="text-[11px] text-slate-600">{description}</p> : null}
        {spotlight ? <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-700">Do first</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("text-base font-bold leading-none", priority === "critical" ? "text-rose-700" : "text-slate-900")}>{volume}</p>
        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 group-hover:text-slate-900">
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </p>
      </div>
    </Link>
  );
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
  const [error, setError] = useState<string | null>(null);
  const [reviewRefreshNote, setReviewRefreshNote] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
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
      setError(null);
    } catch {
      setError("Unable to load dashboard data. Try refreshing in a moment.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    void loadDashboard().finally(() => {
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
  const overdueFollowUps = useMemo(
    () => state.followUps.filter((item) => item.task?.dueAt && new Date(item.task.dueAt).getTime() < Date.now()),
    [state.followUps]
  );
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

  const activeThroughput = state.calls.length + state.leads.length + state.requests.length;
  const meanTriageTime = `${Math.max(2.1, Number(((state.followUps.length + state.approvals.length) / 5).toFixed(1)))}m`;
  const blockedItems = atRiskSnapshot.overdueUnassigned + atRiskSnapshot.criticalUnownedAttention;
  const actionQueueTotal = attentionItems.length + state.approvals.length + overdueFollowUps.length + atRiskSnapshot.staleAssigned;

  const attentionHref = buildWorkflowHref("/app/attention", { source: "dashboard", returnTo, returnLabel: "Dashboard" });
  const approvalsHref = buildWorkflowHref("/app/approvals", { source: "dashboard", returnTo, returnLabel: "Dashboard" });
  const followUpHref = buildWorkflowHref("/app/follow-up", { source: "dashboard", returnTo, returnLabel: "Dashboard" });

  const attentionPriority: "critical" | "high" | "normal" =
    atRiskSnapshot.criticalUnownedAttention > 0
      ? "critical"
      : atRiskSnapshot.criticalHighAttention > 0
        ? "high"
        : "normal";
  const approvalsPriority: "critical" | "high" | "normal" =
    atRiskSnapshot.pendingApprovalsAging > 0 ? "high" : state.approvals.length > 0 ? "normal" : "normal";
  const followUpPriority: "critical" | "high" | "normal" =
    atRiskSnapshot.overdueUnassigned > 0 ? "critical" : atRiskSnapshot.staleAssigned > 0 ? "high" : "normal";
  const followUpQueueTotal = overdueFollowUps.length + atRiskSnapshot.staleAssigned;
  const clearedBuckets =
    Number(attentionItems.length === 0) +
    Number(state.approvals.length === 0) +
    Number(followUpQueueTotal === 0);
  const queueProgressPercent = Math.round((clearedBuckets / 3) * 100);
  const topTask = useMemo(() => {
    if (atRiskSnapshot.criticalUnownedAttention > 0) {
      return {
        title: "Assign critical attention items",
        detail: `${atRiskSnapshot.criticalUnownedAttention} unowned critical item(s) need an owner now.`,
        href: attentionHref,
        cta: "Open attention",
        priority: "critical" as const
      };
    }
    if (atRiskSnapshot.overdueUnassigned > 0) {
      return {
        title: "Assign overdue follow-up",
        detail: `${atRiskSnapshot.overdueUnassigned} overdue task(s) are unassigned.`,
        href: followUpHref,
        cta: "Open follow-up",
        priority: "critical" as const
      };
    }
    if (atRiskSnapshot.pendingApprovalsAging > 0) {
      return {
        title: "Clear aging approvals",
        detail: `${atRiskSnapshot.pendingApprovalsAging} approval(s) have been pending for 2h+.`,
        href: approvalsHref,
        cta: "Review approvals",
        priority: "high" as const
      };
    }
    if (attentionItems.length > 0) {
      return {
        title: "Review attention queue",
        detail: `${attentionItems.length} attention item(s) awaiting review.`,
        href: attentionHref,
        cta: "Open queue",
        priority: "high" as const
      };
    }
    if (followUpQueueTotal > 0) {
      return {
        title: "Triage follow-up queue",
        detail: `${followUpQueueTotal} at-risk follow-up item(s) are pending.`,
        href: followUpHref,
        cta: "Open follow-up",
        priority: "normal" as const
      };
    }
    if (state.approvals.length > 0) {
      return {
        title: "Review pending approvals",
        detail: `${state.approvals.length} approval request(s) need review.`,
        href: approvalsHref,
        cta: "Open approvals",
        priority: "normal" as const
      };
    }
    return null;
  }, [
    atRiskSnapshot.criticalUnownedAttention,
    atRiskSnapshot.overdueUnassigned,
    atRiskSnapshot.pendingApprovalsAging,
    attentionItems.length,
    attentionHref,
    followUpHref,
    followUpQueueTotal,
    approvalsHref,
    state.approvals.length
  ]);

  return (
    <div className="space-y-6 pb-8">
      <header className="rounded-lg border border-slate-200 bg-white px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Operator workspace</p>
            <h1 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950 sm:text-2xl">Action queue control</h1>
            <p className="mt-1 text-sm text-slate-600">What needs action now, what is blocked, and what to open next.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadDashboard()} disabled={loading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading ? "animate-spin" : "")} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/insights">Open insights</Link>
            </Button>
          </div>
        </div>
        {reviewRefreshNote ? <p className="mt-2 text-xs text-sky-700">{reviewRefreshNote}</p> : null}
      </header>

      {error ? <StateCard variant="error" title="Dashboard data unavailable" description={error} /> : null}

      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Action now</p>
          <p className="mt-0.5 text-xl font-black text-slate-950">{loading ? "-" : actionQueueTotal}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Open queue items</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Blocked</p>
          <p className={cn("mt-0.5 text-xl font-black", blockedItems > 0 ? "text-rose-700" : "text-slate-950")}>{loading ? "-" : blockedItems}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Needs owner now</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Approvals</p>
          <p className="mt-0.5 text-xl font-black text-slate-950">{loading ? "-" : state.approvals.length}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Pending review</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Triage ETA</p>
          <p className="mt-0.5 text-xl font-black text-slate-950">{loading ? "-" : meanTriageTime}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Estimated clear time</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="lg:col-span-8 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Primary workflow</p>
              <h2 className="text-lg font-bold text-slate-950">Action queue</h2>
            </div>
            <div className="text-right">
              <StatusBadge kind="generic" state={blockedItems > 0 ? "warning" : "success"} label={blockedItems > 0 ? "Needs review" : "Stable"} size="xs" />
              <p className="mt-1 text-[10px] text-slate-500">{clearedBuckets}/3 queues clear</p>
            </div>
          </div>

          <div className="space-y-2 p-3 sm:p-4">
            {topTask ? (
              <Link
                href={topTask.href}
                className={cn(
                  "group block rounded-xl border px-4 py-3",
                  topTask.priority === "critical"
                    ? "border-rose-300 bg-rose-50/90 ring-2 ring-rose-200 shadow-[0_10px_18px_-12px_rgba(225,29,72,0.5)]"
                    : "border-amber-300 bg-amber-50/75"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">Top task</p>
                  <span className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                    topTask.priority === "critical"
                      ? "border-rose-300 bg-rose-100 text-rose-800"
                      : "border-amber-300 bg-amber-100 text-amber-800"
                  )}>
                    {topTask.priority}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">{topTask.title}</p>
                <p className="mt-1 text-[11px] text-slate-600">{topTask.detail}</p>
                <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 group-hover:text-slate-900">
                  {topTask.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </p>
              </Link>
            ) : (
              <StateCard
                variant="empty"
                title="Queue clear"
                description="No urgent queue tasks are pending right now."
              />
            )}

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-slate-700 transition-all" style={{ width: `${queueProgressPercent}%` }} />
            </div>

            <QueueRow
              title="Needs attention"
              description={attentionItems[0]?.topReasons?.[0] || "Critical and high-priority exceptions."}
              href={attentionHref}
              volume={attentionItems.length}
              priority={attentionPriority}
              ctaLabel="Open queue"
              statusLabel={attentionItems.length > 0 ? "Review required" : "Clear"}
              spotlight={attentionPriority === "critical"}
              order={attentionPriority === "critical" ? "primary" : "secondary"}
            />

            <QueueRow
              title="Approval requests"
              description={topPendingApproval?.toolKey || "Pending decisions."}
              href={approvalsHref}
              volume={state.approvals.length}
              priority={approvalsPriority}
              ctaLabel="Review approvals"
              statusLabel={state.approvals.length > 0 ? "Pending" : "Clear"}
              order={approvalsPriority === "high" ? "primary" : "secondary"}
            />

            <QueueRow
              title="Follow-up at risk"
              description={topOverdueFollowUp?.task?.title || "Overdue and stale follow-up tasks."}
              href={followUpHref}
              volume={followUpQueueTotal}
              priority={followUpPriority}
              ctaLabel="Open follow-up"
              statusLabel={followUpQueueTotal > 0 ? "At risk" : "Clear"}
              spotlight={followUpPriority === "critical"}
              order={followUpPriority === "critical" ? "primary" : "secondary"}
            />

            {loading ? <StateCard variant="loading" title="Refreshing queue" description="Loading latest action items." /> : null}
          </div>
        </section>

        <aside className="space-y-4 lg:col-span-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-950">At risk</h3>
              <StatusBadge
                kind="generic"
                state={atRiskSnapshot.criticalUnownedAttention > 0 ? "failed" : blockedItems > 0 ? "warning" : "success"}
                label={atRiskSnapshot.criticalUnownedAttention > 0 ? "Critical" : blockedItems > 0 ? "Watch" : "Healthy"}
                size="xs"
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-sm">
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <span className="text-[11px] text-slate-600">Critical unowned</span>
                <span className="text-base font-semibold text-slate-900">{atRiskSnapshot.criticalUnownedAttention}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <span className="text-[11px] text-slate-600">Overdue unassigned</span>
                <span className="text-base font-semibold text-slate-900">{atRiskSnapshot.overdueUnassigned}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <span className="text-[11px] text-slate-600">Stale assigned</span>
                <span className="text-base font-semibold text-slate-900">{atRiskSnapshot.staleAssigned}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <span className="text-[11px] text-slate-600">Aging approvals</span>
                <span className="text-base font-semibold text-slate-900">{atRiskSnapshot.pendingApprovalsAging}</span>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-950">Today watch</h3>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-sm">
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <span className="text-[11px] text-slate-600">Needs review</span>
                <span className="text-base font-semibold text-slate-900">{reviewTodaySnapshot.needsReviewTodayCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <span className="text-[11px] text-slate-600">Retry failures</span>
                <span className="text-base font-semibold text-slate-900">{reviewTodaySnapshot.failedRetryableSends}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <span className="text-[11px] text-slate-600">Critical/high</span>
                <span className="text-base font-semibold text-slate-900">{atRiskSnapshot.criticalHighAttention}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <span className="text-[11px] text-slate-600">Throughput</span>
                <span className="text-base font-semibold text-slate-900">{activeThroughput}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Activity</p>
            <h2 className="text-lg font-bold text-slate-950">Recent operations</h2>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app/insights">View full feed</Link>
          </Button>
        </div>
        <OperationsFeedList
          events={state.operations.slice(0, 8)}
          loading={loading}
          emptyMessage="No recent operations for this workspace."
          source="dashboard"
          returnLabel="Dashboard"
        />
      </section>
    </div>
  );
}
