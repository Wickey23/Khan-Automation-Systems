"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, SectionHeading, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { fetchOrgAnalytics, fetchOrgHealth, fetchOrgProfile } from "@/lib/api";
import type { AccessFeatureKey, OrgAccessSummary, OrgAnalytics, OrgHealth, Organization } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAccessSummary } from "@/context/access-summary";

type DashboardPayload = {
  analytics: OrgAnalytics | null;
  health: OrgHealth | null;
  organization: Organization | null;
  profileAccess: OrgAccessSummary | null;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatRelative(value?: string | null) {
  if (!value) return "No recent activity";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "No recent activity";
  const diff = Date.now() - timestamp;
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days <= 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not captured yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not captured yet";
  return parsed.toLocaleString();
}

function firstSuccessLabel(type?: Organization["firstSuccessType"] | null) {
  if (type === "call") return "First call handled";
  if (type === "sms") return "First message handled";
  if (type === "booking") return "First booking request detected";
  return "First success pending";
}

function statusToStateCardVariant(status?: string) {
  if (status === "setup_required") return "setup" as const;
  if (status === "gated" || status === "blocked") return "locked" as const;
  return "empty" as const;
}

export default function AppOverviewPage() {
  const accessSummary = useAccessSummary();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<DashboardPayload>({
    analytics: null,
    health: null,
    organization: null,
    profileAccess: null
  });

  const loadDashboard = useCallback(async () => {
    const [analytics, health, profile] = await Promise.all([
      fetchOrgAnalytics({ range: "7d" }),
      fetchOrgHealth(),
      fetchOrgProfile()
    ]);
    setPayload({
      analytics,
      health,
      organization: profile.organization || null,
      profileAccess: profile.access || null
    });
  }, []);

  useEffect(() => {
    let active = true;
    void loadDashboard()
      .then(() => {
        if (!active) return;
        setError(null);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to load dashboard.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadDashboard]);

  const effectiveAccess = accessSummary || payload.profileAccess;
  const analytics = payload.analytics;
  const health = payload.health;
  const organization = payload.organization;

  const unresolvedOpsCount = useMemo(() => {
    const runtimeMissing = health?.runtimeHealth?.missingChecks?.length || 0;
    const readinessMissing = health?.readiness?.missingChecks?.length || 0;
    return runtimeMissing + readinessMissing;
  }, [health]);

  const metrics = useMemo(() => {
    const kpis = analytics?.kpis;
    if (!kpis) return [];
    return [
      {
        key: "inbound",
        label: "Inbound calls",
        value: formatNumber(kpis.totalCalls),
        detail: "Last 7 days",
        icon: PhoneCall
      },
      {
        key: "handled",
        label: "Calls handled",
        value: formatNumber(kpis.answeredCalls),
        detail: `Answer rate ${formatPercent(kpis.answerRate)}`,
        icon: CheckCircle2
      },
      {
        key: "missed",
        label: "Missed calls",
        value: formatNumber(kpis.missedCalls),
        detail: kpis.missedCalls > 0 ? "Needs follow-up coverage" : "No missed calls in range",
        icon: AlertTriangle
      },
      {
        key: "sms",
        label: "SMS conversations",
        value: formatNumber(kpis.smsThreads),
        detail: `${formatNumber(kpis.smsEngagedThreads)} engaged threads`,
        icon: MessageSquare
      },
      {
        key: "booking",
        label: "Appointment demand",
        value: formatNumber(kpis.appointmentRequests),
        detail: "Detected booking requests",
        icon: CalendarClock
      },
      {
        key: "issues",
        label: "Unresolved issues",
        value: formatNumber(unresolvedOpsCount),
        detail: unresolvedOpsCount > 0 ? "Review operational checks" : "No unresolved checks",
        icon: Activity
      }
    ];
  }, [analytics, unresolvedOpsCount]);

  const trendRows = useMemo(() => {
    const calls = analytics?.charts.callsPerDay || [];
    const leads = analytics?.charts.leadsPerDay || [];
    const maxCalls = Math.max(1, ...calls.map((item) => item.value));
    const maxLeads = Math.max(1, ...leads.map((item) => item.value));
    return calls.map((callPoint, index) => {
      const leadPoint = leads[index];
      return {
        day: callPoint.day,
        calls: callPoint.value,
        leads: leadPoint?.value || 0,
        callsWidth: `${Math.round((callPoint.value / maxCalls) * 100)}%`,
        leadsWidth: `${Math.round(((leadPoint?.value || 0) / maxLeads) * 100)}%`
      };
    });
  }, [analytics]);

  const outcomeRows = useMemo(
    () => (analytics?.charts.outcomeBreakdown || []).slice(0, 5),
    [analytics]
  );

  const workspaceLive = useMemo(() => {
    if (!effectiveAccess) return false;
    return ["calls", "sms", "appointments"].every((key) => effectiveAccess.features[key as AccessFeatureKey]?.status === "ready");
  }, [effectiveAccess]);

  const firstSuccessAt = organization?.firstSuccessAt || null;
  const firstSuccessType = organization?.firstSuccessType || null;

  async function refreshDashboard() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadDashboard();
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to refresh dashboard.");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <PageShell className="space-y-6">
        <SectionShell className="surface-panel">
          <StateCard variant="loading" title="Loading performance dashboard" description="Pulling calls, messages, bookings, and health metrics." />
        </SectionShell>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell className="space-y-6">
        <SectionShell className="surface-panel">
          <StateCard
            variant="error"
            title="Unable to load dashboard"
            description={error}
            action={
              <Button size="sm" variant="outline" onClick={() => void refreshDashboard()}>
                <RefreshCw className={cn("mr-1.5 h-4 w-4", refreshing && "animate-spin")} />
                Retry
              </Button>
            }
          />
        </SectionShell>
      </PageShell>
    );
  }

  if (!analytics) {
    return (
      <PageShell className="space-y-6">
        <SectionShell className="surface-panel">
          <StateCard variant="empty" title="No dashboard metrics yet" description="Run calls or messaging activity to populate your performance snapshot." />
        </SectionShell>
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        eyebrow="Performance snapshot"
        title="Workspace performance"
        description="Core business-value and operational signals for the last 7 days."
        actions={
          <Button size="sm" variant="outline" onClick={() => void refreshDashboard()} disabled={refreshing}>
            <RefreshCw className={cn("mr-1.5 h-4 w-4", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />

      <SectionShell className="surface-panel space-y-4">
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace state</p>
              <StatusBadge kind="feature" state={workspaceLive ? "ready" : "setup_required"} label={workspaceLive ? "Live" : "Needs setup"} size="xs" />
            </div>
            <p className="mt-2 text-sm text-slate-700">
              {workspaceLive
                ? "System is operational for calls, SMS, and appointment workflows."
                : "Activation or setup steps remain before full runtime coverage."}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">First success milestone</p>
              <StatusBadge kind="feature" state={firstSuccessAt ? "ready" : "setup_required"} label={firstSuccessAt ? "Captured" : "Pending"} size="xs" />
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{firstSuccessLabel(firstSuccessType)}</p>
            <p className="mt-1 text-sm text-slate-600">{formatDateTime(firstSuccessAt)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Last activity</p>
              <StatusBadge kind="feature" state={health?.level === "RED" ? "warning" : "ready"} size="xs" />
            </div>
            <p className="mt-2 text-sm text-slate-700">{formatRelative(health?.metrics.recentActivityAt || analytics.kpis.dataFreshnessAt)}</p>
            <p className="mt-1 text-sm text-slate-600">{health?.summary || "Runtime health signals are currently stable."}</p>
          </div>
        </div>
      </SectionShell>

      <SectionShell className="surface-panel space-y-4">
        <SectionHeading title="Core metrics" description="High-value performance indicators tied to call handling, SMS engagement, and booking demand." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.key} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
                <metric.icon className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-900">{metric.value}</p>
              <p className="mt-1 text-sm text-slate-600">{metric.detail}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell className="surface-panel space-y-4">
        <SectionHeading title="Feature readiness context" description="Metrics stay grounded in plan and setup status so blocked features are explicit." />
        <div className="grid gap-3 md:grid-cols-3">
          {(["calls", "sms", "appointments"] as AccessFeatureKey[]).map((key) => {
            const feature = effectiveAccess?.features[key];
            if (!feature) {
              return (
                <StateCard
                  key={key}
                  variant="empty"
                  title={`${key.toUpperCase()} status unavailable`}
                  description="Access status was not returned by profile data."
                />
              );
            }
            if (feature.status === "ready") {
              return (
                <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{feature.label}</p>
                    <StatusBadge kind="feature" state={feature.status} size="xs" />
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{feature.reason}</p>
                </div>
              );
            }
            return (
              <StateCard
                key={key}
                variant={statusToStateCardVariant(feature.status)}
                title={`${feature.label} ${feature.status === "setup_required" ? "needs setup" : "is gated"}`}
                description={feature.reason}
                action={
                  <Link href="/app/activation">
                    <Button size="sm" variant="outline">Open activation</Button>
                  </Link>
                }
              />
            );
          })}
        </div>
      </SectionShell>

      <SectionShell className="surface-panel space-y-4">
        <SectionHeading title="Recent period activity" description="Simple 7-day trend and outcome view for quick operator confidence checks." />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Daily volume</p>
            <div className="mt-3 space-y-3">
              {trendRows.length ? trendRows.map((row) => (
                <div key={row.day}>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{row.day}</span>
                    <span>{row.calls} calls / {row.leads} leads</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-sky-500" style={{ width: row.callsWidth }} />
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: row.leadsWidth }} />
                    </div>
                  </div>
                </div>
              )) : (
                <StateCard variant="empty" title="No trend data yet" description="Activity will appear here once calls and leads are processed." />
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Outcome mix</p>
            <div className="mt-3 space-y-2">
              {outcomeRows.length ? outcomeRows.map((row) => (
                <div key={row.outcome} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge kind="call" state={row.outcome} size="xs" />
                    <p className="text-sm font-medium text-slate-700">{row.outcome.replace(/_/g, " ")}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{formatNumber(row.value)}</p>
                </div>
              )) : (
                <StateCard variant="empty" title="No outcomes recorded" description="Call outcome distribution will populate as activity is logged." />
              )}
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell className="surface-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Next best action</p>
            <p className="text-sm text-slate-700">
              {unresolvedOpsCount > 0
                ? `${unresolvedOpsCount} health or readiness checks still need attention.`
                : "No immediate operational blockers detected."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/calls">
              <Button size="sm"><PhoneCall className="mr-1.5 h-4 w-4" />Open calls</Button>
            </Link>
            <Link href="/app/messages">
              <Button size="sm" variant="outline"><MessageSquare className="mr-1.5 h-4 w-4" />Open messages</Button>
            </Link>
            <Link href="/app/activation">
              <Button size="sm" variant="outline"><Clock3 className="mr-1.5 h-4 w-4" />Activation status</Button>
            </Link>
            {firstSuccessAt ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                <Sparkles className="h-3 w-3" />
                Proven live
              </span>
            ) : null}
          </div>
        </div>
      </SectionShell>
    </PageShell>
  );
}
