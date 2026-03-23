"use client";

import { useEffect, useState } from "react";
import { PhoneCall } from "lucide-react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { fetchClientCalls } from "@/lib/api";
import type { CallRecord } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { PageHeader, PageShell, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";

export default function DashboardCallsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetchClientCalls()
      .then((data) => setCalls(data.calls))
      .catch(() => setCalls([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ClientGuard>
      <PageShell className="space-y-6">
        <PageHeader
          eyebrow="Legacy queue"
          title="Call logs"
          description="Recent calls captured for this workspace."
        />
        <SectionShell className="surface-panel">
          {loading ? (
            <StateCard variant="loading" title="Loading calls" />
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
                <p className="inline-flex items-center gap-2 font-medium text-slate-900">
                  <PhoneCall className="h-4 w-4 text-slate-500" />
                  Total calls in this view: {calls.length}
                </p>
              </div>
              <div className="overflow-auto rounded-xl border border-slate-200/90 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3 text-left">Started</th>
                      <th className="p-3 text-left">From</th>
                      <th className="p-3 text-left">To</th>
                      <th className="p-3 text-left">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map((call) => (
                      <tr key={call.id} className="border-t">
                        <td className="p-3">{formatDate(call.startedAt)}</td>
                        <td className="p-3">{call.fromNumber}</td>
                        <td className="p-3">{call.toNumber}</td>
                        <td className="p-3">{call.outcome}</td>
                      </tr>
                    ))}
                    {!calls.length ? (
                      <tr>
                        <td className="p-3" colSpan={4}>No calls found.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SectionShell>
      </PageShell>
    </ClientGuard>
  );
}
