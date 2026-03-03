"use client";

import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { fetchAdminSystemDashboard, fetchAdminSystemReadiness, fetchAdminSystemScaleGate } from "@/lib/api";
import type { AdminScaleGate, AdminSystemDashboard, AdminSystemReadiness } from "@/lib/types";
import { Button } from "@/components/ui/button";

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function AdminSystemPage() {
  const [dashboard, setDashboard] = useState<AdminSystemDashboard | null>(null);
  const [readiness, setReadiness] = useState<AdminSystemReadiness | null>(null);
  const [scaleGate, setScaleGate] = useState<AdminScaleGate | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
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
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <AdminGuard>
      <div className="container py-10">
        <AdminTopTabs className="mb-3" />
        {scaleGate?.warnings?.lowIncidentVolumeWarning ? (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Low incident sample warning: only {scaleGate.warnings.lowIncidentVolumeContext.p1IncidentCount14d} P1 incidents in
            the last 14 days (recommended minimum: {scaleGate.warnings.lowIncidentVolumeContext.minRecommendedSampleSize}).
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">System Operator Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Internal reliability and scale-readiness telemetry.</p>
          </div>
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Inbound 5m</p>
            <p className="mt-1 text-2xl font-semibold">{dashboard?.inboundCalls.last5m ?? "-"}</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Inbound 1h</p>
            <p className="mt-1 text-2xl font-semibold">{dashboard?.inboundCalls.last1h ?? "-"}</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Inbound 24h</p>
            <p className="mt-1 text-2xl font-semibold">{dashboard?.inboundCalls.last24h ?? "-"}</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Webhook Success</p>
            <p className="mt-1 text-2xl font-semibold">{dashboard ? pct(dashboard.webhookSuccessRate) : "-"}</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Twilio Error Rate</p>
            <p className="mt-1 text-2xl font-semibold">{dashboard ? pct(dashboard.twilioErrorRate) : "-"}</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Vapi Error Rate</p>
            <p className="mt-1 text-2xl font-semibold">{dashboard ? pct(dashboard.vapiProcessingErrorRate) : "-"}</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Auto-Recovery (24h)</p>
            <p className="mt-1 text-2xl font-semibold">{dashboard?.autoRecoveryVolumeLast24h ?? "-"}</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Missing Lead Links</p>
            <p className="mt-1 text-2xl font-semibold">{dashboard?.callsMissingLeadLinkage ?? "-"}</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Org Exposure</p>
            <p className="mt-1 text-2xl font-semibold">{dashboard ? pct(dashboard.orgExposurePercent) : "-"}</p>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Traffic Exposure</p>
            <p className="mt-1 text-2xl font-semibold">{dashboard ? pct(dashboard.trafficExposurePercent) : "-"}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border bg-white p-4">
            <h2 className="mb-2 font-semibold">Routing Tier Distribution (24h)</h2>
            {dashboard?.callsByRoutingTier?.length ? (
              <div className="space-y-1 text-sm">
                {dashboard.callsByRoutingTier.map((row) => (
                  <div key={row.tier} className="flex items-center justify-between rounded border px-2 py-1">
                    <span>Tier {row.tier}</span>
                    <span className="font-medium">{row.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{loading ? "Loading..." : "No routed calls yet."}</p>
            )}
          </section>
          <section className="rounded-lg border bg-white p-4">
            <h2 className="mb-2 font-semibold">SLA Severity by Org</h2>
            {dashboard?.slaSeverityByOrg?.length ? (
              <div className="max-h-64 space-y-1 overflow-auto text-sm">
                {dashboard.slaSeverityByOrg.map((row) => (
                  <div key={row.orgId} className="flex items-center justify-between rounded border px-2 py-1">
                    <span>{row.orgName}</span>
                    <span className="font-medium">{row.severity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{loading ? "Loading..." : "No organizations found."}</p>
            )}
          </section>
        </div>

        <section className="mt-4 rounded-lg border bg-white p-4">
          <h2 className="mb-2 font-semibold">Scale Readiness Snapshot</h2>
          {readiness ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded border p-2 text-sm">
                <p className="text-xs text-muted-foreground">Webhook Success</p>
                <p className="font-medium">{pct(readiness.webhookSuccessRate)}</p>
              </div>
              <div className="rounded border p-2 text-sm">
                <p className="text-xs text-muted-foreground">Lead Linkage</p>
                <p className="font-medium">{pct(readiness.leadLinkageRate)}</p>
              </div>
              <div className="rounded border p-2 text-sm">
                <p className="text-xs text-muted-foreground">Avg Call Quality</p>
                <p className="font-medium">{Math.round(readiness.avgCallQuality)}</p>
              </div>
              <div className="rounded border p-2 text-sm">
                <p className="text-xs text-muted-foreground">P1 Incidents (30d)</p>
                <p className="font-medium">{readiness.P1IncidentCountLast30d}</p>
              </div>
              <div className="rounded border p-2 text-sm">
                <p className="text-xs text-muted-foreground">SLA WARN</p>
                <p className="font-medium">{readiness.SLAStatusDistribution.WARN}</p>
              </div>
              <div className="rounded border p-2 text-sm">
                <p className="text-xs text-muted-foreground">SLA CRITICAL</p>
                <p className="font-medium">{readiness.SLAStatusDistribution.CRITICAL}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{loading ? "Loading..." : "Readiness data unavailable."}</p>
          )}
        </section>
        <section className="mt-4 rounded-lg border bg-white p-4">
          <h2 className="mb-2 font-semibold">Scale Gate</h2>
          {scaleGate ? (
            <div className="space-y-2 text-sm">
              <p>
                Result: <span className="font-semibold">{scaleGate.result}</span> | Evaluated:{" "}
                {new Date(scaleGate.evaluationTimestamp).toLocaleString()}
              </p>
              <p>
                Cooldown:{" "}
                <span className="font-medium">
                  {scaleGate.cooldown.required ? `${scaleGate.cooldown.status} (required)` : "Not required"}
                </span>
              </p>
              <p>
                Exposure thresholds: org {pct(scaleGate.exposure.thresholds.orgExposureThreshold)} / traffic{" "}
                {pct(scaleGate.exposure.thresholds.trafficExposureThreshold)}
              </p>
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
            <p className="text-sm text-muted-foreground">{loading ? "Loading..." : "Scale gate unavailable."}</p>
          )}
        </section>
      </div>
    </AdminGuard>
  );
}
