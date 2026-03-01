"use client";

import { useEffect, useState } from "react";
import { fetchOrgCalls } from "@/lib/api";

type CallLog = {
  id: string;
  fromNumber: string;
  toNumber: string;
  startedAt: string;
  outcome: string;
};

export default function AppCallsPage() {
  const [calls, setCalls] = useState<CallLog[]>([]);

  useEffect(() => {
    void fetchOrgCalls().then((data) => setCalls(data.calls as CallLog[])).catch(() => setCalls([]));
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold">Call Logs</h1>
      <p className="mt-2 text-sm text-muted-foreground">Inbound call events for your assigned numbers.</p>
      <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-3">Started</th>
              <th className="p-3">From</th>
              <th className="p-3">To</th>
              <th className="p-3">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <tr key={call.id} className="border-t">
                <td className="p-3">{new Date(call.startedAt).toLocaleString()}</td>
                <td className="p-3">{call.fromNumber}</td>
                <td className="p-3">{call.toNumber}</td>
                <td className="p-3">{call.outcome}</td>
              </tr>
            ))}
            {!calls.length ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={4}>
                  No calls logged yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
