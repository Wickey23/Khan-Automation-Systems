"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Inbox,
  MessageSquare,
  MoreVertical,
  PhoneCall,
  Plus,
  XCircle
} from "lucide-react";
import {
  approveAppointmentRequest,
  assignAppointmentRequest,
  denyAppointmentRequest,
  fetchAppointmentRequests,
  fetchTeamMembers,
  getMe
} from "@/lib/api";
import type { AppointmentRequest, TeamMember } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const tabs = ["Needs Review", "Ready to Book", "Awaiting Reply", "Booked", "Resolved"] as const;

function queueTab(request: AppointmentRequest) {
  if (request.status === "PENDING_REVIEW") return "Needs Review";
  if (request.status === "APPROVED") return "Ready to Book";
  if (request.status === "SLOT_OFFERED") return "Awaiting Reply";
  if (request.status === "SCHEDULED") return "Booked";
  return "Resolved";
}

function urgency(request: AppointmentRequest) {
  if (request.latestMessageDirection === "INBOUND") return { label: "High", color: "text-red-600", bg: "bg-red-50" };
  if (request.status === "PENDING_REVIEW") return { label: "Medium", color: "text-amber-600", bg: "bg-amber-50" };
  return { label: "Low", color: "text-slate-600", bg: "bg-slate-50" };
}

function sourceLabel(request: AppointmentRequest) {
  if (request.source === "MANUAL") return "Manual";
  if (request.latestMessageDirection === "INBOUND") return "SMS Bot";
  if (request.callLogId) return "AI Call";
  return "Web Form";
}

function requestedTime(request: AppointmentRequest) {
  return request.requestedTimeLabel || (request.requestedStartAt ? new Date(request.requestedStartAt).toLocaleString() : "Timing pending");
}

function note(request: AppointmentRequest) {
  return request.issueSummary || request.requestedPreference || "No booking note recorded yet.";
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "FD";
}

export default function AppAppointmentsPage() {
  const searchParams = useSearchParams();
  const highlightedRequestId = searchParams.get("requestId") || "";
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Needs Review");
  const [selectedRequestId, setSelectedRequestId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [assignable, setAssignable] = useState<Array<{ id: string; label: string }>>([]);
  const [assignedDraft, setAssignedDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    void Promise.all([fetchAppointmentRequests(), getMe(), fetchTeamMembers().catch(() => ({ members: [] as TeamMember[] }))])
      .then(([requestData, me, teamData]) => {
        setRequests(requestData.requests || []);
        setSelectedRequestId(highlightedRequestId || requestData.requests?.[0]?.id || "");
        setCanWrite(["CLIENT_STAFF", "CLIENT_ADMIN", "ADMIN", "SUPER_ADMIN"].includes(me.user.role));
        const members = (teamData.members || [])
          .filter((member) => member.status === "ACTIVE" && member.user?.id)
          .map((member) => ({ id: member.user?.id || "", label: member.user?.email || member.invitedEmail }));
        setAssignable(members);
      })
      .catch(() => {
        setRequests([]);
        setCanWrite(false);
        setAssignable([]);
      })
      .finally(() => setLoading(false));
  }, [highlightedRequestId]);

  const filteredRequests = useMemo(() => {
    const term = query.trim().toLowerCase();
    return requests.filter((request) => {
      if (queueTab(request) !== activeTab) return false;
      if (!term) return true;
      return [
        request.customerName,
        request.customerPhone,
        request.issueSummary,
        request.requestedTimeLabel || "",
        request.assignedUserLabel || "",
        sourceLabel(request)
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [activeTab, query, requests]);

  const currentRequest =
    filteredRequests.find((request) => request.id === selectedRequestId) ||
    requests.find((request) => request.id === selectedRequestId) ||
    filteredRequests[0] ||
    requests[0] ||
    null;

  async function handleApprove(request: AppointmentRequest) {
    setSavingId(request.id);
    try {
      await approveAppointmentRequest(request.id, { assignedUserId: assignedDraft[request.id] || null });
      const refreshed = await fetchAppointmentRequests();
      setRequests(refreshed.requests || []);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeny(request: AppointmentRequest) {
    setSavingId(request.id);
    try {
      await denyAppointmentRequest(request.id);
      const refreshed = await fetchAppointmentRequests();
      setRequests(refreshed.requests || []);
    } finally {
      setSavingId(null);
    }
  }

  async function handleAssign(request: AppointmentRequest) {
    const assignedUserId = assignedDraft[request.id];
    if (!assignedUserId) return;
    setSavingId(request.id);
    try {
      await assignAppointmentRequest(request.id, { assignedUserId });
      const refreshed = await fetchAppointmentRequests();
      setRequests(refreshed.requests || []);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-[calc(100vh-15rem)] overflow-hidden bg-white">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-slate-200">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Inbox className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Booking Triage</h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Front-Desk Request Queue</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search requests..."
                className="h-9 w-64 rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs outline-none focus:border-primary"
              />
              <button className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                New Request
              </button>
            </div>
          </header>

          <div className="flex h-12 shrink-0 items-center gap-6 border-b border-slate-200 bg-slate-50/50 px-8">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedRequestId("");
                }}
                className={cn(
                  "relative h-full px-1 text-[11px] font-bold uppercase tracking-wider transition-all",
                  activeTab === tab ? "text-primary" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {tab}
                {activeTab === tab ? <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-primary" /> : null}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 border-b border-slate-100 bg-white/80 text-[10px] font-bold uppercase tracking-widest text-slate-400 backdrop-blur-sm">
                <tr>
                  <th className="px-8 py-3">Patient / Source</th>
                  <th className="px-8 py-3">Service</th>
                  <th className="px-8 py-3">Requested Time</th>
                  <th className="px-8 py-3">Urgency</th>
                  <th className="px-8 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td className="px-8 py-10 text-sm text-slate-500" colSpan={5}>Loading booking requests...</td></tr>
                ) : filteredRequests.length ? (
                  filteredRequests.map((request) => {
                    const tone = urgency(request);
                    const selected = currentRequest?.id === request.id;
                    return (
                      <tr
                        key={request.id}
                        onClick={() => setSelectedRequestId(request.id)}
                        className={cn("group cursor-pointer transition-colors hover:bg-slate-50", selected && "bg-primary/5")}
                      >
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-bold shadow-sm",
                              selected ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                            )}>
                              {initials(request.customerName)}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-900">{request.customerName}</div>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{sourceLabel(request)}</span>
                                {request.assignedUserLabel ? (
                                  <>
                                    <div className="h-1 w-1 rounded-full bg-slate-300" />
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{request.assignedUserLabel}</span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-4 text-xs font-bold text-slate-700">{request.issueSummary}</td>
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            {requestedTime(request)}
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest", tone.bg, tone.color)}>
                            <AlertCircle className="h-2.5 w-2.5" />
                            {tone.label}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 transition-all group-hover:opacity-100">
                            <button className="rounded-lg border border-transparent p-2 text-slate-400 transition-all hover:border-slate-200 hover:bg-white hover:text-primary shadow-sm">
                              <MessageSquare className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td className="px-8 py-10 text-sm text-slate-500" colSpan={5}>No requests in this queue state yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="hidden w-[400px] shrink-0 flex-col overflow-hidden bg-slate-50/50 xl:flex">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">Action Center</h2>
            <div className="flex gap-2">
              <button className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-100"><Calendar className="h-4 w-4" /></button>
              <button className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-100"><MoreVertical className="h-4 w-4" /></button>
            </div>
          </header>

          {currentRequest ? (
            <div className="flex-1 space-y-8 overflow-y-auto p-8">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-extrabold text-primary shadow-inner">
                    {initials(currentRequest.customerName)}
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-widest",
                      currentRequest.status === "PENDING_REVIEW" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                    )}>
                      {queueTab(currentRequest)}
                    </span>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">ID: #{currentRequest.id.slice(0, 8)}</p>
                  </div>
                </div>
                <h3 className="text-xl font-extrabold tracking-tight text-slate-900">{currentRequest.customerName}</h3>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
                    <PhoneCall className="h-3 w-3" />
                    {currentRequest.customerPhone}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Inbox className="h-4 w-4 text-primary" />
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">AI Triage Context</h4>
                </div>
                <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-primary/5 p-5">
                  <p className="relative z-10 text-sm font-medium italic leading-relaxed text-slate-700">&ldquo;{note(currentRequest)}&rdquo;</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Operator Actions</h4>
                {canWrite ? (
                  <div className="grid gap-3">
                    <button
                      onClick={() => void handleApprove(currentRequest)}
                      disabled={savingId === currentRequest.id}
                      className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
                    >
                      <CheckCircle2 className="h-4.5 w-4.5" />
                      Approve & Schedule
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <button className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50">
                        <Calendar className="h-4 w-4" />
                        Reschedule
                      </button>
                      <Link
                        href={currentRequest.latestMessageThreadId ? `/app/messages?threadId=${encodeURIComponent(currentRequest.latestMessageThreadId)}` : "/app/messages"}
                        className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Send SMS
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Assign</p>
                        <select
                          value={assignedDraft[currentRequest.id] || ""}
                          onChange={(event) => setAssignedDraft((current) => ({ ...current, [currentRequest.id]: event.target.value }))}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"
                        >
                          <option value="">Unassigned</option>
                          {assignable.map((member) => (
                            <option key={member.id} value={member.id}>{member.label}</option>
                          ))}
                        </select>
                        <Button className="mt-2 w-full" size="sm" variant="outline" disabled={!assignedDraft[currentRequest.id] || savingId === currentRequest.id} onClick={() => void handleAssign(currentRequest)}>
                          Assign
                        </Button>
                      </div>
                      <button
                        onClick={() => void handleDeny(currentRequest)}
                        disabled={savingId === currentRequest.id}
                        className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </div>

                    <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-900 bg-slate-900 py-3.5 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:bg-slate-800">
                      <CheckCircle2 className="h-4 w-4" />
                      Finalize & Close Request
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">This account has read-only access to booking actions.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-10 text-center text-sm text-slate-500">Select a request to review its triage context and actions.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
