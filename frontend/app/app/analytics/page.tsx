"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { fetchOrgAnalytics, getBillingStatus, getMe } from "@/lib/api";
import { resolvePlanFeatures } from "@/lib/plan-features";
import type { OrgAnalytics } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientGateCard, ClientStatusGrid } from "@/components/ui/client-module";
import { InfoHint } from "@/components/ui/info-hint";
import { PageHeader, PageHelpFab, PageShell, SectionShell } from "@/components/ui/page";
import { subscriptionStatusLabel } from "@/lib/client-status-language";
import { frontDeskEmptyStateClass, frontDeskLoadingCardClass, frontDeskMetricCardClass, frontDeskSkeletonLineClass, frontDeskWorkspaceCardClass } from "@/lib/front-desk-ui";

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function duration(value: number) {
  if (!value) return "-";
  if (value < 60) return `${Math.round(value)}s`;
  const m = Math.floor(value / 60);
  const s = Math.round(value % 60);
  return `${m}m ${s}s`;
}

export default function AppAnalyticsPage() {
  const [range, setRange] = useState<"7d" | "30d">("7d");
  const [data, setData] = useState<OrgAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [role, setRole] = useState<"CLIENT" | "CLIENT_STAFF" | "CLIENT_ADMIN" | "ADMIN" | "SUPER_ADMIN" | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([getBillingStatus(), getMe()])
      .then(([billing, me]) => {
        if (!active) return;
        const access = resolvePlanFeatures({
          plan: billing.subscription?.plan,
          status: billing.subscription?.status
        });
        setIsPro(access.analytics);
        setRole(me.user.role);
      })
      .catch(() => {
        setIsPro(false);
        setRole(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchOrgAnalytics({ range })
      .then((analytics) => {
        if (!active) return;
        setData(analytics);
      })
      .catch(() => {
        if (!active) return;
        setData(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [range]);

  const kpis = useMemo(() => data?.kpis, [data]);
  const isViewer = role === "CLIENT";
  const metricCards = [
    { label: "AI Answer Rate", hint: "Answered calls divided by total calls in the selected range.", value: kpis ? pct(kpis.answerRate) : "-" },
    { label: "Lead Capture Rate", hint: "Phone-call leads created divided by total calls.", value: kpis ? pct(kpis.leadCaptureRate) : "-" },
    { label: "Avg Conversation Length", hint: "Average conversation duration in the selected time range.", value: kpis ? duration(kpis.avgCallDurationSec) : "-" },
    { label: "Text Reply Rate", hint: "SMS threads with both outbound and inbound responses over total SMS threads.", value: kpis ? pct(kpis.smsEngagementRate) : "-" },
    { label: "Appointment Requests", hint: "Number of calls marked as appointment requested in selected range.", value: kpis?.appointmentRequests ?? "-" },
    { label: "Missed Calls", hint: "Calls marked MISSED or ABANDONED in the selected range.", value: kpis?.missedCalls ?? "-" },
    {
      label: "AI Rescue Rate",
      hint: "Estimated share of AI-handled calls that produced a lead, request, or successful handoff.",
      value: kpis ? pct(kpis.aiRescueRate ?? 0) : "-",
      meta: `${kpis?.rescuedCalls ?? 0} rescued calls`
    },
    {
      label: "Revenue Opportunity",
      hint: "Estimated revenue opportunity based on booked appointments and average job value.",
      value: kpis?.estimatedRevenueOpportunityUsd ? `$${kpis.estimatedRevenueOpportunityUsd.toLocaleString()}` : "$0",
      meta: `${kpis?.appointmentsBooked ?? 0} booked x $${kpis?.averageJobValueUsd ?? 650}`
    },
    { label: "Known Customer Rate", hint: "Percent of newly created leads that are not still using placeholder names.", value: kpis ? pct(Math.max(0, 1 - kpis.unknownNameRate)) : "-" }
  ];

  return (
    <PageShell className="space-y-6">
      <PageHeader
        eyebrow="Business performance"
        title="Performance"
        description="Use this page to measure how front-desk work is converting into leads, follow-up, and booked jobs without digging through raw operational history."
        actions={
          <div className="inline-flex rounded-2xl border bg-white p-1 shadow-sm">
            {(["7d", "30d"] as const).map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={range === option ? "default" : "ghost"}
                onClick={() => setRange(option)}
              >
                Last {option === "7d" ? "7 days" : "30 days"}
              </Button>
            ))}
          </div>
        }
      />

      <PageHelpFab
        items={[
          { label: "Use this page", text: "Use Performance to confirm whether calls, replies, and follow-up work are turning into leads and booked jobs." },
          { label: "Start here", text: "Check demand and conversion first, then use the detailed metrics only after you understand the top-line trend." },
          { label: "Go next", text: "Return to Front Desk, Call Queue, Inbox, or Booking Queue to act on live work. This page is for review, not daily queue work." }
        ]}
      />

      <SectionShell className="surface-panel space-y-5">
        <ClientStatusGrid
          items={[
            {
              label: "Reporting access",
              value: isPro ? "Ready" : "Locked",
              detail: isPro ? "Expanded KPI reporting is available in this workspace." : "Upgrade the workspace plan to unlock the full reporting view.",
              tone: isPro ? "success" : "warning"
            },
            {
              label: "Reporting window",
              value: range === "7d" ? "Last 7 days" : "Last 30 days",
              detail: "Switch the range above to compare short-term and month-long trends."
            },
            {
              label: "Data freshness",
              value: kpis?.dataFreshnessAt ? new Date(kpis.dataFreshnessAt).toLocaleTimeString() : "Pending",
              detail: "Latest analytics snapshot used by this page."
            },
            {
              label: "Viewer role",
              value: isViewer ? "Read-only" : "Operational",
              detail: isViewer ? "This page is for review only." : "Use this page to review trends, then return to the live queues to act."
            }
          ]}
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,420px)] xl:items-start">
          <Card className={frontDeskWorkspaceCardClass("hero")}>
            <CardContent className="space-y-4 p-6 sm:p-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Reporting summary</p>
                <p className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-slate-900">
                  {loading
                    ? "Refreshing performance data"
                    : kpis?.appointmentsBooked
                      ? `${kpis.appointmentsBooked} booked jobs are in the current reporting window`
                      : "No booked jobs in the current reporting window yet"}
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Use Performance to confirm whether front-desk work is turning into leads, replies, and booked jobs. Start with demand and outcomes, then check whether intake is converting into office follow-up.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className={frontDeskMetricCardClass()}>
                  <div className="p-5">
                    <p className="page-eyebrow">Demand</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">Track call volume and missed demand before it turns into lost work.</p>
                  </div>
                </div>
                <div className={frontDeskMetricCardClass()}>
                  <div className="p-5">
                    <p className="page-eyebrow">Conversion</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">Measure how often calls and replies become leads, requests, and booked jobs.</p>
                  </div>
                </div>
                <div className={frontDeskMetricCardClass()}>
                  <div className="p-5">
                    <p className="page-eyebrow">Follow-up quality</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">Use reply and rescue rates to see whether the office is recovering missed demand effectively.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={frontDeskWorkspaceCardClass("default")}>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Reporting controls</p>
                <p className="text-base font-semibold text-slate-900">Switch the reporting window and confirm how fresh the current analytics snapshot is.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["7d", "30d"] as const).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={range === option ? "default" : "outline"}
                    onClick={() => setRange(option)}
                    className="w-full"
                  >
                    Last {option === "7d" ? "7 days" : "30 days"}
                  </Button>
                ))}
              </div>
              <div className="rounded-2xl border border-slate-200/90 bg-white/70 px-4 py-4 text-sm text-slate-700">
                <p className="page-eyebrow">Data freshness</p>
                <p className="mt-2 inline-flex items-center gap-1 font-semibold text-foreground">
                  Latest analytics snapshot
                  <InfoHint text="Timestamp of the latest analytics aggregation used in this view." />
                </p>
                <p className="mt-1 text-muted-foreground">
                  {kpis?.dataFreshnessAt ? new Date(kpis.dataFreshnessAt).toLocaleString() : "Not available yet"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/90 bg-white/60 px-4 py-3 text-sm text-muted-foreground">
                {loading ? "Refreshing analytics..." : "Metrics update automatically from the current reporting window."}
              </div>
            </CardContent>
          </Card>
        </div>
      </SectionShell>

      {!isPro ? (
        <ClientGateCard
          title="Advanced reporting is locked on the current plan."
          description={`Upgrade when you want broader KPI reporting, deeper trend visibility, and stronger operational review tools. Current access: ${subscriptionStatusLabel(isPro ? "active" : "not_active")}.`}
          badgeLabel="Locked"
          badgeTone="warning"
          actions={[{ href: "/app/billing", label: "Open Billing" }]}
        />
      ) : null}

      <SectionShell className="surface-panel space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="page-eyebrow">Core KPI Cards</p>
            <p className="mt-1 text-sm text-muted-foreground">Monitor demand, conversion, and follow-up quality at a glance.</p>
          </div>
          <p className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600">
            {range === "7d" ? "7-day window" : "30-day window"}
          </p>
        </div>
        <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 ${!isPro ? "opacity-60" : ""}`}>
          {metricCards.map((item) => (
            <Card key={item.label} className={frontDeskMetricCardClass()}>
              <CardContent className="p-5">
                <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {item.label}
                  <InfoHint text={item.hint} />
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{item.value}</p>
                {item.meta ? <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </SectionShell>

      {isViewer ? (
        <Card className={`${frontDeskWorkspaceCardClass("subtle")} border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.98)_0%,rgba(254,243,199,0.92)_100%)]`}>
          <CardContent className="p-4 text-sm text-amber-950">Viewer role access: summary KPI cards only.</CardContent>
        </Card>
      ) : null}

      {!isViewer ? (
      <div className={`grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,360px)] ${!isPro ? "opacity-60" : ""}`}>
        <Card className={frontDeskWorkspaceCardClass("default")}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Conversation volume</CardTitle>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Review how much demand is reaching the front desk in this reporting window.
            </p>
          </CardHeader>
          <CardContent>
          {loading ? (
            <div className={frontDeskLoadingCardClass()}>
              <div className="space-y-3">
                <div className={frontDeskSkeletonLineClass("sm")} />
                <div className={frontDeskSkeletonLineClass()} />
                <div className={frontDeskSkeletonLineClass("lg")} />
              </div>
            </div>
          ) : data?.charts.callsPerDay?.length ? (
            <div className="space-y-1">
              {data.charts.callsPerDay.map((row) => (
                <div key={row.day} className="flex items-center gap-3 text-sm">
                  <span className="w-28 text-xs text-muted-foreground">{row.day}</span>
                  <div className="h-2 flex-1 rounded bg-muted">
                    <div
                      className="h-2 rounded bg-zinc-700"
                      style={{ width: `${Math.min(100, row.value * 12)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs">{row.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={frontDeskEmptyStateClass()}>
              No call volume data yet. Once the receptionist starts handling live calls in this reporting window, this chart will show whether demand is building, steady, or dropping off.
            </div>
          )}
          </CardContent>
        </Card>

        <Card className={frontDeskWorkspaceCardClass("subtle")}>
          <CardHeader className="pb-3">
            <CardTitle>What happened</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              See how calls resolved across requests, transfers, missed demand, and other front-desk outcomes.
            </p>
          </CardHeader>
          <CardContent>
          {data?.charts.outcomeBreakdown?.length ? (
            <div className="space-y-2">
              {data.charts.outcomeBreakdown.map((row) => (
                <div key={row.outcome} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{row.outcome.replaceAll("_", " ")}</span>
                  <span className="font-medium">{row.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={frontDeskEmptyStateClass()}>
              No outcomes yet. Once calls are processed, this section will show whether they became requests, transfers, missed calls, or other front-desk results.
            </div>
          )}
          </CardContent>
        </Card>
      </div>
      ) : null}

      {!isViewer ? (
      <Card className={`${frontDeskWorkspaceCardClass("default")} ${!isPro ? "opacity-60" : ""}`}>
        <CardHeader className="pb-3">
          <CardTitle>Leads captured over time</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            Use this section to confirm whether intake is actually turning into saved follow-up work for the office.
          </p>
        </CardHeader>
        <CardContent>
        {data?.charts.leadsPerDay?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.charts.leadsPerDay.map((row) => (
              <div key={row.day} className="rounded-[20px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(244,247,251,0.96)_100%)] p-4 text-sm shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <p className="page-eyebrow">{row.day}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{row.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className={frontDeskEmptyStateClass()}>
            No leads captured in this range yet. When calls, texts, or web requests start turning into saved customer work, those lead totals will appear here.
          </div>
        )}
        </CardContent>
      </Card>
      ) : null}
    </PageShell>
  );
}

