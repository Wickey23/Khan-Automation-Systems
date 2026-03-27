"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { fetchAdminRevenue } from "@/lib/api";
import type { AdminRevenueSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, SectionHeading, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";

function usd(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<AdminRevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchAdminRevenue();
      setData(next);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const planMix = useMemo(
    () => [
      { label: "Founding", value: data?.subscriptionsByPlan.founding ?? 0 },
      { label: "Standard", value: data?.subscriptionsByPlan.starter ?? 0 },
      { label: "Growth/Pro", value: data?.subscriptionsByPlan.pro ?? 0 }
    ],
    [data]
  );

  return (
    <AdminGuard>
      <PageShell className="space-y-5">
        <AdminTopTabs />
        <PageHeader
          eyebrow="Revenue operations"
          title="Subscription revenue overview"
          description="Track active subscriptions, estimated MRR, plan distribution, and Stripe paid totals."
          actions={
            <Button variant="outline" onClick={() => void load()}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Estimated MRR</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{usd(data?.estimatedMrrUsd)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Active subscriptions</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{data?.activeSubscriptions ?? "-"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Stripe paid (30d)</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {data?.stripePaidLast30d != null ? `${data.stripePaidCurrency || "USD"} ${data.stripePaidLast30d.toLocaleString()}` : "-"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Plan entries</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{planMix.reduce((sum, item) => sum + item.value, 0)}</p>
          </div>
        </div>

        <SectionShell className="surface-panel space-y-4">
          <SectionHeading title="Plan mix" description="Current active subscription distribution by plan tier." />
          <div className="grid gap-3 md:grid-cols-3">
            {planMix.map((row) => (
              <div key={row.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{row.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{row.value}</p>
              </div>
            ))}
          </div>
        </SectionShell>

        {data?.stripeError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Stripe paid totals unavailable: {data.stripeError}
          </div>
        ) : null}

        {!data && !loading ? (
          <StateCard variant="empty" title="Revenue data unavailable" description="Refresh to retry loading summary metrics." />
        ) : null}
      </PageShell>
    </AdminGuard>
  );
}

