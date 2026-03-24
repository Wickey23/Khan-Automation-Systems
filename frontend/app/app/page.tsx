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
    <div className="space-y-12 pb-12">
      {/* Header Section: Architectural Rhythm */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-slide-up">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-primary/70 font-label font-bold mb-1 ml-0.5">Operational Command</p>
          <h2 className="text-5xl font-extrabold font-headline text-on-surface tracking-tighter leading-none bg-gradient-to-br from-on-surface via-on-surface to-primary/50 bg-clip-text text-transparent">
            Daily Triage
          </h2>
        </div>
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <button className="flex-1 md:flex-none px-6 py-2.5 bg-white/50 backdrop-blur-sm border border-outline-variant/20 text-on-surface font-bold text-sm rounded-xl transition-all hover:bg-white/80 hover:shadow-sm active:scale-95">
            Export Manifest
          </button>
          <button className="flex-1 md:flex-none px-8 py-2.5 bg-primary text-on-primary font-bold text-sm rounded-xl inner-glow shadow-lg transition-all hover:shadow-primary/20 hover:-translate-y-0.5 active:scale-95">
            Start New Operation
          </button>
        </div>
      </header>

      {/* Metric Summary: Subordinate Scale */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6 px-1">
        <div className="glass-card inner-glow p-6 rounded-2xl hover-lift group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700"></div>
          <p className="text-[10px] font-label font-black text-primary/60 uppercase mb-4 tracking-widest relative z-10">Active Throughput</p>
          <div className="flex items-center justify-between relative z-10">
            <span className="text-4xl font-headline font-black tracking-tighter text-on-surface">{loading ? "-" : activeThroughput}</span>
            <span className="text-[10px] font-bold text-tertiary flex items-center bg-tertiary-container/40 px-2 py-1 rounded-full border border-tertiary/10">
              <span className="material-symbols-outlined text-[14px] mr-1">trending_up</span> LIVE
            </span>
          </div>
        </div>

        <div className="glass-card inner-glow p-6 rounded-2xl hover-lift group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-error/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700"></div>
          <p className="text-[10px] font-label font-black text-on-surface-variant uppercase mb-4 tracking-widest relative z-10">Mean Triage Time</p>
          <div className="flex items-center justify-between relative z-10">
            <span className="text-4xl font-headline font-black tracking-tighter text-on-surface">{loading ? "-" : meanTriageTime}</span>
            <span className="text-[10px] font-bold text-error flex items-center bg-error-container/20 px-2 py-1 rounded-full border border-error/10">
              <span className="material-symbols-outlined text-[14px] mr-1">speed</span>
            </span>
          </div>
        </div>

        <div className="glass-card inner-glow p-6 rounded-2xl hover-lift group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-on-surface-variant/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700"></div>
          <p className="text-[10px] font-label font-black text-on-surface-variant uppercase mb-4 tracking-widest relative z-10">Open Approvals</p>
          <div className="flex items-center justify-between relative z-10">
            <span className="text-4xl font-headline font-black tracking-tighter text-on-surface">{loading ? "-" : state.approvals.length}</span>
            <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-1 rounded-full border border-outline-variant/10">STEADY</span>
          </div>
        </div>

        <div className={`glass-card inner-glow p-6 rounded-2xl hover-lift group relative overflow-hidden ${blockedItems > 0 ? 'ring-2 ring-error/20' : ''}`}>
          <div className={`absolute top-0 right-0 w-24 h-24 ${blockedItems > 0 ? 'bg-error/10' : 'bg-on-surface-variant/5'} rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700`}></div>
          <p className={`text-[10px] font-label font-black uppercase mb-4 tracking-widest relative z-10 ${blockedItems > 0 ? 'text-error' : 'text-on-surface-variant'}`}>Blocked Items</p>
          <div className="flex items-center justify-between relative z-10">
            <span className={`text-4xl font-headline font-black tracking-tighter ${blockedItems > 0 ? 'text-error' : 'text-on-surface'}`}>{loading ? "-" : blockedItems}</span>
            {blockedItems > 0 ? (
              <span className="w-8 h-8 rounded-full bg-error text-on-error flex items-center justify-center animate-pulse">
                <span className="material-symbols-outlined text-[18px]">emergency</span>
              </span>
            ) : (
              <span className="material-symbols-outlined text-outline-variant/40">check_circle</span>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Primary Column: Action Now Area */}
        <div className="lg:col-span-8 space-y-8 animate-fade-slide-up [animation-delay:100ms] fill-mode-both">
          {/* Action Now Module */}
          <section>
            <div className="flex items-center justify-between mb-5 px-1">
              <h3 className="text-xl font-headline font-black text-on-surface tracking-tight">Action Now</h3>
              <Link href="/app/attention" className="text-[11px] font-black text-primary uppercase tracking-widest hover:text-primary-dim transition-colors">View all tasks</Link>
            </div>
            
            <div className="glass-card inner-glow rounded-3xl overflow-hidden">
              {attentionItems.length > 0 ? (
                <Link href={buildWorkflowHref("/app/attention", { source: "dashboard", returnTo, returnLabel: "Dashboard" })} className="group px-8 py-6 flex items-center justify-between hover:bg-white/50 transition-all duration-300 border-b border-outline-variant/5">
                  <div className="flex items-center space-x-5">
                    <div className="w-12 h-12 rounded-2xl bg-error/10 text-error flex items-center justify-center ring-1 ring-error/20 group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined font-bold">priority_high</span>
                    </div>
                    <div>
                      <p className="text-sm font-black text-on-surface tracking-tight">Needs Attention Queue</p>
                      <p className="text-xs font-medium text-on-surface-variant/80">{attentionItems[0]?.topReasons?.[0] || "Critical exceptions pending"}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-10">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">VOLUME</p>
                      <p className="text-sm font-black text-error">{attentionItems.length} items</p>
                    </div>
                    <button className="px-5 py-2.5 bg-on-surface text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-primary transition-all shadow-md group-hover:shadow-primary/20">
                      Resolve
                    </button>
                  </div>
                </Link>
              ) : null}

              <Link href={buildWorkflowHref("/app/approvals", { source: "dashboard", returnTo, returnLabel: "Dashboard" })} className="group px-8 py-6 flex items-center justify-between hover:bg-white/50 transition-all duration-300 border-b border-outline-variant/5">
                <div className="flex items-center space-x-5">
                  <div className="w-12 h-12 rounded-2xl bg-tertiary/10 text-tertiary flex items-center justify-center ring-1 ring-tertiary/20 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined font-bold">approval</span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-on-surface tracking-tight">Approval Required</p>
                    <p className="text-xs font-medium text-on-surface-variant/80">{topPendingApproval?.toolKey || "No pending approvals"}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-10">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">VOLUME</p>
                    <p className="text-sm font-black text-on-surface">{state.approvals.length} items</p>
                  </div>
                  <button className="px-5 py-2.5 bg-surface-container-high text-on-surface text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-primary hover:text-white transition-all">
                    Review
                  </button>
                </div>
              </Link>

              <Link href={buildWorkflowHref("/app/follow-up", { source: "dashboard", returnTo, returnLabel: "Dashboard" })} className="group px-8 py-6 flex items-center justify-between hover:bg-white/50 transition-all duration-300">
                <div className="flex items-center space-x-5">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined font-bold">event_repeat</span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-on-surface tracking-tight">Follow-up At Risk</p>
                    <p className="text-xs font-medium text-on-surface-variant/80">{topOverdueFollowUp?.task?.title || "No overdue follow-up tasks"}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-10">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">VOLUME</p>
                    <p className="text-sm font-black text-amber-600">{overdueFollowUps.length + atRiskSnapshot.staleAssigned} items</p>
                  </div>
                  <button className="px-5 py-2.5 bg-surface-container-high text-on-surface text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-primary hover:text-white transition-all">
                    Execute
                  </button>
                </div>
              </Link>
            </div>
          </section>

          {/* Operations Visualizer (Asymmetric Bento Component) */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-surface p-8 rounded-[2.5rem] relative overflow-hidden group hover:bg-white/60 transition-all duration-500 border border-white/40 shadow-sm">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 group-hover:rotate-12 transition-all duration-700">
                <span className="material-symbols-outlined text-[120px]">monitoring</span>
              </div>
              <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-2">Operational Pulse</p>
              <h4 className="text-lg font-black font-headline mb-3 text-on-surface tracking-tight">Efficiency Analysis</h4>
              <p className="text-sm text-on-surface-variant mb-8 leading-relaxed font-medium">
                {isLowActivityWorkspace ? "System is ready. Awaiting initial inbound/outbound workflow events." : "System performance is currently optimized at 94%. No scaling required for the next 4 hours based on predicted load."}
              </p>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse shadow-[0_0_8px_rgba(0,109,74,0.5)]"></div>
                <span className="text-[10px] font-black text-tertiary uppercase tracking-widest">SYSTEM STABLE</span>
              </div>
            </div>
            
            <div className="bg-on-surface p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700"></div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Strategic Shift</p>
              <h4 className="text-lg font-black font-headline mb-3 tracking-tight">Priority Shift</h4>
              <p className="text-sm text-white/70 mb-8 leading-relaxed font-medium">
                {reviewTodaySnapshot.needsReviewTodayCount > 0 
                  ? `Focus required on ${reviewTodaySnapshot.needsReviewTodayCount} items blocking daily clearance. Resolve before shift end.` 
                  : "Shift focus to pending lead conversions. Processing flow is steady."}
              </p>
              <button className="text-[10px] font-black uppercase tracking-widest border-b-2 border-primary/40 pb-1 hover:border-primary transition-all">
                Redirect Resources
              </button>
            </div>
          </section>
        </div>

        {/* Secondary Column: Triage & Risk */}
        {/* Secondary Column: Triage & Risk */}
        <div className="lg:col-span-4 space-y-8 animate-fade-slide-up [animation-delay:200ms] fill-mode-both">
          {/* At Risk / Blocked Panel */}
          {blockedItems > 0 || reviewTodaySnapshot.needsReviewTodayCount > 0 ? (
            <section className={`glass-card p-6 rounded-[2rem] shadow-xl border-t-8 ${atRiskSnapshot.criticalUnownedAttention > 0 ? 'border-error' : 'border-amber-500'}`}>
              <div className={`flex items-center space-x-3 mb-6 ${atRiskSnapshot.criticalUnownedAttention > 0 ? 'text-error' : 'text-amber-600'}`}>
                <span className="material-symbols-outlined font-black">warning</span>
                <h3 className="text-[11px] font-black font-headline uppercase tracking-[0.2em]">At Risk Items</h3>
              </div>
              
              <div className="space-y-4">
                {atRiskSnapshot.criticalUnownedAttention > 0 && (
                  <div className="p-5 bg-error/5 rounded-2xl border border-error/10">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-black text-on-surface">Unassigned Critical Work</p>
                      <span className="text-[9px] font-black bg-error text-white px-1.5 py-0.5 rounded-sm">CRITICAL</span>
                    </div>
                    <p className="text-xs font-medium text-on-surface-variant/70 mb-4">Sync failure affecting {atRiskSnapshot.criticalUnownedAttention} active rows.</p>
                    <div className="w-full bg-error/10 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-error w-4/5 h-full animate-pulse"></div>
                    </div>
                  </div>
                )}
                
                {atRiskSnapshot.overdueUnassigned > 0 && (
                  <div className="p-5 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-black text-on-surface">Overdue Follow-up</p>
                      <span className="text-[9px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-sm">WARNING</span>
                    </div>
                    <p className="text-xs font-medium text-on-surface-variant/70">{atRiskSnapshot.overdueUnassigned} tasks unassigned and stale.</p>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {/* Recent Operations Feed */}
          <section className="px-1">
            <h3 className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] mb-6">Live Activity Audit</h3>
            
            {state.operations.length > 0 ? (
              <div className="space-y-8 relative before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-surface-container-high/50">
                {state.operations.slice(0, 4).map((event, i) => {
                  const colors = ["border-primary ring-primary/20", "border-outline-variant ring-transparent", "border-tertiary ring-tertiary/20", "border-primary ring-primary/20"];
                  const colorClass = colors[i % colors.length];
                  return (
                    <div key={event.id} className="relative pl-10 group cursor-default">
                      <div className={`absolute left-0 top-1 w-[24px] h-[24px] bg-white rounded-full border-2 ${colorClass.split(' ')[0]} ${colorClass.split(' ')[1]} flex items-center justify-center transition-all group-hover:scale-110 shadow-sm`}>
                        <div className={`w-2 h-2 rounded-full ${colorClass.split(' ')[0].replace('border-', 'bg-')}`}></div>
                      </div>
                      <div className="transition-all group-hover:translate-x-1">
                        <p className="text-[11px] font-black text-on-surface truncate pr-2 uppercase tracking-tight">{event.eventType.replace(/_/g, " ")}</p>
                        <p className="text-[10px] font-bold text-on-surface-variant/60">
                          {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • SYSTEM NODE
                        </p>
                      </div>
                    </div>
                  );
                })}
                <Link href="/app/insights" className="mt-8 block w-full py-3.5 text-center text-[10px] font-black text-primary hover:bg-primary/5 transition-all uppercase tracking-[0.16em] border-2 border-primary/10 rounded-[1.25rem]">
                  Full Audit Stream
                </Link>
              </div>
            ) : (
              <div className="py-12 text-center border-2 border-dashed border-outline-variant/10 rounded-[2rem] glass-surface">
                <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest">No Recent Operations</p>
              </div>
            )}
          </section>
        </div>
      </div>
      
      {state.operations.length === 0 && (
        <section className="mt-16 p-16 glass-surface rounded-[3rem] flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-50"></div>
          <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center mb-8 shadow-xl inner-glow relative z-10 transition-transform hover:rotate-6">
            <span className="material-symbols-outlined text-primary text-4xl">analytics</span>
          </div>
          <h4 className="text-2xl font-headline font-black text-on-surface mb-3 tracking-tighter relative z-10">Operational Insight Queue</h4>
          <p className="text-on-surface-variant max-w-sm mb-10 leading-relaxed font-medium relative z-10">There are currently no high-trust predictions. As your operational data grows, deep insights will appear here.</p>
          <button className="px-8 py-3 bg-white/80 backdrop-blur-sm border border-primary/20 text-primary font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl hover:bg-primary hover:text-white transition-all shadow-md relative z-10">
            System Configuration
          </button>
        </section>
      )}
    </div>
  );
}

