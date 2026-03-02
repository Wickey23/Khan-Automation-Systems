"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchOrgCalls, repopulateOrgCalls } from "@/lib/api";
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedCall, setSelectedCall] = useState<OrgCallRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadCalls = useCallback(async () => {
    try {
      const data = await fetchOrgCalls();
      setCalls(data.calls);
      setLastUpdated(new Date());
    } catch {
      setCalls([]);
    }
  }, []);

  const refreshAndRepopulate = useCallback(async () => {
    setRefreshing(true);
    try {
      await repopulateOrgCalls();
    } catch {
      // if repopulate fails, still refresh list from existing records
    } finally {
      await loadCalls();
      setRefreshing(false);
    }
  }, [loadCalls]);

  useEffect(() => {
    void loadCalls();

    const intervalId = window.setInterval(() => {
      void loadCalls();
    }, 12000);

    const onFocus = () => {
      void loadCalls();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [loadCalls]);

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

  const detectedQuestions = useMemo(() => {
    if (!selectedCall?.transcript) return [];
    const chunks = selectedCall.transcript
      .split(/[\n\r]+|(?<=[?.!])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    return chunks.filter((part) => part.includes("?"));
  }, [selectedCall]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Call Logs</h1>
        <button
          type="button"
          className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
          onClick={() => void refreshAndRepopulate()}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Inbound call events with recording, transcript, summary, and outcomes.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Auto-refreshes every 12 seconds{lastUpdated ? ` (last updated ${lastUpdated.toLocaleTimeString()})` : ""}.
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
              <th className="p-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <tr key={call.id} className="border-t hover:bg-muted/20">
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
                <td className="p-3">
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs font-medium text-primary hover:bg-muted"
                    onClick={() => setSelectedCall(call)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {!calls.length ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={10}>
                  No calls logged yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selectedCall ? (
        <section className="mt-5 rounded-lg border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Call details</h2>
              <p className="text-xs text-muted-foreground">
                Click another call row to switch details.
              </p>
            </div>
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs hover:bg-muted"
              onClick={() => setSelectedCall(null)}
            >
              Close
            </button>
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div><span className="text-muted-foreground">Started:</span> {new Date(selectedCall.startedAt).toLocaleString()}</div>
            <div><span className="text-muted-foreground">Ended:</span> {selectedCall.endedAt ? new Date(selectedCall.endedAt).toLocaleString() : "-"}</div>
            <div><span className="text-muted-foreground">Duration:</span> {selectedCall.durationSec ? `${selectedCall.durationSec}s` : "-"}</div>
            <div><span className="text-muted-foreground">From:</span> {selectedCall.fromNumber}</div>
            <div><span className="text-muted-foreground">To:</span> {selectedCall.toNumber}</div>
            <div><span className="text-muted-foreground">Outcome:</span> {selectedCall.outcome.replaceAll("_", " ")}</div>
            <div><span className="text-muted-foreground">AI Provider:</span> {selectedCall.aiProvider || "-"}</div>
            <div><span className="text-muted-foreground">Appointment:</span> {selectedCall.appointmentRequested ? "Yes" : "No"}</div>
            <div><span className="text-muted-foreground">Lead ID:</span> {selectedCall.leadId || "-"}</div>
            <div className="sm:col-span-2 lg:col-span-3">
              <span className="text-muted-foreground">Call SID:</span>{" "}
              <span className="font-mono text-xs">{selectedCall.providerCallId || "-"}</span>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded border p-3">
              <p className="text-sm font-medium">AI Summary</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {selectedCall.aiSummary || selectedCall.summary || "-"}
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="text-sm font-medium">Recording</p>
              <div className="mt-2 text-sm">
                {selectedCall.recordingUrl ? (
                  <a href={selectedCall.recordingUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                    Open recording
                  </a>
                ) : (
                  <span className="text-muted-foreground">No recording URL</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded border p-3">
            <p className="text-sm font-medium">Transcript</p>
            <p className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">
              {selectedCall.transcript || "-"}
            </p>
          </div>

          <div className="mt-4 rounded border p-3">
            <p className="text-sm font-medium">Detected questions (from transcript)</p>
            {detectedQuestions.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {detectedQuestions.map((question, idx) => (
                  <li key={`${idx}-${question.slice(0, 20)}`}>{question}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No question lines detected.</p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
