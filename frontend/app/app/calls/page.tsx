"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchOrgCalls, repopulateOrgCalls } from "@/lib/api";
import type { OrgCallRecord } from "@/lib/types";
import { InfoHint } from "@/components/ui/info-hint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clientBadgeClass } from "@/lib/client-badges";

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
  if (call.outcome === "APPOINTMENT_REQUEST") return "Review request and confirm scheduling";
  if (!call.transcript) return "Review call and capture notes";
  return "No immediate action";
}

function getDispositionLabel(call: OrgCallRecord) {
  if (call.outcome === "APPOINTMENT_REQUEST") return "Request Captured";
  if (call.outcome === "TRANSFERRED") return "Transferred";
  if (call.outcome === "MESSAGE_TAKEN") return "Follow-Up Sent";
  if (call.outcome === "MISSED") return "Needs Review";
  if (call.outcome === "SPAM") return "Spam";
  return "Conversation";
}

function getDispositionTone(call: OrgCallRecord): "booking" | "success" | "automated" | "warning" | "neutral" {
  if (call.outcome === "APPOINTMENT_REQUEST") return "booking";
  if (call.outcome === "TRANSFERRED") return "success";
  if (call.outcome === "MESSAGE_TAKEN") return "automated";
  if (call.outcome === "MISSED") return "warning";
  return "neutral";
}

function getSuccessBadgeClasses(score: number) {
  if (score >= 85) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (score >= 65) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function extractCallerName(call: OrgCallRecord) {
  if (String(call.displayName || "").trim()) return String(call.displayName || "").trim();
  const source = (call.transcript || "").trim();
  if (!source) return "";

  const stopWords = new Set(["sorry", "help", "issue", "problem", "phone", "number", "looking", "escalating", "customer", "caller", "unknown", "support", "service", "name", "from"]);
  const patterns = [
    /\bmy name is\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,2})\b/i,
    /\bthis is\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,2})\b/i,
    /\bi(?:'m| am)\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,1})\b/i
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    const raw = match?.[1]?.trim() || "";
    if (!raw) continue;
    const cleaned = raw.replace(/\b(from|and|but)\b.*$/i, "").replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const parts = cleaned.split(" ").filter(Boolean);
    if (!parts.length || parts.length > 3) continue;
    if (parts.some((part) => stopWords.has(part.toLowerCase()))) continue;
    return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
  }
  return "";
}

export default function AppCallsPage() {
  const [calls, setCalls] = useState<OrgCallRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalCalls, setTotalCalls] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState<string | null>(null);
  const [assignedNumberProvider, setAssignedNumberProvider] = useState<"TWILIO" | "VAPI" | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedCall, setSelectedCall] = useState<OrgCallRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<"ALL" | OrgCallRecord["outcome"]>("ALL");
  const detailsRef = useRef<HTMLElement | null>(null);
  const pageRef = useRef(page);
  const queryRef = useRef(query);
  const outcomeFilterRef = useRef(outcomeFilter);

  const loadCalls = useCallback(async (next: { page: number; query: string; outcome: "ALL" | OrgCallRecord["outcome"] }) => {
    try {
      const data = await fetchOrgCalls({
        page: next.page,
        pageSize,
        ...(next.outcome !== "ALL" ? { outcome: next.outcome } : {}),
        ...(next.query.trim() ? { query: next.query.trim() } : {})
      });
      setCalls(data.calls);
      setPage(data.page);
      setTotalCalls(data.total);
      setTotalPages(data.totalPages);
      setAssignedPhoneNumber(data.assignedPhoneNumber);
      setAssignedNumberProvider(data.assignedNumberProvider);
      setLastUpdated(new Date());
    } catch {
      setCalls([]);
      setTotalCalls(0);
      setTotalPages(1);
      setAssignedPhoneNumber(null);
      setAssignedNumberProvider(null);
    }
  }, [pageSize]);

  const refreshAndRepopulate = useCallback(async () => {
    setRefreshing(true);
    try {
      await repopulateOrgCalls();
    } catch {
      // Refresh existing records even if repopulation fails.
    } finally {
      await loadCalls({ page, query, outcome: outcomeFilter });
      setRefreshing(false);
    }
  }, [loadCalls, outcomeFilter, page, query]);

  useEffect(() => {
    pageRef.current = page;
    queryRef.current = query;
    outcomeFilterRef.current = outcomeFilter;
  }, [page, query, outcomeFilter]);

  useEffect(() => {
    void loadCalls({ page: 1, query: "", outcome: "ALL" });
  }, [loadCalls]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadCalls({ page: pageRef.current, query: queryRef.current, outcome: outcomeFilterRef.current });
    }, 12000);

    const refresh = () => void loadCalls({ page: pageRef.current, query: queryRef.current, outcome: outcomeFilterRef.current });
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadCalls]);

  useEffect(() => {
    void loadCalls({ page: 1, query, outcome: outcomeFilter });
  }, [query, outcomeFilter, loadCalls]);

  useEffect(() => {
    if (!selectedCall || !detailsRef.current) return;
    detailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedCall]);

  const metrics = useMemo(() => {
    const total = totalCalls;
    if (!total) {
      return { total, successRate: 0, transferRate: 0, appointmentRate: 0, missedRate: 0, avgDurationSec: 0, recordingCoverage: 0 };
    }
    const successful = calls.filter((call) => call.outcome !== "MISSED" && call.outcome !== "SPAM").length;
    const transferred = calls.filter((call) => call.outcome === "TRANSFERRED").length;
    const appointments = calls.filter((call) => call.outcome === "APPOINTMENT_REQUEST" || Boolean(call.appointmentRequested)).length;
    const missed = calls.filter((call) => call.outcome === "MISSED").length;
    const recordings = calls.filter((call) => Boolean(call.recordingUrl)).length;
    const durations = calls.map((call) => call.durationSec || 0).filter((value) => value > 0);
    return {
      total,
      successRate: (successful / total) * 100,
      transferRate: (transferred / total) * 100,
      appointmentRate: (appointments / total) * 100,
      missedRate: (missed / total) * 100,
      avgDurationSec: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0,
      recordingCoverage: (recordings / total) * 100
    };
  }, [calls, totalCalls]);

  const detectedQuestions = useMemo(() => {
    if (!selectedCall?.transcript) return [];
    return selectedCall.transcript
      .split(/[\n\r]+|(?<=[?.!])\s+/)
      .map((part) => part.trim())
      .filter((part) => part.includes("?"));
  }, [selectedCall]);

  const metricCards = [
    { label: "Success rating", value: formatPercent(metrics.successRate), hint: "Directional score based on outcomes, transcript presence, and recording coverage." },
    { label: "Total calls", value: metrics.total, hint: "Total inbound calls in the currently loaded call-log set." },
    { label: "Transfer rate", value: formatPercent(metrics.transferRate), hint: "Share of calls that ended with a transfer outcome." },
    { label: "Appointments", value: formatPercent(metrics.appointmentRate), hint: "Share of calls marked as appointment requested." }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Conversations"
        title="Call review"
        description="Review customer conversations, outcomes, follow-up actions, and transcripts in one place."
        actions={
          <Button onClick={() => void refreshAndRepopulate()} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh calls"}
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="page-eyebrow">Assigned line</p>
            <p className="text-lg font-semibold">{assignedPhoneNumber || "Not assigned"}{assignedNumberProvider ? ` (${assignedNumberProvider})` : ""}</p>
            <p className="text-sm text-muted-foreground">Auto-refreshes every 12 seconds{lastUpdated ? `, last updated ${lastUpdated.toLocaleTimeString()}` : ""}.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["ALL", "MISSED", "TRANSFERRED", "APPOINTMENT_REQUEST", "MESSAGE_TAKEN"].map((value) => (
              <button
                key={value}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                  outcomeFilter === value ? "border-primary bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setOutcomeFilter(value as "ALL" | OrgCallRecord["outcome"])}
              >
                {value === "ALL" ? "All" : value.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="metric-grid">
        {metricCards.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-5">
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {metric.label}
                <InfoHint text={metric.hint} />
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_220px]">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, summary, or call ID"
          />
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm"><span className="text-muted-foreground">Missed</span><div className="mt-1 font-semibold">{formatPercent(metrics.missedRate)}</div></div>
            <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm"><span className="text-muted-foreground">Avg duration</span><div className="mt-1 font-semibold">{formatDuration(metrics.avgDurationSec)}</div></div>
            <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm"><span className="text-muted-foreground">Recording coverage</span><div className="mt-1 font-semibold">{formatPercent(metrics.recordingCoverage)}</div></div>
          </div>
        </CardContent>
      </Card>

      <div className="table-shell">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Caller</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Success</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Recording</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calls.map((call) => {
              const success = getCallSuccessRating(call);
              return (
                <TableRow key={call.id}>
                  <TableCell>{new Date(call.startedAt).toLocaleString()}</TableCell>
                  <TableCell className="font-medium">{extractCallerName(call) || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{call.fromNumber}</TableCell>
                  <TableCell>
                    <Badge className={clientBadgeClass(getDispositionTone(call))}>{getDispositionLabel(call)}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex min-w-[76px] justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getSuccessBadgeClasses(success)}`}>
                      {formatPercent(success)}
                    </span>
                  </TableCell>
                  <TableCell>{call.durationSec ? `${call.durationSec}s` : "-"}</TableCell>
                  <TableCell>
                    {call.recordingUrl ? (
                      <a href={call.recordingUrl} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
                        Open
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelectedCall(call)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!calls.length ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="empty-state">No calls logged yet.</div>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {totalCalls} total call{totalCalls === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => void loadCalls({ page: page - 1, query, outcome: outcomeFilter })}>
              Previous
            </Button>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => void loadCalls({ page: page + 1, query, outcome: outcomeFilter })}>
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedCall ? (
        <section ref={detailsRef}>
        <Card>
          <CardHeader className="border-b pb-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle>Conversation details</CardTitle>
                <p className="text-sm text-muted-foreground">Click another row to switch details without leaving the page.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCall(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["Started", new Date(selectedCall.startedAt).toLocaleString()],
                ["Ended", selectedCall.endedAt ? new Date(selectedCall.endedAt).toLocaleString() : "-"],
                ["Duration", selectedCall.durationSec ? `${selectedCall.durationSec}s` : "-"],
                ["From", selectedCall.fromNumber],
                ["Caller name", extractCallerName(selectedCall) || "-"],
                ["To", selectedCall.toNumber],
                ["Appointment", selectedCall.appointmentRequested ? "Yes" : "No"],
                ["Next action", getNextAction(selectedCall)],
                ["Lead ID", selectedCall.leadId || "-"]
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border bg-muted/30 p-4">
                  <p className="page-eyebrow">{label}</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
                </div>
              ))}
              <div className="rounded-2xl border bg-muted/30 p-4">
                <p className="page-eyebrow">Disposition</p>
                <div className="mt-2">
                  <Badge className={clientBadgeClass(getDispositionTone(selectedCall))}>{getDispositionLabel(selectedCall)}</Badge>
                </div>
              </div>
              <div className="rounded-2xl border bg-muted/30 p-4">
                <p className="page-eyebrow">Success rating</p>
                <div className="mt-2">
                  <span className={`inline-flex min-w-[76px] justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getSuccessBadgeClasses(getCallSuccessRating(selectedCall))}`}>
                    {formatPercent(getCallSuccessRating(selectedCall))}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border bg-muted/30 p-4 md:col-span-2 xl:col-span-1">
                <p className="page-eyebrow">Call SID</p>
                <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{selectedCall.providerCallId || "-"}</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border p-5">
                <p className="text-sm font-semibold">AI summary</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{selectedCall.aiSummary || selectedCall.summary || "-"}</p>
              </div>
              <div className="rounded-2xl border p-5">
                <p className="text-sm font-semibold">Recording</p>
                <div className="mt-3 text-sm">
                  {selectedCall.recordingUrl ? (
                    <a href={selectedCall.recordingUrl} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
                      Open recording
                    </a>
                  ) : (
                    <span className="text-muted-foreground">No recording URL</span>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border p-5">
              <p className="text-sm font-semibold">Transcript</p>
              <p className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{selectedCall.transcript || "-"}</p>
            </div>

            <div className="rounded-2xl border p-5">
              <p className="text-sm font-semibold">Detected questions</p>
              {detectedQuestions.length ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                  {detectedQuestions.map((question, idx) => (
                    <li key={`${idx}-${question.slice(0, 20)}`}>{question}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No question lines detected.</p>
              )}
            </div>
          </CardContent>
        </Card>
        </section>
      ) : null}
    </div>
  );
}
