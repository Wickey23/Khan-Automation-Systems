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
  fetchOrgMessagingReadiness,
  fetchOrgNotifications,
  fetchOrgOnboarding,
  fetchOrgProfile
} from "@/lib/api";
import type {
  ActionNeededItem,
  AppointmentRequest,
  Lead,
  OrgAnalytics,
  OrgCallRecord,
  OrgHealth,
  OrgMessagingReadiness,
  OrgNotification
} from "@/lib/types";
import { clientBadgeClass } from "@/lib/client-badges";
import { ActionNeededPanel } from "@/components/dashboard/action-needed-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";

type DashboardState = {
  assignedPhoneNumber: string | null;
  assignedNumberProvider: "TWILIO" | "VAPI" | null;
  health: OrgHealth | null;
  messagingReadiness: OrgMessagingReadiness | null;
  notifications: OrgNotification[];
  calls: OrgCallRecord[];
  leads: Lead[];
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
      return "Closed";
    case "CLOSED":
      return "Closed";
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
  return lead.serviceRequested || lead.message || lead.classification?.replaceAll("_", " ").toLowerCase() || "New customer inquiry";
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
      fetchAppointmentRequests(),
      fetchOrgAnalytics({ range: "7d" })
    ])
      .then(([profile, , health, messagingReadiness, notifications, calls, leads, requests, analytics]) => {
        if (!active) return;
        setState({
          assignedPhoneNumber: profile.assignedPhoneNumber,
          assignedNumberProvider: profile.assignedNumberProvider,
          health,
          messagingReadiness,
          notifications: notifications.notifications || [],
          calls: calls.calls || [],
          leads: leads.leads || [],
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

    for (const request of state.requests
      .filter((item) => item.status === "SLOT_OFFERED")
      .sort((a, b) => new Date(a.lastEventAt).getTime() - new Date(b.lastEventAt).getTime())) {
      if ((hoursSince(request.lastEventAt) || 0) < 24) continue;
      items.push({
        id: `offer-${request.id}`,
        type: "NEEDS_FOLLOW_UP",
        severity: "warning",
        label: `${request.customerName || "Customer"} has not replied to an offered time`,
        detail: "Follow up and confirm whether the appointment slot still works.",
        href: "/app/appointments",
        timestamp: request.lastEventAt,
        sourceModule: "appointments"
      });
    }

    for (const call of state.calls.filter((item) => item.outcome === "MISSED" || item.outcome === "ABANDONED" || item.unansweredTransfer)) {
      items.push({
        id: `missed-${call.id}`,
        type: "NEEDS_FOLLOW_UP",
        severity: "warning",
        label: `${call.outcome === "ABANDONED" ? "Abandoned call" : call.unansweredTransfer ? "Unanswered transfer" : "Missed call"} from ${call.displayName || call.fromNumber}`,
        detail: call.unansweredTransfer ? "Follow up because the transfer did not connect." : "Call back and help them get scheduled.",
        href: "/app/calls",
        timestamp: call.startedAt,
        sourceModule: "conversations"
      });
    }

    for (const request of state.requests.filter((item) => item.status === "PENDING_REVIEW")) {
      items.push({
        id: `review-${request.id}`,
        type: "NEEDS_REVIEW",
        severity: "warning",
        label: `${request.customerName || "Customer"} needs request review`,
        detail: "Review the booking request and offer the next available time.",
        href: "/app/appointments",
        timestamp: request.lastEventAt,
        sourceModule: "appointments"
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
  }, [state.calls, state.health, state.messagingReadiness, state.notifications, state.requests]);

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
    () => [...state.calls].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 4),
    [state.calls]
  );

  const newRequestsAndLeads = useMemo(() => {
    const requestItems = openRequests.slice(0, 3).map((request) => ({
      id: `request-${request.id}`,
      kind: "request" as const,
      title: request.customerName || "Customer request",
      meta: request.requestedTimeLabel || request.requestedPreference || formatShortDate(request.lastEventAt),
      badge: requestStatusLabel(request.status),
      badgeTone: requestStatusTone(request.status),
      summary: request.issueSummary || "Appointment request waiting for review."
    }));

    const leadItems = [...state.leads]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, Math.max(0, 4 - requestItems.length))
      .map((lead) => ({
      id: `lead-${lead.id}`,
      kind: "lead" as const,
      title: lead.name || lead.business || "New lead",
      meta: lead.phone || formatShortDate(lead.createdAt),
      badge: "Lead",
      badgeTone: "neutral" as const,
      summary: summarizeLead(lead)
      }));

    return [...requestItems, ...leadItems].slice(0, 4);
  }, [openRequests, state.leads]);

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
          description="Today's schedule, customers waiting for follow-up, and new requests."
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
        description="Today's schedule, customers waiting for follow-up, and new requests."
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Follow-up</p>
            <p className="mt-2 text-sm text-slate-100">{loading ? "Checking follow-up queue..." : `${actionItems.length} items need attention right now`}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Requests waiting</p>
            <p className="mt-2 text-sm text-slate-100">{loading ? "Reviewing incoming requests..." : `${openRequests.length} new requests are ready for review`}</p>
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
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-slate-950">{item.customerName || "Customer"}</p>
                          <p className="text-sm text-slate-700">
                            {item.issueSummary || "Appointment details are waiting to be confirmed."}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.requestedTimeLabel || item.requestedPreference || `Updated ${formatShortDateTime(item.lastEventAt)}`}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className={clientBadgeClass(requestStatusTone(item.status))}>{requestStatusLabel(item.status)}</Badge>
                          <span className="text-sm font-medium text-slate-900">
                            {item.requestedStartAt ? formatShortTime(item.requestedStartAt) : item.requestedTimeLabel || "Time pending"}
                          </span>
                        </div>
                      </div>
                    </div>
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
                No appointments scheduled today yet. New booking requests will appear here.
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
              <CardTitle>New requests and open leads</CardTitle>
              <CardDescription>The customers most likely to become {"today's"} next bookings.</CardDescription>
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
                <div key={item.id} className="rounded-xl border border-border/90 bg-muted/18 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.meta}</p>
                    </div>
                    <Badge className={clientBadgeClass(item.badgeTone)}>{item.badge}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-foreground/85">{item.summary}</p>
                </div>
              ))
            ) : (
              <div className="empty-state">No leads or requests need attention right now.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle>Recent customer conversations</CardTitle>
              <CardDescription>The latest customer calls handled by the front desk workflow.</CardDescription>
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
                <div key={call.id} className="rounded-xl border border-border/90 bg-muted/18 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-foreground">{call.displayName || call.fromNumber}</p>
                      <p className="text-xs text-muted-foreground">{formatShortDateTime(call.startedAt)}</p>
                    </div>
                    <Badge className={clientBadgeClass(outcomeTone(call.outcome))}>{outcomeLabel(call.outcome)}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-foreground/85">
                    {call.aiSummary || call.summary || "Conversation summary will appear here after the call is processed."}
                  </p>
                </div>
              ))
            ) : (
              <div className="empty-state">No calls yet today.</div>
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Open Requests</p>
              <p className="text-3xl font-semibold tracking-tight text-foreground">{openRequests.length}</p>
              <p className="text-sm text-muted-foreground">{loading ? "Loading requests..." : openRequests.length === 0 ? "Nothing waiting for review" : "Pending follow-up"}</p>
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">AI Rescue Rate</p>
              <p className="text-3xl font-semibold tracking-tight text-foreground">
                {loading ? "-" : `${state.analytics?.kpis.rescuedCalls ?? 0}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading rescue rate..." : `${formatPercent(state.analytics?.kpis.aiRescueRate ?? 0)} of AI-handled calls produced follow-up value`}
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
                      <p className="text-sm font-semibold text-rose-950">{key}</p>
                      <p className="mt-1 text-sm text-rose-900">{check.reason}</p>
                      <p className="mt-1 text-xs text-rose-700">Fix path: {check.fixHint}</p>
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
