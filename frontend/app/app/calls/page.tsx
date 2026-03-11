"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchOrgCalls, repopulateOrgCalls } from "@/lib/api";
import type { FrontDeskPriority, OrgCallRecord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
import { clientBadgeClass } from "@/lib/client-badges";

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

function todayDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDateValue(value: string, delta: number) {
  const base = new Date(`${value}T00:00:00`);
  base.setDate(base.getDate() + delta);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const day = String(base.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayHeading(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric"
  });
}

function getNextAction(call: OrgCallRecord) {
  if (call.frontDesk?.recommendedAction) return call.frontDesk.recommendedAction;
  if (call.outcome === "MISSED" || call.outcome === "ABANDONED") return "Call this customer back.";
  if (call.outcome === "TRANSFERRED" && call.unansweredTransfer) return "Follow up because the transfer was not answered.";
  if (call.outcome === "TRANSFERRED") return "Confirm the transfer solved the issue.";
  if (call.outcome === "APPOINTMENT_REQUEST") return "Review the request and confirm scheduling.";
  if (!call.transcript) return "Open the call and add notes.";
  return "No immediate action needed.";
}

function getDispositionLabel(call: OrgCallRecord) {
  if (call.frontDesk?.followUpState === "needs_follow_up") return "Needs follow-up";
  if (call.frontDesk?.followUpState === "contacted") return "Contacted";
  if (call.frontDesk?.followUpState === "booked") return "Booked";
  if (call.frontDesk?.followUpState === "closed") return "Closed";
  if (call.frontDesk?.followUpState === "spam") return "Spam";
  if (call.outcome === "APPOINTMENT_REQUEST") return "Request captured";
  if (call.outcome === "TRANSFERRED") return "Transferred";
  if (call.outcome === "MESSAGE_TAKEN") return "Follow-up sent";
  if (call.outcome === "ABANDONED") return "Abandoned";
  if (call.outcome === "MISSED") return "Needs review";
  if (call.outcome === "SPAM") return "Spam";
  return "Conversation";
}

function getDispositionTone(call: OrgCallRecord): "booking" | "success" | "automated" | "warning" | "neutral" {
  if (call.frontDesk?.frontDeskPriority === "urgent") return "warning";
  if (call.frontDesk?.frontDeskPriority === "high") return "warning";
  if (call.frontDesk?.followUpState === "booked") return "booking";
  if (call.frontDesk?.followUpState === "contacted") return "automated";
  if (call.outcome === "APPOINTMENT_REQUEST") return "booking";
  if (call.outcome === "TRANSFERRED") return "success";
  if (call.outcome === "MESSAGE_TAKEN") return "automated";
  if (call.outcome === "ABANDONED") return "warning";
  if (call.outcome === "MISSED") return "warning";
  return "neutral";
}

function outcomeLabel(outcome: OrgCallRecord["outcome"]) {
  if (outcome === "APPOINTMENT_REQUEST") return "Request captured";
  if (outcome === "MESSAGE_TAKEN") return "Message taken";
  if (outcome === "TRANSFERRED") return "Transferred";
  if (outcome === "ABANDONED") return "Abandoned";
  if (outcome === "MISSED") return "Missed call";
  if (outcome === "SPAM") return "Spam";
  return "Call";
}

function formatTransferReason(value: string | null | undefined) {
  if (!value) return "Transfer triggered";
  return value.replaceAll("_", " ").toLowerCase();
}

function formatAnsweredByLabel(value?: "HUMAN" | "AI" | "UNKNOWN") {
  if (value === "HUMAN") return "Human";
  if (value === "AI") return "AI";
  return "Unknown";
}

function extractCallerName(call: OrgCallRecord) {
  if (String(call.frontDesk?.callerName || "").trim()) return String(call.frontDesk?.callerName || "").trim();
  if (String(call.displayName || "").trim()) return String(call.displayName || "").trim();
  return call.fromNumber;
}

function prioritySurface(priority: FrontDeskPriority | undefined, selected: boolean) {
  if (selected && priority === "urgent") return "border-rose-300 ring-1 ring-rose-300/40 bg-rose-50/50";
  if (selected && priority === "high") return "border-amber-300 ring-1 ring-amber-300/40 bg-amber-50/50";
  if (selected) return "border-primary ring-1 ring-primary/20 shadow-[0_10px_24px_rgba(31,58,138,0.08)]";
  if (priority === "urgent") return "border-rose-200 hover:bg-rose-50/40 hover:shadow-[0_10px_22px_rgba(244,63,94,0.08)]";
  if (priority === "high") return "border-amber-200 hover:bg-amber-50/30 hover:shadow-[0_10px_22px_rgba(245,158,11,0.08)]";
  return "hover:-translate-y-px hover:bg-muted/20 hover:shadow-[0_10px_22px_rgba(15,23,42,0.06)]";
}

function formatPriorityLabel(priority: FrontDeskPriority | undefined) {
  if (!priority) return "normal";
  return priority;
}

export default function AppCallsPage() {
  const [calls, setCalls] = useState<OrgCallRecord[]>([]);
  const [selectedDay, setSelectedDay] = useState(todayDateValue());
  const [page, setPage] = useState(1);
  const [totalVisible, setTotalVisible] = useState(0);
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
  const selectedDayRef = useRef(selectedDay);
  const queryRef = useRef(query);
  const outcomeFilterRef = useRef(outcomeFilter);
  const pageRef = useRef(page);

  const loadCalls = useCallback(async (next: { day: string; query: string; outcome: "ALL" | OrgCallRecord["outcome"]; page: number }) => {
    try {
      const data = await fetchOrgCalls({
        date: next.day,
        page: next.page,
        pageSize: 25,
        ...(next.outcome !== "ALL" ? { outcome: next.outcome } : {}),
        ...(next.query.trim() ? { query: next.query.trim() } : {})
      });
      setCalls(data.calls);
      setPage(data.page);
      setTotalVisible(data.totalVisible);
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
      setTotalVisible(0);
      setTotalPages(1);
      setAssignedPhoneNumber(null);
      setAssignedNumberProvider(null);
    }
  }, []);

  const refreshAndRepopulate = useCallback(async () => {
    setRefreshing(true);
    try {
      await repopulateOrgCalls();
    } catch {
      // still refresh current data
    } finally {
      await loadCalls({ day: selectedDay, query, outcome: outcomeFilter, page });
      setRefreshing(false);
    }
  }, [loadCalls, outcomeFilter, page, query, selectedDay]);

  useEffect(() => {
    selectedDayRef.current = selectedDay;
    queryRef.current = query;
    outcomeFilterRef.current = outcomeFilter;
    pageRef.current = page;
  }, [selectedDay, query, outcomeFilter, page]);

  useEffect(() => {
    selectedCallIdRef.current = selectedCall?.id || null;
  }, [selectedCall]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadCalls({ day: selectedDayRef.current, query: queryRef.current, outcome: outcomeFilterRef.current, page: pageRef.current });
    }, 12000);

    const refresh = () => void loadCalls({ day: selectedDayRef.current, query: queryRef.current, outcome: outcomeFilterRef.current, page: pageRef.current });
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadCalls]);

  useEffect(() => {
    void loadCalls({ day: selectedDay, query, outcome: outcomeFilter, page });
  }, [selectedDay, query, outcomeFilter, page, loadCalls]);

  useEffect(() => {
    if (!selectedCall || !detailsRef.current || !shouldScrollToDetailsRef.current) return;
    shouldScrollToDetailsRef.current = false;
    detailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedCall]);

  const metrics = useMemo(() => {
    const totalVisible = calls.length;
    if (!totalVisible) {
      return { totalVisible, needsReview: 0, requestCount: 0, urgentCount: 0 };
    }
    return {
      totalVisible,
      needsReview: calls.filter((call) => call.frontDesk?.needsFollowUp || call.outcome === "MISSED" || call.outcome === "ABANDONED" || Boolean(call.unansweredTransfer)).length,
      requestCount: calls.filter((call) => call.outcome === "APPOINTMENT_REQUEST").length,
      urgentCount: calls.filter((call) => call.frontDesk?.frontDeskPriority === "urgent").length
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
              <span>{formatDayHeading(selectedDay)}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>Updated {formatRelativeUpdate(lastUpdated)}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>{totalVisible} matching calls</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["ALL", "MISSED", "ABANDONED", "TRANSFERRED", "APPOINTMENT_REQUEST", "MESSAGE_TAKEN"].map((value) => (
              <button
                key={value}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                  outcomeFilter === value
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(31,58,138,0.16)]"
                    : "bg-white text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                onClick={() => {
                  setOutcomeFilter(value as "ALL" | OrgCallRecord["outcome"]);
                  setPage(1);
                }}
              >
                {value === "ALL" ? "All" : value.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Visible calls", value: metrics.totalVisible, meta: `Page ${page} of ${totalPages}` },
          { label: "Need follow-up", value: metrics.needsReview, meta: "Open requests on this page" },
          { label: "Requests captured", value: metrics.requestCount, meta: "Appointment requests on this page" },
          { label: "Urgent", value: metrics.urgentCount, meta: "Urgent front-desk items on this page" }
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
                <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <Input
                    type="date"
                    value={selectedDay}
                    onChange={(e) => {
                      setSelectedDay(e.target.value);
                      setPage(1);
                    }}
                  />
                  <Input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search by caller name, phone number, summary, or call ID"
                  />
                </div>
              </div>
              <div className="rounded-xl border bg-slate-50 px-4 py-4 text-sm">
                <p className="font-medium text-foreground">Queue summary</p>
                <div className="mt-3 space-y-2 text-muted-foreground">
                  <p>{totalVisible} matching calls on {formatDayHeading(selectedDay)}.</p>
                  <p>{calls.length} calls currently loaded on page {page}.</p>
                  <p>Use the day selector or day navigation to move the review queue backward or forward.</p>
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
                {calls.length} loaded on this page
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
                    className={`w-full rounded-2xl border bg-white p-5 text-left shadow-sm transition-all ${prioritySurface(call.frontDesk?.frontDeskPriority, selected)}`}
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
                          {formatPriorityLabel(call.frontDesk?.frontDeskPriority)}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {call.frontDesk?.summary || call.aiSummary || call.summary || "No summary available yet."}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{call.frontDesk?.serviceRequested || outcomeLabel(call.outcome)}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span>{call.frontDesk?.urgency || "Standard priority"}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span>{call.frontDesk?.recommendedAction || getNextAction(call)}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{call.frontDesk?.appointmentRequested ? "Appointment requested" : "No appointment requested"}</span>
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
              <div className="space-y-1">
                <p className="page-eyebrow">Day navigation</p>
                <p className="text-sm text-muted-foreground">{formatDayHeading(selectedDay)}</p>
              </div>
              <p className="hidden text-sm text-muted-foreground xl:block">
                Page {page} of {totalPages} - {totalVisible} matching call{totalVisible === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => {
                  setSelectedDay((current) => shiftDateValue(current, -1));
                  setPage(1);
                }}>
                  Previous day
                </Button>
                <Button variant="outline" onClick={() => {
                  setSelectedDay(todayDateValue());
                  setPage(1);
                }} disabled={selectedDay === todayDateValue()}>
                  Today
                </Button>
                <Button variant="outline" onClick={() => {
                  setSelectedDay((current) => shiftDateValue(current, 1));
                  setPage(1);
                }}>
                  Next day
                </Button>
              </div>
            </CardContent>
          </Card>
          {totalPages > 1 ? (
            <Card className="border-slate-200 shadow-[0_14px_30px_rgba(15,23,42,0.08)]">
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="page-eyebrow">Page controls</p>
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} for {formatDayHeading(selectedDay)}.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
                    Previous page
                  </Button>
                  <Button variant="outline" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>
                    Next page
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
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
                        ["Answered by", formatAnsweredByLabel(selectedCall.answeredByLabel)],
                        ["Priority", formatPriorityLabel(selectedCall.frontDesk?.frontDeskPriority)],
                        ["Next step", getNextAction(selectedCall)]
                      ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border bg-slate-50 p-4">
                        <p className="page-eyebrow">{label}</p>
                        <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>

                  {selectedCall.outcome === "TRANSFERRED" || selectedCall.recoverySmsSentAt ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedCall.outcome === "TRANSFERRED" ? (
                        <>
                          <div className="rounded-xl border bg-slate-50 p-4">
                            <p className="page-eyebrow">Transfer reason</p>
                            <p className="mt-2 text-sm font-medium text-foreground">{formatTransferReason(selectedCall.transferReason)}</p>
                          </div>
                          <div className="rounded-xl border bg-slate-50 p-4">
                            <p className="page-eyebrow">Transfer target</p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                              {selectedCall.transferTarget || "Office routing"}
                              {selectedCall.unansweredTransfer ? " (not answered)" : ""}
                            </p>
                          </div>
                        </>
                      ) : null}
                      {selectedCall.recoverySmsSentAt ? (
                        <>
                          <div className="rounded-xl border bg-slate-50 p-4">
                            <p className="page-eyebrow">Recovery SMS</p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                              Sent {new Date(selectedCall.recoverySmsSentAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="rounded-xl border bg-slate-50 p-4">
                            <p className="page-eyebrow">Recovery response</p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                              {selectedCall.recoverySmsResponse || "No reply yet"}
                            </p>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <p className="page-eyebrow">Front-desk summary</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ["Caller", extractCallerName(selectedCall)],
                        ["Service requested", selectedCall.frontDesk?.serviceRequested || "Not captured"],
                        ["Urgency", selectedCall.frontDesk?.urgency || "Standard priority"],
                        ["Service location", selectedCall.frontDesk?.serviceLocation || "Not captured"],
                        ["Appointment requested", selectedCall.frontDesk?.appointmentRequested ? "Yes" : "No"],
                        ["Recommended action", selectedCall.frontDesk?.recommendedAction || getNextAction(selectedCall)],
                        ["Follow-up state", getDispositionLabel(selectedCall)]
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border bg-slate-50 p-4">
                          <p className="page-eyebrow">{label}</p>
                          <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {selectedCall.frontDesk?.summary || selectedCall.aiSummary || selectedCall.summary || "No summary available yet."}
                    </p>
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
