"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Lock } from "lucide-react";
import { fetchOrgAnalytics, getBillingStatus, getMe } from "@/lib/api";
import { resolvePlanFeatures } from "@/lib/plan-features";
import type { OrgAnalytics } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { PageHeader } from "@/components/ui/page";
import { frontDeskMetricCardClass, frontDeskWorkspaceCardClass } from "@/lib/front-desk-ui";

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
    <div className="space-y-5">
      <PageHeader
        eyebrow="Business performance"
        title="Analytics"
        description="Track conversation volume, lead capture, and booking performance without digging through raw operational data."
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

      <Card className={frontDeskWorkspaceCardClass("hero")}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
          <div>
            <p className="page-eyebrow">Data freshness</p>
            <p className="mt-2 inline-flex items-center gap-1 font-semibold text-foreground">
              Latest analytics snapshot
              <InfoHint text="Timestamp of the latest analytics aggregation used in this view." />
            </p>
            <p className="mt-1 text-muted-foreground">
              {kpis?.dataFreshnessAt ? new Date(kpis.dataFreshnessAt).toLocaleString() : "Not available yet"}
            </p>
          </div>
          <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            {loading ? "Refreshing analytics..." : "Metrics update automatically from the current reporting window."}
          </div>
        </CardContent>
      </Card>

      {!isPro ? (
        <Card className={`${frontDeskWorkspaceCardClass("subtle")} border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.98)_0%,rgba(254,243,199,0.92)_100%)]`}>
          <CardContent className="p-5 text-sm text-amber-950">
            <div className="flex items-center gap-2 font-semibold">
              <Lock className="h-4 w-4" />
              Advanced analytics is a Pro feature
            </div>
            <p className="mt-1">
              Upgrade to Pro to unlock expanded KPI reporting and trend analysis.
            </p>
            <Link href="/app/billing" className="mt-3 inline-block rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-medium">
              Upgrade to Pro
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <div className={`metric-grid ${!isPro ? "opacity-60" : ""}`}>
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

      {isViewer ? (
        <Card className={`${frontDeskWorkspaceCardClass("subtle")} border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.98)_0%,rgba(254,243,199,0.92)_100%)]`}>
          <CardContent className="p-4 text-sm text-amber-950">Viewer role access: summary KPI cards only.</CardContent>
        </Card>
      ) : null}

      {!isViewer ? (
      <div className={`grid gap-4 lg:grid-cols-3 ${!isPro ? "opacity-60" : ""}`}>
        <Card className={`${frontDeskWorkspaceCardClass("default")} lg:col-span-2`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Conversation volume</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
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
            <p className="text-sm text-muted-foreground">No call data in this range.</p>
          )}
          </CardContent>
        </Card>

        <Card className={frontDeskWorkspaceCardClass("subtle")}>
          <CardHeader className="pb-3">
            <CardTitle>What happened</CardTitle>
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
            <p className="text-sm text-muted-foreground">No outcomes to display.</p>
          )}
          </CardContent>
        </Card>
      </div>
      ) : null}

      {!isViewer ? (
      <Card className={`${frontDeskWorkspaceCardClass("default")} ${!isPro ? "opacity-60" : ""}`}>
        <CardHeader className="pb-3">
          <CardTitle>Leads captured over time</CardTitle>
        </CardHeader>
        <CardContent>
        {data?.charts.leadsPerDay?.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {data.charts.leadsPerDay.map((row) => (
              <div key={row.day} className="rounded border bg-muted/20 p-2 text-sm">
                <p className="text-xs text-muted-foreground">{row.day}</p>
                <p className="mt-1 text-lg font-semibold">{row.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No lead data in this range.</p>
        )}
        </CardContent>
      </Card>
      ) : null}
    </div>
  );
}
