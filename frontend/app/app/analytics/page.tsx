"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Lock } from "lucide-react";
import { fetchOrgAnalytics, getBillingStatus, getMe } from "@/lib/api";
import { resolvePlanFeatures } from "@/lib/plan-features";
import type { OrgAnalytics } from "@/lib/types";
import { InfoHint } from "@/components/ui/info-hint";

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Revenue and operations view of call handling, lead capture, and messaging performance.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              Data freshness
              <InfoHint text="Timestamp of the latest analytics aggregation used in this view." />
            </span>
            : {kpis?.dataFreshnessAt ? new Date(kpis.dataFreshnessAt).toLocaleString() : "n/a"}
          </p>
        </div>
        <div className="inline-flex rounded-md border bg-white p-1">
          {(["7d", "30d"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`rounded px-3 py-1 text-sm ${range === option ? "bg-muted font-medium" : ""}`}
              onClick={() => setRange(option)}
            >
              Last {option === "7d" ? "7 days" : "30 days"}
            </button>
          ))}
        </div>
      </div>

      {!isPro ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <Lock className="h-4 w-4" />
            Advanced analytics is a Pro feature
          </div>
          <p className="mt-1">
            Upgrade to Pro to unlock expanded KPI reporting and trend analysis.
          </p>
          <Link href="/app/billing" className="mt-2 inline-block rounded border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium">
            Upgrade to Pro
          </Link>
        </div>
      ) : null}

      <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${!isPro ? "opacity-60" : ""}`}>
        <div className="rounded-lg border bg-white p-4">
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            Answer Rate
            <InfoHint text="Answered calls divided by total calls in selected range." />
          </p>
          <p className="mt-1 text-2xl font-semibold">{kpis ? pct(kpis.answerRate) : "-"}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            Lead Capture Rate
            <InfoHint text="Phone-call leads created divided by total calls." />
          </p>
          <p className="mt-1 text-2xl font-semibold">{kpis ? pct(kpis.leadCaptureRate) : "-"}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            Avg Call Duration
            <InfoHint text="Average call duration in the selected time range." />
          </p>
          <p className="mt-1 text-2xl font-semibold">{kpis ? duration(kpis.avgCallDurationSec) : "-"}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            SMS Engagement Rate
            <InfoHint text="Threads with both inbound and outbound SMS over total threads." />
          </p>
          <p className="mt-1 text-2xl font-semibold">{kpis ? pct(kpis.smsEngagementRate) : "-"}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            Appointment Requests
            <InfoHint text="Number of calls marked as appointment requested in selected range." />
          </p>
          <p className="mt-1 text-2xl font-semibold">{kpis?.appointmentRequests ?? "-"}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            Missed Calls
            <InfoHint text="Calls marked MISSED in the selected range." />
          </p>
          <p className="mt-1 text-2xl font-semibold">{kpis?.missedCalls ?? "-"}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            Call Quality Avg
            <InfoHint text="Average computed quality score for calls that have scoring data." />
          </p>
          <p className="mt-1 text-2xl font-semibold">{kpis ? Math.round(kpis.callQualityAverage) : "-"}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            ROI Estimate
            <InfoHint text="Estimated revenue opportunity = appointments booked x average job value." />
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {kpis?.estimatedRevenueOpportunityUsd
              ? `$${kpis.estimatedRevenueOpportunityUsd.toLocaleString()}`
              : "$0"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {kpis?.appointmentsBooked ?? 0} booked x ${kpis?.averageJobValueUsd ?? 650}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            Unknown Name Rate
            <InfoHint text="Percent of newly created leads still using placeholder names." />
          </p>
          <p className="mt-1 text-2xl font-semibold">{kpis ? pct(kpis.unknownNameRate) : "-"}</p>
        </div>
      </div>

      {isViewer ? (
        <div className="rounded-lg border bg-amber-50 p-3 text-sm text-amber-900">
          Viewer role access: summary KPI cards only.
        </div>
      ) : null}

      {!isViewer ? (
      <div className={`grid gap-4 lg:grid-cols-3 ${!isPro ? "opacity-60" : ""}`}>
        <section className="rounded-lg border bg-white p-4 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Calls per day</h2>
          </div>
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
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-semibold">Outcome breakdown</h2>
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
        </section>
      </div>
      ) : null}

      {!isViewer ? (
      <section className={`rounded-lg border bg-white p-4 ${!isPro ? "opacity-60" : ""}`}>
        <h2 className="mb-3 font-semibold">Leads per day</h2>
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
      </section>
      ) : null}
    </div>
  );
}
