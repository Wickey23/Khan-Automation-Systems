"use client";

import { useEffect, useState } from "react";
import { fetchOrgCalls } from "@/lib/api";
import type { OrgCallRecord } from "@/lib/types";

export default function AppCallsPage() {
  const [calls, setCalls] = useState<OrgCallRecord[]>([]);

  useEffect(() => {
    void fetchOrgCalls().then((data) => setCalls(data.calls)).catch(() => setCalls([]));
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold">Call Logs</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Inbound call events with recording, transcript, summary, and outcomes.
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-3">Started</th>
              <th className="p-3">Duration</th>
              <th className="p-3">From</th>
              <th className="p-3">To</th>
              <th className="p-3">Outcome</th>
              <th className="p-3">AI</th>
              <th className="p-3">Summary</th>
              <th className="p-3">Recording</th>
              <th className="p-3">Call SID</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <tr key={call.id} className="border-t">
                <td className="p-3">{new Date(call.startedAt).toLocaleString()}</td>
                <td className="p-3">{call.durationSec ? `${call.durationSec}s` : "-"}</td>
                <td className="p-3">{call.fromNumber}</td>
                <td className="p-3">{call.toNumber}</td>
                <td className="p-3">{call.outcome.replaceAll("_", " ")}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {call.aiProvider || "-"}
                  {call.appointmentRequested ? " | appointment" : ""}
                </td>
                <td className="p-3">
                  <div className="max-w-sm whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                    {call.aiSummary || call.summary || "-"}
                    {call.transcript ? `\n\nTranscript: ${call.transcript}` : ""}
                  </div>
                </td>
                <td className="p-3">
                  {call.recordingUrl ? (
                    <a
                      href={call.recordingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Open
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{call.providerCallId || "-"}</td>
              </tr>
            ))}
            {!calls.length ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={9}>
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
