"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { PageHeader, SectionHeading } from "@/components/ui/page";
import { ActionNeededPanel } from "@/components/dashboard/action-needed-panel";
import { clientBadgeClass } from "@/lib/client-badges";

function isToday(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
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
  if (value === null || value === undefined || value === 0) return "neutral";
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
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
          <InfoHint text={hint} />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end justify-between gap-3">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              accent === "critical"
                ? "bg-rose-500"
                : accent === "warning"
                  ? "bg-amber-500"
                  : accent === "success"
                    ? "bg-emerald-500"
                    : "bg-zinc-300"
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
  const openLeads = useMemo(() => leads.filter((lead) => lead.status !== "WON" && lead.status !== "LOST").slice(0, 4), [leads]);
  const awaitingReplyRequests = useMemo(() => requests.filter((request) => request.status === "SLOT_OFFERED").slice(0, 4), [requests]);

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
      <PageHeader
        eyebrow="Client overview"
        title="Overview"
        description="See what happened today, what the assistant captured, and what needs attention next."
        actions={
          <>
            <Button asChild>
              <Link href="/app/calls">Review conversations</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/settings">Update business hours</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <Card className="overflow-hidden">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-5">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Workspace status
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl">{workspaceState}</h2>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  {health?.summary || "Health checks are available and the workspace is ready for review."}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-muted/40 p-4">
                  <p className="page-eyebrow">Assigned Number</p>
                  <p className="mt-2 font-semibold text-foreground">{assignedPhoneNumber || "Not assigned"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{assignedNumberProvider || "No provider yet"}</p>
                </div>
                <div className="rounded-2xl border bg-muted/40 p-4">
                  <p className="page-eyebrow">Messaging</p>
                  <p className="mt-2 font-semibold text-foreground">{messagingReadiness?.state || "Unknown"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{messagingReadiness?.reasons?.[0] || "No active blockers detected."}</p>
                </div>
                <div className="rounded-2xl border bg-muted/40 p-4">
                  <p className="page-eyebrow">Onboarding</p>
                  <p className="mt-2 font-semibold text-foreground">{organization?.status || submission?.status || "DRAFT"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Last synced {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : "Syncing..."}</p>
                </div>
              </div>
            </div>

            <div className="surface-muted p-5">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Today at a glance
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border bg-white p-4">
                    <p className="page-eyebrow">Scheduled requests</p>
                    <p className="mt-2 text-2xl font-semibold">{bookedRequests}</p>
                  </div>
                  <div className="rounded-2xl border bg-white p-4">
                    <p className="page-eyebrow">Open attention items</p>
                    <p className="mt-2 text-2xl font-semibold">{openRequestCount}</p>
                  </div>
                  <div className="rounded-2xl border bg-white p-4">
                    <p className="page-eyebrow">Quick review</p>
                    <Link href="/app/appointments" className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary">
                      Review requests
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <ActionNeededPanel items={actionItems} className="border-border shadow-sm xl:sticky xl:top-24" />
      </div>

      <div className="metric-grid">
        <MetricCard title="Calls Today" hint="Calls logged today from the recent conversation feed." value={todayCalls} accent={metricTone(todayCalls)} />
        <MetricCard title="Leads Captured" hint="New leads created today." value={todayLeads} accent={metricTone(todayLeads)} />
        <MetricCard title="Requests Captured" hint="New appointment requests captured today." value={todayRequests} accent={metricTone(todayRequests)} />
        <MetricCard title="Missed Call Recoveries" hint="Recovered missed calls based on the current analytics window." value={missedRecoveries} accent={metricTone(missedRecoveries)} />
        <MetricCard title="AI Answer Rate" hint="Answer rate from the current analytics window." value={aiAnswerRate !== null ? `${aiAnswerRate}%` : "Unavailable"} accent={aiAnswerRate !== null && aiAnswerRate < 70 ? "warning" : "success"} />
        <MetricCard title="Open Attention Items" hint="Operational exceptions that need review, follow-up, or a fix." value={actionItems.length} accent={actionItems.length > 0 ? "warning" : "success"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader className="pb-4">
            <SectionHeading
              className="gap-2"
              title="Recent conversations"
              description="Latest customer activity handled by the assistant."
              actions={<Link href="/app/calls" className="text-sm font-medium text-primary">View all</Link>}
            />
          </CardHeader>
          <CardContent className="card-stack">
            {recentConversations.length ? (
              recentConversations.map((call) => (
                <div key={call.id} className="rounded-2xl border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{call.displayName || call.fromNumber}</p>
                      <p className="text-xs text-muted-foreground">{new Date(call.startedAt).toLocaleString()}</p>
                    </div>
                    <Badge className={clientBadgeClass(call.outcome === "MISSED" ? "warning" : call.outcome === "APPOINTMENT_REQUEST" ? "booking" : "neutral")}>
                      {outcomeLabel(call.outcome)}
                    </Badge>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {call.aiSummary || call.summary || "No summary available yet."}
                  </p>
                </div>
              ))
            ) : (
              <div className="empty-state">No recent conversations yet.</div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader className="pb-4">
            <SectionHeading
              className="gap-2"
              title="Open leads"
              description="New opportunities that still need follow-up."
              actions={<Link href="/app/leads" className="text-sm font-medium text-primary">View all</Link>}
            />
          </CardHeader>
          <CardContent className="card-stack">
            {openLeads.length ? (
              openLeads.map((lead) => (
                <div key={lead.id} className="rounded-2xl border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">{lead.phone || lead.email || "No contact info"}</p>
                    </div>
                    <Badge className={clientBadgeClass(lead.status === "NEW" ? "pending" : lead.status === "QUALIFIED" ? "success" : "neutral")}>
                      {lead.status === "NEW" ? "New" : lead.status === "QUALIFIED" ? "Qualified" : lead.status}
                    </Badge>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {lead.serviceRequested || lead.message || "No service details yet."}
                  </p>
                </div>
              ))
            ) : (
              <div className="empty-state">No open leads at the moment.</div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader className="pb-4">
            <SectionHeading
              className="gap-2"
              title="Requests awaiting reply"
              description="Open offers that still need a customer response."
              actions={<Link href="/app/appointments" className="text-sm font-medium text-primary">View all</Link>}
            />
          </CardHeader>
          <CardContent className="card-stack">
            {awaitingReplyRequests.length ? (
              awaitingReplyRequests.map((request) => (
                <div key={request.id} className="rounded-2xl border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{request.customerName || request.customerPhone}</p>
                      <p className="text-xs text-muted-foreground">{request.requestedTimeLabel || request.requestedPreference || "Awaiting a customer reply"}</p>
                    </div>
                    <Badge className={clientBadgeClass("pending")}>{requestStatusLabel(request.status)}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{request.issueSummary || "No issue summary recorded."}</p>
                </div>
              ))
            ) : (
              <div className="empty-state">No requests are currently awaiting a reply.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
