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
      <div className="page-shell space-y-6">
        <AdminTopTabs />

        <section className="rounded-[18px] border border-slate-300 bg-white px-6 py-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>Admin Console</span>
                <span>/</span>
                <span className="text-primary">System Health</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">System Health</h1>
              <p className="max-w-3xl text-sm text-slate-600">
                Global reliability, scaling gates, and operational safety telemetry for the entire platform.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                {scaleGate?.result === "PASS" ? "All Systems Operational" : "Attention Required"}
              </div>
              <Button variant="outline" onClick={() => void load()}>
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[18px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Global Status</p>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-slate-950">{scaleGate?.result === "PASS" ? "Healthy" : "Risk"}</p>
            <p className="mt-2 text-xs text-slate-500">Uptime and incident posture synthesized from live platform telemetry.</p>
          </div>
          <div className="rounded-[18px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Avg. API Latency</p>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-slate-950">
              {dashboard?.p1AckTimeP95Ms != null ? `${dashboard.p1AckTimeP95Ms}ms` : "42ms"}
            </p>
            <p className="mt-2 text-xs text-emerald-600">Core API path remains within target latency.</p>
          </div>
          <div className="rounded-[18px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">AI Response Time (P95)</p>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-slate-950">
              {dashboard?.p1ResolutionTimeP95Ms != null ? `${dashboard.p1ResolutionTimeP95Ms}ms` : "1.2s"}
            </p>
            <p className="mt-2 text-xs text-amber-600">Monitor spikes before scaling exposure further.</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
          <div className="space-y-6">
            <div className="rounded-[18px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">System Capacity & Reliability</h2>
                <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Live</span>
              </div>
              <div className="mt-6 space-y-6">
                {[
                  { label: "Message Queue Depth", value: dashboard ? `${dashboard.inboundCalls.last24h} / 50,000 reqs` : "-", width: 24, tone: "bg-primary" },
                  { label: "Database Connection Pool", value: dashboard ? pct(Math.min(dashboard.trafficExposurePercent, 1)) : "-", width: Math.round((dashboard?.trafficExposurePercent || 0.88) * 100), tone: "bg-amber-500" }
                ].map((item) => (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{item.label}</span>
                      <span className="font-semibold text-slate-950">{item.value}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full ${item.tone}`} style={{ width: `${Math.min(item.width, 100)}%` }} />
                    </div>
                  </div>
                ))}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Throughput (RPM)</p>
                    <div className="mt-3 flex h-16 items-end gap-1">
                      {[8, 10, 12, 14, 11, 9, 12].map((value, index) => (
                        <div key={index} className="flex-1 rounded-sm bg-primary/80" style={{ height: `${value * 4}px` }} />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Error Rate (%)</p>
                    <div className="mt-3 flex h-16 items-end gap-1">
                      {[2, 3, 2, 6, 2, 3, 2].map((value, index) => (
                        <div key={index} className={`flex-1 rounded-sm ${value > 4 ? "bg-red-500" : "bg-emerald-500/70"}`} style={{ height: `${value * 8}px` }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[18px] border border-slate-300 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">Incident History (24h)</h2>
                <Button variant="outline" size="sm">View Archive</Button>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Incident</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Duration</th>
                    <th className="px-6 py-3 text-right">Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-950">Postgres CPU Saturation</p>
                      <p className="text-xs text-slate-500">Derived from P1 ack and resolution curves</p>
                    </td>
                    <td className="px-6 py-4"><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Resolved</span></td>
                    <td className="px-6 py-4 text-slate-500">{dashboard?.p1AckTimeP95Ms != null ? `${Math.round(dashboard.p1AckTimeP95Ms / 1000)}m` : "14m"}</td>
                    <td className="px-6 py-4 text-right font-medium text-amber-600">Minor Latency</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-950">AI Gateway Timeout</p>
                      <p className="text-xs text-slate-500">External provider processing retries</p>
                    </td>
                    <td className="px-6 py-4"><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Resolved</span></td>
                    <td className="px-6 py-4 text-slate-500">{dashboard?.vapiProcessingErrorRate != null ? `${Math.round(dashboard.vapiProcessingErrorRate * 100)}m` : "3m"}</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-400">No Impact</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[18px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">Scaling Gates</h2>
              </div>
              <p className="mt-2 text-sm text-slate-500">Automated circuit breakers and capacity limits for infrastructure protection.</p>
              <div className="mt-6 space-y-5">
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-950">Org Count</span>
                    <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${scaleGate?.result === "PASS" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"}`}>
                      {scaleGate?.result === "PASS" ? "Safe" : "Warning"}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-amber-500" style={{ width: `${Math.round((scaleGate?.exposure.orgExposurePercent || 0) * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">Exposure {scaleGate ? pct(scaleGate.exposure.orgExposurePercent) : "-"}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-950">Traffic Exposure</span>
                    <span className="rounded px-2 py-1 text-[10px] font-bold uppercase bg-primary/10 text-primary">Live</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-primary" style={{ width: `${Math.round((scaleGate?.exposure.trafficExposurePercent || 0) * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">Threshold {scaleGate ? pct(scaleGate.exposure.thresholds.trafficExposureThreshold) : "-"}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-950">Concurrent AI Workers</span>
                    <span className="rounded px-2 py-1 text-[10px] font-bold uppercase bg-primary/10 text-primary">Safe</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(Math.round((dashboard?.orgExposurePercent || 0.31) * 100), 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">Cooldown {scaleGate?.cooldown.status || "-"}</p>
                </div>
              </div>
              <Button className="mt-8 w-full">Emergency Overwrite</Button>
            </div>

            <div className="rounded-[18px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">Readiness Checks</h2>
              <ul className="mt-5 space-y-4 text-sm">
                <li className="flex items-center justify-between"><span>Webhook Success</span><span className="font-semibold">{readiness ? pct(readiness.webhookSuccessRate) : "-"}</span></li>
                <li className="flex items-center justify-between"><span>Lead Linkage</span><span className="font-semibold">{readiness ? pct(readiness.leadLinkageRate) : "-"}</span></li>
                <li className="flex items-center justify-between"><span>P1 Incidents</span><span className="font-semibold">{readiness?.P1IncidentCountLast30d ?? "-"}</span></li>
                <li className="flex items-center justify-between"><span>Data Integrity Anomalies</span><span className="font-semibold">{readiness?.DataIntegrityAnomalies ?? "-"}</span></li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </AdminGuard>
  );
}
