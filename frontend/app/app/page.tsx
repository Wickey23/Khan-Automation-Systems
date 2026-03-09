"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, PhoneCall, ShieldCheck, Sparkles } from "lucide-react";
import {
  fetchAppointmentRequests,
  fetchOrgAnalytics,
  fetchOrgCalls,
  fetchOrgHealth,
  fetchOrgLeads,
  fetchOrgMessagingReadiness,
  fetchOrgNotifications,
  fetchOrgOnboarding,
  fetchOrgProfile,
  getBillingStatus
} from "@/lib/api";
import type {
  ActionNeededItem,
  AppointmentRequest,
  Lead,
  OnboardingSubmission,
  Organization,
  OrgAnalytics,
  OrgCallRecord,
  OrgHealth,
  OrgMessagingReadiness,
  OrgNotification,
  OrgSubscription
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { ActionNeededPanel } from "@/components/dashboard/action-needed-panel";
import { clientBadgeClass } from "@/lib/client-badges";

function isToday(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function hoursSince(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}

function outcomeLabel(outcome: string | null | undefined) {
  if (!outcome) return "Conversation";
  if (outcome === "APPOINTMENT_REQUEST") return "Request Captured";
  if (outcome === "TRANSFERRED") return "Transferred";
  if (outcome === "MESSAGE_TAKEN") return "Follow-Up Sent";
  if (outcome === "MISSED") return "Needs Review";
  return outcome.replaceAll("_", " ");
}

function requestStatusLabel(status: AppointmentRequest["status"]) {
  switch (status) {
    case "PENDING_REVIEW":
      return "Request Captured";
    case "SLOT_OFFERED":
      return "Awaiting Reply";
    case "SCHEDULED":
      return "Scheduled";
    case "APPROVED":
      return "Slot Offered";
    case "DENIED":
      return "Closed";
    default:
      return status.replaceAll("_", " ");
  }
}

function workspaceStateLabel(organization: Organization | null, subscription: OrgSubscription | null) {
  const billingActive = subscription ? ["active", "trialing"].includes(String(subscription.status || "").toLowerCase()) : false;
  if (organization?.live && billingActive) return "Live";
  if (organization?.live) return "Live (billing inactive)";
  if (billingActive) return "Provisioning";
  return "Setup in progress";
}

function metricTone(value: number | null | undefined) {
  if (value === null || value === undefined) return "neutral";
  if (value === 0) return "neutral";
  return "success";
}

function MetricCard({
  title,
  hint,
  value,
  accent
}: {
  title: string;
  hint: string;
  value: string | number;
  accent?: "success" | "warning" | "critical" | "neutral";
}) {
  return (
    <Card className="border-slate-200 shadow-none">
      <CardHeader className="space-y-0 pb-2">
        <CardTitle className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {title}
          <InfoHint text={hint} />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end justify-between gap-3">
          <p className="text-4xl font-semibold tracking-tight text-slate-950">{value}</p>
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              accent === "critical"
                ? "bg-rose-500"
                : accent === "warning"
                  ? "bg-amber-500"
                  : accent === "success"
                    ? "bg-emerald-500"
                    : "bg-slate-300"
            }`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AppOverviewPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [submission, setSubmission] = useState<OnboardingSubmission | null>(null);
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState<string | null>(null);
  const [assignedNumberProvider, setAssignedNumberProvider] = useState<"TWILIO" | "VAPI" | null>(null);
  const [health, setHealth] = useState<OrgHealth | null>(null);
  const [messagingReadiness, setMessagingReadiness] = useState<OrgMessagingReadiness | null>(null);
  const [notifications, setNotifications] = useState<OrgNotification[]>([]);
  const [calls, setCalls] = useState<OrgCallRecord[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    void Promise.allSettled([
      fetchOrgProfile(),
      fetchOrgOnboarding(),
      getBillingStatus(),
      fetchOrgHealth(),
      fetchOrgMessagingReadiness(),
      fetchOrgNotifications(),
      fetchOrgCalls({ page: 1, pageSize: 25 }),
      fetchOrgLeads(),
      fetchAppointmentRequests(),
      fetchOrgAnalytics({ range: "7d" })
    ]).then((results) => {
      const [org, onboarding, billing, orgHealth, orgMessagingReadiness, orgNotifications, orgCalls, orgLeads, appointmentRequests, orgAnalytics] = results;

      if (org.status === "fulfilled") {
        setOrganization(org.value.organization);
        setAssignedPhoneNumber(org.value.assignedPhoneNumber);
        setAssignedNumberProvider(org.value.assignedNumberProvider);
      }
      if (onboarding.status === "fulfilled") setSubmission(onboarding.value.submission);
      if (billing.status === "fulfilled") setSubscription(billing.value.subscription);
      if (orgHealth.status === "fulfilled") setHealth(orgHealth.value);
      if (orgMessagingReadiness.status === "fulfilled") setMessagingReadiness(orgMessagingReadiness.value);
      if (orgNotifications.status === "fulfilled") setNotifications(orgNotifications.value.notifications || []);
      if (orgCalls.status === "fulfilled") setCalls(orgCalls.value.calls || []);
      if (orgLeads.status === "fulfilled") setLeads(orgLeads.value.leads || []);
      if (appointmentRequests.status === "fulfilled") setRequests(appointmentRequests.value.requests || []);
      if (orgAnalytics.status === "fulfilled") setAnalytics(orgAnalytics.value);
      setLastSyncedAt(new Date().toISOString());
    });
  }, []);

  const todayCalls = useMemo(() => calls.filter((call) => isToday(call.startedAt)).length, [calls]);
  const todayLeads = useMemo(() => leads.filter((lead) => isToday(lead.createdAt)).length, [leads]);
  const todayRequests = useMemo(() => requests.filter((request) => isToday(request.createdAt)).length, [requests]);

  const recentConversations = useMemo(() => calls.slice(0, 4), [calls]);
  const openLeads = useMemo(
    () =>
      leads
        .filter((lead) => lead.status !== "WON" && lead.status !== "LOST")
        .slice(0, 4),
    [leads]
  );
  const awaitingReplyRequests = useMemo(
    () => requests.filter((request) => request.status === "SLOT_OFFERED").slice(0, 4),
    [requests]
  );

  const actionItems = useMemo<ActionNeededItem[]>(() => {
    const items: ActionNeededItem[] = [];

    notifications
      .filter((item) => !item.readAt)
      .slice(0, 3)
      .forEach((notification) => {
        items.push({
          id: `notification-${notification.id}`,
          type: notification.severity === "URGENT" ? "NEEDS_FIX" : "NEEDS_REVIEW",
          severity:
            notification.severity === "URGENT"
              ? "critical"
              : notification.severity === "ACTION_REQUIRED"
                ? "warning"
                : "info",
          label: notification.title,
          href: notification.type === "APPOINTMENT_BOOKED" ? "/app/appointments" : "/app/messages",
          timestamp: notification.createdAt,
          sourceModule: notification.type === "APPOINTMENT_BOOKED" ? "appointments" : "system"
        });
      });

    requests
      .filter((request) => request.status === "PENDING_REVIEW")
      .slice(0, 2)
      .forEach((request) => {
        items.push({
          id: `request-review-${request.id}`,
          type: "NEEDS_REVIEW",
          severity: "warning",
          label: `${request.customerName || "Unknown caller"} needs request review`,
          href: "/app/appointments",
          timestamp: request.createdAt,
          sourceModule: "appointments"
        });
      });

    requests
      .filter((request) => request.status === "SLOT_OFFERED" && hoursSince(request.lastEventAt) > 24)
      .slice(0, 2)
      .forEach((request) => {
        items.push({
          id: `request-followup-${request.id}`,
          type: "NEEDS_FOLLOW_UP",
          severity: "warning",
          label: `${request.customerName || "Customer"} has not replied to the slot offer`,
          href: "/app/appointments",
          timestamp: request.lastEventAt,
          sourceModule: "appointments"
        });
      });

    calls
      .filter((call) => call.outcome === "MISSED")
      .slice(0, 2)
      .forEach((call) => {
        items.push({
          id: `missed-${call.id}`,
          type: "NEEDS_FOLLOW_UP",
          severity: "warning",
          label: `Missed call from ${call.displayName || call.fromNumber || "unknown caller"} needs follow-up`,
          href: "/app/calls",
          timestamp: call.startedAt,
          sourceModule: "conversations"
        });
      });

    if (messagingReadiness?.state && messagingReadiness.state !== "A2P_REGISTERED") {
      items.push({
        id: "messaging-readiness",
        type: "NEEDS_FIX",
        severity: messagingReadiness.state === "A2P_BLOCKED" ? "critical" : "warning",
        label: `Messaging readiness is ${messagingReadiness.state.replaceAll("_", " ").toLowerCase()}`,
        href: "/app/billing",
        timestamp: lastSyncedAt,
        sourceModule: "system"
      });
    }

    if (health?.level && health.level !== "GREEN") {
      items.push({
        id: "system-health",
        type: "NEEDS_FIX",
        severity: health.level === "RED" ? "critical" : "warning",
        label: health.summary || "System health needs attention",
        href: "/app",
        timestamp: lastSyncedAt,
        sourceModule: "system"
      });
    }

    return items.slice(0, 8);
  }, [calls, health, lastSyncedAt, messagingReadiness, notifications, requests]);

  const workspaceState = workspaceStateLabel(organization, subscription);
  const aiAnswerRate = analytics ? Math.round(analytics.kpis.answerRate * 100) : null;
  const missedRecoveries = analytics?.kpis.missedCallsRecovered ?? analytics?.kpis.autoRecoveryLeadConversions ?? 0;
  const bookedRequests = requests.filter((request) => request.status === "SCHEDULED").length;
  const openRequestCount = requests.filter((request) => request.status !== "SCHEDULED" && request.status !== "DENIED").length;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="border-slate-200 bg-white shadow-none">
          <CardContent className="flex flex-col gap-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  Client Overview
                </div>
                <div>
                  <h1 className="text-4xl font-semibold tracking-tight text-slate-950">Overview</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    See what happened today, what the assistant captured, and what needs attention next.
                  </p>
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 lg:inline-flex">
                <ShieldCheck className="h-3.5 w-3.5" />
                {workspaceState}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Link
                href="/app/calls"
                className="inline-flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-95"
              >
                Review Conversations
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/app/appointments"
                className="inline-flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
              >
                Review Requests
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </Link>
              <Link
                href="/app/settings"
                className="inline-flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
              >
                Update Business Hours
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-slate-950 text-white shadow-none">
          <CardContent className="flex h-full flex-col justify-between gap-5 p-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">System Status</p>
              <p className="text-2xl font-semibold tracking-tight">{workspaceState}</p>
              <p className="text-sm leading-6 text-slate-300">
                {health?.summary || "Health checks are available and the workspace is ready for review."}
              </p>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-300">Assigned Number</p>
                <p className="mt-1 font-medium text-white">{assignedPhoneNumber || "Not assigned"}</p>
                <p className="text-xs text-slate-400">{assignedNumberProvider || "No provider yet"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-300">Messaging</p>
                <p className="mt-1 font-medium text-white">{messagingReadiness?.state || "Unknown"}</p>
                <p className="text-xs text-slate-400">
                  {messagingReadiness?.reasons?.[0] || "No active blockers detected."}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Last synced: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : "Syncing..."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard title="Calls Today" hint="Calls logged today from the recent conversation feed." value={todayCalls} accent={metricTone(todayCalls)} />
        <MetricCard title="Leads Captured" hint="New leads created today." value={todayLeads} accent={metricTone(todayLeads)} />
        <MetricCard title="Requests Captured" hint="New appointment requests captured today." value={todayRequests} accent={metricTone(todayRequests)} />
        <MetricCard
          title="Missed Call Recoveries"
          hint="Recovered missed calls based on the current analytics window."
          value={missedRecoveries}
          accent={metricTone(missedRecoveries)}
        />
        <MetricCard
          title="AI Answer Rate"
          hint="Answer rate from the current analytics window."
          value={aiAnswerRate !== null ? `${aiAnswerRate}%` : "Unavailable"}
          accent={aiAnswerRate !== null && aiAnswerRate < 70 ? "warning" : "success"}
        />
        <MetricCard
          title="Open Attention Items"
          hint="Operational exceptions that need review, follow-up, or a fix."
          value={actionItems.length}
          accent={actionItems.length > 0 ? "warning" : "success"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]">
        <div className="grid gap-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-none">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-950">Recent Conversations</CardTitle>
                    <p className="mt-1 text-sm text-slate-500">Latest customer activity handled by the assistant.</p>
                  </div>
                  <Link href="/app/calls" className="text-xs font-medium text-primary hover:underline">
                    View all
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentConversations.length ? (
                  recentConversations.map((call) => (
                    <div key={call.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{call.displayName || call.fromNumber}</p>
                          <p className="text-xs text-slate-500">{new Date(call.startedAt).toLocaleString()}</p>
                        </div>
                        <Badge className={clientBadgeClass(call.outcome === "MISSED" ? "warning" : call.outcome === "APPOINTMENT_REQUEST" ? "booking" : "neutral")}>
                          {outcomeLabel(call.outcome)}
                        </Badge>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                        {call.aiSummary || call.summary || "No summary available yet."}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    No recent conversations yet.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-none">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-950">Open Leads</CardTitle>
                    <p className="mt-1 text-sm text-slate-500">New opportunities that still need follow-up.</p>
                  </div>
                  <Link href="/app/leads" className="text-xs font-medium text-primary hover:underline">
                    View all
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {openLeads.length ? (
                  openLeads.map((lead) => (
                    <div key={lead.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{lead.name}</p>
                          <p className="text-xs text-slate-500">{lead.phone || lead.email || "No contact info"}</p>
                        </div>
                        <Badge className={clientBadgeClass(lead.status === "NEW" ? "pending" : lead.status === "QUALIFIED" ? "success" : "neutral")}>
                          {lead.status === "NEW" ? "New" : lead.status === "QUALIFIED" ? "Qualified" : lead.status}
                        </Badge>
                      </div>
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                        {lead.serviceRequested || lead.message || "No service details yet."}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    No open leads at the moment.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <Card className="border-slate-200 shadow-none">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-950">Requests Awaiting Reply</CardTitle>
                    <p className="mt-1 text-sm text-slate-500">Open offers that still need a customer response.</p>
                  </div>
                  <Link href="/app/appointments" className="text-xs font-medium text-primary hover:underline">
                    View all
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {awaitingReplyRequests.length ? (
                  awaitingReplyRequests.map((request) => (
                    <div key={request.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{request.customerName || request.customerPhone}</p>
                          <p className="text-xs text-slate-500">
                            {request.requestedTimeLabel || request.requestedPreference || "Awaiting a customer reply"}
                          </p>
                        </div>
                        <Badge className={clientBadgeClass("pending")}>{requestStatusLabel(request.status)}</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {request.issueSummary || "No issue summary recorded."}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    No requests are currently awaiting a reply.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-slate-50 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">At a glance</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Scheduled</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{bookedRequests}</p>
                  <p className="mt-1 text-xs text-slate-500">Requests already moved into appointments.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Still Open</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{openRequestCount}</p>
                  <p className="mt-1 text-xs text-slate-500">Requests that still need review, follow-up, or a reply.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Quick Test</p>
                  <Link
                    href="/app/calls"
                    className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Review live activity
                  </Link>
                  <p className="mt-2 text-sm text-slate-500">Use conversations and requests to confirm the assistant is behaving correctly.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-none">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-950">Workspace Status</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Configuration and readiness details for the current workspace.</p>
                </div>
                <Badge className={clientBadgeClass(health?.level === "RED" ? "critical" : health?.level === "YELLOW" ? "warning" : "success")}>
                  {workspaceState}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Workspace</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{workspaceState}</p>
                  <p className="mt-1 text-sm text-slate-500">{organization?.status || submission?.status || "DRAFT"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Assigned Number</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{assignedPhoneNumber || "Not assigned"}</p>
                  <p className="mt-1 text-sm text-slate-500">{assignedNumberProvider || "No provider yet"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Messaging</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{messagingReadiness?.state || "Unknown"}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {messagingReadiness?.reasons?.[0] || "No active blockers detected."}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Health</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{health?.level || "Unknown"}</p>
                  <p className="mt-1 text-sm text-slate-500">{health?.summary || "Health checks are still loading."}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <ActionNeededPanel items={actionItems} className="border-slate-200 shadow-none xl:sticky xl:top-6" />
      </div>
    </div>
  );
}
