"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { fetchManagerInsights, fetchOperationsFeed } from "@/lib/api";
import { OperationsFeedList } from "@/components/ai/operations-feed-list";
import type { ManagerInsightSummary, OperationsFeedEvent } from "@/lib/types";
import { PageShell, SectionShell } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { CommandHeader, SectionDisclosure } from "@/components/ops";
import { buildReturnTo, buildWorkflowHref, normalizeReturnTo, sourceToLabel } from "@/lib/workflow-nav";
import { WorkflowReturnBanner } from "@/components/queue/workflow-return-banner";

type InsightsFeedFilter = "all" | "failures" | "approvals" | "handoffs" | "attention";
const insightsFeedFilters: InsightsFeedFilter[] = ["all", "failures", "approvals", "handoffs", "attention"];

function parseInsightsFeedFilter(value: string | null): InsightsFeedFilter {
  const normalized = (value || "").toLowerCase();
  return insightsFeedFilters.includes(normalized as InsightsFeedFilter) ? (normalized as InsightsFeedFilter) : "all";
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function InsightMetricCard({
  label,
  value,
  detail,
  href,
  linkLabel
}: {
  label: string;
  value: string | number;
  detail: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{detail}</p>
      {href && linkLabel ? (
        <div className="mt-3">
          <Link href={href} className="text-xs font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900">
            {linkLabel}
          </Link>
        </div>
      ) : null}
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
  const summaryWindowLabel = summary ? new Date(summary.since).toLocaleString() : "Loading window";
  const interpretationSummary = useMemo(
    () => ({
      whatChanged: `${summary?.callsTotal ?? 0} calls and ${summary?.messagesTotal ?? 0} messages in this window.`,
      whatMatters: `${summary?.pendingApprovals ?? 0} pending approvals and ${summary?.openFollowUps ?? 0} open follow-ups currently shape workload.`,
      watchArea: `${usageMetrics.reviewFrictionCount} friction signals and ${usageMetrics.highAttentionSignals} high-attention signals need monitoring.`
    }),
    [
      summary?.callsTotal,
      summary?.messagesTotal,
      summary?.openFollowUps,
      summary?.pendingApprovals,
      usageMetrics.highAttentionSignals,
      usageMetrics.reviewFrictionCount
    ]
  );

  return (
    <PageShell className="space-y-5">
      <CommandHeader
        eyebrow="Insights"
        title="Analytical Overview"
        description="Understand trend signals, workflow changes, and emerging watch areas across the workspace."
      />

      <SectionShell className="surface-panel">
        {busySummary ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-8">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            <span className="text-xs font-semibold text-slate-600">Loading insight summary...</span>
          </div>
        ) : null}

        {!busySummary && summaryError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
            {summaryError}
          </div>
        ) : null}

        {!busySummary && !summaryError && summary ? (
          <>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Summary window</p>
              <p className="mt-1 text-xs text-slate-600">{summaryWindowLabel}</p>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">What changed</p>
                  <p className="mt-1 text-sm text-slate-700">{interpretationSummary.whatChanged}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">What matters</p>
                  <p className="mt-1 text-sm text-slate-700">{interpretationSummary.whatMatters}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Watch area</p>
                  <p className="mt-1 text-sm text-slate-700">{interpretationSummary.watchArea}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              <MetricCard label="Total calls" value={summary.callsTotal} />
              <MetricCard label="Messages" value={summary.messagesTotal} />
              <MetricCard label="Pending approvals" value={summary.pendingApprovals} />
              <MetricCard label="Open follow-up" value={summary.openFollowUps} />
            </div>
            <SectionDisclosure title="Expanded trend snapshot" storageKey="insights-full-summary" className="mt-1" defaultCollapsed>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
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
            <h2 className="text-lg font-semibold text-slate-900">Trend signals</h2>
            <p className="mt-1 text-sm text-slate-600">Grouped changes across approvals, delivery reliability, and handoff behavior.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => void loadUsageSignals()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
        {busyUsage ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            <span className="mt-2 text-xs text-slate-600">Loading trend signals...</span>
          </div>
        ) : null}

        {!busyUsage && usageError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{usageError}</div>
        ) : null}

        {!busyUsage && !usageError ? (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Change signals</p>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                <InsightMetricCard label="Approvals pending" value={usageMetrics.approvalsPending} detail="Actions currently waiting for review." />
                <InsightMetricCard
                  label="Retryable send failures"
                  value={usageMetrics.failedRetryableSends}
                  detail="Outbound sends that failed and can be retried."
                />
                <InsightMetricCard
                  label="High-attention signals"
                  value={usageMetrics.highAttentionSignals}
                  detail="Entities entering high-attention status."
                  href={buildWorkflowHref("/app/attention?risk=at_risk", { source: "insights", returnTo, returnLabel: "Insights" })}
                  linkLabel="View related attention items"
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Watch areas</p>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                <InsightMetricCard label="Approvals rejected" value={usageMetrics.approvalsRejected} detail="Rejections recorded during this period." />
                <InsightMetricCard label="Retry failed" value={usageMetrics.retryFailed} detail="Retry attempts that still failed delivery." />
                <InsightMetricCard
                  label="Friction signals"
                  value={usageMetrics.reviewFrictionCount}
                  detail="Combined friction from rejects, retry failures, and suppressed handoffs."
                  href={buildWorkflowHref("/app/insights?feedFilter=failures", { source: "insights", returnTo, returnLabel: "Insights" })}
                  linkLabel="View failure-focused signals"
                />
              </div>
            </div>

            <SectionDisclosure title="Usage details" storageKey="insights-usage-breakdown" defaultCollapsed>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                <InsightMetricCard label="Approvals approved" value={usageMetrics.approvalsApproved} detail="Approved actions in this period." />
                <InsightMetricCard label="Follow-up generated" value={usageMetrics.followUpWorkflowItems} detail="Follow-up items created from workflows." />
                <InsightMetricCard label="Handoffs executed" value={usageMetrics.handoffExecuted} detail="Cross-workflow handoffs completed." />
                <InsightMetricCard label="Retry attempts" value={usageMetrics.retryAttempts} detail="Total retry executions observed." />
              </div>
            </SectionDisclosure>
          </div>
        ) : null}
      </SectionShell>

      <SectionShell className="surface-panel">
        <div className="mb-3">
          <WorkflowReturnBanner returnTo={returnToQuery} returnLabel={returnLabel} />
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Recent signals</h2>
            <p className="mt-1 text-sm text-slate-600">Latest workflow events supporting trend interpretation.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={feedFilter}
              onChange={(event) => setFeedFilter(parseInsightsFeedFilter(event.target.value))}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <option value="all">All events</option>
              <option value="failures">Failures</option>
              <option value="approvals">Approvals</option>
              <option value="handoffs">Handoffs</option>
              <option value="attention">Attention</option>
            </select>
            <Button type="button" size="sm" variant="outline" onClick={() => void loadFeed(feedFilter)}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        {feedError ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{feedError}</div> : null}

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <OperationsFeedList
            events={events}
            loading={busyFeed}
            emptyMessage={
              feedFilter === "failures"
                ? "No failure signals in this window. Delivery reliability appears stable."
                : feedFilter === "all"
                  ? "No recent signals yet. This is common in low-activity or newly configured workspaces."
                  : "No recent signals match this filter."
            }
            source="insights"
            returnLabel="Insights"
            onActionComplete={async () => {
              await Promise.all([loadFeed(feedFilter), loadUsageSignals()]);
            }}
          />
        </div>
        {!busyFeed && !feedError && events.length === 0 && feedFilter === "all" ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Not enough recent activity</p>
            <p className="mt-1 text-sm text-slate-600">Signals will appear here as calls, leads, and messages generate workflow events.</p>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-end">
          <Link href={buildWorkflowHref("/app/attention", { source: "insights", returnTo, returnLabel: "Insights" })} className="text-xs font-semibold text-slate-700 underline underline-offset-2">
            View related attention items
          </Link>
        </div>
      </SectionShell>
    </PageShell>
  );
}


