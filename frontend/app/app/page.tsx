"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  fetchAppointmentRequests,
  fetchOrgAnalytics,
  fetchOrgCalls,
  fetchOrgHealth,
  fetchOrgLeads,
  fetchOrgMessages,
  fetchOrgMessagingReadiness,
  fetchOrgNotifications,
  fetchOrgOnboarding,
  fetchOrgProfile
} from "@/lib/api";
import type {
  ActionNeededItem,
  AppointmentRequest,
  FrontDeskPriority,
  Lead,
  OrgAnalytics,
  OrgCallRecord,
  OrgHealth,
  OrgMessageThread,
  OrgMessagingReadiness,
  OrgNotification
} from "@/lib/types";
import { clientBadgeClass } from "@/lib/client-badges";
import { ActionNeededPanel } from "@/components/dashboard/action-needed-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { frontDeskActionBadgeClass, frontDeskOutcomeBadgeMeta, frontDeskPriorityBadgeClass, frontDeskPriorityMeta } from "@/lib/front-desk-ui";

type DashboardState = {
  assignedPhoneNumber: string | null;
  assignedNumberProvider: "TWILIO" | "VAPI" | null;
  health: OrgHealth | null;
  messagingReadiness: OrgMessagingReadiness | null;
  notifications: OrgNotification[];
  calls: OrgCallRecord[];
  leads: Lead[];
  threads: OrgMessageThread[];
  requests: AppointmentRequest[];
  analytics: OrgAnalytics | null;
};

function isToday(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function hoursSince(value: string | null | undefined) {
  if (!value) return null;
  const ms = Date.now() - new Date(value).getTime();
  return Number.isFinite(ms) ? ms / (1000 * 60 * 60) : null;
}

function formatShortTime(value: string | null | undefined) {
  if (!value) return "Time pending";
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatShortDateTime(value: string | null | undefined) {
  if (!value) return "Awaiting update";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).replace(",", " -");
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "Today";
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function healthCheckLabel(key: string) {
  switch (key) {
    case "callSuccessScore":
      return "Call outcomes need review";
    case "recentActivity":
      return "Recent activity looks low";
    case "callQualityAverage":
      return "Call quality needs review";
    case "slaDegradation":
      return "Response-time monitoring issue";
    default:
      return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  }
}

function healthFixPathLabel(path: string | undefined) {
  if (!path) return "Open the related workspace";
  switch (path) {
    case "/app/calls":
      return "Review recent calls";
    case "/app":
      return "Review the dashboard";
    case "/admin/events":
      return "Review system events";
    default:
      return `Open ${path}`;
  }
}

function notificationDetail(notification: OrgNotification) {
  const metadata =
    notification.metadataJson && typeof notification.metadataJson === "object" ? notification.metadataJson : null;
  const calendarFallbackDetail =
    metadata && typeof metadata.calendarFallbackDetail === "string" ? metadata.calendarFallbackDetail : "";
  if (notification.title === "Calendar booking fallback" && calendarFallbackDetail.trim()) {
    return calendarFallbackDetail.trim();
  }
  return notification.body;
}

function requestStatusLabel(status: AppointmentRequest["status"]) {
  switch (status) {
    case "SCHEDULED":
      return "Scheduled";
    case "SLOT_OFFERED":
      return "Offer sent";
    case "APPROVED":
      return "Ready to book";
    case "PENDING_REVIEW":
      return "Needs review";
    case "DENIED":
      return "Resolved";
    case "CLOSED":
      return "Resolved";
    default:
      return "Active";
  }
}

function requestStatusTone(status: AppointmentRequest["status"]) {
  switch (status) {
    case "SCHEDULED":
      return "success" as const;
    case "SLOT_OFFERED":
      return "booking" as const;
    case "APPROVED":
    case "PENDING_REVIEW":
      return "pending" as const;
    default:
      return "neutral" as const;
  }
}

function bookingActionLabel(request: AppointmentRequest) {
  if (request.status === "PENDING_REVIEW") return "Review request";
  if (request.status === "APPROVED") return "Offer times";
  if (request.status === "SLOT_OFFERED") return "Wait for reply";
  if (request.status === "SCHEDULED") return "Confirm booking";
  return "No action needed";
}

function outcomeLabel(outcome: OrgCallRecord["outcome"]) {
  switch (outcome) {
    case "APPOINTMENT_REQUEST":
      return "Request captured";
    case "MESSAGE_TAKEN":
      return "Message taken";
    case "TRANSFERRED":
      return "Transferred";
    case "ABANDONED":
      return "Abandoned";
    case "MISSED":
      return "Missed call";
    case "SPAM":
      return "Spam";
    default:
      return "Call";
  }
}

function outcomeTone(outcome: OrgCallRecord["outcome"]) {
  switch (outcome) {
    case "APPOINTMENT_REQUEST":
      return "booking" as const;
    case "MESSAGE_TAKEN":
      return "manual" as const;
    case "TRANSFERRED":
      return "automated" as const;
    case "ABANDONED":
      return "warning" as const;
    case "MISSED":
      return "warning" as const;
    case "SPAM":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

function healthTone(level: OrgHealth["level"] | null | undefined) {
  switch (level) {
    case "RED":
      return {
        dot: "status-dot-critical",
        badge: "critical",
        label: "Needs attention"
      } as const;
    case "YELLOW":
      return {
        dot: "status-dot-warning",
        badge: "warning",
        label: "Watch closely"
      } as const;
    default:
      return {
        dot: "status-dot-success",
        badge: "success",
        label: "Live"
      } as const;
  }
}

function bookingPriority(request: AppointmentRequest) {
  switch (request.status) {
    case "SCHEDULED":
      return 0;
    case "SLOT_OFFERED":
      return 1;
    case "PENDING_REVIEW":
      return 2;
    case "APPROVED":
      return 3;
    default:
      return 4;
  }
}

function summarizeLead(lead: Lead) {
  return lead.frontDesk?.summary || lead.serviceRequested || lead.message || lead.classification?.replaceAll("_", " ").toLowerCase() || "New customer inquiry";
}

function frontDeskSeverity(priority: FrontDeskPriority | undefined): ActionNeededItem["severity"] {
  if (priority === "urgent") return "critical";
  if (priority === "high") return "warning";
  return "info";
}

function frontDeskPriorityWeight(priority: FrontDeskPriority | undefined) {
  if (priority === "urgent") return 0;
  if (priority === "high") return 1;
  if (priority === "normal") return 2;
  return 3;
}

function priorityBadge(priority: FrontDeskPriority | undefined) {
  return frontDeskPriorityMeta(priority);
}

function frontDeskStateWeight(state: "needs_follow_up" | "contacted" | "booked" | "closed" | "spam" | undefined | null) {
  if (state === "needs_follow_up") return 0;
  if (state === "contacted") return 1;
  if (state === "booked") return 2;
  if (state === "closed") return 3;
  if (state === "spam") return 4;
  return 1;
}

function followUpLabel(state: OrgCallRecord["frontDesk"] | Lead["frontDesk"] | undefined) {
  const value = state ? ("followUpState" in state ? state.followUpState : state.state) : null;
  switch (value) {
    case "needs_follow_up":
      return "Needs follow-up";
    case "contacted":
      return "Contacted";
    case "booked":
      return "Booked";
    case "closed":
      return "Resolved";
    case "spam":
      return "Spam";
    default:
      return "Open";
  }
}

function threadStateBadge(thread: OrgMessageThread) {
  const state = thread.frontDesk || thread.lead?.frontDesk;
  switch (state?.state) {
    case "needs_follow_up":
      return { label: "Needs follow-up", tone: "warning" as const };
    case "contacted":
      return { label: "Contacted", tone: "pending" as const };
    case "booked":
      return { label: "Booked", tone: "booking" as const };
    case "closed":
      return { label: "Resolved", tone: "success" as const };
    case "spam":
      return { label: "Spam", tone: "neutral" as const };
    default:
      return { label: "Open", tone: "neutral" as const };
  }
}

function latestThreadDirection(thread: OrgMessageThread) {
  const latestMessage = [...(thread.messages || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
  if (!latestMessage) return "No recent messages";
  return latestMessage.direction === "INBOUND" ? "Customer replied" : "Office sent follow-up";
}

function latestCallDirection(call: OrgCallRecord) {
  if (String(call.recoverySmsResponse || "").trim()) return "Customer replied";
  if (call.recoverySmsSentAt) return "Office sent recovery text";
  if (call.frontDesk?.followUpState === "contacted") return "Office sent follow-up";
  return "No follow-up movement yet";
}

function overviewCallActionLabel(call: OrgCallRecord) {
  if (String(call.recoverySmsResponse || "").trim() && call.recoverySmsThreadId) return "Review reply";
  return call.frontDesk?.recommendedAction || "Review request";
}

function overviewLeadActionLabel(lead: Lead) {
  if (lead.latestAppointmentRequestId && lead.latestMessageThreadId && lead.frontDesk?.needsFollowUp) {
    return "Review reply";
  }
  return lead.frontDesk?.recommendedAction || "Review request";
}

function overviewThreadActionLabel(thread: OrgMessageThread) {
  if (thread.latestAppointmentRequestId && latestThreadDirection(thread) === "Customer replied") {
    return "Review reply";
  }
  return (thread.frontDesk || thread.lead?.frontDesk)?.recommendedAction || "Review thread";
}

function overviewCallOutcomeNote(call: OrgCallRecord) {
  if (call.frontDesk?.followUpState === "booked") return "Booked work already confirmed.";
  if (call.frontDesk?.followUpState === "closed") return "Handled and resolved by the office.";
  if (call.recoverySmsResponse) return "Saved missed call with a live text reply.";
  if (call.recoverySmsSentAt) return "Missed-call recovery is already in motion.";
  return null;
}

function overviewThreadOutcomeNote(thread: OrgMessageThread) {
  const state = (thread.frontDesk || thread.lead?.frontDesk)?.state;
  if (state === "booked") return "Booked work already confirmed.";
  if (state === "closed") return "Handled and resolved by the office.";
  if (latestThreadDirection(thread) === "Customer replied") return "Live customer reply waiting in the inbox.";
  return null;
}

function overviewBookingOutcomeNote(request: AppointmentRequest) {
  if (request.status === "SCHEDULED") return "Booked work already confirmed.";
  if (request.latestMessageDirection === "INBOUND") return "Customer replied and the booking handoff is active.";
  return null;
}

function overviewBookingOutcomeBadge(request: AppointmentRequest) {
  if (request.status === "SCHEDULED") return frontDeskOutcomeBadgeMeta("booked");
  if (request.latestMessageDirection === "INBOUND") return frontDeskOutcomeBadgeMeta("saved");
  return null;
}

function overviewCallOutcomeBadge(call: OrgCallRecord) {
  if (call.frontDesk?.followUpState === "booked") return frontDeskOutcomeBadgeMeta("booked");
  if (call.frontDesk?.followUpState === "closed") return frontDeskOutcomeBadgeMeta("resolved");
  if (call.recoverySmsResponse) return frontDeskOutcomeBadgeMeta("saved");
  return null;
}

function overviewThreadOutcomeBadge(thread: OrgMessageThread) {
  const state = (thread.frontDesk || thread.lead?.frontDesk)?.state;
  if (state === "booked") return frontDeskOutcomeBadgeMeta("booked");
  if (state === "closed") return frontDeskOutcomeBadgeMeta("resolved");
  if (latestThreadDirection(thread) === "Customer replied") return frontDeskOutcomeBadgeMeta("saved");
  return null;
}

export default function AppOverviewPage() {
  const [state, setState] = useState<DashboardState>({
    assignedPhoneNumber: null,
    assignedNumberProvider: null,
    health: null,
    messagingReadiness: null,
    notifications: [],
    calls: [],
    leads: [],
    threads: [],
    requests: [],
    analytics: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void Promise.all([
      fetchOrgProfile(),
      fetchOrgOnboarding(),
      fetchOrgHealth(),
      fetchOrgMessagingReadiness(),
      fetchOrgNotifications(),
      fetchOrgCalls({ page: 1, pageSize: 25 }),
      fetchOrgLeads(),
      fetchOrgMessages(),
      fetchAppointmentRequests(),
      fetchOrgAnalytics({ range: "7d" })
    ])
      .then(([profile, , health, messagingReadiness, notifications, calls, leads, messages, requests, analytics]) => {
        if (!active) return;
        setState({
          assignedPhoneNumber: profile.assignedPhoneNumber,
          assignedNumberProvider: profile.assignedNumberProvider,
          health,
          messagingReadiness,
          notifications: notifications.notifications || [],
          calls: calls.calls || [],
          leads: leads.leads || [],
          threads: messages.threads || [],
          requests: requests.requests || [],
          analytics
        });
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load today's dashboard.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const scheduledRequests = useMemo(
    () =>
      state.requests
        .filter((request) => request.status === "SCHEDULED")
        .sort((a, b) => new Date(a.requestedStartAt || a.lastEventAt).getTime() - new Date(b.requestedStartAt || b.lastEventAt).getTime()),
    [state.requests]
  );

  const scheduledWithConfidence = useMemo(
    () => scheduledRequests.filter((request) => Boolean(request.requestedStartAt || request.requestedTimeLabel)),
    [scheduledRequests]
  );

  const bookingBoardItems = useMemo(() => {
    if (scheduledWithConfidence.length > 0) {
      return scheduledWithConfidence.slice(0, 4);
    }

    return [...state.requests]
      .filter((request) => ["SCHEDULED", "SLOT_OFFERED", "PENDING_REVIEW", "APPROVED"].includes(request.status))
      .sort((a, b) => {
        const priority = bookingPriority(a) - bookingPriority(b);
        if (priority !== 0) return priority;
        return new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime();
      })
      .slice(0, 4);
  }, [scheduledWithConfidence, state.requests]);

  const scheduleTitle = scheduledWithConfidence.length > 0 ? "Today's schedule" : "Today's booking board";
  const scheduleDescription =
    scheduledWithConfidence.length > 0
      ? "Confirmed appointments and booked work that shape the day."
      : "No confirmed schedule is available yet. These customers are closest to being booked next.";

  const actionItems = useMemo<ActionNeededItem[]>(() => {
    const items: ActionNeededItem[] = [];

    for (const call of state.calls.filter((item) => item.frontDesk?.needsFollowUp)) {
      const hasRecoveryReply = Boolean(call.recoverySmsThreadId && call.recoverySmsResponse);
      items.push({
        id: `call-${call.id}`,
        type: "NEEDS_FOLLOW_UP",
        severity: frontDeskSeverity(call.frontDesk?.frontDeskPriority),
        label: hasRecoveryReply
          ? `Customer replied: ${call.frontDesk?.callerName || call.displayName || call.fromNumber}`
          : `${call.frontDesk?.recommendedAction}: ${call.frontDesk?.callerName || call.displayName || call.fromNumber}`,
        detail: hasRecoveryReply
          ? call.recoverySmsResponse || call.frontDesk?.summary || "Customer replied to the recovery text."
          : call.frontDesk?.summary || "Customer request still needs office follow-up.",
        href: hasRecoveryReply
          ? `/app/messages?threadId=${encodeURIComponent(call.recoverySmsThreadId || "")}`
          : `/app/calls?callId=${encodeURIComponent(call.id)}`,
        ctaLabel: hasRecoveryReply ? "Open inbox" : "Open call",
        timestamp: hasRecoveryReply ? call.recoverySmsSentAt || call.startedAt : call.startedAt,
        sourceModule: hasRecoveryReply ? "messages" : "conversations"
      });
    }

    for (const lead of state.leads.filter((item) => item.frontDesk?.needsFollowUp)) {
      items.push({
        id: `lead-${lead.id}`,
        type: "NEEDS_FOLLOW_UP",
        severity: frontDeskSeverity(lead.frontDesk?.frontDeskPriority),
        label: `${overviewLeadActionLabel(lead)}: ${lead.name || lead.phone || "New lead"}`,
        detail: summarizeLead(lead),
        href: `/app/leads?leadId=${encodeURIComponent(lead.id)}`,
        ctaLabel: "Open lead",
        timestamp: lead.frontDesk?.lastActivityAt || lead.updatedAt,
        sourceModule: "leads"
      });
    }

    for (const thread of state.threads.filter((item) => (item.frontDesk || item.lead?.frontDesk)?.needsFollowUp)) {
      const frontDesk = thread.frontDesk || thread.lead?.frontDesk;
      items.push({
        id: `thread-${thread.id}`,
        type: "NEEDS_FOLLOW_UP",
        severity: frontDeskSeverity(frontDesk?.frontDeskPriority),
        label: `${overviewThreadActionLabel(thread)}: ${thread.contactName || thread.lead?.name || thread.contactPhone}`,
        detail: frontDesk?.summary || thread.messages?.[0]?.body || "Customer reply needs review.",
        href: `/app/messages?threadId=${encodeURIComponent(thread.id)}`,
        ctaLabel: "Open thread",
        timestamp: thread.lastMessageAt,
        sourceModule: "messages"
      });
    }

    for (const request of state.requests
      .filter((item) => item.status === "SLOT_OFFERED")
      .sort((a, b) => new Date(a.lastEventAt).getTime() - new Date(b.lastEventAt).getTime())) {
      if (request.latestMessageDirection === "INBOUND") continue;
      if ((hoursSince(request.lastEventAt) || 0) < 24) continue;
      items.push({
        id: `offer-${request.id}`,
        type: "NEEDS_FOLLOW_UP",
        severity: "warning",
        label: `${request.customerName || "Customer"} has not replied to an offered time`,
        detail: "Follow up and confirm whether the appointment slot still works.",
        href: `/app/appointments?requestId=${encodeURIComponent(request.id)}`,
        ctaLabel: "Open booking",
        timestamp: request.lastEventAt,
        sourceModule: "appointments"
      });
    }

    for (const call of state.calls.filter((item) => !item.frontDesk && (item.outcome === "MISSED" || item.outcome === "ABANDONED" || item.unansweredTransfer))) {
      items.push({
        id: `missed-${call.id}`,
        type: "NEEDS_FOLLOW_UP",
        severity: "warning",
        label: `${call.outcome === "ABANDONED" ? "Abandoned call" : call.unansweredTransfer ? "Unanswered transfer" : "Missed call"} from ${call.displayName || call.fromNumber}`,
        detail: call.unansweredTransfer ? "Follow up because the transfer did not connect." : "Call back and help them get scheduled.",
        href: `/app/calls?callId=${encodeURIComponent(call.id)}`,
        ctaLabel: "Open call",
        timestamp: call.startedAt,
        sourceModule: "conversations"
      });
    }

    for (const request of state.requests.filter((item) => item.status === "PENDING_REVIEW")) {
      items.push({
        id: `review-${request.id}`,
        type: "NEEDS_REVIEW",
        severity: "warning",
        label:
          request.latestMessageDirection === "INBOUND"
            ? `${request.customerName || "Customer"} replied about booking`
            : `${request.customerName || "Customer"} needs request review`,
        detail:
          request.latestMessageDirection === "INBOUND"
            ? "The customer replied in text. Review the thread and finish the booking handoff."
            : "Review the booking request and offer the next available time.",
        href:
          request.latestMessageDirection === "INBOUND" && request.latestMessageThreadId
            ? `/app/messages?threadId=${encodeURIComponent(request.latestMessageThreadId)}`
            : `/app/appointments?requestId=${encodeURIComponent(request.id)}`,
        ctaLabel: request.latestMessageDirection === "INBOUND" && request.latestMessageThreadId ? "Open inbox" : "Open booking",
        timestamp: request.latestMessageAt || request.lastEventAt,
        sourceModule: request.latestMessageDirection === "INBOUND" && request.latestMessageThreadId ? "messages" : "appointments"
      });
    }

    if (state.messagingReadiness && state.messagingReadiness.state !== "A2P_REGISTERED") {
      items.push({
        id: "messaging-blocker",
        type: "NEEDS_FIX",
        severity: state.messagingReadiness.state === "A2P_BLOCKED" ? "critical" : "warning",
        label: "Messaging issue may block customer replies",
        detail: "Check messaging setup before follow-up texts are affected.",
        href: "/app/settings",
        ctaLabel: "Open settings",
        timestamp: null,
        sourceModule: "messages"
      });
    }

    if (state.health && state.health.level !== "GREEN") {
      items.push({
        id: "system-health",
        type: "NEEDS_FIX",
        severity: state.health.level === "RED" ? "critical" : "warning",
        label: state.health.summary,
        detail: "Review system health details and clear anything blocking customers.",
        href: "/app",
        ctaLabel: "Open dashboard",
        timestamp: state.health.metrics.recentActivityAt,
        sourceModule: "system"
      });
    }

    for (const notification of state.notifications.filter((item) => !item.readAt)) {
      const isCalendarFallback = notification.title === "Calendar booking fallback";
      items.push({
        id: `notification-${notification.id}`,
        type: notification.severity === "URGENT" ? "NEEDS_FIX" : "NEEDS_FOLLOW_UP",
        severity: notification.severity === "URGENT" ? "critical" : notification.severity === "ACTION_REQUIRED" ? "warning" : "info",
        label: notification.title,
        detail: notificationDetail(notification),
        href: isCalendarFallback ? "/app/settings" : "/app/calls",
        ctaLabel: isCalendarFallback ? "Open settings" : "Open calls",
        timestamp: notification.createdAt,
        sourceModule: notification.type === "NEW_LEAD_CAPTURED" ? "leads" : notification.type === "APPOINTMENT_BOOKED" ? "appointments" : "system"
      });
    }

    return items
      .sort((a, b) => {
        const severityWeight = { critical: 0, warning: 1, info: 2 };
        const severityDelta = severityWeight[a.severity] - severityWeight[b.severity];
        if (severityDelta !== 0) return severityDelta;
        return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
      })
      .slice(0, 4);
  }, [state.calls, state.health, state.leads, state.messagingReadiness, state.notifications, state.requests, state.threads]);

  const customerActionCount = useMemo(
    () => actionItems.filter((item) => item.sourceModule !== "system").length,
    [actionItems]
  );

  const systemActionCount = useMemo(
    () => actionItems.filter((item) => item.sourceModule === "system").length,
    [actionItems]
  );

  const frontDeskLeadQueue = useMemo(
    () =>
      [...state.leads]
        .filter((lead) => lead.frontDesk?.needsFollowUp)
        .sort((a, b) => {
          const priorityDelta = frontDeskPriorityWeight(a.frontDesk?.frontDeskPriority) - frontDeskPriorityWeight(b.frontDesk?.frontDeskPriority);
          if (priorityDelta !== 0) return priorityDelta;
          return new Date(b.frontDesk?.lastActivityAt || b.updatedAt).getTime() - new Date(a.frontDesk?.lastActivityAt || a.updatedAt).getTime();
        }),
    [state.leads]
  );

  const openRequests = useMemo(
    () => state.requests.filter((request) => ["PENDING_REVIEW", "APPROVED", "SLOT_OFFERED"].includes(request.status)),
    [state.requests]
  );

  const todayAppointmentsCount = useMemo(() => {
    const explicitlyToday = scheduledWithConfidence.filter((request) => isToday(request.requestedStartAt)).length;
    return explicitlyToday || scheduledWithConfidence.length;
  }, [scheduledWithConfidence]);

  const newLeadsToday = useMemo(() => state.leads.filter((lead) => isToday(lead.createdAt)).length, [state.leads]);
  const callsToday = useMemo(() => state.calls.filter((call) => isToday(call.startedAt)).length, [state.calls]);

  const recentCalls = useMemo(
    () =>
      [...state.calls]
        .sort((a, b) => {
          const stateDelta = frontDeskStateWeight(a.frontDesk?.followUpState) - frontDeskStateWeight(b.frontDesk?.followUpState);
          if (stateDelta !== 0) return stateDelta;
          const priorityDelta = frontDeskPriorityWeight(a.frontDesk?.frontDeskPriority) - frontDeskPriorityWeight(b.frontDesk?.frontDeskPriority);
          if (priorityDelta !== 0) return priorityDelta;
          return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
        })
        .slice(0, 4),
    [state.calls]
  );

  const callbackQueue = useMemo(
    () =>
      [...state.calls]
        .filter((call) => call.frontDesk?.recommendedAction === "Call back now")
        .sort((a, b) => {
          const priorityDelta = frontDeskPriorityWeight(a.frontDesk?.frontDeskPriority) - frontDeskPriorityWeight(b.frontDesk?.frontDeskPriority);
          if (priorityDelta !== 0) return priorityDelta;
          return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
        })
        .slice(0, 4),
    [state.calls]
  );

  const recentMessageThreads = useMemo(
    () =>
      [...state.threads]
        .sort((a, b) => {
          const stateDelta =
            frontDeskStateWeight((a.frontDesk || a.lead?.frontDesk)?.state) -
            frontDeskStateWeight((b.frontDesk || b.lead?.frontDesk)?.state);
          if (stateDelta !== 0) return stateDelta;
          const priorityDelta = frontDeskPriorityWeight((a.frontDesk || a.lead?.frontDesk)?.frontDeskPriority) -
            frontDeskPriorityWeight((b.frontDesk || b.lead?.frontDesk)?.frontDeskPriority);
          if (priorityDelta !== 0) return priorityDelta;
          return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        })
        .slice(0, 4),
    [state.threads]
  );

  const newRequestsAndLeads = useMemo(() => {
    const requestItems = openRequests.slice(0, 3).map((request) => ({
      id: `request-${request.id}`,
      kind: "request" as const,
      title: request.customerName || "Customer request",
      meta: request.requestedTimeLabel || request.requestedPreference || formatShortDate(request.lastEventAt),
      sourceLabel: request.latestMessageDirection === "INBOUND" ? "Booking reply" : "Booking request",
      badge: requestStatusLabel(request.status),
      badgeTone: requestStatusTone(request.status),
      summary: request.issueSummary || "Appointment request waiting for review.",
      href:
        request.latestMessageDirection === "INBOUND" && request.latestMessageThreadId
          ? `/app/messages?threadId=${encodeURIComponent(request.latestMessageThreadId)}`
          : `/app/appointments?requestId=${encodeURIComponent(request.id)}`,
      ctaLabel: request.latestMessageDirection === "INBOUND" && request.latestMessageThreadId ? "Open inbox" : "Open booking request"
    }));

    const leadItems = [...frontDeskLeadQueue]
      .slice(0, Math.max(0, 4 - requestItems.length))
      .map((lead) => ({
      id: `lead-${lead.id}`,
      kind: "lead" as const,
      title: lead.name || lead.business || "New lead",
      meta: lead.phone || formatShortDate(lead.createdAt),
      sourceLabel: lead.frontDesk?.recommendedAction === "Call back now" ? "Callback lead" : "Open lead",
      badge: followUpLabel(lead.frontDesk),
      badgeTone:
        lead.frontDesk?.frontDeskPriority === "urgent"
          ? ("critical" as const)
          : lead.frontDesk?.frontDeskPriority === "high"
            ? ("warning" as const)
            : ("neutral" as const),
      summary: summarizeLead(lead),
      href: `/app/leads?leadId=${encodeURIComponent(lead.id)}`,
      ctaLabel: "Open lead follow-up"
      }));

    return [...requestItems, ...leadItems].slice(0, 4);
  }, [frontDeskLeadQueue, openRequests]);

  const callbackCount = useMemo(
    () => state.calls.filter((call) => call.frontDesk?.recommendedAction === "Call back now").length,
    [state.calls]
  );

  const savedMissedCallCount = useMemo(
    () =>
      state.calls.filter(
        (call) =>
          (call.outcome === "MISSED" || call.outcome === "ABANDONED" || Boolean(call.unansweredTransfer)) &&
          Boolean(call.recoverySmsSentAt || call.recoverySmsResponse || call.frontDesk?.followUpState === "contacted" || call.frontDesk?.followUpState === "booked")
      ).length,
    [state.calls]
  );

  const bookedOutcomeCount = useMemo(
    () =>
      state.requests.filter((request) => request.status === "SCHEDULED").length +
      state.leads.filter((lead) => lead.frontDesk?.state === "booked").length,
    [state.leads, state.requests]
  );

  const runtimeHealth = state.health?.runtimeHealth || state.health;
  const readiness = state.health?.readiness || null;
  const healthStateFromRuntime = healthTone(runtimeHealth?.level);
  const systemHealthMessage =
    runtimeHealth?.level === "GREEN" ? "All services operational" : runtimeHealth?.summary || "Review the system health details.";
  const failingHealthChecks = useMemo(
    () => Object.entries(runtimeHealth?.checks || {}).filter(([, check]) => !check.ok),
    [runtimeHealth]
  );

  const answerRate = state.analytics?.kpis.answerRate ?? 0;

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Front desk"
          title="Today"
          description="Today's active follow-up work, saved missed calls, and booked jobs."
          actions={
            <>
              <Button asChild>
                <Link href="/app/appointments">Open Schedule</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/app/settings">Update Settings</Link>
              </Button>
            </>
          }
        />
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Front desk"
        title="Today"
        description="Today's active follow-up work, saved missed calls, and booked jobs."
        actions={
          <>
            <Button asChild>
              <Link href="/app/appointments">Open Schedule</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/appointments">Review Requests</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/app/calls">Review Calls</Link>
            </Button>
          </>
        }
      />

      <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#0f172a_100%)] p-4 text-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Today at a glance</p>
            <p className="mt-2 text-sm text-slate-100">{loading ? "Loading today's schedule..." : `${todayAppointmentsCount} appointments on the board today`}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Needs attention now</p>
            <p className="mt-2 text-sm text-slate-100">
              {loading ? "Checking follow-up queue..." : `${customerActionCount} active customer items need action now`}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Callbacks and missed-call rescue</p>
            <p className="mt-2 text-sm text-slate-100">{loading ? "Reviewing callback and rescue work..." : `${callbackCount} callbacks pending, ${savedMissedCallCount} saved missed calls`}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.9fr)]">
        <Card className="border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
          <CardHeader>
            <CardTitle className="text-slate-950">{scheduleTitle}</CardTitle>
            <CardDescription className="text-slate-600">{scheduleDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="grid gap-3">
                {[0, 1, 2].map((item) => (
                    <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    {"Loading today's booking board..."}
                  </div>
                ))}
              </div>
            ) : bookingBoardItems.length ? (
              <>
                <div className="space-y-3">
                  {bookingBoardItems.map((item) => (
                    <Link
                      key={item.id}
                      href={
                        item.latestMessageDirection === "INBOUND" && item.latestMessageThreadId
                          ? `/app/messages?threadId=${encodeURIComponent(item.latestMessageThreadId)}`
                          : `/app/appointments?requestId=${encodeURIComponent(item.id)}`
                      }
                      className="block rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:bg-slate-50"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-slate-950">{item.customerName || "Customer"}</p>
                          <p className="text-sm text-slate-700">
                            {item.issueSummary || "Appointment details are waiting to be confirmed."}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.requestedTimeLabel || item.requestedPreference || `Updated ${formatShortDateTime(item.lastEventAt)}`}
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${frontDeskActionBadgeClass(bookingActionLabel(item))}`}>
                              {bookingActionLabel(item)}
                            </span>
                            {overviewBookingOutcomeBadge(item) ? (
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${clientBadgeClass(overviewBookingOutcomeBadge(item)!.tone)}`}>
                                {overviewBookingOutcomeBadge(item)!.label}
                              </span>
                            ) : null}
                          </div>
                          {overviewBookingOutcomeNote(item) ? (
                            <p className="text-xs text-slate-500">{overviewBookingOutcomeNote(item)}</p>
                          ) : null}
                          {item.latestMessageDirection === "INBOUND" ? (
                            <p className="text-xs text-slate-500">Customer replied in text</p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className={clientBadgeClass(requestStatusTone(item.status))}>{requestStatusLabel(item.status)}</Badge>
                          <span className="text-sm font-medium text-slate-900">
                            {item.requestedStartAt ? formatShortTime(item.requestedStartAt) : item.requestedTimeLabel || "Time pending"}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="pt-1">
                  <Button asChild variant="ghost" className="px-0 text-primary hover:bg-transparent hover:text-primary/90">
                    <Link href="/app/appointments">
                      View full schedule
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                No booking work is scheduled yet. Confirmed appointments and near-ready booking requests will appear here for the office to act on.
              </div>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <Card className="border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-slate-950">Needs attention</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Loading follow-up tasks...
              </div>
            </CardContent>
          </Card>
        ) : (
          <ActionNeededPanel items={actionItems} className="border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_16px_34px_rgba(15,23,42,0.08)]" />
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle>Needs callback</CardTitle>
              <CardDescription>Open callback work that still needs a live office response.</CardDescription>
            </div>
            <Button asChild variant="ghost" className="shrink-0">
              <Link href="/app/calls">Open call queue</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="rounded-xl border border-border/90 bg-muted/25 px-4 py-4 text-sm text-muted-foreground">
                Loading callback queue...
              </div>
            ) : callbackQueue.length ? (
              callbackQueue.map((call) => (
                <Link
                  key={call.id}
                  href={
                    call.recoverySmsThreadId && call.recoverySmsResponse
                      ? `/app/messages?threadId=${encodeURIComponent(call.recoverySmsThreadId)}`
                      : `/app/calls?callId=${encodeURIComponent(call.id)}`
                  }
                  className="block rounded-xl border border-border/90 bg-muted/18 px-4 py-3 transition-colors hover:bg-muted/28"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-foreground">{call.frontDesk?.callerName || call.displayName || call.fromNumber}</p>
                      <p className="text-xs text-muted-foreground">{formatShortDateTime(call.startedAt)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={frontDeskPriorityBadgeClass(call.frontDesk?.frontDeskPriority)}>
                        {priorityBadge(call.frontDesk?.frontDeskPriority).label}
                      </Badge>
                      <Badge className={clientBadgeClass(call.frontDesk?.frontDeskPriority === "urgent" ? "critical" : "warning")}>
                        {call.frontDesk?.frontDeskPriority === "urgent" ? "Urgent callback" : "Callback needed"}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${frontDeskActionBadgeClass(call.recoverySmsThreadId && call.recoverySmsResponse ? "Review reply" : "Call back now")}`}>
                      {call.recoverySmsThreadId && call.recoverySmsResponse ? "Review reply" : "Call back now"}
                    </span>
                    {overviewCallOutcomeBadge(call) ? (
                      <Badge className={clientBadgeClass(overviewCallOutcomeBadge(call)!.tone)}>{overviewCallOutcomeBadge(call)!.label}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-foreground/85">
                    {call.frontDesk?.summary || "Customer request still needs a callback."}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{call.frontDesk?.serviceRequested || outcomeLabel(call.outcome)}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span>{call.frontDesk?.urgency || "Standard priority"}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span>{call.recoverySmsResponse ? "Recovery reply received" : call.recoverySmsSentAt ? "Recovery text sent" : "No recovery text sent"}</span>
                  </div>
                  {overviewCallOutcomeNote(call) ? (
                    <p className="mt-2 rounded-xl border bg-white/60 px-3 py-2 text-xs text-muted-foreground">{overviewCallOutcomeNote(call)}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {call.leadId ? (
                      <span className="rounded-full border px-2.5 py-1 text-xs font-medium text-foreground/75">Lead linked</span>
                    ) : null}
                    {call.recoverySmsThreadId ? (
                      <span className="rounded-full border px-2.5 py-1 text-xs font-medium text-foreground/75">Inbox thread linked</span>
                    ) : null}
                    <span className="rounded-full border px-2.5 py-1 text-xs font-medium text-foreground/75">
                      {call.recoverySmsThreadId && call.recoverySmsResponse ? "Open inbox" : "Open call"}
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="empty-state">
                No callback work is waiting right now. Missed calls and urgent requests will appear here when the office needs to respond quickly.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle>New requests</CardTitle>
              <CardDescription>Fresh customer work that still needs office review or booking follow-up.</CardDescription>
            </div>
            <Button asChild variant="ghost" className="shrink-0">
              <Link href="/app/leads">Open leads</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="rounded-xl border border-border/90 bg-muted/25 px-4 py-4 text-sm text-muted-foreground">
                Loading new requests and leads...
              </div>
            ) : newRequestsAndLeads.length ? (
              newRequestsAndLeads.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="block rounded-xl border border-border/90 bg-muted/18 px-4 py-3 transition-colors hover:bg-muted/28"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.meta}</p>
                    </div>
                    <Badge className={clientBadgeClass(item.badgeTone)}>{item.badge}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${frontDeskActionBadgeClass(item.ctaLabel === "Open booking" ? "Review request" : item.ctaLabel === "Open inbox" ? "Review reply" : "Review request")}`}>
                      {item.ctaLabel === "Open booking" ? "Review request" : item.ctaLabel === "Open inbox" ? "Review reply" : "Review request"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-foreground/85">{item.summary}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.sourceLabel}</p>
                  <p className="mt-2 text-xs font-medium text-foreground/80">
                    {item.ctaLabel}
                  </p>
                </Link>
              ))
            ) : (
              <div className="empty-state">
                No new requests are waiting right now. Fresh web leads, missed-call recoveries, and open callback work will appear here as they come in.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle>Missed calls and recent conversations</CardTitle>
              <CardDescription>Structured intake first, then the next action your office should take.</CardDescription>
            </div>
            <Button asChild variant="ghost" className="shrink-0">
              <Link href="/app/calls">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="rounded-xl border border-border/90 bg-muted/25 px-4 py-4 text-sm text-muted-foreground">
                Loading recent customer conversations...
              </div>
            ) : recentCalls.length ? (
              recentCalls.map((call) => (
                (() => {
                  const priority = priorityBadge(call.frontDesk?.frontDeskPriority);
                  return (
                <Link
                  key={call.id}
                  href={`/app/calls?callId=${encodeURIComponent(call.id)}`}
                  className="block rounded-xl border border-border/90 bg-muted/18 px-4 py-3 transition-colors hover:bg-muted/28"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-foreground">{call.frontDesk?.callerName || call.displayName || call.fromNumber}</p>
                      <p className="text-xs text-muted-foreground">{formatShortDateTime(call.startedAt)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={frontDeskPriorityBadgeClass(call.frontDesk?.frontDeskPriority)}>{priority.label}</Badge>
                      <Badge
                        className={clientBadgeClass(
                          call.frontDesk?.frontDeskPriority === "urgent"
                            ? "critical"
                            : call.frontDesk?.frontDeskPriority === "high"
                              ? "warning"
                              : outcomeTone(call.outcome)
                        )}
                      >
                        {followUpLabel(call.frontDesk)}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${frontDeskActionBadgeClass(overviewCallActionLabel(call))}`}>
                      {overviewCallActionLabel(call)}
                    </span>
                    {overviewCallOutcomeBadge(call) ? (
                      <Badge className={clientBadgeClass(overviewCallOutcomeBadge(call)!.tone)}>{overviewCallOutcomeBadge(call)!.label}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-foreground/85">
                    {call.frontDesk?.summary || call.aiSummary || call.summary || "Conversation summary will appear here after the call is processed."}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{call.frontDesk?.serviceRequested || outcomeLabel(call.outcome)}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span>{call.frontDesk?.urgency || "Standard priority"}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span>{latestCallDirection(call)}</span>
                  </div>
                  {overviewCallOutcomeNote(call) ? (
                    <p className="mt-2 rounded-xl border bg-white/60 px-3 py-2 text-xs text-muted-foreground">{overviewCallOutcomeNote(call)}</p>
                  ) : null}
                </Link>
                  );
                })()
              ))
            ) : (
              <div className="empty-state">
                When a call is handled or missed, this area shows the structured summary, urgency, and the next office action.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle>Recent customer messages</CardTitle>
              <CardDescription>Live SMS replies and follow-up threads tied to active customer work.</CardDescription>
            </div>
            <Button asChild variant="ghost" className="shrink-0">
              <Link href="/app/messages">Open inbox</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="rounded-xl border border-border/90 bg-muted/25 px-4 py-4 text-sm text-muted-foreground">
                Loading recent messages...
              </div>
            ) : recentMessageThreads.length ? (
              recentMessageThreads.map((thread) => {
                const badge = threadStateBadge(thread);
                const frontDesk = thread.frontDesk || thread.lead?.frontDesk;
                const priority = priorityBadge(frontDesk?.frontDeskPriority);
                const latestMessage = thread.messages?.[0]?.body || "Open the thread to review the latest message.";
                return (
                  <Link
                    key={thread.id}
                    href={`/app/messages?threadId=${encodeURIComponent(thread.id)}`}
                    className="block rounded-xl border border-border/90 bg-muted/18 px-4 py-3 transition-colors hover:bg-muted/28"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-foreground">{thread.contactName || thread.lead?.name || thread.contactPhone}</p>
                        <p className="text-xs text-muted-foreground">{formatShortDateTime(thread.lastMessageAt)}</p>
                      </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge className={frontDeskPriorityBadgeClass(frontDesk?.frontDeskPriority)}>{priority.label}</Badge>
                        <Badge className={clientBadgeClass(badge.tone)}>{badge.label}</Badge>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${frontDeskActionBadgeClass(overviewThreadActionLabel(thread))}`}>
                        {overviewThreadActionLabel(thread)}
                      </span>
                      {overviewThreadOutcomeBadge(thread) ? (
                        <Badge className={clientBadgeClass(overviewThreadOutcomeBadge(thread)!.tone)}>{overviewThreadOutcomeBadge(thread)!.label}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-foreground/85">
                      {frontDesk?.summary || latestMessage}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{latestThreadDirection(thread)}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span>{thread.contactPhone}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span>{formatShortDateTime(thread.lastMessageAt)}</span>
                    </div>
                    {overviewThreadOutcomeNote(thread) ? (
                      <p className="mt-2 rounded-xl border bg-white/60 px-3 py-2 text-xs text-muted-foreground">{overviewThreadOutcomeNote(thread)}</p>
                    ) : null}
                  </Link>
                );
              })
            ) : (
              <div className="empty-state">
                No customer replies are waiting right now. Recovery texts and live SMS conversations will appear here when the office needs to respond.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <p className="page-eyebrow">Business snapshot</p>
          <p className="text-sm text-muted-foreground">Supportive context for the day. These numbers should not compete with the booking board.</p>
        </div>
        <div className="metric-grid">
          <Card>
            <CardContent className="space-y-2 pt-5 sm:pt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Calls Today</p>
              <p className="text-3xl font-semibold tracking-tight text-foreground">{callsToday}</p>
              <p className="text-sm text-muted-foreground">{loading ? "Loading activity..." : callsToday === 0 ? "No calls yet today" : "Last 24 hours"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 pt-5 sm:pt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">New Leads</p>
              <p className="text-3xl font-semibold tracking-tight text-foreground">{newLeadsToday}</p>
              <p className="text-sm text-muted-foreground">{loading ? "Loading leads..." : newLeadsToday === 0 ? "No new leads captured" : "Captured today"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 pt-5 sm:pt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Active Follow-Up</p>
              <p className="text-3xl font-semibold tracking-tight text-foreground">{customerActionCount}</p>
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading requests..." : customerActionCount === 0 ? "No live customer work waiting" : "Open customer work waiting now"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 pt-5 sm:pt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">System Alerts</p>
              <p className="text-3xl font-semibold tracking-tight text-foreground">{systemActionCount}</p>
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading alerts..." : systemActionCount === 0 ? "No active system blockers" : "Configuration or runtime items to review"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 pt-5 sm:pt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Answer Rate</p>
              <p className="text-3xl font-semibold tracking-tight text-foreground">{formatPercent(answerRate)}</p>
              <p className="text-sm text-muted-foreground">{loading ? "Loading reporting..." : "Answered calls divided by total calls in the current reporting window"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 pt-5 sm:pt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Saved Missed Calls</p>
              <p className="text-3xl font-semibold tracking-tight text-foreground">
                {loading ? "-" : `${savedMissedCallCount}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading recovery..." : savedMissedCallCount === 0 ? "No missed-call recoveries yet" : "Missed or abandoned calls that still produced follow-up value"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 pt-5 sm:pt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Booked Outcomes</p>
              <p className="text-3xl font-semibold tracking-tight text-foreground">{loading ? "-" : `${bookedOutcomeCount}`}</p>
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading bookings..." : bookedOutcomeCount === 0 ? "No booked work yet" : "Requests and leads already moved into booked work"}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <Card className="bg-muted/18">
          <CardHeader>
            <CardTitle>System health</CardTitle>
            <CardDescription>Support information for the front desk and booking workflow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className={clientBadgeClass(healthStateFromRuntime.badge)}>
                <span className={`status-dot ${healthStateFromRuntime.dot}`} />
                {healthStateFromRuntime.label}
              </Badge>
              <p className="text-sm text-muted-foreground">{systemHealthMessage}</p>
            </div>
            {failingHealthChecks.length ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700">Checks needing review</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {failingHealthChecks.slice(0, 6).map(([key, check]) => (
                    <div key={key} className="rounded-lg border border-rose-200 bg-white px-3 py-3">
                      <p className="text-sm font-semibold text-rose-950">{healthCheckLabel(key)}</p>
                      <p className="mt-1 text-sm text-rose-900">{check.reason}</p>
                      <p className="mt-1 text-xs text-rose-700">{healthFixPathLabel(check.fixHint)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border/90 bg-background px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">System Status</p>
                <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className={`status-dot ${healthStateFromRuntime.dot}`} />
                  {healthStateFromRuntime.label}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{systemHealthMessage}</p>
              </div>
              <div className="rounded-xl border border-border/90 bg-background px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Phone Number</p>
                <p className="mt-3 text-sm font-semibold text-foreground">{state.assignedPhoneNumber || "Not assigned"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{state.assignedNumberProvider || "Phone setup pending"}</p>
              </div>
              <div className="rounded-xl border border-border/90 bg-background px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Messaging</p>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {state.messagingReadiness?.state === "A2P_REGISTERED" ? "A2P registered" : state.messagingReadiness?.state === "A2P_PENDING" ? "Registration pending" : "Needs setup"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {state.messagingReadiness?.state === "A2P_REGISTERED" ? "No blockers" : "Review messaging setup"}
                </p>
              </div>
              <div className="rounded-xl border border-border/90 bg-background px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Readiness</p>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {readiness?.level === "READY" ? "Ready" : readiness?.level === "NEEDS_ACTION" ? "Minor follow-up" : "Setup incomplete"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {readiness?.summary || "Setup status unavailable"}
                </p>
              </div>
              <div className="rounded-xl border border-border/90 bg-background px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Last Synced</p>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {runtimeHealth?.metrics.recentActivityAt ? formatShortTime(runtimeHealth.metrics.recentActivityAt) : "Awaiting sync"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {runtimeHealth?.metrics.recentActivityAt ? formatShortDate(runtimeHealth.metrics.recentActivityAt) : loading ? "Checking now" : "No recent activity"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
