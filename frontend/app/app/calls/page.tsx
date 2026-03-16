"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchOrgCalls, repopulateOrgCalls, sendOrgMessage } from "@/lib/api";
import type { FrontDeskFollowUpState, OrgCallRecord } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientBadgeClass } from "@/lib/client-badges";

type QueueFilter = "ALL" | "needs_follow_up" | "closed" | "spam";
type SortMode = "newest" | "longest" | "priority";

const queueFilters: Array<{ label: string; value: QueueFilter; icon?: string }> = [
  { label: "All Calls", value: "ALL" },
  { label: "Pending Review", value: "needs_follow_up", icon: "pending_actions" },
  { label: "Resolved", value: "closed", icon: "check_circle" },
  { label: "Voicemail", value: "spam", icon: "voicemail" }
];

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatTimeLabel(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function callerLabel(call: OrgCallRecord) {
  return call.frontDesk?.callerName || call.displayName || call.fromNumber;
}

function intentLabel(call: OrgCallRecord) {
  if (call.outcome === "APPOINTMENT_REQUEST") return "Booking Request";
  if (call.outcome === "MESSAGE_TAKEN") return "Voicemail";
  if (call.outcome === "TRANSFERRED") return "Transferred";
  if (call.outcome === "SPAM") return "Spam";
  if (call.outcome === "ABANDONED") return "Abandoned";
  return "Call Review";
}

function intentTone(call: OrgCallRecord) {
  if (call.outcome === "APPOINTMENT_REQUEST") return "warning" as const;
  if (call.outcome === "MESSAGE_TAKEN") return "booking" as const;
  if (call.outcome === "SPAM") return "neutral" as const;
  if (call.outcome === "TRANSFERRED") return "pending" as const;
  return "critical" as const;
}

function stateForFilter(call: OrgCallRecord): FrontDeskFollowUpState {
  if (call.outcome === "SPAM") return "spam";
  if (call.frontDesk?.followUpState) return call.frontDesk.followUpState;
  if (call.outcome === "MESSAGE_TAKEN") return "closed";
  return "needs_follow_up";
}

function primaryHref(call: OrgCallRecord) {
  if (call.appointmentRequestId) return `/app/appointments?requestId=${encodeURIComponent(call.appointmentRequestId)}`;
  if (call.leadId) return `/app/leads?leadId=${encodeURIComponent(call.leadId)}`;
  if (call.recoverySmsThreadId) return `/app/messages?threadId=${encodeURIComponent(call.recoverySmsThreadId)}`;
  return `/app/calls?callId=${encodeURIComponent(call.id)}`;
}

export default function AppCallsPage() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const deepLinkedCallId = searchParams.get("callId");
  const [calls, setCalls] = useState<OrgCallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [selectedCallId, setSelectedCallId] = useState<string | null>(deepLinkedCallId);
  const [smsBody, setSmsBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await fetchOrgCalls({
          page: 1,
          pageSize: 40,
          ...(deepLinkedCallId ? { callId: deepLinkedCallId } : {}),
          ...(query.trim() ? { query: query.trim() } : {})
        });
        if (!active) return;
        const rows = data.calls || [];
        setCalls(rows);
        setSelectedCallId((current) => deepLinkedCallId || current || rows[0]?.id || null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [deepLinkedCallId, query]);

  const visibleCalls = useMemo(() => {
    const filtered = calls.filter((call) => {
      if (queueFilter === "ALL") return true;
      return stateForFilter(call) === queueFilter;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "longest") return (b.durationSec || 0) - (a.durationSec || 0);
      if (sortMode === "priority") {
        const aWeight = a.frontDesk?.frontDeskPriority === "urgent" ? 0 : a.frontDesk?.frontDeskPriority === "high" ? 1 : 2;
        const bWeight = b.frontDesk?.frontDeskPriority === "urgent" ? 0 : b.frontDesk?.frontDeskPriority === "high" ? 1 : 2;
        if (aWeight !== bWeight) return aWeight - bWeight;
      }
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });
  }, [calls, queueFilter, sortMode]);

  const selectedCall = useMemo(
    () => visibleCalls.find((call) => call.id === selectedCallId) || visibleCalls[0] || null,
    [visibleCalls, selectedCallId]
  );

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await repopulateOrgCalls();
      const data = await fetchOrgCalls({ page: 1, pageSize: 40, ...(query.trim() ? { query: query.trim() } : {}) });
      setCalls(data.calls || []);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSendSms() {
    if (!selectedCall || !smsBody.trim()) return;
    setSending(true);
    try {
      await sendOrgMessage({
        to: selectedCall.fromNumber,
        body: smsBody.trim(),
        leadId: selectedCall.leadId || undefined
      });
      setSmsBody("");
      showToast({ title: "Follow-up queued" });
    } catch (error) {
      showToast({
        title: "Could not send follow-up",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.07)]">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-primary/10 p-1.5">
            <span className="material-symbols-outlined text-primary">call_log</span>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-slate-950">Call Queue</h2>
        </div>
        <div className="flex flex-1 justify-end gap-4">
          <div className="hidden items-center rounded-lg border border-transparent bg-slate-100 px-3 py-1.5 transition-colors focus-within:border-primary/50 md:flex">
            <span className="material-symbols-outlined text-xl text-slate-400">search</span>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search transcripts or leads..."
              className="h-auto w-64 border-0 bg-transparent px-2 py-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" className="rounded-lg p-2 transition-colors hover:bg-slate-100">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button type="button" className="rounded-lg border border-slate-200 p-2 transition-colors hover:bg-slate-100">
              <span className="material-symbols-outlined">account_circle</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center gap-2">
              {queueFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setQueueFilter(filter.value)}
                  className={
                    queueFilter === filter.value
                      ? "flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white"
                      : "flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
                  }
                >
                  {filter.icon ? <span className="material-symbols-outlined text-lg">{filter.icon}</span> : null}
                  <span>{filter.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sort by:</span>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="cursor-pointer border-none bg-transparent text-sm font-medium focus:ring-0"
              >
                <option value="newest">Newest First</option>
                <option value="longest">Longest Duration</option>
                <option value="priority">Intent Priority</option>
              </select>
              <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing}>
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-background-light p-6">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {loading ? (
                <div className="px-6 py-10 text-sm text-slate-500">Loading calls...</div>
              ) : visibleCalls.length ? (
                <table className="w-full border-collapse text-left">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      {["Time / Date", "Duration", "AI Summary", "Intent", "Actions"].map((label) => (
                        <th key={label} className="border-b border-slate-200 px-6 py-4">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleCalls.map((call) => (
                      <tr
                        key={call.id}
                        className={`cursor-pointer transition-colors hover:bg-slate-50 ${selectedCall?.id === call.id ? "bg-primary/5" : ""}`}
                        onClick={() => setSelectedCallId(call.id)}
                      >
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-950">{formatTimeLabel(call.startedAt)}</div>
                          <div className="text-xs text-slate-400">{formatDateLabel(call.startedAt)}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-slate-600">{formatDuration(call.durationSec)}</td>
                        <td className="px-6 py-4">
                          <p className="max-w-md text-sm text-slate-700">
                            {call.frontDesk?.summary || call.aiSummary || call.summary || "No AI summary available yet."}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <Badge className={clientBadgeClass(intentTone(call))}>{intentLabel(call)}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button asChild variant="ghost" className="gap-1 p-0 font-semibold text-primary hover:bg-transparent hover:underline">
                            <Link href={primaryHref(call)}>
                              {selectedCall?.id === call.id ? "Review" : "Details"}
                              <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-6 py-10 text-sm text-slate-500">No calls match the current filter.</div>
              )}
            </div>
          </div>
        </div>

        <aside className="relative z-10 flex w-[450px] min-w-[450px] flex-col border-l border-slate-200 bg-white shadow-2xl">
          {selectedCall ? (
            <>
              <div className="border-b border-slate-100 p-6">
                <div className="mb-6 flex items-center justify-between">
                  <Badge className={clientBadgeClass(selectedCall.frontDesk?.frontDeskPriority === "urgent" ? "critical" : "warning")}>
                    {selectedCall.frontDesk?.frontDeskPriority === "urgent" ? "Urgent Pending" : "Pending"}
                  </Badge>
                  <button type="button" onClick={() => setSelectedCallId(null)} className="rounded-lg p-1 hover:bg-slate-100">
                    <span className="material-symbols-outlined text-slate-400">close</span>
                  </button>
                </div>

                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                    {callerLabel(selectedCall)
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() || "")
                      .join("")}
                  </div>
                  <div>
                    <h3 className="mb-1 text-lg font-bold leading-none text-slate-950">{callerLabel(selectedCall)}</h3>
                    <p className="flex items-center gap-1 text-sm text-slate-500">
                      <span className="material-symbols-outlined text-xs">phone</span>
                      {selectedCall.fromNumber}
                    </p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Button asChild variant="ghost" className="h-10 w-10 bg-slate-50 p-0 hover:text-primary">
                      <Link href={primaryHref(selectedCall)}>
                        <span className="material-symbols-outlined">call</span>
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-100 bg-background-light p-4">
                    <h4 className="mb-2 text-xs font-bold uppercase text-slate-400">AI Summary</h4>
                    <p className="text-sm leading-relaxed text-slate-700">
                      {selectedCall.frontDesk?.summary || selectedCall.aiSummary || selectedCall.summary || "No AI summary available yet."}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Service Type</span>
                      <span className="text-sm font-medium text-slate-950">
                        {selectedCall.frontDesk?.serviceRequested || intentLabel(selectedCall)}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Preferred Date</span>
                      <span className="text-sm font-medium text-slate-950">
                        {selectedCall.appointmentRequested ? "Customer requested scheduling" : "Not captured"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-6 overflow-auto p-6">
                <div>
                  <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                    <span className="material-symbols-outlined text-sm">description</span>
                    Transcript
                  </h4>
                  <div className="space-y-4 text-sm">
                    {selectedCall.transcript ? (
                      selectedCall.transcript.split("\n").filter(Boolean).map((line, index) => (
                        <div key={`${selectedCall.id}-${index}`} className="flex gap-3">
                          <span className="shrink-0 font-bold text-primary">
                            {line.toLowerCase().includes("agent") || line.toLowerCase().includes("ai") ? "AI:" : `${callerLabel(selectedCall)}:`}
                          </span>
                          <p className="text-slate-700">{line}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                        Transcript unavailable. Call started {formatDateTime(selectedCall.startedAt)}.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 bg-slate-50 p-6">
                <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Quick Follow-up SMS</label>
                <div className="relative">
                  <textarea
                    value={smsBody}
                    onChange={(event) => setSmsBody(event.target.value)}
                    className="h-24 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm focus:border-primary focus:ring-primary"
                    placeholder={`Send a text to ${callerLabel(selectedCall)}...`}
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendSms()}
                    disabled={sending || !smsBody.trim()}
                    className="absolute bottom-3 right-3 flex items-center justify-center rounded-lg bg-primary p-2 text-white transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-lg">send</span>
                  </button>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button asChild variant="ghost" className="gap-1 px-0 text-xs font-medium text-slate-500 hover:bg-transparent hover:text-primary">
                      <Link href={primaryHref(selectedCall)}>
                        <span className="material-symbols-outlined text-sm">history</span>
                        Log Activity
                      </Link>
                    </Button>
                  </div>
                  <Button asChild className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <Link href={primaryHref(selectedCall)}>
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Open Workflow
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-500">
              Select a call to review the transcript, summary, and follow-up actions.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
