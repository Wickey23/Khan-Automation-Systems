"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  cancelOrgAppointment,
  completeOrgAppointment,
  createOrgAppointment,
  fetchAppointmentAvailability,
  fetchCalendarProviders,
  fetchOrgProfile,
  fetchOrgAppointments,
  getMe,
  patchOrgAppointment
} from "@/lib/api";
import type { Appointment, CalendarConnection, OrgFeatureFlags } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";

export default function AppAppointmentsPage() {
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [status, setStatus] = useState<Appointment["status"] | "ALL">("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [canWrite, setCanWrite] = useState(false);
  const [canManageCalendar, setCanManageCalendar] = useState(false);
  const [calendarProviders, setCalendarProviders] = useState<CalendarConnection[]>([]);
  const [slotDate, setSlotDate] = useState("");
  const [slotTimezone, setSlotTimezone] = useState("America/New_York");
  const [slotProvider, setSlotProvider] = useState<"INTERNAL" | "GOOGLE" | "OUTLOOK">("INTERNAL");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [issueSummary, setIssueSummary] = useState("");
  const [availableSlots, setAvailableSlots] = useState<Array<{ startAt: string; endAt: string }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creatingSlot, setCreatingSlot] = useState<string | null>(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);
  const [calendarFeatureEnabled, setCalendarFeatureEnabled] = useState(false);

  const load = useCallback(async (nextStatus: Appointment["status"] | "ALL", nextFrom: string, nextTo: string) => {
    setLoading(true);
    try {
      const data = await fetchOrgAppointments({
        ...(nextStatus === "ALL" ? {} : { status: nextStatus }),
        ...(nextFrom ? { from: new Date(`${nextFrom}T00:00:00`).toISOString() } : {}),
        ...(nextTo ? { to: new Date(`${nextTo}T23:59:59`).toISOString() } : {})
      });
      setAppointments(data.appointments || []);
      setFeatureDisabled(false);
    } catch (error) {
      setAppointments([]);
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("appointments feature is disabled")) {
        setFeatureDisabled(true);
        return;
      }
      showToast({
        title: "Could not load appointments",
        description: message || "Try again.",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void Promise.all([
      getMe(),
      fetchOrgProfile().catch(() => ({
        organization: null,
        assignedPhoneNumber: null,
        assignedNumberProvider: null,
        features: {}
      }))
    ])
      .then(([me, profile]) => {
        const role = me.user.role;
        const writable =
          role === "CLIENT_STAFF" ||
          role === "CLIENT_ADMIN" ||
          role === "ADMIN" ||
          role === "SUPER_ADMIN";
        const calendarManage =
          role === "CLIENT_ADMIN" ||
          role === "ADMIN" ||
          role === "SUPER_ADMIN";
        setCanWrite(writable);
        setCanManageCalendar(calendarManage);
        const features: OrgFeatureFlags = profile.features || {};
        const appointmentsEnabled = features.appointmentsEnabled === true;
        const calendarEnabled = features.calendarOauthEnabled === true;
        setFeatureDisabled(!appointmentsEnabled);
        setCalendarFeatureEnabled(calendarEnabled);
        if (!appointmentsEnabled) {
          setAppointments([]);
          setCalendarProviders([]);
          setLoading(false);
          return;
        }
        void load("ALL", "", "");
        if (calendarManage && calendarEnabled) {
          void fetchCalendarProviders()
            .then((data) => setCalendarProviders(data.providers || []))
            .catch(() => setCalendarProviders([]));
        } else {
          setCalendarProviders([]);
        }
      })
      .catch(() => {
        setCanWrite(false);
        setCanManageCalendar(false);
        setFeatureDisabled(true);
        setCalendarFeatureEnabled(false);
        setLoading(false);
      });
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (localTz) setSlotTimezone(localTz);
  }, [load]);

  async function onConfirm(id: string) {
    setSavingId(id);
    try {
      await patchOrgAppointment(id, { status: "CONFIRMED" });
      showToast({ title: "Appointment confirmed" });
      await load(status, fromDate, toDate);
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
      await load(status, fromDate, toDate);
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
      await load(status, fromDate, toDate);
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

  async function onFetchSlots() {
    if (!slotDate) {
      showToast({ title: "Select a date", description: "Choose a date before fetching availability.", variant: "error" });
      return;
    }
    setLoadingSlots(true);
    try {
      const from = new Date(`${slotDate}T00:00:00`);
      const to = new Date(`${slotDate}T23:59:59`);
      const data = await fetchAppointmentAvailability({
        from: from.toISOString(),
        to: to.toISOString()
      });
      setAvailableSlots(data.slots || []);
      setFeatureDisabled(false);
      if ((data.slots || []).length === 0) {
        showToast({ title: "No slots found", description: "No available times for the selected day." });
      }
    } catch (error) {
      setAvailableSlots([]);
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("appointments feature is disabled")) {
        setFeatureDisabled(true);
        return;
      }
      showToast({
        title: "Could not fetch slots",
        description: message || "Try again.",
        variant: "error"
      });
    } finally {
      setLoadingSlots(false);
    }
  }

  async function onCreateFromSlot(slot: { startAt: string; endAt: string }) {
    if (!customerName.trim() || !customerPhone.trim() || !issueSummary.trim()) {
      showToast({
        title: "Missing details",
        description: "Add customer name, phone, and issue summary before booking.",
        variant: "error"
      });
      return;
    }
    const stableIdempotencyKey = `slot:${slot.startAt}:${slot.endAt}:${customerPhone.trim().toLowerCase()}:${customerName
      .trim()
      .toLowerCase()}`;
    setCreatingSlot(slot.startAt);
    try {
      await createOrgAppointment({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        issueSummary: issueSummary.trim(),
        startAt: slot.startAt,
        endAt: slot.endAt,
        timezone: slotTimezone,
        calendarProvider: slotProvider,
        idempotencyKey: stableIdempotencyKey
      });
      showToast({ title: "Appointment created" });
      setAvailableSlots([]);
      setFeatureDisabled(false);
      await load(status, fromDate, toDate);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("appointments feature is disabled")) {
        setFeatureDisabled(true);
        return;
      }
      showToast({
        title: "Could not create appointment",
        description: message || "Try again.",
        variant: "error"
      });
    } finally {
      setCreatingSlot(null);
    }
  }

  const hasGoogle = calendarProviders.some((provider) => provider.provider === "GOOGLE" && provider.isActive);
  const hasOutlook = calendarProviders.some((provider) => provider.provider === "OUTLOOK" && provider.isActive);

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
                void load(next, fromDate, toDate);
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

      {featureDisabled ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Appointments are currently disabled for this workspace. Ask an admin to enable the feature flag for your org.
        </div>
      ) : null}

      {canWrite && !featureDisabled ? (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold">Create appointment</h2>
          <p className="text-sm text-muted-foreground">Select a day, pull available slots, then book a confirmed or internal pending appointment.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Customer name</span>
              <input
                className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Jane Smith"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Customer phone</span>
              <input
                className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="+15165551234"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Calendar provider</span>
              <select
                value={slotProvider}
                onChange={(event) => setSlotProvider(event.target.value as "INTERNAL" | "GOOGLE" | "OUTLOOK")}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3"
              >
                <option value="INTERNAL">INTERNAL</option>
                {calendarFeatureEnabled && hasGoogle ? <option value="GOOGLE">GOOGLE</option> : null}
                {calendarFeatureEnabled && hasOutlook ? <option value="OUTLOOK">OUTLOOK</option> : null}
              </select>
              {!canManageCalendar ? (
                <p className="mt-1 text-xs text-muted-foreground">Google/Outlook booking is admin-managed in Settings.</p>
              ) : null}
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Date</span>
              <input
                type="date"
                className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                value={slotDate}
                onChange={(event) => setSlotDate(event.target.value)}
              />
            </label>
          </div>
          <label className="mt-3 block text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Issue summary</span>
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3"
              value={issueSummary}
              onChange={(event) => setIssueSummary(event.target.value)}
              placeholder="No heat, furnace inspection requested"
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void onFetchSlots()} disabled={loadingSlots}>
              {loadingSlots ? "Loading slots..." : "Find available slots"}
            </Button>
            <span className="text-xs text-muted-foreground">Timezone: {slotTimezone}</span>
          </div>
          {availableSlots.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {availableSlots.map((slot) => (
                <Button
                  key={slot.startAt}
                  size="sm"
                  variant="outline"
                  disabled={creatingSlot === slot.startAt}
                  onClick={() => void onCreateFromSlot(slot)}
                >
                  {creatingSlot === slot.startAt
                    ? "Booking..."
                    : `${new Date(slot.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - ${new Date(slot.endAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

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
                    <div>
                      Lead:{" "}
                      {appointment.leadId ? (
                        <Link className="underline" href={`/app/leads?leadId=${encodeURIComponent(appointment.leadId)}`}>
                          {appointment.lead?.name || appointment.leadId}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </div>
                    <div>
                      Call:{" "}
                      {appointment.callLogId ? (
                        <Link className="underline" href={`/app/calls?callId=${encodeURIComponent(appointment.callLogId)}`}>
                          {appointment.callLog?.providerCallId || appointment.callLogId}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </div>
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
