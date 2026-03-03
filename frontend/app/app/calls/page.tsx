"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRef } from "react";
import { fetchOrgCalls, repopulateOrgCalls } from "@/lib/api";
import type { OrgCallRecord } from "@/lib/types";
import { InfoHint } from "@/components/ui/info-hint";

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

function getCallSuccessRating(call: OrgCallRecord) {
  let base = 60;
  if (call.outcome === "APPOINTMENT_REQUEST") base = 95;
  else if (call.outcome === "TRANSFERRED") base = 90;
  else if (call.outcome === "MESSAGE_TAKEN") base = 75;
  else if (call.outcome === "SPAM") base = 40;
  else if (call.outcome === "MISSED") base = 20;

  if (call.transcript) base += 5;
  if (call.recordingUrl) base += 5;

  return Math.max(0, Math.min(100, base));
}

function getNextAction(call: OrgCallRecord) {
  if (call.outcome === "MISSED") return "Call back customer";
  if (call.outcome === "TRANSFERRED") return "Confirm transfer resolved issue";
  if (call.outcome === "APPOINTMENT_REQUEST") return "Confirm booking with customer";
  if (!call.transcript) return "Review call and capture notes";
  return "No immediate action";
}

function getSuccessBadgeClasses(score: number) {
  if (score >= 85) {
    return "border-emerald-300 bg-gradient-to-r from-emerald-50 to-lime-50 text-emerald-800";
  }
  if (score >= 65) {
    return "border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-800";
  }
  return "border-rose-300 bg-gradient-to-r from-rose-50 to-red-50 text-rose-800";
}

function extractCallerName(call: OrgCallRecord) {
  const source = (call.transcript || "").trim();
  if (!source) return "";

  const stopWords = new Set([
    "sorry",
    "help",
    "issue",
    "problem",
    "phone",
    "number",
    "looking",
    "escalating",
    "customer",
    "caller",
    "unknown",
    "support",
    "service",
    "name",
    "from"
  ]);

  const patterns = [
    /\bmy name is\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,2})\b/i,
    /\bthis is\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,2})\b/i,
    /\bi(?:'m| am)\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,1})\b/i
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    const raw = match?.[1]?.trim() || "";
    if (!raw) continue;

    const cleaned = raw
      .replace(/\b(from|and|but)\b.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) continue;

    const parts = cleaned.split(" ").filter(Boolean);
    if (!parts.length || parts.length > 3) continue;
    if (parts.some((part) => stopWords.has(part.toLowerCase()))) continue;
    if (parts.length === 1 && parts[0].length < 2) continue;

    return parts
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  return "";
}

export default function AppCallsPage() {
  const [calls, setCalls] = useState<OrgCallRecord[]>([]);
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState<string | null>(null);
  const [assignedNumberProvider, setAssignedNumberProvider] = useState<"TWILIO" | "VAPI" | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedCall, setSelectedCall] = useState<OrgCallRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<"ALL" | OrgCallRecord["outcome"]>("ALL");
  const detailsRef = useRef<HTMLElement | null>(null);

  const loadCalls = useCallback(async () => {
    try {
      const data = await fetchOrgCalls();
      setCalls(data.calls);
      setAssignedPhoneNumber(data.assignedPhoneNumber);
      setAssignedNumberProvider(data.assignedNumberProvider);
      setLastUpdated(new Date());
    } catch {
      setCalls([]);
      setAssignedPhoneNumber(null);
      setAssignedNumberProvider(null);
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

  const filteredCalls = useMemo(() => {
    const q = query.trim().toLowerCase();
    return calls.filter((call) => {
      if (outcomeFilter !== "ALL" && call.outcome !== outcomeFilter) return false;
      if (!q) return true;
      const callerName = extractCallerName(call).toLowerCase();
      return (
        callerName.includes(q) ||
        call.fromNumber.toLowerCase().includes(q) ||
        (call.aiSummary || "").toLowerCase().includes(q) ||
        (call.providerCallId || "").toLowerCase().includes(q)
      );
    });
  }, [calls, query, outcomeFilter]);

  const detectedQuestions = useMemo(() => {
    if (!selectedCall?.transcript) return [];
    const chunks = selectedCall.transcript
      .split(/[\n\r]+|(?<=[?.!])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    return chunks.filter((part) => part.includes("?"));
  }, [selectedCall]);

  useEffect(() => {
    if (!selectedCall || !detailsRef.current) return;
    detailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
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
      <p className="mt-1 text-sm text-muted-foreground">
        Assigned number: <span className="font-medium">{assignedPhoneNumber || "Not assigned"}</span>
        {assignedNumberProvider ? ` (${assignedNumberProvider})` : ""}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Auto-refreshes every 12 seconds{lastUpdated ? ` (last updated ${lastUpdated.toLocaleTimeString()})` : ""}.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            Success rating
            <InfoHint text="Directional score based on call outcomes, transcript presence, and recording coverage." />
          </p>
          <p className="mt-1 text-2xl font-semibold">{formatPercent(metrics.successRate)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            Total calls
            <InfoHint text="Total inbound calls in the currently loaded call-log set." />
          </p>
          <p className="mt-1 text-2xl font-semibold">{metrics.total}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            Transfer rate
            <InfoHint text="Share of calls that ended with a transfer outcome." />
          </p>
          <p className="mt-1 text-2xl font-semibold">{formatPercent(metrics.transferRate)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            Appointments
            <InfoHint text="Share of calls marked as appointment requested." />
          </p>
          <p className="mt-1 text-2xl font-semibold">{formatPercent(metrics.appointmentRate)}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-3 text-sm"><span className="text-muted-foreground">Missed:</span> {formatPercent(metrics.missedRate)}</div>
        <div className="rounded-lg border bg-white p-3 text-sm"><span className="text-muted-foreground">Avg duration:</span> {formatDuration(metrics.avgDurationSec)}</div>
        <div className="rounded-lg border bg-white p-3 text-sm"><span className="text-muted-foreground">Recording coverage:</span> {formatPercent(metrics.recordingCoverage)}</div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {["ALL", "MISSED", "TRANSFERRED", "APPOINTMENT_REQUEST", "MESSAGE_TAKEN"].map((value) => (
            <button
              key={value}
              type="button"
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                outcomeFilter === value ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
              }`}
              onClick={() => setOutcomeFilter(value as "ALL" | OrgCallRecord["outcome"])}
            >
              {value === "ALL" ? "All" : value.replaceAll("_", " ")}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone, summary, call id..."
          className="w-full rounded-md border px-3 py-2 text-sm sm:max-w-sm"
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-3">Started</th>
              <th className="p-3">Name</th>
              <th className="p-3">Caller</th>
              <th className="p-3">Outcome</th>
              <th className="p-3">Success</th>
              <th className="p-3">Duration</th>
              <th className="p-3">Recording</th>
              <th className="p-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredCalls.map((call) => (
              <tr key={call.id} className="border-t hover:bg-muted/20">
                {(() => {
                  const success = getCallSuccessRating(call);
                  return (
                    <>
                <td className="p-3">{new Date(call.startedAt).toLocaleString()}</td>
                <td className="p-3">{extractCallerName(call) || "-"}</td>
                <td className="p-3 font-mono text-xs">{call.fromNumber}</td>
                <td className="p-3">{call.outcome.replaceAll("_", " ")}</td>
                <td className="p-3">
                  <span
                    className={`inline-flex min-w-[72px] justify-center rounded-md border px-2 py-1 text-xs font-semibold ${getSuccessBadgeClasses(success)}`}
                  >
                    {formatPercent(success)}
                  </span>
                </td>
                <td className="p-3">{call.durationSec ? `${call.durationSec}s` : "-"}</td>
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
                <td className="p-3">
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs font-medium text-primary hover:bg-muted"
                    onClick={() => setSelectedCall(call)}
                  >
                    View
                  </button>
                </td>
                    </>
                  );
                })()}
              </tr>
            ))}
            {!calls.length ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={9}>
                  No calls logged yet.
                </td>
              </tr>
            ) : !filteredCalls.length ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={9}>
                  No calls match current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selectedCall ? (
        <section ref={detailsRef} className="mt-5 rounded-lg border bg-white p-4">
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
            <div><span className="text-muted-foreground">Caller name:</span> {extractCallerName(selectedCall) || "-"}</div>
            <div><span className="text-muted-foreground">To:</span> {selectedCall.toNumber}</div>
            <div><span className="text-muted-foreground">Outcome:</span> {selectedCall.outcome.replaceAll("_", " ")}</div>
            <div>
              <span className="text-muted-foreground">Success rating:</span>{" "}
              <span
                className={`inline-flex min-w-[72px] justify-center rounded-md border px-2 py-1 text-xs font-semibold ${getSuccessBadgeClasses(
                  getCallSuccessRating(selectedCall)
                )}`}
              >
                {formatPercent(getCallSuccessRating(selectedCall))}
              </span>
            </div>
            <div><span className="text-muted-foreground">Appointment:</span> {selectedCall.appointmentRequested ? "Yes" : "No"}</div>
            <div><span className="text-muted-foreground">Next action:</span> {getNextAction(selectedCall)}</div>
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
