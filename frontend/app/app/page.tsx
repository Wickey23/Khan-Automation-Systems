"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

  const recentConversations = useMemo(() => calls.slice(0, 5), [calls]);
  const openLeads = useMemo(
    () =>
      leads
        .filter((lead) => lead.status !== "WON" && lead.status !== "LOST")
        .slice(0, 5),
    [leads]
  );
  const awaitingReplyRequests = useMemo(
    () => requests.filter((request) => request.status === "SLOT_OFFERED").slice(0, 5),
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Overview</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track calls, leads, requests, and the items that need attention.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/calls" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Review Conversations
          </Link>
          <Link href="/app/appointments" className="rounded-md border px-4 py-2 text-sm font-medium">
            Review Requests
          </Link>
          <Link href="/app/settings" className="rounded-md border px-4 py-2 text-sm font-medium">
            Update Business Hours
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="inline-flex items-center gap-1 text-sm">
              Calls Today
              <InfoHint text="Calls logged today from the most recent conversation feed." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{todayCalls}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="inline-flex items-center gap-1 text-sm">
              Leads Captured
              <InfoHint text="New leads created today." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{todayLeads}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="inline-flex items-center gap-1 text-sm">
              Requests Captured
              <InfoHint text="New appointment requests captured today." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{todayRequests}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="inline-flex items-center gap-1 text-sm">
              Missed Call Recoveries
              <InfoHint text="Recovered missed calls based on the current analytics window." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{missedRecoveries}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="inline-flex items-center gap-1 text-sm">
              AI Answer Rate
              <InfoHint text="Answer rate from the current analytics window." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{aiAnswerRate !== null ? `${aiAnswerRate}%` : "Unavailable"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="inline-flex items-center gap-1 text-sm">
              Open Attention Items
              <InfoHint text="Operational exceptions that need review, follow-up, or a fix." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{actionItems.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="grid gap-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Recent Conversations</CardTitle>
                  <Link href="/app/calls" className="text-xs font-medium text-primary hover:underline">
                    View all
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentConversations.length ? (
                  recentConversations.map((call) => (
                    <div key={call.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{call.displayName || call.fromNumber}</p>
                          <p className="text-xs text-muted-foreground">{new Date(call.startedAt).toLocaleString()}</p>
                        </div>
                        <Badge className={clientBadgeClass(call.outcome === "MISSED" ? "warning" : call.outcome === "APPOINTMENT_REQUEST" ? "booking" : "neutral")}>
                          {outcomeLabel(call.outcome)}
                        </Badge>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {call.aiSummary || call.summary || "No summary available yet."}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    No recent conversations yet.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Open Leads</CardTitle>
                  <Link href="/app/leads" className="text-xs font-medium text-primary hover:underline">
                    View all
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {openLeads.length ? (
                  openLeads.map((lead) => (
                    <div key={lead.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">{lead.phone || lead.email || "No contact info"}</p>
                        </div>
                        <Badge className={clientBadgeClass(lead.status === "NEW" ? "pending" : lead.status === "QUALIFIED" ? "success" : "neutral")}>
                          {lead.status}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {lead.serviceRequested || lead.message || "No service details yet."}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    No open leads at the moment.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Requests Awaiting Reply</CardTitle>
                  <Link href="/app/appointments" className="text-xs font-medium text-primary hover:underline">
                    View all
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {awaitingReplyRequests.length ? (
                  awaitingReplyRequests.map((request) => (
                    <div key={request.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{request.customerName || request.customerPhone}</p>
                          <p className="text-xs text-muted-foreground">{request.requestedTimeLabel || request.requestedPreference || "Awaiting a customer reply"}</p>
                        </div>
                        <Badge className={clientBadgeClass("pending")}>{requestStatusLabel(request.status)}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {request.issueSummary || "No issue summary recorded."}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    No requests are currently awaiting a reply.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Workspace</p>
                  <p className="mt-1 text-lg font-semibold">{workspaceState}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{organization?.status || submission?.status || "DRAFT"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Assigned Number</p>
                  <p className="mt-1 text-lg font-semibold">{assignedPhoneNumber || "Not assigned"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{assignedNumberProvider || "No provider yet"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Messaging</p>
                  <p className="mt-1 text-lg font-semibold">{messagingReadiness?.state || "Unknown"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {messagingReadiness?.reasons?.[0] || "No active blockers detected."}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Health</p>
                  <p className="mt-1 text-lg font-semibold">{health?.level || "Unknown"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{health?.summary || "Health checks are still loading."}</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Last synced: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : "Syncing..."}
              </p>
            </CardContent>
          </Card>
        </div>

        <ActionNeededPanel items={actionItems} />
      </div>
    </div>
  );
}

