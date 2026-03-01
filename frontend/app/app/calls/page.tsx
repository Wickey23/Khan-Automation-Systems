"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchOrgCalls } from "@/lib/api";
import type { OrgCallRecord } from "@/lib/types";

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export default function AppCallsPage() {
  const [calls, setCalls] = useState<OrgCallRecord[]>([]);

  useEffect(() => {
    void fetchOrgCalls().then((data) => setCalls(data.calls)).catch(() => setCalls([]));
  }, []);

  const metrics = useMemo(() => {
    const total = calls.length;
    if (!total) {
      return {
        total,
        successRate: 0,
        transferRate: 0,
        appointmentRate: 0,
        missedRate: 0,
        avgDurationSec: 0,
        recordingCoverage: 0,
        transcriptCoverage: 0
      };
    }

    const successful = calls.filter((call) => call.outcome !== "MISSED" && call.outcome !== "SPAM").length;
    const transferred = calls.filter((call) => call.outcome === "TRANSFERRED").length;
    const appointments = calls.filter((call) => call.outcome === "APPOINTMENT_REQUEST" || Boolean(call.appointmentRequested)).length;
    const missed = calls.filter((call) => call.outcome === "MISSED").length;
    const recordings = calls.filter((call) => Boolean(call.recordingUrl)).length;
    const transcripts = calls.filter((call) => Boolean(call.transcript)).length;
    const durations = calls.map((call) => call.durationSec || 0).filter((value) => value > 0);
    const avgDurationSec = durations.length
      ? durations.reduce((sum, value) => sum + value, 0) / durations.length
      : 0;

    return {
      total,
      successRate: (successful / total) * 100,
      transferRate: (transferred / total) * 100,
      appointmentRate: (appointments / total) * 100,
      missedRate: (missed / total) * 100,
      avgDurationSec,
      recordingCoverage: (recordings / total) * 100,
      transcriptCoverage: (transcripts / total) * 100
    };
  }, [calls]);

  return (
    <div>
      <h1 className="text-3xl font-bold">Call Logs</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Inbound call events with recording, transcript, summary, and outcomes.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Success rating</p>
          <p className="mt-1 text-2xl font-semibold">{formatPercent(metrics.successRate)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total calls</p>
          <p className="mt-1 text-2xl font-semibold">{metrics.total}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Transfer rate</p>
          <p className="mt-1 text-2xl font-semibold">{formatPercent(metrics.transferRate)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Appointment rate</p>
          <p className="mt-1 text-2xl font-semibold">{formatPercent(metrics.appointmentRate)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Missed rate</p>
          <p className="mt-1 text-2xl font-semibold">{formatPercent(metrics.missedRate)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg call duration</p>
          <p className="mt-1 text-2xl font-semibold">{formatDuration(metrics.avgDurationSec)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Recording coverage</p>
          <p className="mt-1 text-2xl font-semibold">{formatPercent(metrics.recordingCoverage)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Transcript coverage</p>
          <p className="mt-1 text-2xl font-semibold">{formatPercent(metrics.transcriptCoverage)}</p>
        </div>
      </div>
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
