"use client";

import { useEffect, useState } from "react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { fetchClientCalls } from "@/lib/api";
import type { CallRecord } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function DashboardCallsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);

  useEffect(() => {
    void fetchClientCalls().then((data) => setCalls(data.calls)).catch(() => setCalls([]));
  }, []);

  return (
    <ClientGuard>
      <div className="container py-10">
        <h1 className="text-3xl font-bold">Call Logs</h1>
        <div className="mt-5 overflow-auto rounded-md border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted">
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
            </tbody>
          </table>
        </div>
      </div>
    </ClientGuard>
  );
}
