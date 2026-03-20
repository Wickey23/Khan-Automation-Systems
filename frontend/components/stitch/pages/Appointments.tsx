"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2, Clock3, RefreshCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { approveAppointmentRequest, denyAppointmentRequest, fetchAppointmentRequests, fetchOrgAppointments } from "@/lib/api";
import type { Appointment, AppointmentRequest } from "@/lib/types";
import { StateCard } from "@/components/stitch/components/app/StateCard";
import { StatusBadge } from "@/components/stitch/components/app/StatusBadge";

function formatWhen(value: string | null | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function appointmentState(status: Appointment["status"]): "confirmed" | "pending" | "cancelled" {
  if (status === "CONFIRMED" || status === "COMPLETED") return "confirmed";
  if (status === "CANCELED" || status === "NO_SHOW") return "cancelled";
  return "pending";
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchOrgAppointments({}), fetchAppointmentRequests()])
      .then(([appointmentsPayload, requestsPayload]) => {
        setAppointments(appointmentsPayload.appointments || []);
        setRequests(requestsPayload.requests || []);
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Unable to load appointment data.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === "PENDING_REVIEW" || request.status === "SLOT_OFFERED"),
    [requests]
  );
  const confirmedCount = useMemo(
    () => appointments.filter((item) => item.status === "CONFIRMED" || item.status === "COMPLETED").length,
    [appointments]
  );
  const canceledCount = useMemo(
    () => appointments.filter((item) => item.status === "CANCELED" || item.status === "NO_SHOW").length,
    [appointments]
  );

  const handleApprove = async (requestId: string) => {
    if (actioningId) return;
    setActioningId(requestId);
    try {
      await approveAppointmentRequest(requestId);
      loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not approve request.");
    } finally {
      setActioningId(null);
    }
  };

  const handleDeny = async (requestId: string) => {
    if (actioningId) return;
    setActioningId(requestId);
    try {
      await denyAppointmentRequest(requestId, { denialReason: "Denied by operator from appointments page." });
      loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not deny request.");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Appointments</h1>
          <p className="text-sm text-on-surface-variant">Track appointments and triage request approvals.</p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 rounded-xl bg-surface-container-high px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-container-highest"
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
      </header>

      {loading ? <StateCard type="loading" title="Loading appointments" description="Fetching requests and scheduled appointments." /> : null}
      {!loading && error ? <StateCard type="error" title="Appointments unavailable" description={error} /> : null}

      {!loading && !error ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <Calendar size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider">Scheduled</span>
              </div>
              <p className="mt-2 text-2xl font-black text-on-surface">{appointments.length}</p>
            </div>
            <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <Clock3 size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider">Pending review</span>
              </div>
              <p className="mt-2 text-2xl font-black text-on-surface">{pendingRequests.length}</p>
            </div>
            <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <CheckCircle2 size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider">Confirmed / done</span>
              </div>
              <p className="mt-2 text-2xl font-black text-on-surface">{confirmedCount}</p>
            </div>
            <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <XCircle size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider">Canceled / no-show</span>
              </div>
              <p className="mt-2 text-2xl font-black text-on-surface">{canceledCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <section className="space-y-4 lg:col-span-5">
              <h2 className="text-lg font-bold text-on-surface">Needs review</h2>
              {pendingRequests.length === 0 ? (
                <StateCard type="empty" title="No pending requests" description="New booking requests will appear here." />
              ) : (
                pendingRequests.slice(0, 8).map((request) => (
                  <article key={request.id} className="rounded-xl border border-outline-variant/10 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-on-surface">{request.customerName}</h3>
                      <StatusBadge type="booking" state="pending" />
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant">{request.issueSummary}</p>
                    <p className="mt-2 text-[11px] text-on-surface-variant">Requested: {formatWhen(request.createdAt)}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        disabled={actioningId === request.id}
                        onClick={() => void handleApprove(request.id)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        disabled={actioningId === request.id}
                        onClick={() => void handleDeny(request.id)}
                        className="rounded-lg bg-surface-container-high px-3 py-1.5 text-xs font-bold text-on-surface disabled:opacity-60"
                      >
                        Deny
                      </button>
                    </div>
                  </article>
                ))
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm lg:col-span-7">
              <div className="flex items-center justify-between border-b border-outline-variant/10 px-5 py-4">
                <h2 className="text-lg font-bold text-on-surface">Appointment ledger</h2>
                <Link href="/app/settings" className="text-xs font-semibold text-primary hover:underline">
                  Configure calendar
                </Link>
              </div>
              {appointments.length === 0 ? (
                <div className="p-5">
                  <StateCard type="empty" title="No appointments yet" description="Approved requests will create entries here." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-outline-variant/10 bg-surface-container-low/40">
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Customer</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Issue</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Window</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/5">
                      {appointments.map((appointment) => (
                        <tr key={appointment.id} className="hover:bg-surface-container-low/30">
                          <td className="px-5 py-4">
                            <p className="text-sm font-bold text-on-surface">{appointment.customerName}</p>
                            <p className="text-xs text-on-surface-variant">{appointment.customerPhone}</p>
                          </td>
                          <td className="px-5 py-4 text-sm text-on-surface-variant">{appointment.issueSummary}</td>
                          <td className="px-5 py-4 text-sm text-on-surface-variant">{formatWhen(appointment.startAt)}</td>
                          <td className="px-5 py-4">
                            <StatusBadge type="booking" state={appointmentState(appointment.status)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
