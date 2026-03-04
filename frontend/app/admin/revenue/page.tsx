"use client";

import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { fetchAdminRevenue } from "@/lib/api";
import type { AdminRevenueSummary } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function usd(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<AdminRevenueSummary | null>(null);

  async function load() {
    try {
      const next = await fetchAdminRevenue();
      setData(next);
    } catch {
      setData(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <AdminGuard>
      <div className="container py-10">
        <AdminTopTabs className="mb-3" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Revenue</h1>
            <p className="mt-1 text-sm text-muted-foreground">Subscription money view across active tenants.</p>
          </div>
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estimated MRR</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{usd(data?.estimatedMrrUsd)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Subscriptions</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{data?.activeSubscriptions ?? "-"}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stripe Paid (30d)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {data?.stripePaidLast30d != null ? `${data.stripePaidCurrency || "USD"} ${data.stripePaidLast30d.toLocaleString()}` : "-"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plan Mix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Founding: {data?.subscriptionsByPlan.founding ?? 0}</p>
              <p>Standard: {data?.subscriptionsByPlan.starter ?? 0}</p>
              <p>Growth/Pro: {data?.subscriptionsByPlan.pro ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        {data?.stripeError ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Stripe paid totals unavailable: {data.stripeError}
          </div>
        ) : null}
      </div>
    </AdminGuard>
  );
}

