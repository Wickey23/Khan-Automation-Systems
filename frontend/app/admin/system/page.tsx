"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { fetchAdminSystemDashboard, fetchAdminSystemReadiness, fetchAdminSystemScaleGate } from "@/lib/api";
import type { AdminScaleGate, AdminSystemDashboard, AdminSystemReadiness } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, SectionHeading, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function AdminSystemPage() {
  const [dashboard, setDashboard] = useState<AdminSystemDashboard | null>(null);
  const [readiness, setReadiness] = useState<AdminSystemReadiness | null>(null);
  const [scaleGate, setScaleGate] = useState<AdminScaleGate | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardData, readinessData, scaleGateData] = await Promise.all([
        fetchAdminSystemDashboard(),
        fetchAdminSystemReadiness(),
        fetchAdminSystemScaleGate()
      ]);
      setDashboard(dashboardData);
      setReadiness(readinessData);
      setScaleGate(scaleGateData);
    } catch {
      setDashboard(null);
      setReadiness(null);
      setScaleGate(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const topStats = useMemo(
    () => [
      { label: "Inbound 5m", value: dashboard?.inboundCalls.last5m ?? "-" },
      { label: "Inbound 1h", value: dashboard?.inboundCalls.last1h ?? "-" },
      { label: "Inbound 24h", value: dashboard?.inboundCalls.last24h ?? "-" },
      { label: "Webhook success", value: dashboard ? pct(dashboard.webhookSuccessRate) : "-" }
    ],
    [dashboard]
  );

  const reliabilityStats = useMemo(
    () => [
      { label: "Twilio error rate", value: dashboard ? pct(dashboard.twilioErrorRate) : "-" },
      { label: "Vapi error rate", value: dashboard ? pct(dashboard.vapiProcessingErrorRate) : "-" },
      { label: "Auto-recovery (24h)", value: dashboard?.autoRecoveryVolumeLast24h ?? "-" },
      { label: "Missing lead links", value: dashboard?.callsMissingLeadLinkage ?? "-" },
      { label: "Org exposure", value: dashboard ? pct(dashboard.orgExposurePercent) : "-" },
      { label: "Traffic exposure", value: dashboard ? pct(dashboard.trafficExposurePercent) : "-" }
    ],
    [dashboard]
  );

  return (
    <AdminGuard>
      <PageShell className="space-y-6">
        <AdminTopTabs />

        <PageHeader
          eyebrow="System operations"
          title="Reliability and scale readiness"
          description="Internal telemetry for platform health, security posture, and launch safety gates."
          actions={
            <Button variant="outline" onClick={() => void load()}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          }
        />

        {scaleGate?.warnings?.lowIncidentVolumeWarning ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Low incident sample warning: only {scaleGate.warnings.lowIncidentVolumeContext.p1IncidentCount14d} P1 incidents in the
            last 14 days (recommended minimum: {scaleGate.warnings.lowIncidentVolumeContext.minRecommendedSampleSize}).
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {topStats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{stat.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>

        <SectionShell className="surface-panel space-y-4">
          <SectionHeading title="Reliability metrics" description="Core transport and runtime signals for the current window." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reliabilityStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{stat.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{stat.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Auth and 2FA email health (24h)</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded border border-slate-200 bg-white px-2 py-1 text-sm">Provider: {dashboard?.emailProviderConfigured ? "Configured" : "Missing"}</div>
              <div className="rounded border border-slate-200 bg-white px-2 py-1 text-sm">2FA Required: {dashboard?.auth2fa?.required24h ?? 0}</div>
              <div className="rounded border border-slate-200 bg-white px-2 py-1 text-sm">OTP Success: {dashboard?.auth2fa?.otpSuccess24h ?? 0}</div>
              <div className="rounded border border-slate-200 bg-white px-2 py-1 text-sm">Invalid OTP: {dashboard?.auth2fa?.invalidOtp24h ?? 0}</div>
              <div className="rounded border border-slate-200 bg-white px-2 py-1 text-sm">Email Failures: {dashboard?.auth2fa?.emailFailure24h ?? 0}</div>
              <div className="rounded border border-slate-200 bg-white px-2 py-1 text-sm">Test Sends: {dashboard?.auth2fa?.testEmailsSent24h ?? 0}</div>
            </div>
          </div>
        </SectionShell>

        <SectionShell className="surface-panel space-y-4">
          <SectionHeading
            title="Security signals"
            description="Step-up failures, context rejects, webhook security counters, and suppression events."
          />
          {dashboard?.securityAlerts?.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {dashboard.securityAlerts.map((alert) => (
                <div
                  key={alert.key}
                  className={`rounded border px-3 py-2 text-sm ${
                    alert.severity === "critical"
                      ? "border-rose-300 bg-rose-50 text-rose-900"
                      : "border-amber-300 bg-amber-50 text-amber-900"
                  }`}
                >
                  <div className="font-medium">{alert.label}</div>
                  <div className="text-xs opacity-80">{alert.key} - {alert.value} in the last 24h</div>
                </div>
              ))}
            </div>
          ) : (
            <StateCard variant={loading ? "loading" : "empty"} title={loading ? "Loading security alerts" : "No elevated security counters"} />
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">Step-Up Forbidden: {dashboard?.securityCounters?.stepUpForbidden24h ?? 0}</div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">Tool Context Rejects: {dashboard?.securityCounters?.toolOrgContextRejected24h ?? 0}</div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">Signature Invalid: {dashboard?.securityCounters?.webhookSignatureInvalid24h ?? 0}</div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">Replay Blocked: {dashboard?.securityCounters?.webhookReplayBlocked24h ?? 0}</div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">Retry Failures: {dashboard?.securityCounters?.webhookRetryWorthyFailure24h ?? 0}</div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">SMS Suppressed: {dashboard?.securityCounters?.smsAutomationSuppressed24h ?? 0}</div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">Hourly SMS Cap: {dashboard?.securityCounters?.quotaOrgSmsHourly24h ?? 0}</div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">Daily SMS Cap: {dashboard?.securityCounters?.quotaOrgSmsDaily24h ?? 0}</div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">Offer Suppressed: {dashboard?.securityCounters?.requestOfferSuppressed24h ?? 0}</div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">Clarification Suppressed: {dashboard?.securityCounters?.requestClarificationSuppressed24h ?? 0}</div>
          </div>
        </SectionShell>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionShell className="surface-panel space-y-3">
            <SectionHeading title="Routing tier distribution (24h)" description="Call volumes by routing tier." />
            {dashboard?.callsByRoutingTier?.length ? (
              <div className="space-y-1 text-sm">
                {dashboard.callsByRoutingTier.map((row) => (
                  <div key={row.tier} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1">
                    <span>Tier {row.tier}</span>
                    <span className="font-medium">{row.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <StateCard variant={loading ? "loading" : "empty"} title={loading ? "Loading routing tiers" : "No routed calls yet"} />
            )}
          </SectionShell>

          <SectionShell className="surface-panel space-y-3">
            <SectionHeading title="SLA severity by org" description="Current SLA severity ranking for tenant environments." />
            {dashboard?.slaSeverityByOrg?.length ? (
              <div className="max-h-64 space-y-1 overflow-auto text-sm">
                {dashboard.slaSeverityByOrg.map((row) => (
                  <div key={row.orgId} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1">
                    <span>{row.orgName}</span>
                    <span className="font-medium">{row.severity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <StateCard variant={loading ? "loading" : "empty"} title={loading ? "Loading organizations" : "No organizations found"} />
            )}
          </SectionShell>
        </div>

        <SectionShell className="surface-panel space-y-4">
          <SectionHeading title="Scale readiness snapshot" description="Aggregated reliability metrics used in go/no-go decisions." />
          {readiness ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded border border-slate-200 bg-white p-2 text-sm"><p className="text-xs text-slate-500">Webhook Success</p><p className="font-medium">{pct(readiness.webhookSuccessRate)}</p></div>
              <div className="rounded border border-slate-200 bg-white p-2 text-sm"><p className="text-xs text-slate-500">Lead Linkage</p><p className="font-medium">{pct(readiness.leadLinkageRate)}</p></div>
              <div className="rounded border border-slate-200 bg-white p-2 text-sm"><p className="text-xs text-slate-500">Avg Call Quality</p><p className="font-medium">{Math.round(readiness.avgCallQuality)}</p></div>
              <div className="rounded border border-slate-200 bg-white p-2 text-sm"><p className="text-xs text-slate-500">P1 Incidents (30d)</p><p className="font-medium">{readiness.P1IncidentCountLast30d}</p></div>
              <div className="rounded border border-slate-200 bg-white p-2 text-sm"><p className="text-xs text-slate-500">SLA WARN</p><p className="font-medium">{readiness.SLAStatusDistribution.WARN}</p></div>
              <div className="rounded border border-slate-200 bg-white p-2 text-sm"><p className="text-xs text-slate-500">SLA CRITICAL</p><p className="font-medium">{readiness.SLAStatusDistribution.CRITICAL}</p></div>
            </div>
          ) : (
            <StateCard variant={loading ? "loading" : "empty"} title={loading ? "Loading readiness metrics" : "Readiness data unavailable"} />
          )}
        </SectionShell>

        <SectionShell className="surface-panel space-y-3">
          <SectionHeading title="Scale gate" description="Final gate result and failing criteria for expansion decisions." />
          {scaleGate ? (
            <div className="space-y-2 text-sm">
              <p>Result: <span className="font-semibold">{scaleGate.result}</span> | Evaluated: {new Date(scaleGate.evaluationTimestamp).toLocaleString()}</p>
              <p>Cooldown: <span className="font-medium">{scaleGate.cooldown.required ? `${scaleGate.cooldown.status} (required)` : "Not required"}</span></p>
              <p>Exposure thresholds: org {pct(scaleGate.exposure.thresholds.orgExposureThreshold)} / traffic {pct(scaleGate.exposure.thresholds.trafficExposureThreshold)}</p>
              {scaleGate.failingCriteria.length ? (
                <div>
                  <p className="font-medium">Failing criteria</p>
                  <ul className="list-disc pl-5">
                    {scaleGate.failingCriteria.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-emerald-700">All gate criteria currently passing.</p>
              )}
            </div>
          ) : (
            <StateCard variant={loading ? "loading" : "empty"} title={loading ? "Loading scale gate" : "Scale gate unavailable"} />
          )}
        </SectionShell>
      </PageShell>
    </AdminGuard>
  );
}
