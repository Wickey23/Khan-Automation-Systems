"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  History,
  Info,
  Mic,
  Paperclip,
  Phone,
  Search,
  Send,
  Smile,
  User,
  X
} from "lucide-react";
import { fetchOrgCalls, getMe, repopulateOrgCalls, updateLeadPipelineStage } from "@/lib/api";
import type { FrontDeskPriority, OrgCallRecord } from "@/lib/types";
import { AskAiInline } from "@/components/ai/ask-ai-inline";
import { clientBadgeClass } from "@/lib/client-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageShell, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAccessSummary } from "@/context/access-summary";

const stateFilters = ["ALL", "needs_follow_up", "contacted", "booked", "closed", "spam"] as const;
type QueueState = (typeof stateFilters)[number];
type PipelineStage = "NEEDS_SCHEDULING" | "SCHEDULED" | "COMPLETED";

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "FD";
}

function callerName(call: OrgCallRecord) {
  return String(call.frontDesk?.callerName || call.displayName || call.fromNumber || "Unknown caller").trim();
}

function dispositionLabel(call: OrgCallRecord) {
  if (call.frontDesk?.followUpState === "needs_follow_up") return "Needs follow-up";
  if (call.frontDesk?.followUpState === "contacted") return "Contacted";
  if (call.frontDesk?.followUpState === "booked") return "Resolved";
  if (call.frontDesk?.followUpState === "closed") return "Resolved";
  if (call.frontDesk?.followUpState === "spam") return "Spam";
  if (call.outcome === "APPOINTMENT_REQUEST") return "Booking Request";
  if (call.outcome === "MESSAGE_TAKEN") return "Voicemail";
  if (call.outcome === "TRANSFERRED") return "Transferred";
  if (call.outcome === "SPAM") return "Spam";
  return "Reviewed";
}

function dispositionTone(call: OrgCallRecord) {
  const label = dispositionLabel(call);
  if (label === "Booking Request") return "bg-emerald-100 text-emerald-700";
  if (label === "Voicemail") return "bg-amber-100 text-amber-700";
  if (label === "Transferred") return "bg-blue-100 text-blue-700";
  if (label === "Spam") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function priorityLabel(priority: FrontDeskPriority | undefined) {
  if (priority === "urgent") return "Urgent";
  if (priority === "high") return "High";
  if (priority === "normal") return "Normal";
  return "Standard";
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return date.toLocaleDateString([], { month: "short", day: "numeric" });
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function nextAction(call: OrgCallRecord) {
  if (call.frontDesk?.recommendedAction) return call.frontDesk.recommendedAction;
  if (call.outcome === "APPOINTMENT_REQUEST") return "Review";
  if (call.outcome === "MISSED" || call.outcome === "ABANDONED") return "Call Back";
  return "Details";
}

function transcriptLines(call: OrgCallRecord) {
  const transcript = String(call.transcript || "").trim();
  if (!transcript) return [];
  return transcript.split(/\n+/).filter(Boolean).slice(0, 8);
}

function quickActions(call: OrgCallRecord | null): Array<{ label: string; stage: PipelineStage; tone: "default" | "outline" }> {
  if (!call?.leadId) return [];
  if (call.frontDesk?.followUpState === "booked") {
    return [
      { label: "Mark booked", stage: "SCHEDULED", tone: "default" },
      { label: "Mark resolved", stage: "COMPLETED", tone: "outline" }
    ];
  }
  return [
    { label: "Schedule appointment", stage: "NEEDS_SCHEDULING", tone: "default" },
    { label: "Mark resolved", stage: "COMPLETED", tone: "outline" }
  ];
}

export default function AppCallsPage() {
  const searchParams = useSearchParams();
  const deepLinkedCallId = searchParams.get("callId") || "";
  const accessSummary = useAccessSummary();
  const callsAccess = accessSummary?.features.calls;
  const gatingStatus = callsAccess?.status;
  const shouldShowCallQueue = !callsAccess || gatingStatus === "ready";
  const [calls, setCalls] = useState<OrgCallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<QueueState>("ALL");
  const [canEditPipeline, setCanEditPipeline] = useState(false);
  const [savingLeadStage, setSavingLeadStage] = useState<PipelineStage | null>(null);

  const loadCalls = useCallback(async (search: string) => {
    const result = await fetchOrgCalls({
      page: 1,
      pageSize: 30,
      ...(search.trim() ? { query: search.trim() } : {}),
      ...(deepLinkedCallId ? { callId: deepLinkedCallId } : {})
    });
    setCalls(result.calls || []);
    if (deepLinkedCallId) {
      setSelectedCallId(deepLinkedCallId);
    } else if (!selectedCallId && result.calls?.[0]) {
      setSelectedCallId(result.calls[0].id);
    } else if (selectedCallId && !result.calls?.some((call) => call.id === selectedCallId)) {
      setSelectedCallId(result.calls?.[0]?.id || null);
    }
  }, [deepLinkedCallId, selectedCallId]);

  useEffect(() => {
    void getMe()
      .then((me) => setCanEditPipeline(["CLIENT_STAFF", "CLIENT_ADMIN", "ADMIN", "SUPER_ADMIN"].includes(me.user.role)))
      .catch(() => setCanEditPipeline(false));
  }, []);

  useEffect(() => {
    if (!shouldShowCallQueue) {
      setCalls([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void loadCalls(query)
      .catch(() => {
        if (!active) return;
        setCalls([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadCalls, query, shouldShowCallQueue]);

  const visibleCalls = useMemo(() => {
    return calls.filter((call) => {
      if (stateFilter === "ALL") return true;
      return (call.frontDesk?.followUpState || "closed") === stateFilter;
    });
  }, [calls, stateFilter]);

  const selectedCall = useMemo(
    () => visibleCalls.find((call) => call.id === selectedCallId) || calls.find((call) => call.id === selectedCallId) || visibleCalls[0] || calls[0] || null,
    [calls, selectedCallId, visibleCalls]
  );

  async function refreshQueue() {
    if (!shouldShowCallQueue) return;
    setRefreshing(true);
    try {
      await repopulateOrgCalls();
      await loadCalls(query);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleQuickAction(stage: PipelineStage) {
    if (!selectedCall?.leadId || !canEditPipeline) return;
    setSavingLeadStage(stage);
    try {
      await updateLeadPipelineStage(selectedCall.leadId, stage);
      await loadCalls(query);
    } finally {
      setSavingLeadStage(null);
    }
  }

  if (callsAccess && callsAccess.status !== "ready") {
    const cardVariant = callsAccess.status === "setup_required" ? "setup" : "locked";
    const actionHref = callsAccess.status === "blocked" ? "/app/billing" : "/app/settings#settings-telephony";
    const actionLabel = callsAccess.status === "blocked" ? "Open billing" : "Open telephony settings";
    return (
      <PageShell className="space-y-6">
        <SectionShell className="surface-panel space-y-4">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Call handling access</p>
              <h1 className="text-3xl font-black text-slate-900">{callsAccess.label} not ready</h1>
              <p className="text-sm text-slate-500">{callsAccess.reason}</p>
            </div>
            <StatusBadge kind="feature" state={callsAccess.status} size="sm" />
          </div>
          <StateCard
            variant={cardVariant}
            title="Call queue blocked"
            description={callsAccess.reason}
            action={
              <Link href={actionHref}>
                <Button variant="outline">{actionLabel}</Button>
              </Link>
            }
          />
        </SectionShell>
      </PageShell>
    );
  }

  return (
    <div className="space-y-4">
      <AskAiInline page="calls" entityType={selectedCall ? "call" : undefined} entityId={selectedCall?.id} defaultAgentKey="front_desk" />
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-[calc(100vh-15rem)] overflow-hidden">
        <aside className="hidden w-16 shrink-0 flex-col items-center border-r border-slate-200 bg-slate-50 py-4 lg:flex">
          <div className="flex flex-col gap-4">
            <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
              <History className="h-5 w-5" />
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200">
              <Phone className="h-5 w-5" />
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200">
              <User className="h-5 w-5" />
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200">
              <Mic className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-auto">
            <button className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200">
              <Info className="h-5 w-5" />
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 overflow-hidden">
          <section className="flex min-w-0 flex-[2] flex-col overflow-hidden border-r border-slate-200">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
              <div className="flex items-center gap-4">
                <h1 className="text-lg font-bold text-slate-900">Reviewed Calls</h1>
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                  {stateFilters.map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setStateFilter(filter)}
                      className={cn(
                        "rounded-md px-3 py-1 text-xs font-bold transition-colors",
                        stateFilter === filter ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      {filter === "ALL" ? "All" : filter.replaceAll("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search calls..."
                    className="h-8 w-44 rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs outline-none focus:border-primary"
                  />
                </div>
                <button
                  onClick={() => void refreshQueue()}
                  className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Time / Date</th>
                    <th className="px-6 py-3">Duration</th>
                    <th className="px-6 py-3">AI Summary</th>
                    <th className="px-6 py-3">Intent</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td className="px-6 py-10 text-sm text-slate-500" colSpan={5}>Loading reviewed calls...</td>
                    </tr>
                  ) : visibleCalls.length ? (
                    visibleCalls.map((call) => (
                      <tr
                        key={call.id}
                        onClick={() => setSelectedCallId(call.id)}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-slate-50",
                          selectedCall?.id === call.id && "bg-primary/5"
                        )}
                      >
                        <td className="px-6 py-4">
                          <div className="font-medium">{formatTime(call.startedAt)}</div>
                          <div className="text-xs text-slate-400">{formatDateLabel(call.startedAt)}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-slate-600">{formatDuration(call.durationSec || 0)}</td>
                        <td className="px-6 py-4">
                          <p className="max-w-md line-clamp-2 text-sm">
                            {call.frontDesk?.summary || call.aiSummary || call.summary || "No structured summary available yet."}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", dispositionTone(call))}>
                            {dispositionLabel(call)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                            {nextAction(call)}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-6 py-10 text-sm text-slate-500" colSpan={5}>No calls match this filter yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex min-w-0 flex-[1.5] flex-col overflow-hidden bg-slate-50/30">
            {selectedCall ? (
              <>
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                      {initials(callerName(selectedCall))}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{callerName(selectedCall)}</h3>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {dispositionLabel(selectedCall)} - {formatTime(selectedCall.startedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest", dispositionTone(selectedCall))}>
                      {priorityLabel(selectedCall.frontDesk?.frontDeskPriority)}
                    </span>
                    <button
                      onClick={() => setSelectedCallId(null)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-red-200 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-8">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <Phone className="h-4 w-4 text-primary" />
                        <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">AI Summary</h4>
                      </div>
                      <p className="text-sm font-medium leading-relaxed text-slate-700">
                        {selectedCall.frontDesk?.summary || selectedCall.aiSummary || selectedCall.summary || "No structured summary available yet."}
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Service Type</p>
                          <p className="text-xs font-bold text-slate-900">{selectedCall.frontDesk?.serviceRequested || dispositionLabel(selectedCall)}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Preferred Date</p>
                          <p className="text-xs font-bold text-slate-900">
                            {selectedCall.frontDesk?.appointmentRequested ? "Appointment requested" : "Not captured"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-4 px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Call Transcript</h4>
                      <div className="space-y-4 px-1">
                        {transcriptLines(selectedCall).length ? (
                          transcriptLines(selectedCall).map((line, index) => {
                            const speaker = line.includes(":") ? line.split(":")[0]?.trim() : index % 2 === 0 ? callerName(selectedCall) : "AI";
                            const text = line.includes(":") ? line.slice(line.indexOf(":") + 1).trim() : line;
                            const ai = speaker.toUpperCase() === "AI";
                            return (
                              <div key={`${speaker}-${index}`} className="flex gap-3">
                                <span className={cn("mt-1 w-16 shrink-0 text-[10px] font-bold uppercase", ai ? "text-primary" : "text-slate-400")}>
                                  {speaker}:
                                </span>
                                <p className={cn("text-sm leading-relaxed", ai ? "text-slate-700" : "italic text-slate-600")}>
                                  &ldquo;{text}&rdquo;
                                </p>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-slate-500">No transcript available for this call.</p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-8">
                      <h4 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Quick Follow-up SMS</h4>
                      <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                        <textarea
                          className="w-full resize-none border-none bg-transparent p-4 text-sm font-medium placeholder:text-slate-400 focus:ring-0"
                          placeholder={`Send a follow-up to ${callerName(selectedCall).split(" ")[0]}...`}
                          rows={3}
                        />
                        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                          <div className="flex gap-2 text-slate-400">
                            <Smile className="h-4 w-4 cursor-pointer transition-colors hover:text-primary" />
                            <Paperclip className="h-4 w-4 cursor-pointer transition-colors hover:text-primary" />
                            <Clock className="h-4 w-4 cursor-pointer transition-colors hover:text-primary" />
                          </div>
                          <button className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90">
                            Send SMS
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {selectedCall.leadId && canEditPipeline ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {quickActions(selectedCall).map((action) => (
                            <Button
                              key={action.stage}
                              size="sm"
                              variant={action.tone}
                              disabled={savingLeadStage === action.stage}
                              onClick={() => void handleQuickAction(action.stage)}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedCall.recoverySmsThreadId ? (
                          <Link href={`/app/messages?threadId=${encodeURIComponent(selectedCall.recoverySmsThreadId)}`}>
                            <Badge className={clientBadgeClass("pending")}>Open inbox thread</Badge>
                          </Link>
                        ) : null}
                        {selectedCall.appointmentRequestId ? (
                          <Link href={`/app/appointments?requestId=${encodeURIComponent(selectedCall.appointmentRequestId)}`}>
                            <Badge className={clientBadgeClass("booking")}>Open booking</Badge>
                          </Link>
                        ) : null}
                        {selectedCall.recordingUrl ? (
                          <a href={selectedCall.recordingUrl} target="_blank" rel="noreferrer">
                            <Badge className={clientBadgeClass("neutral")}>Open recording</Badge>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center p-10 text-center text-sm text-slate-500">
                Select a call from the queue to review its summary, transcript, and next step.
              </div>
            )}
          </section>
        </div>
      </div>
      </div>
    </div>
  );
}
