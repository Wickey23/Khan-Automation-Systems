"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  approveAppointmentRequest,
  assignAppointmentRequest,
  denyAppointmentRequest,
  cancelOrgAppointment,
  completeOrgAppointment,
  createOrgAppointment,
  fetchAppointmentRequests,
  fetchAppointmentAvailability,
  fetchCalendarEvents,
  fetchCalendarProviders,
  fetchCustomerBase,
  fetchOrgProfile,
  fetchOrgAppointments,
  fetchTeamMembers,
  getMe,
  patchOrgAppointment
} from "@/lib/api";
import type {
  Appointment,
  AppointmentRequest,
  CalendarConnection,
  CustomerBaseRecord,
  OrgCalendarEvent,
  OrgFeatureFlags,
  TeamMember
} from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";

export default function AppAppointmentsPage() {
  const { showToast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentRequests, setAppointmentRequests] = useState<AppointmentRequest[]>([]);
  const [viewMode, setViewMode] = useState<"LIST" | "CALENDAR">("CALENDAR");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [status, setStatus] = useState<Appointment["status"] | "ALL">("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [canWrite, setCanWrite] = useState(false);
  const [canManageCalendar, setCanManageCalendar] = useState(false);
  const [calendarProviders, setCalendarProviders] = useState<CalendarConnection[]>([]);
  const [customerBase, setCustomerBase] = useState<CustomerBaseRecord[]>([]);
  const [assignableTechnicians, setAssignableTechnicians] = useState<Array<{ id: string; label: string }>>([]);
  const [requestTechnicianDrafts, setRequestTechnicianDrafts] = useState<Record<string, string>>({});
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState("");
  const [calendarEvents, setCalendarEvents] = useState<OrgCalendarEvent[]>([]);
  const [slotDate, setSlotDate] = useState("");
  const [slotTimezone, setSlotTimezone] = useState("America/New_York");
  const [slotProvider, setSlotProvider] = useState<"INTERNAL" | "GOOGLE" | "OUTLOOK">("INTERNAL");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [issueSummary, setIssueSummary] = useState("");
  const [availableSlots, setAvailableSlots] = useState<Array<{ startAt: string; endAt: string }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingCalendarEvents, setLoadingCalendarEvents] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [requestSavingId, setRequestSavingId] = useState<string | null>(null);
  const [creatingSlot, setCreatingSlot] = useState<string | null>(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);
  const [calendarFeatureEnabled, setCalendarFeatureEnabled] = useState(false);
  const [selectedCalendarDetail, setSelectedCalendarDetail] = useState<
    | null
    | { type: "APPOINTMENT"; appointment: Appointment }
    | { type: "EXTERNAL"; event: OrgCalendarEvent }
  >(null);

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

  const loadRequests = useCallback(async () => {
    try {
      const data = await fetchAppointmentRequests();
      const requests = data.requests || [];
      setAppointmentRequests(requests);
      setRequestTechnicianDrafts((current) => {
        const next = { ...current };
        for (const request of requests) {
          if (!next[request.id] && request.assignedTechnician) {
            next[request.id] = request.assignedTechnician;
          }
        }
        return next;
      });
    } catch (error) {
      showToast({
        title: "Could not load appointment requests",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
      setAppointmentRequests([]);
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
          setAppointmentRequests([]);
          setCalendarProviders([]);
          setCustomerBase([]);
          setLoading(false);
          return;
        }
        void load("ALL", "", "");
        void loadRequests();
        if (writable) {
          void fetchCustomerBase()
            .then((data) => setCustomerBase(data.customers || []))
            .catch(() => setCustomerBase([]));
          void fetchTeamMembers()
            .then((data) => {
              const activeMembers = (data.members || []).filter((member) => member.status === "ACTIVE");
              setAssignableTechnicians(
                activeMembers.map((member: TeamMember) => ({
                  id: member.id,
                  label: member.user?.email || member.invitedEmail
                }))
              );
            })
            .catch(() => setAssignableTechnicians([]));
        } else {
          setCustomerBase([]);
          setAssignableTechnicians([]);
        }
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
        setCustomerBase([]);
        setAppointmentRequests([]);
        setAssignableTechnicians([]);
        setLoading(false);
      });
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (localTz) setSlotTimezone(localTz);
  }, [load, loadRequests]);

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

  async function onApproveRequest(request: AppointmentRequest) {
    setRequestSavingId(request.id);
    try {
      await approveAppointmentRequest(request.id, {
        assignedTechnician: requestTechnicianDrafts[request.id]?.trim() || null
      });
      showToast({ title: "Appointment request approved" });
      await loadRequests();
    } catch (error) {
      showToast({
        title: "Could not approve request",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setRequestSavingId(null);
    }
  }

  async function onDenyRequest(request: AppointmentRequest) {
    setRequestSavingId(request.id);
    try {
      await denyAppointmentRequest(request.id);
      showToast({ title: "Appointment request denied" });
      await loadRequests();
    } catch (error) {
      showToast({
        title: "Could not deny request",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setRequestSavingId(null);
    }
  }

  async function onAssignRequest(request: AppointmentRequest) {
    const assignedTechnician = requestTechnicianDrafts[request.id]?.trim() || "";
    if (!assignedTechnician) {
      showToast({
        title: "Select a technician",
        description: "Choose a technician before assigning this request.",
        variant: "error"
      });
      return;
    }
    setRequestSavingId(request.id);
    try {
      await assignAppointmentRequest(request.id, { assignedTechnician });
      showToast({ title: "Technician assigned" });
      await loadRequests();
    } catch (error) {
      showToast({
        title: "Could not assign technician",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setRequestSavingId(null);
    }
  }

  const hasGoogle = calendarProviders.some((provider) => provider.provider === "GOOGLE" && provider.isActive);
  const hasOutlook = calendarProviders.some((provider) => provider.provider === "OUTLOOK" && provider.isActive);
  const hasExternalCalendar = hasGoogle || hasOutlook;

  useEffect(() => {
    if (hasGoogle) {
      if (slotProvider !== "GOOGLE") setSlotProvider("GOOGLE");
      return;
    }
    if (hasOutlook) {
      if (slotProvider !== "OUTLOOK") setSlotProvider("OUTLOOK");
      return;
    }
    if (slotProvider !== "INTERNAL") setSlotProvider("INTERNAL");
  }, [hasGoogle, hasOutlook, slotProvider]);

  useEffect(() => {
    if (featureDisabled || !calendarFeatureEnabled || viewMode !== "CALENDAR") {
      setCalendarEvents([]);
      return;
    }
    const from = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1, 0, 0, 0);
    const to = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0, 23, 59, 59);
    setLoadingCalendarEvents(true);
    void fetchCalendarEvents({
      from: from.toISOString(),
      to: to.toISOString()
    })
      .then((data) => setCalendarEvents(data.events || []))
      .catch(() => setCalendarEvents([]))
      .finally(() => setLoadingCalendarEvents(false));
  }, [calendarFeatureEnabled, calendarMonth, featureDisabled, viewMode]);

  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const firstDayWeekday = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  const monthCells: Array<{ date: Date | null; key: string }> = [];
  for (let i = 0; i < firstDayWeekday; i += 1) {
    monthCells.push({ date: null, key: `pad-start-${i}` });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    monthCells.push({
      date: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day),
      key: `day-${day}`
    });
  }
  while (monthCells.length % 7 !== 0) {
    monthCells.push({ date: null, key: `pad-end-${monthCells.length}` });
  }

  function toLocalDateKey(value: Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const appointmentMapByDate = appointments.reduce<Record<string, Appointment[]>>((acc, appointment) => {
    const key = toLocalDateKey(new Date(appointment.startAt));
    if (!acc[key]) acc[key] = [];
    acc[key].push(appointment);
    return acc;
  }, {});
  Object.values(appointmentMapByDate).forEach((items) => {
    items.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  });
  const calendarEventMapByDate = calendarEvents.reduce<Record<string, OrgCalendarEvent[]>>((acc, event) => {
    const key = toLocalDateKey(new Date(event.startAt));
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {});
  Object.values(calendarEventMapByDate).forEach((items) => {
    items.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  });

  const sortedAppointmentRequests = [...appointmentRequests].sort((a, b) => {
    const priority = { PENDING_REVIEW: 0, APPROVED: 1, DENIED: 2 } as const;
    return (
      priority[a.reviewStatus] - priority[b.reviewStatus] ||
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  });

  function buildEventViewUrl(event: OrgCalendarEvent) {
    if (event.viewUrl && String(event.viewUrl).trim()) return String(event.viewUrl).trim();
    const start = new Date(event.startAt);
    const y = start.getUTCFullYear();
    const m = String(start.getUTCMonth() + 1).padStart(2, "0");
    const d = String(start.getUTCDate()).padStart(2, "0");
    const ymd = `${y}${m}${d}`;
    const iso = encodeURIComponent(start.toISOString());
    if (event.provider === "GOOGLE") {
      return `https://calendar.google.com/calendar/u/0/r/day/${ymd}`;
    }
    return `https://outlook.office.com/calendar/view/day?startdt=${iso}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Appointments</h1>
          <p className="text-sm text-muted-foreground">Track pending, confirmed, and completed bookings.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">View</span>
            <select
              value={viewMode}
              onChange={(event) => setViewMode(event.target.value as "LIST" | "CALENDAR")}
              className="mt-1 h-10 rounded-md border bg-background px-3"
            >
              <option value="CALENDAR">Calendar</option>
              <option value="LIST">List</option>
            </select>
          </label>
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
          {customerBase.length > 0 ? (
            <label className="mt-3 block text-sm">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Select customer from customer base</span>
              <select
                className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                value={selectedCustomerPhone}
                onChange={(event) => {
                  const phone = event.target.value;
                  setSelectedCustomerPhone(phone);
                  if (!phone) return;
                  const selected = customerBase.find((row) => row.phoneNumber === phone);
                  if (!selected) return;
                  setCustomerPhone(selected.phoneNumber);
                  setCustomerName(selected.lead?.name || selected.displayName || "");
                }}
              >
                <option value="">Manual entry</option>
                {customerBase.map((customer) => (
                  <option key={customer.phoneNumber} value={customer.phoneNumber}>
                    {(customer.lead?.name || customer.displayName || customer.phoneNumber).trim()} - {customer.phoneNumber}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
                {!hasExternalCalendar ? <option value="INTERNAL">INTERNAL</option> : null}
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

      {!featureDisabled ? (
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Appointment requests</h2>
              <p className="text-sm text-muted-foreground">
                Review worker-created appointment requests, assign a technician, and decide whether to accept or decline.
              </p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {sortedAppointmentRequests.length} request{sortedAppointmentRequests.length === 1 ? "" : "s"}
            </span>
          </div>
          {sortedAppointmentRequests.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sortedAppointmentRequests.map((request) => {
                const reviewTone =
                  request.reviewStatus === "APPROVED"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : request.reviewStatus === "DENIED"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-amber-200 bg-amber-50 text-amber-700";
                const draftTechnician = requestTechnicianDrafts[request.id] ?? request.assignedTechnician ?? "";
                return (
                  <div key={request.id} className="rounded-lg border p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold">{request.customerName}</h3>
                        <p className="text-sm text-muted-foreground">{request.customerPhone}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${reviewTone}`}>
                        {request.reviewStatus.replace("_", " ")}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Requested</span>
                        <p>{new Date(request.startedAt).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Issue</span>
                        <p>{request.issueSummary}</p>
                      </div>
                      <div>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Address</span>
                        <p>{request.serviceAddress || "Not captured yet"}</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">Worker state</span>
                          <p>{request.requestState}</p>
                        </div>
                        <div>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">Assigned</span>
                          <p>{request.assignedTechnician || "Unassigned"}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {request.leadId ? (
                          <Link className="underline" href={`/app/leads?leadId=${encodeURIComponent(request.leadId)}`}>
                            Open lead
                          </Link>
                        ) : null}
                        <Link className="underline" href={`/app/calls?callId=${encodeURIComponent(request.id)}`}>
                          Open call
                        </Link>
                      </div>
                    </div>
                    {canWrite ? (
                      <div className="mt-4 space-y-2">
                        <label className="block text-sm">
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">Assign technician</span>
                          <select
                            className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                            value={draftTechnician}
                            onChange={(event) =>
                              setRequestTechnicianDrafts((current) => ({
                                ...current,
                                [request.id]: event.target.value
                              }))
                            }
                          >
                            <option value="">Unassigned</option>
                            {assignableTechnicians.map((tech) => (
                              <option key={tech.id} value={tech.label}>
                                {tech.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={requestSavingId === request.id}
                            onClick={() => void onAssignRequest(request)}
                          >
                            Assign
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={requestSavingId === request.id}
                            onClick={() => void onApproveRequest(request)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={requestSavingId === request.id}
                            onClick={() => void onDenyRequest(request)}
                          >
                            Deny
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No open appointment requests yet.</p>
          )}
        </div>
      ) : null}

      {viewMode === "CALENDAR" ? (
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
            >
              Previous
            </Button>
            <h2 className="text-base font-semibold">
              {calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
            >
              Next
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-wide text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <div key={label} className="py-1">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
            {monthCells.map((cell) => {
              if (!cell.date) {
                return <div key={cell.key} className="min-h-28 rounded-md border bg-muted/20" />;
              }
              const dayKey = toLocalDateKey(cell.date);
              const dayItems = appointmentMapByDate[dayKey] || [];
              const dayExternalItems = calendarEventMapByDate[dayKey] || [];
              return (
                <div key={cell.key} className="min-h-28 rounded-md border p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">{cell.date.getDate()}</span>
                    <span className="text-xs text-muted-foreground">
                      {dayItems.length + dayExternalItems.length ? dayItems.length + dayExternalItems.length : ""}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayItems.slice(0, 3).map((appointment) => {
                      const isGoogleSynced = appointment.calendarProvider === "GOOGLE";
                      const appointmentCardClass = isGoogleSynced
                        ? "w-full cursor-pointer rounded border border-blue-200 bg-blue-50 px-2 py-1 text-left text-xs transition hover:-translate-y-px hover:bg-blue-100 hover:shadow-sm"
                        : "w-full cursor-pointer rounded border bg-muted/20 px-2 py-1 text-left text-xs transition hover:-translate-y-px hover:bg-muted/30 hover:shadow-sm";
                      const appointmentPrimaryTextClass = isGoogleSynced ? "font-medium text-blue-900" : "font-medium";
                      const appointmentSecondaryTextClass = isGoogleSynced ? "text-blue-700" : "text-muted-foreground";
                      return (
                        <button
                          type="button"
                          key={appointment.id}
                          className={appointmentCardClass}
                          onClick={() => setSelectedCalendarDetail({ type: "APPOINTMENT", appointment })}
                        >
                          <div className={appointmentPrimaryTextClass}>
                            {new Date(appointment.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{" "}
                            {appointment.customerName}
                          </div>
                          <div className={appointmentSecondaryTextClass}>
                            {appointment.status}
                            {isGoogleSynced ? " • GOOGLE" : ""}
                          </div>
                        </button>
                      );
                    })}
                    {dayExternalItems.slice(0, 2).map((event) => (
                      <button
                        type="button"
                        key={`external-${event.id}`}
                        className="w-full cursor-pointer rounded border border-blue-200 bg-blue-50 px-2 py-1 text-left text-xs transition hover:-translate-y-px hover:bg-blue-100 hover:shadow-sm"
                        onClick={() => setSelectedCalendarDetail({ type: "EXTERNAL", event })}
                      >
                        <div className="font-medium text-blue-900">
                          {new Date(event.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} {event.title}
                        </div>
                        <div className="flex items-center justify-between gap-2 text-blue-700">
                          <span>{event.provider}</span>
                          <a
                            href={buildEventViewUrl(event)}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                            onClick={(clickEvent) => clickEvent.stopPropagation()}
                          >
                            Open
                          </a>
                        </div>
                      </button>
                    ))}
                    {dayItems.length > 3 ? (
                      <div className="text-xs text-muted-foreground">+{dayItems.length - 3} more</div>
                    ) : null}
                    {dayExternalItems.length > 2 ? (
                      <div className="text-xs text-blue-700">+{dayExternalItems.length - 2} provider events</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {loading ? <p className="mt-3 text-sm text-muted-foreground">Loading appointments...</p> : null}
          {loadingCalendarEvents ? <p className="mt-1 text-sm text-muted-foreground">Loading provider calendar events...</p> : null}
          {!loading && appointments.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No appointments yet.</p> : null}
        </div>
      ) : (
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
      )}

      {selectedCalendarDetail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-xl overflow-hidden rounded-xl border bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b bg-slate-50 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {selectedCalendarDetail.type === "APPOINTMENT" ? "Appointment details" : "Calendar event details"}
                </p>
                <h3 className="text-xl font-semibold text-slate-900">
                  {selectedCalendarDetail.type === "APPOINTMENT"
                    ? selectedCalendarDetail.appointment.customerName
                    : selectedCalendarDetail.event.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedCalendarDetail.type === "APPOINTMENT"
                    ? new Date(selectedCalendarDetail.appointment.startAt).toLocaleString()
                    : new Date(selectedCalendarDetail.event.startAt).toLocaleString()}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setSelectedCalendarDetail(null)}>
                Close
              </Button>
            </div>

            {selectedCalendarDetail.type === "APPOINTMENT" ? (
              <div className="grid gap-3 px-5 py-4 text-sm">
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <span className="text-slate-500">Phone</span>
                  <span className="font-medium text-slate-900">{selectedCalendarDetail.appointment.customerPhone}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <span className="text-slate-500">Status</span>
                  <span className="font-medium text-slate-900">{selectedCalendarDetail.appointment.status}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <span className="text-slate-500">Provider</span>
                  <span className="font-medium text-slate-900">{selectedCalendarDetail.appointment.calendarProvider}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <span className="text-slate-500">Issue</span>
                  <span className="font-medium text-slate-900">{selectedCalendarDetail.appointment.issueSummary}</span>
                </div>
                {selectedCalendarDetail.appointment.leadId ? (
                  <div className="grid grid-cols-[110px_1fr] gap-2">
                    <span className="text-slate-500">Lead</span>
                    <Link className="font-medium text-blue-700 underline" href={`/app/leads?leadId=${encodeURIComponent(selectedCalendarDetail.appointment.leadId)}`}>
                      {selectedCalendarDetail.appointment.lead?.name || selectedCalendarDetail.appointment.leadId}
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-3 px-5 py-4 text-sm">
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <span className="text-slate-500">Provider</span>
                  <span className="font-medium text-slate-900">{selectedCalendarDetail.event.provider}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <span className="text-slate-500">Start</span>
                  <span className="font-medium text-slate-900">{new Date(selectedCalendarDetail.event.startAt).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <span className="text-slate-500">End</span>
                  <span className="font-medium text-slate-900">{new Date(selectedCalendarDetail.event.endAt).toLocaleString()}</span>
                </div>
                <a
                  className="mt-1 inline-flex w-fit items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  href={buildEventViewUrl(selectedCalendarDetail.event)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in provider calendar
                </a>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
