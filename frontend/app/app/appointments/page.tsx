"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { approveAppointmentRequest, denyAppointmentRequest, fetchAppointmentRequests } from "@/lib/api";
import type { AppointmentRequest } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const queueFilters = ["needs_review", "ready_to_book", "awaiting_reply", "booked", "closed"] as const;

function queueState(request: AppointmentRequest) {
  if (request.status === "PENDING_REVIEW") return "needs_review";
  if (request.status === "APPROVED") return "ready_to_book";
  if (request.status === "SLOT_OFFERED") return "awaiting_reply";
  if (request.status === "SCHEDULED") return "booked";
  return "closed";
}

function queueMeta(request: AppointmentRequest) {
  if (request.status === "PENDING_REVIEW") return "Overdue 2h";
  if (request.status === "APPROVED") return "Ready";
  if (request.status === "SLOT_OFFERED") return "Waiting";
  if (request.status === "SCHEDULED") return "Booked";
  return "Resolved";
}

export default function AppAppointmentsPage() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const highlightedRequestId = searchParams.get("requestId") || "";
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof queueFilters)[number]>("needs_review");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(highlightedRequestId || null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    void fetchAppointmentRequests()
      .then((data) => {
        const rows = data.requests || [];
        setRequests(rows);
        setSelectedId((current) => current || rows[0]?.id || null);
      })
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((request) => {
      if (queueState(request) !== filter) return false;
      if (!q) return true;
      return [request.customerName, request.customerPhone, request.issueSummary, request.requestedTimeLabel || "", request.requestedPreference || ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [filter, query, requests]);

  const selected = useMemo(
    () => filtered.find((request) => request.id === selectedId) || filtered[0] || null,
    [filtered, selectedId]
  );

  async function refreshRequests() {
    const refreshed = await fetchAppointmentRequests();
    setRequests(refreshed.requests || []);
  }

  async function onApprove(request: AppointmentRequest) {
    setSavingId(request.id);
    try {
      await approveAppointmentRequest(request.id, {});
      await refreshRequests();
      showToast({ title: "Request approved" });
    } catch (error) {
      showToast({ title: "Could not approve request", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
    } finally {
      setSavingId(null);
    }
  }

  async function onDecline(request: AppointmentRequest) {
    setSavingId(request.id);
    try {
      await denyAppointmentRequest(request.id);
      await refreshRequests();
      showToast({ title: "Request resolved" });
    } catch (error) {
      showToast({ title: "Could not resolve request", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-[20px] border border-primary/10 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.07)]">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-primary/10 bg-white px-6 py-3">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined text-3xl">medical_services</span>
            <h2 className="text-lg font-bold tracking-tight text-slate-950">Front Desk OS</h2>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/app" className="text-sm font-medium text-slate-500 transition-colors hover:text-primary">Dashboard</Link>
            <span className="border-b-2 border-primary pb-1 text-sm font-bold text-primary">Booking Queue</span>
            <Link href="/app/appointments" className="text-sm font-medium text-slate-500 transition-colors hover:text-primary">Calendar</Link>
            <Link href="/app/leads" className="text-sm font-medium text-slate-500 transition-colors hover:text-primary">Patients</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-64 border-0 bg-primary/5 pl-10"
              placeholder="Search patients or requests..."
            />
          </div>
          <button type="button" className="rounded-lg bg-primary/5 p-2 text-slate-600 transition-colors hover:bg-primary/10">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/30 bg-primary/20">
            <span className="material-symbols-outlined text-primary">account_circle</span>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-64 flex-col border-r border-primary/10 bg-white p-4 lg:flex">
          <div className="flex items-center gap-3 rounded-lg bg-primary/10 px-3 py-2 text-primary">
            <span className="material-symbols-outlined">pending_actions</span>
            <span className="text-sm font-semibold">Queue Overview</span>
          </div>
          <div className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 transition-colors hover:bg-primary/5">
            <span className="material-symbols-outlined">chat</span>
            <span className="text-sm font-medium">Active Chats</span>
            <span className="ml-auto rounded-full bg-primary/20 px-1.5 py-0.5 text-xs text-primary">{requests.length}</span>
          </div>
          <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 transition-colors hover:bg-primary/5">
            <span className="material-symbols-outlined">call</span>
            <span className="text-sm font-medium">Missed Calls</span>
            <span className="ml-auto rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-600">
              {requests.filter((request) => request.status === "PENDING_REVIEW").length}
            </span>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-primary/10 bg-white px-6">
            <div className="no-scrollbar flex gap-8 overflow-x-auto">
              {queueFilters.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`flex flex-col items-center whitespace-nowrap py-4 text-sm ${
                    filter === item ? "border-b-2 border-primary font-bold text-primary" : "border-b-2 border-transparent font-medium text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {item === "needs_review" && `Needs Review (${requests.filter((request) => queueState(request) === item).length})`}
                  {item === "ready_to_book" && `Ready to Book (${requests.filter((request) => queueState(request) === item).length})`}
                  {item === "awaiting_reply" && `Awaiting Reply (${requests.filter((request) => queueState(request) === item).length})`}
                  {item === "booked" && `Booked (${requests.filter((request) => queueState(request) === item).length})`}
                  {item === "closed" && "Resolved"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto bg-background-light p-6">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                {filter === "needs_review" ? "Urgent Requests" : "Request Queue"}
              </h3>
              <div className="space-y-4">
                {loading ? (
                  <div className="rounded-xl border border-primary/10 bg-white p-4 text-sm text-slate-500">Loading booking queue...</div>
                ) : filtered.length ? (
                  filtered.map((request) => (
                    <button
                      key={request.id}
                      type="button"
                      onClick={() => setSelectedId(request.id)}
                      className={`relative w-full rounded-xl border p-4 text-left shadow-sm transition-all hover:border-primary/40 ${
                        selected?.id === request.id ? "border-l-4 border-l-primary bg-primary/5" : "border-primary/10 bg-white"
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                            {(request.customerName || "U").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-950">{request.customerName}</h4>
                            <p className="text-xs text-slate-500">{request.source} | {request.customerPhone}</p>
                          </div>
                        </div>
                        <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${
                          request.status === "PENDING_REVIEW" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
                        }`}>
                          {queueMeta(request)}
                        </span>
                      </div>
                      <div className="mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-slate-400">
                          {request.source === "WORKER" ? "call" : "message"}
                        </span>
                        <p className="line-clamp-1 text-sm italic text-slate-600">{request.issueSummary || "Booking workflow updated."}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">schedule</span>
                          Received {new Date(request.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">calendar_today</span>
                          {request.requestedTimeLabel || request.requestedPreference || "Time pending"}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-xl border border-primary/10 bg-white p-4 text-sm text-slate-500">No booking requests in this queue state.</div>
                )}
              </div>
            </div>

            <aside className="flex w-[450px] flex-col gap-6 overflow-y-auto border-l border-primary/10 bg-white p-6">
              {selected ? (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-950">Action Center</h3>
                    <button type="button" className="text-slate-400 hover:text-slate-600">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="mb-4 flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
                        {(selected.customerName || "U").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-950">{selected.customerName}</h4>
                        <p className="text-xs text-slate-500">{selected.customerPhone}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Request Type</span>
                        <span className="font-medium text-slate-950">{selected.source} / Booking</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Preferred Time</span>
                        <span className="font-medium text-slate-950">{selected.requestedTimeLabel || selected.requestedPreference || "ASAP"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Latest movement</span>
                        <span className="font-medium text-slate-950">
                          {selected.latestMessageDirection === "INBOUND" ? "Customer replied" : "Office action pending"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Available Actions</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={savingId === selected.id}
                        onClick={() => void onApprove(selected)}
                        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-primary/20 p-4 transition-colors hover:bg-primary/5 disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined text-primary">event_available</span>
                        <span className="text-sm font-bold">Approve</span>
                      </button>
                      <button type="button" className="flex flex-col items-center justify-center gap-2 rounded-xl border border-primary/20 p-4 transition-colors hover:bg-primary/5">
                        <span className="material-symbols-outlined text-primary">event_busy</span>
                        <span className="text-sm font-bold">Reschedule</span>
                      </button>
                      <Link href={selected.latestMessageThreadId ? `/app/messages?threadId=${encodeURIComponent(selected.latestMessageThreadId)}` : "/app/messages"} className="flex flex-col items-center justify-center gap-2 rounded-xl border border-primary/20 p-4 transition-colors hover:bg-primary/5">
                        <span className="material-symbols-outlined text-primary">sms</span>
                        <span className="text-sm font-bold">Send SMS</span>
                      </Link>
                      <Link href={selected.leadId ? `/app/leads?leadId=${encodeURIComponent(selected.leadId)}` : "/app/leads"} className="flex flex-col items-center justify-center gap-2 rounded-xl border border-primary/20 p-4 transition-colors hover:bg-primary/5">
                        <span className="material-symbols-outlined text-primary">person_search</span>
                        <span className="text-sm font-bold">Merge Record</span>
                      </Link>
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-primary/10 pt-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Recent Activity</p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-lg text-primary">call</span>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-950">Inbound Call</p>
                          <p className="text-[11px] text-slate-500">{new Date(selected.startedAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-lg text-primary">message</span>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-950">Booking Summary</p>
                          <p className="text-[11px] italic leading-tight text-slate-600">{selected.issueSummary}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-primary/10 pt-4">
                    <label className="mb-2 block text-sm font-bold text-slate-950">Internal Note</label>
                    <Textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      className="h-24 rounded-lg border-primary/10 bg-background-light p-3 text-sm"
                      placeholder="Add a private note for other staff members..."
                    />
                  </div>

                  <Button disabled={savingId === selected.id} onClick={() => void onApprove(selected)} className="gap-2 shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined">send</span>
                    Finalize &amp; Close Request
                  </Button>
                  <Button variant="ghost" className="text-slate-400 hover:text-red-500" disabled={savingId === selected.id} onClick={() => void onDecline(selected)}>
                    Decline &amp; Mark as Spam
                  </Button>
                </>
              ) : (
                <div className="text-sm text-slate-500">Select a booking request to review and complete the office handoff.</div>
              )}
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
