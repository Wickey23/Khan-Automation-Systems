"use client";

import { useEffect, useState } from "react";
import {
  cancelOrgAppointment,
  completeOrgAppointment,
  fetchOrgAppointments,
  getMe,
  patchOrgAppointment
} from "@/lib/api";
import type { Appointment } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";

export default function AppAppointmentsPage() {
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [status, setStatus] = useState<Appointment["status"] | "ALL">("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load(nextStatus: Appointment["status"] | "ALL" = status, nextFrom = fromDate, nextTo = toDate) {
    setLoading(true);
    try {
      const data = await fetchOrgAppointments({
        ...(nextStatus === "ALL" ? {} : { status: nextStatus }),
        ...(nextFrom ? { from: new Date(`${nextFrom}T00:00:00`).toISOString() } : {}),
        ...(nextTo ? { to: new Date(`${nextTo}T23:59:59`).toISOString() } : {})
      });
      setAppointments(data.appointments || []);
    } catch (error) {
      setAppointments([]);
      showToast({
        title: "Could not load appointments",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void getMe()
      .then((me) => {
        setCanWrite(me.user.role !== "CLIENT");
      })
      .catch(() => {
        setCanWrite(false);
      });
  }, []);

  async function onConfirm(id: string) {
    setSavingId(id);
    try {
      await patchOrgAppointment(id, { status: "CONFIRMED" });
      showToast({ title: "Appointment confirmed" });
      await load();
    } catch (error) {
      showToast({
        title: "Could not confirm appointment",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSavingId(null);
    }
  }

  async function onCancel(id: string) {
    setSavingId(id);
    try {
      await cancelOrgAppointment(id);
      showToast({ title: "Appointment canceled" });
      await load();
    } catch (error) {
      showToast({
        title: "Could not cancel appointment",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSavingId(null);
    }
  }

  async function onComplete(id: string) {
    setSavingId(id);
    try {
      await completeOrgAppointment(id);
      showToast({ title: "Appointment completed" });
      await load();
    } catch (error) {
      showToast({
        title: "Could not complete appointment",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Appointments</h1>
          <p className="text-sm text-muted-foreground">Track pending, confirmed, and completed bookings.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span>
            <select
              value={status}
              onChange={(event) => {
                const next = event.target.value as Appointment["status"] | "ALL";
                setStatus(next);
                void load(next);
              }}
              className="mt-1 h-10 rounded-md border bg-background px-3"
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELED">CANCELED</option>
              <option value="NO_SHOW">NO_SHOW</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => {
                const next = event.target.value;
                setFromDate(next);
                void load(status, next, toDate);
              }}
              className="mt-1 h-10 rounded-md border bg-background px-3"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => {
                const next = event.target.value;
                setToDate(next);
                void load(status, fromDate, next);
              }}
              className="mt-1 h-10 rounded-md border bg-background px-3"
            />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-3">Start</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Issue</th>
              <th className="p-3">Linked records</th>
              <th className="p-3">Technician</th>
              <th className="p-3">Status</th>
              <th className="p-3">Calendar</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={9}>Loading appointments...</td>
              </tr>
            ) : appointments.length ? (
              appointments.map((appointment) => (
                <tr key={appointment.id} className="border-t align-top">
                  <td className="p-3">{new Date(appointment.startAt).toLocaleString()}</td>
                  <td className="p-3">{appointment.customerName}</td>
                  <td className="p-3">{appointment.customerPhone}</td>
                  <td className="p-3 max-w-[320px]">{appointment.issueSummary}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    <div>Lead: {appointment.leadId || "-"}</div>
                    <div>Call: {appointment.callLogId || "-"}</div>
                  </td>
                  <td className="p-3">{appointment.assignedTechnician || "-"}</td>
                  <td className="p-3">{appointment.status}</td>
                  <td className="p-3">{appointment.calendarProvider}</td>
                  <td className="p-3">
                    {canWrite ? (
                      <div className="flex gap-2">
                        {appointment.status === "PENDING" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savingId === appointment.id}
                            onClick={() => void onConfirm(appointment.id)}
                          >
                            Confirm
                          </Button>
                        ) : null}
                        {(appointment.status === "PENDING" || appointment.status === "CONFIRMED") ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savingId === appointment.id}
                            onClick={() => void onComplete(appointment.id)}
                          >
                            Complete
                          </Button>
                        ) : null}
                        {appointment.status !== "CANCELED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savingId === appointment.id}
                            onClick={() => void onCancel(appointment.id)}
                          >
                            Cancel
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Read-only</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={9}>No appointments yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
