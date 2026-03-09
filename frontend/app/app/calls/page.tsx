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
    const total = totalCalls;
    if (!total) {
      return { total, needsReview: 0, requestCount: 0, answerRate: 0 };
    }
    const successful = calls.filter((call) => call.outcome !== "MISSED" && call.outcome !== "SPAM").length;
    return {
      total,
      needsReview: calls.filter((call) => call.outcome === "MISSED").length,
      requestCount: calls.filter((call) => call.outcome === "APPOINTMENT_REQUEST").length,
      answerRate: (successful / total) * 100
    };
  }, [calls, totalCalls]);

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

      <Card>
        <CardContent className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-2">
            <p className="page-eyebrow">Assigned line</p>
            <p className="text-lg font-semibold text-foreground">
              {assignedPhoneNumber || "Not assigned"}{assignedNumberProvider ? ` (${assignedNumberProvider})` : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              Showing {filteredLabel}. Last updated {lastUpdated ? lastUpdated.toLocaleTimeString() : "just now"}.
            </p>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total calls", value: metrics.total },
          { label: "Need review", value: metrics.needsReview },
          { label: "Requests captured", value: metrics.requestCount },
          { label: "Answer rate", value: formatPercent(metrics.answerRate) }
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5">
              <p className="page-eyebrow">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className={`grid gap-6 ${selectedCall ? "xl:grid-cols-[minmax(0,1fr)_420px]" : ""}`}>
        <div className="space-y-4 min-w-0">
          <Card>
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_240px]">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by caller name, phone number, summary, or call ID"
              />
              <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">What to do here</p>
                <p className="mt-1 text-muted-foreground">Open a call to review the summary, transcript, and next step.</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
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
                    className={`w-full rounded-2xl border bg-white p-5 text-left shadow-sm transition-colors ${
                      selected ? "border-primary ring-1 ring-primary/20" : "hover:bg-muted/20"
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
                  </button>
                );
              })
            ) : (
              <div className="empty-state">No calls match this view yet.</div>
            )}
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
        </div>

        {selectedCall ? (
          <section ref={detailsRef} className="xl:sticky xl:top-24 xl:self-start">
            <Card>
              <CardContent className="p-6">
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
                      <div key={label} className="rounded-xl border bg-muted/20 p-4">
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
              </CardContent>
            </Card>
          </section>
        ) : null}
      </div>
    </div>
  );
}
