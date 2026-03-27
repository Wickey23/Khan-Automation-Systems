"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Inbox,
  MessageSquare,
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
import { AskAiInline } from "@/components/ai/ask-ai-inline";
import { useAccessSummary } from "@/context/access-summary";
import type { AppointmentRequest, TeamMember } from "@/lib/types";
import { CommandHeader } from "@/components/ops";
import { Button } from "@/components/ui/button";
import { PageShell, SectionHeading, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { QueueEmptyState } from "@/components/queue/queue-empty-state";

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

const STATUS_DESCRIPTIONS: Record<string, string> = {
  PENDING_REVIEW: "Pending human review before any booking attempt.",
  APPROVED: "Ready for the booking finalizer or manual scheduling.",
  SLOT_OFFERED: "Automation sent a slot offer; the lead needs to reply.",
  SCHEDULED: "Appointment confirmed in your calendar.",
  DENIED: "The system or team rejected this request.",
  CLOSED: "The request has been resolved or archived."
};

function pendingNextStep(request: AppointmentRequest) {
  if (request.status === "PENDING_REVIEW") return "Review the triage context, assign an operator, and approve if the request can be honored.";
  if (request.status === "APPROVED") return "Finalize scheduling with the primary calendar or follow-up team.";
  if (request.status === "SLOT_OFFERED") return "Follow up on the slot offer; send a reminder or accept a customer reply.";
  if (request.status === "SCHEDULED") return "Confirm the appointment details with the customer and close the request once done.";
  if (request.status === "DENIED") return request.denialReason || "Review why the request was declined before trying again.";
  return "Use this view to understand why the booking is in its current state.";
}

export default function AppAppointmentsPage() {
  const searchParams = useSearchParams();
  const highlightedRequestId = searchParams.get("requestId") || "";
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const accessSummary = useAccessSummary();
  const appointmentsAccess = accessSummary?.features.appointments;
  const shouldShowAppointments = !appointmentsAccess || appointmentsAccess.status === "ready";
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Needs Review");
  const [selectedRequestId, setSelectedRequestId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [assignable, setAssignable] = useState<Array<{ id: string; label: string }>>([]);
  const [assignedDraft, setAssignedDraft] = useState<Record<string, string>>({});
  const bookingReadinessCheck = useMemo(
    () => (accessSummary?.readinessChecklist || []).find((check) => check.key === "bookingSetup") || null,
    [accessSummary]
  );
  const pendingReviewCount = useMemo(
    () => requests.filter((request) => request.status === "PENDING_REVIEW").length,
    [requests]
  );
  const readyToBookCount = useMemo(
    () => requests.filter((request) => request.status === "APPROVED").length,
    [requests]
  );
  const loadAppointmentWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [requestData, me, teamData] = await Promise.all([
        fetchAppointmentRequests(),
        getMe(),
        fetchTeamMembers().catch(() => ({ members: [] as TeamMember[] }))
      ]);
      setRequests(requestData.requests || []);
      setSelectedRequestId(highlightedRequestId || requestData.requests?.[0]?.id || "");
      setCanWrite(["CLIENT_STAFF", "CLIENT_ADMIN", "ADMIN", "SUPER_ADMIN"].includes(me.user.role));
      const members = (teamData.members || [])
        .filter((member) => member.status === "ACTIVE" && member.user?.id)
        .map((member) => ({ id: member.user?.id || "", label: member.user?.email || member.invitedEmail }));
      setAssignable(members);
      setError(null);
    } catch (loadError) {
      setRequests([]);
      setCanWrite(false);
      setAssignable([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load booking requests.");
    } finally {
      setLoading(false);
    }
  }, [highlightedRequestId]);

  useEffect(() => {
    if (!shouldShowAppointments) {
      setRequests([]);
      setError(null);
      setLoading(false);
      return;
    }
    void loadAppointmentWorkspace();
  }, [loadAppointmentWorkspace, shouldShowAppointments]);

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

  if (appointmentsAccess && appointmentsAccess.status !== "ready") {
    const cardVariant = appointmentsAccess.status === "setup_required" ? "setup" : "locked";
    const actionHref = appointmentsAccess.status === "blocked" ? "/app/billing" : "/app/settings#settings-calendar";
    const actionLabel = appointmentsAccess.status === "blocked" ? "Open billing" : "Open calendar settings";
    return (
      <PageShell className="space-y-5">
        <SectionShell className="surface-panel space-y-4">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Appointments access</p>
              <h1 className="text-3xl font-semibold text-slate-900">{appointmentsAccess.label} offline</h1>
              <p className="text-sm text-slate-500">{appointmentsAccess.reason}</p>
            </div>
            <StatusBadge kind="feature" state={appointmentsAccess.status} size="sm" />
          </div>
          <StateCard
            variant={cardVariant}
            title="Booking triage locked"
            description={appointmentsAccess.reason}
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
    <PageShell className="space-y-5">
      <AskAiInline
        page="appointments"
        entityType={currentRequest ? "appointment" : undefined}
        entityId={currentRequest?.id}
        defaultAgentKey="scheduling"
      />
      <SectionShell className="surface-panel space-y-3">
        <CommandHeader
          eyebrow="Booking operations"
          title="Booking triage"
          description="Confirm booking readiness, work request states, and resolve blockers to move requests to scheduled."
          actions={
            <div className="flex items-center">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search requests..."
                className="h-10 w-64 rounded-xl border border-slate-200 bg-white px-4 text-xs outline-none focus:border-primary"
              />
            </div>
          }
        />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Booking availability</p>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                {appointmentsAccess?.status === "ready" || !appointmentsAccess ? "Ready" : "Setup required"}
              </p>
              <StatusBadge kind="feature" state={appointmentsAccess?.status || "ready"} size="xs" />
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {appointmentsAccess?.status === "ready" || !appointmentsAccess
                ? "Booking path is available in this workspace."
                : appointmentsAccess.reason}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Calendar readiness</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {bookingReadinessCheck?.status === "ready" ? "Configured" : "Needs setup"}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {bookingReadinessCheck?.description || "Connect booking settings and lead-time rules in settings."}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Requests needing action</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {pendingReviewCount} review / {readyToBookCount} ready
            </p>
            <p className="mt-1 text-xs text-slate-600">Start with pending review, then move approved requests to booking.</p>
          </div>
        </div>
      </SectionShell>

      <SectionShell className="surface-panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Inbox className="h-5 w-5 text-primary" />
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Front-Desk request queue</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedRequestId("");
                }}
                className={cn(
                  "relative pb-1",
                  activeTab === tab ? "text-primary" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {tab}
                {activeTab === tab ? <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" /> : null}
              </button>
            ))}
          </div>
        </div>
      </SectionShell>

      <div className="flex flex-col gap-6 2xl:flex-row">
        <div className="flex-1">
          <SectionShell className="surface-panel">
            {loading ? (
              <StateCard variant="loading" title="Loading booking requests" description="Refreshing the queue." />
            ) : error ? (
              <StateCard
                variant="error"
                title="Booking requests unavailable"
                description={error}
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void loadAppointmentWorkspace()}
                  >
                    Retry
                  </Button>
                }
              />
            ) : filteredRequests.length ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-white/80 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    <tr>
                      <th className="px-6 py-3">Patient / Source</th>
                      <th className="px-6 py-3">Service</th>
                      <th className="px-6 py-3 text-center">Requested Time</th>
                      <th className="px-6 py-3">Urgency</th>
                      <th className="px-6 py-3 text-right">Status</th>
                      <th className="px-6 py-3 text-right">Thread</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                    {filteredRequests.map((request) => {
                      const tone = urgency(request);
                      const selected = currentRequest?.id === request.id;
                      return (
                        <tr
                          key={request.id}
                          role="button"
                          tabIndex={0}
                          aria-pressed={selected}
                          onClick={() => setSelectedRequestId(request.id)}
                          onKeyDown={(event) => {
                            if (event.currentTarget !== event.target) return;
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedRequestId(request.id);
                            }
                          }}
                          className={cn(
                            "group cursor-pointer transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
                            selected && "bg-primary/5"
                          )}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-semibold shadow-sm",
                                selected ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                              )}>
                                {initials(request.customerName)}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-slate-900">{request.customerName}</div>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">{sourceLabel(request)}</span>
                                  {request.assignedUserLabel ? (
                                    <>
                                      <div className="h-1 w-1 rounded-full bg-slate-300" />
                                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">{request.assignedUserLabel}</span>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-slate-700">{request.issueSummary}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-600">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              {requestedTime(request)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]", tone.bg, tone.color)}>
                              <AlertCircle className="h-2.5 w-2.5" />
                              {tone.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <StatusBadge kind="booking" state={request.status} label={queueTab(request)} size="xs" />
                          </td>
                          <td className="px-6 py-4 text-right">
                            {request.latestMessageThreadId ? (
                              <Link
                                href={`/app/messages?threadId=${encodeURIComponent(request.latestMessageThreadId)}`}
                                className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                              >
                                Open thread
                              </Link>
                            ) : (
                              <span className="text-xs text-slate-400">No thread</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <QueueEmptyState
                title="No Requests In This Queue State"
                description="Switch tabs or update your search to find booking workflow items."
              />
            )}
          </SectionShell>
        </div>

        <aside className="w-full 2xl:w-[360px]">
          {currentRequest ? (
            <SectionShell className="surface-panel space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-semibold text-primary">
                    {initials(currentRequest.customerName)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-400">{sourceLabel(currentRequest)}</p>
                    <h3 className="text-xl font-semibold text-slate-900">{currentRequest.customerName}</h3>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">ID: #{currentRequest.id.slice(0, 8)}</p>
                  </div>
                </div>
                <StatusBadge kind="booking" state={currentRequest.status} label={queueTab(currentRequest)} />
              </div>

              <div className="space-y-3">
                <SectionHeading title="Booking pipeline" description={STATUS_DESCRIPTIONS[currentRequest.status] || "Review the pipeline state for this request."} />
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Workflow state</p>
                      <p className="text-sm font-semibold text-slate-900">{queueTab(currentRequest)}</p>
                    </div>
                    <StatusBadge kind="booking" state={currentRequest.status} size="xs" />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Calendar sync</p>
                      <p className="text-sm font-semibold text-slate-900">{currentRequest.appointmentId ? "Appointment created" : "Awaiting sync"}</p>
                    </div>
                    <StatusBadge kind="booking" state={currentRequest.appointmentId ? "completed" : "processing"} size="xs" />
                  </div>
                </div>
              </div>

              {currentRequest.status === "DENIED" ? (
                <StateCard
                  variant="error"
                  title="Request denied"
                  description={currentRequest.denialReason || "This request was declined. Close or reopen once resolved."}
                />
              ) : currentRequest.status === "PENDING_REVIEW" ? (
                <StateCard
                  variant="retry"
                  title="Review required"
                  description="Assign a staff member, or approve now if the request is supported."
                />
              ) : null}

              <div className="space-y-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Next steps</h4>
                <p className="text-sm text-slate-700">{pendingNextStep(currentRequest)}</p>
                <div className="flex flex-wrap gap-2">
                  {currentRequest.callLogId ? (
                    <Link href={`/app/calls?callId=${encodeURIComponent(currentRequest.callLogId)}`} className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                      Open call details
                    </Link>
                  ) : null}
                  {currentRequest.latestMessageThreadId ? (
                    <Link
                      href={`/app/messages?threadId=${encodeURIComponent(currentRequest.latestMessageThreadId)}`}
                      className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      Open SMS thread
                    </Link>
                  ) : null}
                  <Link href="/app/settings#settings-calendar" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                    Open calendar settings
                  </Link>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">AI context</h4>
                <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-primary/5 p-4 text-sm text-slate-700">
                  <p>&ldquo;{note(currentRequest)}&rdquo;</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Operator actions</h4>
                {canWrite ? (
                  <div className="grid gap-3">
                    <button
                      onClick={() => void handleApprove(currentRequest)}
                      disabled={savingId === currentRequest.id}
                      className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-3 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-lg shadow-primary/20 hover:bg-primary/90"
                    >
                      <CheckCircle2 className="h-4.5 w-4.5" />
                      Approve request
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <Link
                        href="/app/settings#settings-calendar"
                        className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 hover:bg-slate-50"
                      >
                        <Calendar className="h-4 w-4" />
                        Calendar settings
                      </Link>
                      <Link
                        href={currentRequest.latestMessageThreadId ? `/app/messages?threadId=${encodeURIComponent(currentRequest.latestMessageThreadId)}` : "/app/messages"}
                        className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 hover:bg-slate-50"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Open thread
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Assign</p>
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
                        className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 hover:bg-slate-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                    <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Finalize and close happens after a confirmed appointment is created in the booking workflow.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">This account has read-only access to booking actions.</p>
                )}
              </div>
            </SectionShell>
          ) : (
            <QueueEmptyState
              title="No Request Selected"
              description="Choose a booking request to inspect pipeline state, notes, and operator actions."
            />
          )}
        </aside>
      </div>
    </PageShell>
  );
}


