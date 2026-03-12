"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { clientBadgeClass } from "@/lib/client-badges";
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
import { PageHeader } from "@/components/ui/page";
import {
  frontDeskActionBadgeClass,
  frontDeskCardClass,
  frontDeskContextPanelClass,
  frontDeskEmptyStateClass,
  frontDeskLoadingCardClass,
  frontDeskOutcomeBadgeMeta,
  frontDeskOutcomeSurfaceClass,
  frontDeskWorkspaceCardClass,
  frontDeskMetricCardClass,
  frontDeskSkeletonLineClass
} from "@/lib/front-desk-ui";

const requestQueueFilters = ["ALL", "needs_review", "ready_to_book", "awaiting_reply", "booked", "closed"] as const;

function requestActionLabel(request: AppointmentRequest) {
  if (request.latestMessageDirection === "INBOUND" && request.latestMessageThreadId) return "Review reply";
  if (request.status === "PENDING_REVIEW") return "Review request";
  if (request.status === "APPROVED") return "Offer times";
  if (request.status === "SLOT_OFFERED") return "Wait for reply";
  if (request.status === "SCHEDULED") return "Confirm booking";
  return "No action needed";
}

function requestActionTone(request: AppointmentRequest) {
  if (request.status === "PENDING_REVIEW") return "warning";
  if (request.status === "APPROVED") return "booking";
  if (request.status === "SLOT_OFFERED") return "pending";
  if (request.status === "SCHEDULED") return "success";
  if (request.status === "DENIED") return "critical";
  return "neutral";
}

function requestStatusLabel(request: AppointmentRequest) {
  if (request.status === "PENDING_REVIEW") return "Needs review";
  if (request.status === "SLOT_OFFERED") return "Awaiting reply";
  if (request.status === "APPROVED") return "Ready to book";
  if (request.status === "SCHEDULED") return "Booked";
  if (request.status === "CLOSED" || request.status === "DENIED") return "Resolved";
  return "Request";
}

function requestWorkTypeLabel(request: AppointmentRequest) {
  if (request.status === "PENDING_REVIEW") return "Review";
  if (request.status === "APPROVED") return "Scheduling";
  if (request.status === "SLOT_OFFERED") return "Waiting on customer";
  if (request.status === "SCHEDULED") return "Booked work";
  if (request.status === "CLOSED" || request.status === "DENIED") return "Resolved";
  return "Request";
}

function requestQueueState(request: AppointmentRequest) {
  if (request.status === "PENDING_REVIEW") return "needs_review" as const;
  if (request.status === "APPROVED") return "ready_to_book" as const;
  if (request.status === "SLOT_OFFERED") return "awaiting_reply" as const;
  if (request.status === "SCHEDULED") return "booked" as const;
  return "closed" as const;
}

function requestQueueFilterLabel(value: (typeof requestQueueFilters)[number]) {
  switch (value) {
    case "needs_review":
      return "Needs review";
    case "ready_to_book":
      return "Ready to book";
    case "awaiting_reply":
      return "Awaiting reply";
    case "booked":
      return "Booked";
    case "closed":
      return "Resolved";
    default:
      return "All";
  }
}

function requestLatestMessageLabel(request: AppointmentRequest) {
  if (request.latestMessageDirection === "INBOUND") return "Customer replied";
  if (request.latestMessageDirection === "OUTBOUND") return "Office sent follow-up";
  return "No SMS follow-up yet";
}

function requestReplyWeight(request: AppointmentRequest) {
  if (request.latestMessageDirection === "INBOUND") return 0;
  if (request.latestMessageDirection === "OUTBOUND") return 1;
  return 2;
}

function requestOutcomeListNote(request: AppointmentRequest) {
  if (request.status === "SCHEDULED") return "Booked work already confirmed.";
  if (request.status === "CLOSED" || request.status === "DENIED") return "Handled and resolved by the office.";
  return null;
}

function requestOutcomeBadge(request: AppointmentRequest) {
  if (request.status === "SCHEDULED") return frontDeskOutcomeBadgeMeta("booked");
  if (request.status === "CLOSED" || request.status === "DENIED") return frontDeskOutcomeBadgeMeta("resolved");
  if (request.latestMessageDirection === "INBOUND") return frontDeskOutcomeBadgeMeta("saved");
  return null;
}

export default function AppAppointmentsPage() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const highlightedRequestId = searchParams.get("requestId") || "";
  const todayDateValue = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentRequests, setAppointmentRequests] = useState<AppointmentRequest[]>([]);
  const [requestQueueFilter, setRequestQueueFilter] = useState<(typeof requestQueueFilters)[number]>("ALL");
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
  const [requestSlotDates, setRequestSlotDates] = useState<Record<string, string>>({});
  const [requestAvailableSlots, setRequestAvailableSlots] = useState<Record<string, Array<{ startAt: string; endAt: string }>>>({});
  const [requestLoadingSlotsId, setRequestLoadingSlotsId] = useState<string | null>(null);
  const [requestCreatingSlotId, setRequestCreatingSlotId] = useState<string | null>(null);
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState("");
  const [calendarEvents, setCalendarEvents] = useState<OrgCalendarEvent[]>([]);
  const [slotDate, setSlotDate] = useState("");
  const [slotTimezone, setSlotTimezone] = useState("America/New_York");
  const [slotProvider, setSlotProvider] = useState<"INTERNAL" | "GOOGLE" | "OUTLOOK">("INTERNAL");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [issueSummary, setIssueSummary] = useState("");
  const [showDirectBooking, setShowDirectBooking] = useState(false);
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
          if (!next[request.id] && request.assignedUserId) {
            next[request.id] = request.assignedUserId;
          }
        }
        return next;
      });
      setRequestSlotDates((current) => {
        const next = { ...current };
        for (const request of requests) {
          if (next[request.id]) continue;
          if (request.requestedStartAt) {
            const requested = new Date(request.requestedStartAt);
            if (!Number.isNaN(requested.getTime())) {
              const year = requested.getFullYear();
              const month = String(requested.getMonth() + 1).padStart(2, "0");
              const day = String(requested.getDate()).padStart(2, "0");
              const requestedDateValue = `${year}-${month}-${day}`;
              next[request.id] = requestedDateValue < todayDateValue ? todayDateValue : requestedDateValue;
            }
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
  }, [showToast, todayDateValue]);

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
                activeMembers
                  .filter((member: TeamMember) => Boolean(member.user?.id))
                  .map((member: TeamMember) => ({
                    id: member.user?.id || "",
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
    if (slotDate < todayDateValue) {
      showToast({
        title: "Past dates are blocked",
        description: "Choose today or a future date.",
        variant: "error"
      });
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
        assignedUserId: requestTechnicianDrafts[request.id]?.trim() || null
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
    const assignedUserId = requestTechnicianDrafts[request.id]?.trim() || "";
    if (!assignedUserId) {
      showToast({
        title: "Select a technician",
        description: "Choose a technician before assigning this request.",
        variant: "error"
      });
      return;
    }
    setRequestSavingId(request.id);
    try {
      await assignAppointmentRequest(request.id, { assignedUserId });
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

  async function onFetchRequestSlots(request: AppointmentRequest) {
    const slotDateValue = requestSlotDates[request.id];
    if (!slotDateValue) {
      showToast({
        title: "Select a date",
        description: "Choose a target day before generating time slots.",
        variant: "error"
      });
      return;
    }
    if (slotDateValue < todayDateValue) {
      showToast({
        title: "Past dates are blocked",
        description: "Choose today or a future date for this request.",
        variant: "error"
      });
      return;
    }
    setRequestLoadingSlotsId(request.id);
    try {
      const from = new Date(`${slotDateValue}T00:00:00`);
      const to = new Date(`${slotDateValue}T23:59:59`);
      const data = await fetchAppointmentAvailability({
        from: from.toISOString(),
        to: to.toISOString()
      });
      setRequestAvailableSlots((current) => ({
        ...current,
        [request.id]: data.slots || []
      }));
      if (!(data.slots || []).length) {
        showToast({
          title: "No slots found",
          description: "No available times matched that day."
        });
      }
    } catch (error) {
      showToast({
        title: "Could not load slots",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
      setRequestAvailableSlots((current) => ({ ...current, [request.id]: [] }));
    } finally {
      setRequestLoadingSlotsId(null);
    }
  }

  async function onBookRequestSlot(request: AppointmentRequest, slot: { startAt: string; endAt: string }) {
    setRequestCreatingSlotId(`${request.id}:${slot.startAt}`);
    try {
      const assignedUserId = requestTechnicianDrafts[request.id]?.trim() || request.assignedUserId || "";
      const assignedTechnicianLabel =
        assignableTechnicians.find((tech) => tech.id === assignedUserId)?.label || request.assignedUserLabel || undefined;
      await createOrgAppointment({
        appointmentRequestId: request.id,
        leadId: request.leadId || undefined,
        callLogId: request.callLogId,
        customerName: request.customerName,
        customerPhone: request.followUpPhone || request.customerPhone,
        issueSummary: request.issueSummary,
        assignedTechnician: assignedTechnicianLabel,
        startAt: slot.startAt,
        endAt: slot.endAt,
        timezone: slotTimezone,
        calendarProvider: slotProvider,
        idempotencyKey: `request:${request.id}:${slot.startAt}:${slot.endAt}`
      });
      showToast({ title: "Appointment scheduled" });
      setRequestAvailableSlots((current) => ({ ...current, [request.id]: [] }));
      await Promise.all([load(status, fromDate, toDate), loadRequests()]);
    } catch (error) {
      showToast({
        title: "Could not schedule request",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setRequestCreatingSlotId(null);
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
    const priority = { PENDING_REVIEW: 0, APPROVED: 1, SLOT_OFFERED: 2, DENIED: 3, SCHEDULED: 4, CLOSED: 5 } as const;
    return (
      priority[a.status] - priority[b.status] ||
      requestReplyWeight(a) - requestReplyWeight(b) ||
      new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime()
    );
  });
  const pendingAppointmentRequests = sortedAppointmentRequests.filter((request) => request.status === "PENDING_REVIEW");
  const approvedAppointmentRequests = sortedAppointmentRequests.filter((request) => request.status === "APPROVED");
  const offeredAppointmentRequests = sortedAppointmentRequests.filter((request) => request.status === "SLOT_OFFERED");
  const scheduledAppointmentRequests = sortedAppointmentRequests.filter((request) => request.status === "SCHEDULED");
  const closedAppointmentRequests = sortedAppointmentRequests.filter((request) => request.status === "CLOSED");
  const deniedAppointmentRequests = sortedAppointmentRequests.filter((request) => request.status === "DENIED");
  const filteredAppointmentRequests =
    requestQueueFilter === "ALL"
      ? sortedAppointmentRequests
      : sortedAppointmentRequests.filter((request) => requestQueueState(request) === requestQueueFilter);
  const repliedAppointmentRequests = sortedAppointmentRequests.filter(
    (request) => request.latestMessageDirection === "INBOUND" && !["SCHEDULED", "DENIED", "CLOSED"].includes(request.status)
  );
  const nextFocusLabel =
    repliedAppointmentRequests.length > 0
      ? `${repliedAppointmentRequests.length} booking replies need review`
      : pendingAppointmentRequests.length > 0
      ? `${pendingAppointmentRequests.length} requests need a booking decision`
      : offeredAppointmentRequests.length > 0
        ? `${offeredAppointmentRequests.length} customers are waiting on a reply`
        : viewMode === "CALENDAR"
          ? "Review the schedule for conflicts"
          : "Review the appointment list";

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Scheduling workspace"
        title="Appointments"
        description="Review captured requests first, then manage the appointments already on the calendar."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={viewMode === "CALENDAR" ? "default" : "outline"}
              onClick={() => setViewMode("CALENDAR")}
            >
              Calendar
            </Button>
            <Button
              size="sm"
              variant={viewMode === "LIST" ? "default" : "outline"}
              onClick={() => setViewMode("LIST")}
            >
              List
            </Button>
          </div>
        }
      />

      <div className={frontDeskWorkspaceCardClass("hero")}>
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] 2xl:items-start">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace focus</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{nextFocusLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start with requests that need a decision, then switch to calendar or list view for schedule management.
              </p>
            </div>
            {!featureDisabled ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className={frontDeskMetricCardClass()}>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Needs review</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{pendingAppointmentRequests.length}</p>
                </div>
                <div className={frontDeskMetricCardClass()}>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer replied</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{repliedAppointmentRequests.length}</p>
                </div>
                <div className={frontDeskMetricCardClass()}>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">On calendar</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{appointments.length}</p>
                </div>
              </div>
            ) : null}
          </div>
          <div className={frontDeskContextPanelClass()}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">View filters</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3 2xl:grid-cols-1">
              <label className="text-sm">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span>
                <select
                  value={status}
                  onChange={(event) => {
                    const next = event.target.value as Appointment["status"] | "ALL";
                    setStatus(next);
                    void load(next, fromDate, toDate);
                  }}
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                >
                  <option value="ALL">All appointments</option>
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELED">Canceled</option>
                  <option value="NO_SHOW">No show</option>
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
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3"
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
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {featureDisabled ? (
        <div className="rounded-[22px] border border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.96)_0%,rgba(254,243,199,0.92)_100%)] p-4 text-sm text-amber-950 shadow-[0_12px_26px_rgba(217,119,6,0.12)]">
          Appointments are currently disabled for this workspace. Ask an admin to enable the feature flag for your org.
        </div>
      ) : null}

      {!featureDisabled ? (
        <div className={frontDeskWorkspaceCardClass("default")}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Appointment Requests</h2>
              <p className="text-sm text-muted-foreground">
                Review requests the assistant captured, offer times, and decide which ones need office follow-up.
              </p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {filteredAppointmentRequests.length} request{filteredAppointmentRequests.length === 1 ? "" : "s"}
            </span>
          </div>
          {sortedAppointmentRequests.length ? (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {requestQueueFilters.map((filter) => {
                  const count =
                    filter === "ALL"
                      ? sortedAppointmentRequests.length
                      : sortedAppointmentRequests.filter((request) => requestQueueState(request) === filter).length;
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setRequestQueueFilter(filter)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        requestQueueFilter === filter
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {requestQueueFilterLabel(filter)}{" "}
                      <span className="text-xs text-muted-foreground">{count}</span>
                    </button>
                  );
                })}
              </div>
              {([
                { key: "pending", title: "Pending review", items: pendingAppointmentRequests },
                { key: "approved", title: "Approved", items: approvedAppointmentRequests },
                { key: "offered", title: "Slot offered", items: offeredAppointmentRequests },
                { key: "scheduled", title: "Booked", items: scheduledAppointmentRequests },
                { key: "closed", title: "Resolved", items: closedAppointmentRequests },
                { key: "denied", title: "Denied", items: deniedAppointmentRequests }
              ] as const).map((section) =>
                section.items.filter((request) => requestQueueFilter === "ALL" || requestQueueState(request) === requestQueueFilter).length ? (
                  <div key={section.key} className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</h3>
                      <span className="text-xs text-muted-foreground">
                        {section.items.filter((request) => requestQueueFilter === "ALL" || requestQueueState(request) === requestQueueFilter).length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {section.items
                        .filter((request) => requestQueueFilter === "ALL" || requestQueueState(request) === requestQueueFilter)
                        .map((request) => {
                        const reviewTone =
                          request.status === "APPROVED"
                            ? "success"
                            : request.status === "DENIED"
                              ? "critical"
                              : request.status === "SLOT_OFFERED"
                                ? "pending"
                              : "warning";
                        const draftTechnician = requestTechnicianDrafts[request.id] ?? request.assignedUserId ?? "";
                        const requestSlotDate = requestSlotDates[request.id] || "";
                        const slotsForRequest = requestAvailableSlots[request.id] || [];
                          return (
                          <div
                            key={request.id}
                            className={`${frontDeskCardClass("default")} p-4 ${
                              request.status === "CLOSED" || request.status === "DENIED"
                                ? frontDeskOutcomeSurfaceClass("resolved")
                                : request.status === "SCHEDULED"
                                  ? frontDeskOutcomeSurfaceClass("booked")
                                  : request.latestMessageDirection === "INBOUND"
                                    ? frontDeskOutcomeSurfaceClass("saved")
                                    : frontDeskOutcomeSurfaceClass("active")
                            } ${
                              request.id === highlightedRequestId ? "border-primary ring-1 ring-primary/20 shadow-[0_10px_24px_rgba(31,58,138,0.08)]" : ""
                            }`}
                          >
                            <div className="flex flex-col gap-3 border-b pb-3 xl:flex-row xl:items-start xl:justify-between">
                              <div>
                                <h3 className="text-base font-semibold">{request.customerName}</h3>
                                <p className="text-sm text-muted-foreground">{request.effectiveSmsPhone}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${frontDeskActionBadgeClass(requestActionLabel(request))}`}>
                                    {requestActionLabel(request)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${clientBadgeClass(requestActionTone(request))}`}>
                                  {requestWorkTypeLabel(request)}
                                </span>
                                {request.latestMessageDirection === "INBOUND" ? (
                                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${clientBadgeClass("warning")}`}>
                                    Customer replied
                                  </span>
                                ) : null}
                                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${clientBadgeClass(reviewTone)}`}>
                                  {requestStatusLabel(request)}
                                </span>
                              </div>
                            </div>
                            <div className="mt-3 grid gap-4 2xl:grid-cols-[1.5fr_0.9fr]">
                              <div className="space-y-3 text-sm">
                                <div>
                                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Issue</span>
                                  <p className="mt-1 line-clamp-3 text-slate-900">{request.issueSummary}</p>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Requested On</span>
                                    <p className="mt-1">{new Date(request.startedAt).toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Requested For</span>
                                    <p className="mt-1">{request.requestedTimeLabel || "Not captured yet"}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Address</span>
                                    <p className="mt-1">{request.serviceAddress || "Not captured yet"}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Assigned</span>
                                    <p className="mt-1">{request.assignedUserLabel || "Unassigned"}</p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                  <span>State: {request.requestState}</span>
                                  <span>Next action: {requestActionLabel(request)}</span>
                                  <span>{requestLatestMessageLabel(request)}</span>
                                </div>
                                {requestOutcomeBadge(request) ? (
                                  <div className="flex flex-wrap gap-2">
                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${clientBadgeClass(requestOutcomeBadge(request)!.tone)}`}>
                                      {requestOutcomeBadge(request)!.label}
                                    </span>
                                  </div>
                                ) : null}
                                {requestOutcomeListNote(request) ? (
                                  <p className={`${frontDeskContextPanelClass()} text-xs text-muted-foreground`}>{requestOutcomeListNote(request)}</p>
                                ) : null}
                              </div>
                              <div className={`${frontDeskContextPanelClass()} space-y-3`}>
                                <div>
                                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Next office action</span>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${frontDeskActionBadgeClass(requestActionLabel(request))}`}>
                                      {requestActionLabel(request)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {request.latestMessageDirection === "INBOUND" && request.latestMessageThreadId
                                      ? "The customer already replied in text. Review the thread first, then finish the booking handoff."
                                      : request.status === "PENDING_REVIEW"
                                      ? "Review the request, assign the right technician, and decide whether to offer times."
                                      : request.status === "APPROVED"
                                        ? "Send slots or book directly while the request is still fresh."
                                        : request.status === "SLOT_OFFERED"
                                          ? "The customer has a slot offer. Follow up if they do not reply."
                                          : request.status === "SCHEDULED"
                                            ? "This request is already booked. Use the linked records only if the office needs to confirm the appointment details."
                                            : "This request is already resolved. No additional booking action is needed."}
                                  </p>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  SMS: {request.effectiveSmsPhone}
                                  {request.latestMessageAt ? ` • ${requestLatestMessageLabel(request)} ${new Date(request.latestMessageAt).toLocaleDateString()}` : ""}
                                </div>
                                <div className="space-y-2">
                                  <p className="page-eyebrow">Jump to follow-up</p>
                                  <div className="grid gap-2 sm:flex sm:flex-wrap">
                                    {request.effectiveSmsPhone ? (
                                      <Button asChild size="sm" variant={request.latestMessageDirection === "INBOUND" ? "default" : "outline"} className="w-full sm:w-auto">
                                        <Link
                                          href={
                                            request.latestMessageThreadId
                                              ? `/app/messages?threadId=${encodeURIComponent(request.latestMessageThreadId)}`
                                              : `/app/messages?contactPhone=${encodeURIComponent(request.effectiveSmsPhone)}`
                                          }
                                        >
                                          Open inbox
                                        </Link>
                                      </Button>
                                    ) : null}
                                    {request.leadId ? (
                                      <Button asChild size="sm" variant={!request.effectiveSmsPhone ? "default" : "outline"} className="w-full sm:w-auto">
                                        <Link href={`/app/leads?leadId=${encodeURIComponent(request.leadId)}`}>Open lead</Link>
                                      </Button>
                                    ) : null}
                                    <Button asChild size="sm" variant={request.effectiveSmsPhone || request.leadId ? "outline" : "default"} className="w-full sm:w-auto">
                                      <Link href={`/app/calls?callId=${encodeURIComponent(request.callLogId)}`}>Open call</Link>
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {canWrite && request.status !== "DENIED" && request.status !== "SCHEDULED" && request.status !== "CLOSED" ? (
                              <div className="mt-4 rounded-xl border bg-slate-50 p-4">
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
                                      <option key={tech.id} value={tech.id}>
                                        {tech.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <div className="mt-2 grid gap-2 sm:flex sm:flex-wrap">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full sm:w-auto"
                                    disabled={requestSavingId === request.id}
                                    onClick={() => void onAssignRequest(request)}
                                  >
                                    Assign
                                  </Button>
                                  <Button
                                    size="sm"
                                    disabled={requestSavingId === request.id}
                                    variant={request.status === "APPROVED" ? "outline" : "default"}
                                    className="w-full sm:w-auto"
                                    onClick={() => void onApproveRequest(request)}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full sm:w-auto"
                                    disabled={requestSavingId === request.id}
                                    onClick={() => void onDenyRequest(request)}
                                  >
                                    Deny
                                  </Button>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,220px)_auto] sm:items-end">
                                    <label className="min-w-[180px] flex-1 text-sm">
                                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Find schedule slots</span>
                                      <input
                                        type="date"
                                        className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                                        value={requestSlotDate}
                                        min={todayDateValue}
                                        onChange={(event) =>
                                          setRequestSlotDates((current) => ({
                                            ...current,
                                            [request.id]: event.target.value
                                          }))
                                        }
                                      />
                                    </label>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={requestLoadingSlotsId === request.id}
                                    onClick={() => void onFetchRequestSlots(request)}
                                  >
                                    {requestLoadingSlotsId === request.id ? "Loading..." : "Find slots"}
                                  </Button>
                                </div>
                                  {slotsForRequest.length ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {slotsForRequest.map((slot) => {
                                        const creatingKey = `${request.id}:${slot.startAt}`;
                                        return (
                                          <Button
                                            key={slot.startAt}
                                            size="sm"
                                            variant="outline"
                                            disabled={requestCreatingSlotId === creatingKey}
                                            onClick={() => void onBookRequestSlot(request, slot)}
                                          >
                                            {requestCreatingSlotId === creatingKey
                                              ? "Scheduling..."
                                              : new Date(slot.startAt).toLocaleTimeString([], {
                                                  hour: "numeric",
                                                  minute: "2-digit"
                                                })}
                                          </Button>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                              </div>
                            ) : null}
                          </div>
                          );
                        })}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          ) : (
            <p className={frontDeskEmptyStateClass()}>
              No booking requests are waiting yet. When a caller asks for an appointment, the request will appear here for review, slot offers, and confirmation.
            </p>
          )}
        </div>
      ) : null}

      {viewMode === "CALENDAR" ? (
        <div className={frontDeskWorkspaceCardClass("default")}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Appointments Calendar</h2>
              <p className="text-xs text-muted-foreground">Review scheduled work and outside calendar conflicts.</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
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
          {loading ? (
            <div className={`mt-3 ${frontDeskLoadingCardClass()}`}>
              <div className="space-y-3">
                <div className={frontDeskSkeletonLineClass("md")} />
                <div className={frontDeskSkeletonLineClass()} />
              </div>
            </div>
          ) : null}
          {loadingCalendarEvents ? (
            <div className={`mt-3 ${frontDeskLoadingCardClass()}`}>
              <div className="space-y-3">
                <div className={frontDeskSkeletonLineClass("sm")} />
                <div className={frontDeskSkeletonLineClass("lg")} />
              </div>
            </div>
          ) : null}
          {!loading && appointments.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No appointments are on the schedule yet. Confirmed bookings will appear here once the office starts placing jobs.</p> : null}
        </div>
      ) : (
        <div className={frontDeskWorkspaceCardClass("default")}>
          <div className="mb-3">
            <h2 className="text-base font-semibold">Appointments List</h2>
            <p className="text-xs text-muted-foreground">Review upcoming, completed, and canceled appointments in one list.</p>
          </div>
          <div className="overflow-x-auto">
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
                  <td className="p-3" colSpan={9}>
                    <div className={frontDeskLoadingCardClass()}>
                      <div className="space-y-3">
                        <div className={frontDeskSkeletonLineClass("md")} />
                        <div className={frontDeskSkeletonLineClass()} />
                        <div className={frontDeskSkeletonLineClass("lg")} />
                      </div>
                    </div>
                  </td>
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
                  <td className="p-3 text-muted-foreground" colSpan={9}>No appointments yet. Confirmed bookings will appear here once the office schedules work.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {canWrite && !featureDisabled ? (
        <div className={frontDeskWorkspaceCardClass("subtle")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Office Booking</p>
              <h2 className="mt-2 text-xl font-semibold">Book directly when you already have the details</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Use this when the office already knows the customer and just needs to place the appointment on the calendar.
              </p>
            </div>
            <Button size="sm" variant={showDirectBooking ? "outline" : "default"} onClick={() => setShowDirectBooking((current) => !current)}>
              {showDirectBooking ? "Hide booking form" : "Open booking form"}
            </Button>
          </div>
          {showDirectBooking ? (
            <>
          {customerBase.length > 0 ? (
            <label className="mt-4 block text-sm">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Select customer</span>
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
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            </label>
            <label className="text-sm">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Date</span>
              <input
                type="date"
                className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                value={slotDate}
                min={todayDateValue}
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
            {!canManageCalendar ? (
              <span className="text-xs text-muted-foreground">Google/Outlook booking is admin-managed in Assistant Settings.</span>
            ) : null}
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
            </>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed bg-slate-50 px-4 py-4 text-sm text-muted-foreground">
              Keep this closed until you need to manually place a job. The page stays easier to scan when booking is tucked away.
            </div>
          )}
        </div>
      ) : null}

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
