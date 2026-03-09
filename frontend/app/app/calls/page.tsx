"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchOrgCalls, repopulateOrgCalls } from "@/lib/api";
import type { OrgCallRecord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
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

function formatRelativeUpdate(value: Date | null) {
  if (!value) return "just now";
  const diffMs = Date.now() - value.getTime();
  const diffMin = Math.max(0, Math.round(diffMs / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return value.toLocaleString();
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
  if (call.outcome === "MISSED") return "Call this customer back.";
  if (call.outcome === "TRANSFERRED") return "Confirm the transfer solved the issue.";
  if (call.outcome === "APPOINTMENT_REQUEST") return "Review the request and confirm scheduling.";
  if (!call.transcript) return "Open the call and add notes.";
  return "No immediate action needed.";
}

function getDispositionLabel(call: OrgCallRecord) {
  if (call.outcome === "APPOINTMENT_REQUEST") return "Request captured";
  if (call.outcome === "TRANSFERRED") return "Transferred";
  if (call.outcome === "MESSAGE_TAKEN") return "Follow-up sent";
  if (call.outcome === "MISSED") return "Needs review";
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

function extractCallerName(call: OrgCallRecord) {
  if (String(call.displayName || "").trim()) return String(call.displayName || "").trim();
  return call.fromNumber;
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
  const shouldScrollToDetailsRef = useRef(false);
  const selectedCallIdRef = useRef<string | null>(null);
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
      if (selectedCallIdRef.current) {
        const fresh = data.calls.find((item) => item.id === selectedCallIdRef.current) || null;
        setSelectedCall(fresh);
      }
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
      // still refresh current data
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
    selectedCallIdRef.current = selectedCall?.id || null;
  }, [selectedCall]);

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
    if (!selectedCall || !detailsRef.current || !shouldScrollToDetailsRef.current) return;
    shouldScrollToDetailsRef.current = false;
    detailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedCall]);

  const metrics = useMemo(() => {
    const totalVisible = calls.length;
    if (!totalVisible) {
      return { totalVisible, needsReview: 0, requestCount: 0, answerRate: 0 };
    }
    const successful = calls.filter((call) => call.outcome !== "MISSED" && call.outcome !== "SPAM").length;
    return {
      totalVisible,
      needsReview: calls.filter((call) => call.outcome === "MISSED").length,
      requestCount: calls.filter((call) => call.outcome === "APPOINTMENT_REQUEST").length,
      answerRate: (successful / totalVisible) * 100
    };
  }, [calls]);

  const filteredLabel = outcomeFilter === "ALL" ? "All calls" : outcomeFilter.replaceAll("_", " ").toLowerCase();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Calls"
        title="Calls"
        description="This page is a simple review queue. Find a call, open it, and see what needs to happen next."
        actions={
          <Button onClick={() => void refreshAndRepopulate()} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />

      <Card className="border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
        <CardContent className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="page-eyebrow">Assigned line</p>
              <p className="text-lg font-semibold text-foreground">
                {assignedPhoneNumber || "Not assigned"}{assignedNumberProvider ? ` (${assignedNumberProvider})` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>Showing {filteredLabel}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>Updated {formatRelativeUpdate(lastUpdated)}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>{totalCalls} matching calls</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["ALL", "MISSED", "TRANSFERRED", "APPOINTMENT_REQUEST", "MESSAGE_TAKEN"].map((value) => (
              <button
                key={value}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                  outcomeFilter === value
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(31,58,138,0.16)]"
                    : "bg-white text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => setOutcomeFilter(value as "ALL" | OrgCallRecord["outcome"])}
              >
                {value === "ALL" ? "All" : value.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Visible calls", value: metrics.totalVisible, meta: "Calls on this page" },
          { label: "Need review", value: metrics.needsReview, meta: "Missed calls in view" },
          { label: "Requests captured", value: metrics.requestCount, meta: "Appointment requests in view" },
          { label: "Visible answer rate", value: formatPercent(metrics.answerRate), meta: "Answered and non-spam calls in view" }
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5">
              <p className="page-eyebrow">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.meta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4 min-w-0">
          <Card>
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="page-eyebrow">Review queue</p>
                  <p className="text-sm text-muted-foreground">
                    Search the queue, open a call, then review the summary, transcript, and recommended next step.
                  </p>
                </div>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by caller name, phone number, summary, or call ID"
                />
              </div>
              <div className="rounded-xl border bg-slate-50 px-4 py-4 text-sm">
                <p className="font-medium text-foreground">Queue summary</p>
                <div className="mt-3 space-y-2 text-muted-foreground">
                  <p>{totalCalls} total matching calls across all pages.</p>
                  <p>{calls.length} calls currently loaded in this view.</p>
                  <p>Use filters first, then open a call for the full details.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="page-eyebrow">Call list</p>
                <p className="text-sm text-muted-foreground">Open a call to inspect the outcome, summary, transcript, and next step.</p>
              </div>
              <span className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-medium text-muted-foreground">
                {calls.length} loaded
              </span>
            </div>
            {calls.length ? (
              calls.map((call) => {
                const selected = selectedCall?.id === call.id;
                return (
                  <button
                    key={call.id}
                    type="button"
                    onClick={() => {
                      shouldScrollToDetailsRef.current = selectedCall?.id !== call.id;
                      setSelectedCall(call);
                    }}
                    className={`w-full rounded-2xl border bg-white p-5 text-left shadow-sm transition-all ${
                      selected ? "border-primary ring-1 ring-primary/20 shadow-[0_10px_24px_rgba(31,58,138,0.08)]" : "hover:-translate-y-px hover:bg-muted/20 hover:shadow-[0_10px_22px_rgba(15,23,42,0.06)]"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-foreground">{extractCallerName(call)}</p>
                        <p className="text-sm text-muted-foreground">{call.fromNumber}</p>
                        <p className="text-xs text-muted-foreground">{new Date(call.startedAt).toLocaleString()}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={clientBadgeClass(getDispositionTone(call))}>{getDispositionLabel(call)}</Badge>
                        <span className="rounded-full border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                          {formatPercent(getCallSuccessRating(call))}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {call.aiSummary || call.summary || "No summary available yet."}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{getNextAction(call)}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span>{formatDuration(call.durationSec || 0)}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="empty-state">No calls match this view yet.</div>
            )}
          </div>

          <Card className="border-slate-200 shadow-[0_14px_30px_rgba(15,23,42,0.08)]">
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
        </div>

        <section ref={detailsRef} className="xl:sticky xl:top-24 xl:self-start">
          <Card className="border-slate-200 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
            <CardContent className="p-6">
              {selectedCall ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="page-eyebrow">Selected call</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-2xl">{extractCallerName(selectedCall)}</h2>
                          <Badge className={clientBadgeClass(getDispositionTone(selectedCall))}>{getDispositionLabel(selectedCall)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{selectedCall.fromNumber}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          shouldScrollToDetailsRef.current = false;
                          setSelectedCall(null);
                        }}
                      >
                        Close
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Started", new Date(selectedCall.startedAt).toLocaleString()],
                      ["Duration", formatDuration(selectedCall.durationSec || 0)],
                      ["Success score", formatPercent(getCallSuccessRating(selectedCall))],
                      ["Next step", getNextAction(selectedCall)]
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border bg-slate-50 p-4">
                        <p className="page-eyebrow">{label}</p>
                        <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <p className="page-eyebrow">Summary</p>
                    <p className="text-sm leading-6 text-muted-foreground">{selectedCall.aiSummary || selectedCall.summary || "No summary available yet."}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="page-eyebrow">Transcript</p>
                    <div className="max-h-72 overflow-auto rounded-xl border bg-muted/10 p-4 text-sm leading-6 text-muted-foreground">
                      {selectedCall.transcript || "No transcript available."}
                    </div>
                  </div>

                  {selectedCall.recordingUrl ? (
                    <Button asChild variant="outline">
                      <a href={selectedCall.recordingUrl} target="_blank" rel="noreferrer">
                        Open recording
                      </a>
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="page-eyebrow">Call details</p>
                    <h2 className="text-2xl">Select a call</h2>
                    <p className="text-sm leading-6 text-muted-foreground">
                      This panel stays fixed so your review workflow is stable. Open any call from the queue to inspect the summary, transcript, disposition, and next step.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Review outcome", "Check whether the call became a request, transfer, message, or review item."],
                      ["Inspect summary", "Read the short summary first before digging into the transcript."],
                      ["Confirm next action", "See whether the office should call back, schedule, or just document the result."],
                      ["Open recording", "Jump to the recording only when quality or handoff review is needed."]
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border bg-slate-50 p-4">
                        <p className="page-eyebrow">{label}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
