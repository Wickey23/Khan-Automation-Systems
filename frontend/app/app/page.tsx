"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchAppointmentRequests, fetchOrgAnalytics, fetchOrgCalls, fetchOrgHealth, fetchOrgLeads, fetchOrgMessagingReadiness, fetchOrgNotifications, fetchOrgOnboarding, fetchOrgProfile, getBillingStatus } from "@/lib/api";
import type { ActionNeededItem, AppointmentRequest, Lead, OnboardingSubmission, Organization, OrgAnalytics, OrgCallRecord, OrgHealth, OrgMessagingReadiness, OrgNotification, OrgSubscription } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
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

function workspaceStateLabel(organization: Organization | null, subscription: OrgSubscription | null) {
  const billingActive = subscription ? ["active", "trialing"].includes(String(subscription.status || "").toLowerCase()) : false;
  if (organization?.live && billingActive) return "Live";
  if (organization?.live) return "Live (billing inactive)";
  if (billingActive) return "Provisioning";
  return "Setup in progress";
}

function requestStatusLabel(status: AppointmentRequest["status"]) {
  switch (status) {
    case "PENDING_REVIEW":
      return "Needs review";
    case "SLOT_OFFERED":
      return "Awaiting reply";
    case "SCHEDULED":
      return "Scheduled";
    case "APPROVED":
      return "Slot offered";
    case "DENIED":
      return "Closed";
    default:
      return status.replaceAll("_", " ");
  }
}

function outcomeLabel(outcome: string | null | undefined) {
  if (!outcome) return "Conversation";
  if (outcome === "APPOINTMENT_REQUEST") return "Request captured";
  if (outcome === "TRANSFERRED") return "Transferred";
  if (outcome === "MESSAGE_TAKEN") return "Follow-up sent";
  if (outcome === "MISSED") return "Needs review";
  return outcome.replaceAll("_", " ");
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
  const openRequestCount = useMemo(() => requests.filter((request) => request.status !== "SCHEDULED" && request.status !== "DENIED").length, [requests]);
  const aiAnswerRate = analytics ? Math.round(analytics.kpis.answerRate * 100) : null;
  const recentConversations = useMemo(() => calls.slice(0, 3), [calls]);
  const openLeads = useMemo(() => leads.filter((lead) => lead.status !== "WON" && lead.status !== "LOST").slice(0, 3), [leads]);

  const actionItems = useMemo<ActionNeededItem[]>(() => {
    const items: ActionNeededItem[] = [];

    notifications
      .filter((item) => !item.readAt)
      .slice(0, 2)
      .forEach((notification) => {
        items.push({
          id: `notification-${notification.id}`,
          type: notification.severity === "URGENT" ? "NEEDS_FIX" : "NEEDS_REVIEW",
          severity: notification.severity === "URGENT" ? "critical" : notification.severity === "ACTION_REQUIRED" ? "warning" : "info",
          label: notification.title,
          href: notification.type === "APPOINTMENT_BOOKED" ? "/app/appointments" : "/app/messages",
          timestamp: notification.createdAt,
          sourceModule: notification.type === "APPOINTMENT_BOOKED" ? "appointments" : "system"
        });
      });

    requests
      .filter((request) => request.status === "PENDING_REVIEW")
      .slice(0, 1)
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
      .slice(0, 1)
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
      .slice(0, 1)
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
        label: `Messaging setup needs attention`,
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

    return items.slice(0, 4);
  }, [calls, health, lastSyncedAt, messagingReadiness, notifications, requests]);

  const workspaceState = workspaceStateLabel(organization, subscription);
  const summaryStats = [
    { label: "Calls today", value: todayCalls },
    { label: "New leads", value: todayLeads },
    { label: "Open requests", value: openRequestCount },
    { label: "Answer rate", value: aiAnswerRate !== null ? `${aiAnswerRate}%` : "-" }
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Client overview"
        title="Overview"
        description="This page should tell you only three things: whether the system is healthy, what needs action, and what happened recently."
        actions={
          <>
            <Button asChild>
              <Link href="/app/calls">Review calls</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/settings">Update settings</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:items-start xl:grid-cols-[minmax(0,1.15fr)_380px]">
        <Card className="self-start">
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <p className="page-eyebrow">Workspace status</p>
              <h2 className="text-3xl">{workspaceState}</h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {health?.summary || "Everything looks normal right now."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-muted/25 p-4">
                <p className="page-eyebrow">Phone number</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{assignedPhoneNumber || "Not assigned"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{assignedNumberProvider || "No provider yet"}</p>
              </div>
              <div className="rounded-xl border bg-muted/25 p-4">
                <p className="page-eyebrow">Messaging</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{messagingReadiness?.state || "Unknown"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{messagingReadiness?.reasons?.[0] || "No active blockers detected."}</p>
              </div>
              <div className="rounded-xl border bg-muted/25 p-4">
                <p className="page-eyebrow">Last synced</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : "Syncing..."}</p>
                <p className="mt-1 text-xs text-muted-foreground">{organization?.status || submission?.status || "DRAFT"}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm">
                <Link href="/app/calls">Open calls</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/app/appointments">Open requests</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <ActionNeededPanel items={actionItems} className="self-start shadow-sm xl:sticky xl:top-24" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryStats.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5">
              <p className="page-eyebrow">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:items-start xl:grid-cols-2">
        <Card className="self-start">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Recent calls</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">The latest conversations handled by the assistant.</p>
              </div>
              <Link href="/app/calls" className="text-sm font-medium text-primary">View all</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentConversations.length ? (
              recentConversations.map((call) => (
                <div key={call.id} className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{call.displayName || call.fromNumber}</p>
                      <p className="text-xs text-muted-foreground">{new Date(call.startedAt).toLocaleString()}</p>
                    </div>
                    <Badge className={clientBadgeClass(call.outcome === "MISSED" ? "warning" : call.outcome === "APPOINTMENT_REQUEST" ? "booking" : "neutral")}>
                      {outcomeLabel(call.outcome)}
                    </Badge>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{call.aiSummary || call.summary || "No summary available yet."}</p>
                </div>
              ))
            ) : (
              <div className="empty-state py-8">No recent calls yet.</div>
            )}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Open leads and requests</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">The work that most likely needs follow-up next.</p>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/app/leads" className="text-sm font-medium text-primary">Leads</Link>
                <Link href="/app/appointments" className="text-sm font-medium text-primary">Requests</Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {openLeads.length ? (
              openLeads.map((lead) => (
                <div key={lead.id} className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">{lead.phone || lead.email || "No contact info"}</p>
                    </div>
                    <Badge className={clientBadgeClass(lead.status === "NEW" ? "pending" : lead.status === "QUALIFIED" ? "success" : "neutral")}>
                      {lead.status}
                    </Badge>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{lead.serviceRequested || lead.message || "No service details yet."}</p>
                </div>
              ))
            ) : requests.slice(0, 3).length ? (
              requests.slice(0, 3).map((request) => (
                <div key={request.id} className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{request.customerName || request.customerPhone}</p>
                      <p className="text-xs text-muted-foreground">{request.requestedTimeLabel || request.requestedPreference || "Scheduling request"}</p>
                    </div>
                    <Badge className={clientBadgeClass("pending")}>{requestStatusLabel(request.status)}</Badge>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{request.issueSummary || "No issue summary recorded."}</p>
                </div>
              ))
            ) : (
              <div className="empty-state py-8">No open leads or requests right now.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
