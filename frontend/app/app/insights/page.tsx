"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { fetchManagerInsights, fetchOperationsFeed } from "@/lib/api";
import { OperationsFeedList } from "@/components/ai/operations-feed-list";
import type { ManagerInsightSummary, OperationsFeedEvent } from "@/lib/types";
import { PageShell, SectionShell } from "@/components/ui/page";
import { CommandHeader, SectionDisclosure } from "@/components/ops";
import { buildReturnTo, buildWorkflowHref, normalizeReturnTo, sourceToLabel } from "@/lib/workflow-nav";
import { OPERATIONAL_LABELS } from "@/lib/operational-language";
import { WorkflowReturnBanner } from "@/components/queue/workflow-return-banner";

type InsightsFeedFilter = "all" | "failures" | "approvals" | "handoffs" | "attention";
const insightsFeedFilters: InsightsFeedFilter[] = ["all", "failures", "approvals", "handoffs", "attention"];

function parseInsightsFeedFilter(value: string | null): InsightsFeedFilter {
  const normalized = (value || "").toLowerCase();
  return insightsFeedFilters.includes(normalized as InsightsFeedFilter) ? (normalized as InsightsFeedFilter) : "all";
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-[-0.03em] text-slate-900">{value}</p>
    </div>
  );
}

function ActionMetricCard({
  label,
  value,
  detail,
  href,
  cta
}: {
  label: string;
  value: string | number;
  detail: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{detail}</p>
      <div className="mt-2">
        <Link href={href} className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50">
          {cta}
        </Link>
      </div>
    </div>
  );
}

function toStringRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export default function InsightsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [busySummary, setBusySummary] = useState(true);
  const [busyFeed, setBusyFeed] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ManagerInsightSummary | null>(null);
  const [events, setEvents] = useState<OperationsFeedEvent[]>([]);
  const [usageEvents, setUsageEvents] = useState<OperationsFeedEvent[]>([]);
  const [busyUsage, setBusyUsage] = useState(true);
  const [feedFilter, setFeedFilter] = useState<InsightsFeedFilter>(() => parseInsightsFeedFilter(searchParams.get("feedFilter")));
  const source = searchParams.get("source") || "";
  const returnToQuery = normalizeReturnTo(searchParams.get("returnTo"));
  const returnLabel = searchParams.get("returnLabel") || sourceToLabel(source);

  async function loadSummary() {
    setBusySummary(true);
    setSummaryError(null);
    try {
      const response = await fetchManagerInsights();
      setSummary(response);
    } catch (loadError) {
      setSummaryError(loadError instanceof Error ? loadError.message : "Failed to load manager insights.");
    } finally {
      setBusySummary(false);
    }
  }

  async function loadFeed(filterValue: InsightsFeedFilter) {
    setBusyFeed(true);
    setFeedError(null);
    try {
      const filter =
        filterValue === "all"
          ? undefined
          : filterValue === "failures"
            ? "failed"
            : filterValue === "approvals"
              ? "approval"
              : filterValue === "handoffs"
                ? "handoff"
                : filterValue === "attention"
                  ? "attention"
                  : filterValue;
      const response = await fetchOperationsFeed({ limit: 40, filter });
      setEvents(response.events || []);
    } catch (loadError) {
      setFeedError(loadError instanceof Error ? loadError.message : "Failed to load recent operations.");
    } finally {
      setBusyFeed(false);
    }
  }

  async function loadUsageSignals() {
    setBusyUsage(true);
    setUsageError(null);
    try {
      const response = await fetchOperationsFeed({ limit: 50 });
      setUsageEvents(response.events || []);
    } catch (loadError) {
      setUsageError(loadError instanceof Error ? loadError.message : "Failed to load AI usage signals.");
    } finally {
      setBusyUsage(false);
    }
  }

  useEffect(() => {
    void loadSummary();
    void loadUsageSignals();
  }, []);

  useEffect(() => {
    void (async () => {
      await loadFeed(feedFilter);
    })();
  }, [feedFilter]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (feedFilter === "all") {
      params.delete("feedFilter");
    } else {
      params.set("feedFilter", feedFilter);
    }
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    const currentUrl = buildReturnTo(pathname, searchParams);
    if (nextUrl !== currentUrl) router.replace(nextUrl, { scroll: false });
  }, [feedFilter, pathname, router, searchParams]);

  const returnTo = buildReturnTo(pathname, searchParams);

  const usageMetrics = (() => {
    const eventsPool = usageEvents;
    const approvalsPending = eventsPool.filter((event) => event.eventType === "approval_pending").length;
    const approvalsRejected = eventsPool.filter((event) => {
      const metadata = toStringRecord(event.metadata);
      return event.eventType === "approval_rejected" || metadata.approvalStatus === "REJECTED";
    }).length;
    const approvalsApproved = eventsPool.filter((event) => {
      const metadata = toStringRecord(event.metadata);
      return metadata.approvalStatus === "APPROVED";
    }).length;
    const retryAttempts = eventsPool.filter((event) => event.eventType.startsWith("retry_delivery_")).length;
    const retrySucceeded = eventsPool.filter((event) => event.eventType === "retry_delivery_sent").length;
    const retryFailed = eventsPool.filter((event) => event.eventType === "retry_delivery_failed").length;
    const failedRetryableSends = eventsPool.filter((event) => {
      const metadata = toStringRecord(event.metadata);
      return (event.eventType === "delivery_failed" || event.eventType === "retry_delivery_failed") && Boolean(metadata.retryable);
    }).length;
    const handoffExecuted = eventsPool.filter((event) => event.eventType === "handoff_executed").length;
    const handoffSuppressed = eventsPool.filter((event) => event.eventType === "handoff_suppressed").length;
    const followUpWorkflowItems = eventsPool.filter((event) => event.eventType === "follow_up_open" || event.eventType === "follow_up_overdue").length;
    const highAttentionSignals = eventsPool.filter((event) => event.eventType === "high_attention_entity").length;
    const reviewFrictionCount = approvalsRejected + retryFailed + handoffSuppressed;

    return {
      approvalsPending,
      approvalsApproved,
      approvalsRejected,
      retryAttempts,
      retrySucceeded,
      retryFailed,
      failedRetryableSends,
      handoffExecuted,
      handoffSuppressed,
      followUpWorkflowItems,
      highAttentionSignals,
      reviewFrictionCount
    };
  })();

  return (
    <PageShell className="space-y-6">
      <CommandHeader
        eyebrow="AI Operations"
        title="Operational Insights"
        description="Action-oriented review of workflow usage, friction, and recent operations."
        actions={
          <Link
            href={buildWorkflowHref("/app/attention", { source: "insights", returnTo, returnLabel: "Insights" })}
            className="inline-flex items-center rounded-md border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Return to action queues
          </Link>
        }
      />

      <SectionShell className="surface-panel">
        {busySummary ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading manager insights...
          </div>
        ) : null}

        {!busySummary && summaryError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{summaryError}</div> : null}

        {!busySummary && !summaryError && summary ? (
          <>
            <p className="mb-4 text-sm text-slate-500">Window start: {new Date(summary.since).toLocaleString()}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <MetricCard label="Pending approvals" value={summary.pendingApprovals} />
              <MetricCard label="Open follow-up" value={summary.openFollowUps} />
            </div>
            <SectionDisclosure title="Full Operational Snapshot" storageKey="insights-full-summary" className="mt-3" defaultCollapsed>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard label="Total calls" value={summary.callsTotal} />
              <MetricCard label="Missed calls" value={summary.callsMissed} />
              <MetricCard label="Messages" value={summary.messagesTotal} />
              <MetricCard label="Booking requests" value={summary.bookingRequests} />
              <MetricCard label="Open follow-up" value={summary.openFollowUps} />
              <MetricCard label="Pending approvals" value={summary.pendingApprovals} />
              </div>
            </SectionDisclosure>
          </>
        ) : null}
      </SectionShell>

      <SectionShell className="surface-panel">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">AI Workflow Usage & Trust Signals</h2>
            <p className="text-sm text-slate-500">Use these signals to route work into approvals, attention, and follow-up queues.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadUsageSignals()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh signals
          </button>
        </div>
        <SectionDisclosure title="Workflow usage and friction breakdown" storageKey="insights-usage-breakdown" defaultCollapsed>
          {busyUsage ? (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading AI usage signals...
            </div>
          ) : null}

          {!busyUsage && usageError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{usageError}</div> : null}

          {!busyUsage && !usageError ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Needs action</p>
                <div className="mt-2 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <ActionMetricCard
                    label="Retryable send failures"
                    value={usageMetrics.failedRetryableSends}
                    detail="Failed outbound sends currently marked retryable."
                    href={buildWorkflowHref("/app/approvals?focus=needs_retry", { source: "insights", returnTo, returnLabel: "Insights" })}
                    cta="Open retryable failures"
                  />
                  <ActionMetricCard
                    label="Pending approvals"
                    value={usageMetrics.approvalsPending}
                    detail="Approval actions waiting for operator review."
                    href={buildWorkflowHref("/app/approvals?focus=needs_review", { source: "insights", returnTo, returnLabel: "Insights" })}
                    cta={`Open ${OPERATIONAL_LABELS.needsReview.toLowerCase()} queue`}
                  />
                  <ActionMetricCard
                    label="High attention signals"
                    value={usageMetrics.highAttentionSignals}
                    detail="Critical/high attention entities from recent workflow state."
                    href={buildWorkflowHref("/app/attention?risk=at_risk", { source: "insights", returnTo, returnLabel: "Insights" })}
                    cta="Open high-attention items"
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Friction</p>
                <div className="mt-2 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <ActionMetricCard
                    label="Approvals rejected"
                    value={usageMetrics.approvalsRejected}
                    detail="Operator-rejected approval actions."
                    href={buildWorkflowHref("/app/approvals?status=REJECTED", { source: "insights", returnTo, returnLabel: "Insights" })}
                    cta="Review rejected approvals"
                  />
                  <ActionMetricCard
                    label="Retry failed"
                    value={usageMetrics.retryFailed}
                    detail="Retries that still failed delivery."
                    href={buildWorkflowHref("/app/approvals?focus=needs_retry", { source: "insights", returnTo, returnLabel: "Insights" })}
                    cta="Review retry failures"
                  />
                  <ActionMetricCard
                    label="Handoffs suppressed"
                    value={usageMetrics.handoffSuppressed}
                    detail="Handoffs prevented due to duplicate/recent suppression."
                    href={buildWorkflowHref("/app/attention?risk=at_risk", { source: "insights", returnTo, returnLabel: "Insights" })}
                    cta="Review affected work"
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Usage</p>
                <div className="mt-2 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <ActionMetricCard
                    label="Approvals approved"
                    value={usageMetrics.approvalsApproved}
                    detail="Approved actions from recent workflow events."
                    href={buildWorkflowHref("/app/approvals?status=APPROVED", { source: "insights", returnTo, returnLabel: "Insights" })}
                    cta="Open approved approvals"
                  />
                  <ActionMetricCard
                    label="Follow-up from workflows"
                    value={usageMetrics.followUpWorkflowItems}
                    detail="Follow-up queue items generated by current workflows."
                    href={buildWorkflowHref("/app/follow-up", { source: "insights", returnTo, returnLabel: "Insights" })}
                    cta="Open follow-up queue"
                  />
                  <ActionMetricCard
                    label="Handoffs executed"
                    value={usageMetrics.handoffExecuted}
                    detail="Cross-agent handoffs completed in recent events."
                    href={buildWorkflowHref("/app/attention", { source: "insights", returnTo, returnLabel: "Insights" })}
                    cta="Review attention queue"
                  />
                  <ActionMetricCard
                    label="Retry attempts"
                    value={usageMetrics.retryAttempts}
                    detail="Recent delivery retry executions."
                    href={buildWorkflowHref("/app/approvals?focus=needs_retry", { source: "insights", returnTo, returnLabel: "Insights" })}
                    cta={`Open ${OPERATIONAL_LABELS.needsRetry.toLowerCase()} queue`}
                  />
                  <ActionMetricCard
                    label="Friction signals"
                    value={usageMetrics.reviewFrictionCount}
                    detail="Rejected approvals + retry failures + suppressed handoffs."
                    href={buildWorkflowHref("/app/insights?feedFilter=failures", { source: "insights", returnTo, returnLabel: "Insights" })}
                    cta="Open failure-focused feed"
                  />
                </div>
              </div>

            </div>
          ) : null}
        </SectionDisclosure>
      </SectionShell>

      <SectionShell className="surface-panel">
        <div className="mb-3">
          <WorkflowReturnBanner returnTo={returnToQuery} returnLabel={returnLabel} />
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Recent Operations</h2>
            <p className="text-sm text-slate-500">Shared operational activity feed used by dashboard and insights.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={feedFilter}
              onChange={(event) => setFeedFilter(parseInsightsFeedFilter(event.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="all">All events</option>
              <option value="failures">Failures</option>
              <option value="approvals">Approvals</option>
              <option value="handoffs">Handoffs</option>
              <option value="attention">Attention</option>
            </select>
            <button
              type="button"
              onClick={() => void loadFeed(feedFilter)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {feedError ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{feedError}</div> : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <OperationsFeedList
            events={events}
            loading={busyFeed}
            emptyMessage={
              feedFilter === "failures"
                ? `No failure events right now. Delivery and retries appear ${OPERATIONAL_LABELS.healthy.toLowerCase()}.`
                : feedFilter === "all"
                  ? `No operational events yet. This is expected on ${OPERATIONAL_LABELS.lowActivity.toLowerCase()} or newly configured workspaces.`
                  : "No operational events match this filter."
            }
            source="insights"
            returnLabel="Insights"
            onActionComplete={async () => {
              await Promise.all([loadFeed(feedFilter), loadUsageSignals()]);
            }}
          />
        </div>
        {!busyFeed && !feedError && events.length === 0 && feedFilter === "all" ? (
          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
            <p className="font-semibold">Not enough activity yet</p>
            <p className="mt-1">Start from Calls, Leads, or Messages to generate operational events and daily review history.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link href={buildWorkflowHref("/app/calls", { source: "insights", returnTo, returnLabel: "Insights" })} className="rounded-md border border-blue-200 bg-white px-2 py-1 font-semibold text-blue-700">
                Open Calls
              </Link>
              <Link href={buildWorkflowHref("/app/leads", { source: "insights", returnTo, returnLabel: "Insights" })} className="rounded-md border border-blue-200 bg-white px-2 py-1 font-semibold text-blue-700">
                Open Leads
              </Link>
              <Link href={buildWorkflowHref("/app/messages", { source: "insights", returnTo, returnLabel: "Insights" })} className="rounded-md border border-blue-200 bg-white px-2 py-1 font-semibold text-blue-700">
                Open Messages
              </Link>
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-end">
          <Link
            href={buildWorkflowHref("/app/attention", { source: "insights", returnTo, returnLabel: "Insights" })}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Open Needs Attention
          </Link>
        </div>
      </SectionShell>
    </PageShell>
  );
}
