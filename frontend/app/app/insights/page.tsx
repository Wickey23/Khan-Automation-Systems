"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchManagerInsights } from "@/lib/api";
import type { ManagerInsightSummary } from "@/lib/types";
import { PageHeader, PageShell, SectionShell } from "@/components/ui/page";

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-[-0.03em] text-slate-900">{value}</p>
    </div>
  );
}

export default function InsightsPage() {
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ManagerInsightSummary | null>(null);

  useEffect(() => {
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetchManagerInsights();
        setSummary(response);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load manager insights.");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  return (
    <PageShell>
      <PageHeader
        eyebrow="AI Operations"
        title="Manager Insights"
        description="7-day operational summary for calls, messaging, booking demand, and unresolved workload."
      />

      <SectionShell>
        {busy ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading manager insights...
          </div>
        ) : null}

        {!busy && error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        {!busy && !error && summary ? (
          <>
            <p className="mb-4 text-sm text-slate-500">Window start: {new Date(summary.since).toLocaleString()}</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard label="Total calls" value={summary.callsTotal} />
              <MetricCard label="Missed calls" value={summary.callsMissed} />
              <MetricCard label="Messages" value={summary.messagesTotal} />
              <MetricCard label="Booking requests" value={summary.bookingRequests} />
              <MetricCard label="Open follow-up" value={summary.openFollowUps} />
              <MetricCard label="Pending approvals" value={summary.pendingApprovals} />
            </div>
          </>
        ) : null}
      </SectionShell>
    </PageShell>
  );
}
