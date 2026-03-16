"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  fetchAppointmentRequests,
  fetchOrgCalls,
  fetchOrgHealth,
  fetchOrgLeads,
  fetchOrgMessages
} from "@/lib/api";
import type { AppointmentRequest, Lead, OrgCallRecord, OrgHealth, OrgMessageThread } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { clientBadgeClass } from "@/lib/client-badges";

type QueueStatus = "Urgent" | "Pending" | "Follow-up";
type QueueItem = {
  id: string;
  status: QueueStatus;
  sortWeight: number;
  occurredAt: string;
  customer: string;
  lastAction: string;
  href: string;
  ctaLabel: string;
};

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  occurredAt: string;
  icon: "call" | "booking" | "message" | "lead";
};

function safeDate(value?: string | null) {
  return value ? new Date(value) : null;
}

function timeLabel(value?: string | null) {
  const date = safeDate(value);
  if (!date || Number.isNaN(date.getTime())) return "Recent";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function timeAgo(value?: string | null) {
  const date = safeDate(value);
  if (!date || Number.isNaN(date.getTime())) return "recently";
  const diff = Date.now() - date.getTime();
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function initials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "NA";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "NA";
}

function queueTone(status: QueueStatus) {
  if (status === "Urgent") return "critical" as const;
  if (status === "Pending") return "warning" as const;
  return "pending" as const;
}

function activityIconClass(icon: ActivityItem["icon"]) {
  if (icon === "call") return "bg-primary/10 text-primary";
  if (icon === "booking") return "bg-green-100 text-green-600";
  if (icon === "message") return "bg-amber-100 text-amber-600";
  return "bg-slate-100 text-slate-600";
}

function activityIconName(icon: ActivityItem["icon"]) {
  if (icon === "call") return "phone_in_talk";
  if (icon === "booking") return "done_all";
  if (icon === "message") return "forward_to_inbox";
  return "person";
}

function customerNameFromCall(call: OrgCallRecord) {
  return call.frontDesk?.callerName || call.displayName || call.fromNumber;
}

function buildLeadQueueItem(lead: Lead): QueueItem {
  const status: QueueStatus = lead.frontDesk?.state === "contacted" ? "Follow-up" : "Pending";
  return {
    id: `lead-${lead.id}`,
    status,
    sortWeight: status === "Pending" ? 0 : 2,
    occurredAt: lead.frontDesk?.lastActivityAt || lead.updatedAt,
    customer: lead.name || lead.phone || "Unknown lead",
    lastAction: lead.source === "WEB_FORM" ? "New Lead (Web Form)" : lead.frontDesk?.recommendedAction || "Lead needs review",
    href: `/app/leads?leadId=${encodeURIComponent(lead.id)}`,
    ctaLabel: status === "Pending" ? "Process" : "Remind"
  };
}

function buildCallQueueItem(call: OrgCallRecord): QueueItem {
  return {
    id: `call-${call.id}`,
    status: "Urgent",
    sortWeight: call.frontDesk?.frontDeskPriority === "urgent" ? 1 : 3,
    occurredAt: call.startedAt,
    customer: customerNameFromCall(call),
    lastAction: call.outcome === "MISSED" ? "Missed Call" : call.frontDesk?.recommendedAction || "Review call",
    href: `/app/calls?callId=${encodeURIComponent(call.id)}`,
    ctaLabel: "Call Back"
  };
}

function buildMessageQueueItem(thread: OrgMessageThread): QueueItem {
  return {
    id: `thread-${thread.id}`,
    status: "Follow-up",
    sortWeight: 4,
    occurredAt: thread.lastMessageAt,
    customer: thread.contactName || thread.lead?.name || thread.contactPhone,
    lastAction: "SMS Sent (No Reply)",
    href: `/app/messages?threadId=${encodeURIComponent(thread.id)}`,
    ctaLabel: "Remind"
  };
}

function buildAppointmentQueueItem(request: AppointmentRequest): QueueItem {
  return {
    id: `request-${request.id}`,
    status: request.status === "PENDING_REVIEW" ? "Pending" : "Follow-up",
    sortWeight: request.status === "PENDING_REVIEW" ? 0 : 3,
    occurredAt: request.lastEventAt || request.createdAt,
    customer: request.customerName || request.customerPhone,
    lastAction: request.status === "PENDING_REVIEW" ? "Booking Request Pending" : "Booking Awaiting Reply",
    href: `/app/appointments?requestId=${encodeURIComponent(request.id)}`,
    ctaLabel: request.status === "PENDING_REVIEW" ? "Process" : "Review"
  };
}

export default function AppOverviewPage() {
  const [calls, setCalls] = useState<OrgCallRecord[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [threads, setThreads] = useState<OrgMessageThread[]>([]);
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [health, setHealth] = useState<OrgHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void Promise.all([
      fetchOrgCalls({ page: 1, pageSize: 20 }),
      fetchOrgLeads(),
      fetchOrgMessages(),
      fetchAppointmentRequests(),
      fetchOrgHealth()
    ])
      .then(([callData, leadData, messageData, appointmentData, healthData]) => {
        if (!active) return;
        setCalls(callData.calls || []);
        setLeads(leadData.leads || []);
        setThreads(messageData.threads || []);
        setRequests(appointmentData.requests || []);
        setHealth(healthData || null);
      })
      .catch(() => {
        if (!active) return;
        setCalls([]);
        setLeads([]);
        setThreads([]);
        setRequests([]);
        setHealth(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const urgentCalls = calls.filter(
      (call) =>
        call.frontDesk?.frontDeskPriority === "urgent" ||
        call.outcome === "MISSED" ||
        call.outcome === "ABANDONED"
    ).length;
    const pendingLeads = leads.filter((lead) => lead.frontDesk?.state === "needs_follow_up").length;
    const activeBookings = requests.filter((request) =>
      ["PENDING_REVIEW", "APPROVED", "SLOT_OFFERED", "SCHEDULED"].includes(request.status)
    ).length;

    return {
      urgentActions: urgentCalls + pendingLeads,
      callsToday: calls.length,
      leadsCaptured: leads.length,
      activeBookings
    };
  }, [calls, leads, requests]);

  const queueItems = useMemo(() => {
    const leadItems = leads
      .filter((lead) => lead.frontDesk?.state === "needs_follow_up" || lead.frontDesk?.state === "contacted")
      .map(buildLeadQueueItem);
    const callItems = calls
      .filter((call) => call.outcome === "MISSED" || call.outcome === "ABANDONED" || call.frontDesk?.frontDeskPriority === "urgent")
      .map(buildCallQueueItem);
    const messageItems = threads
      .filter((thread) => thread.frontDesk?.state === "contacted" || thread.frontDesk?.state === "needs_follow_up")
      .map(buildMessageQueueItem);
    const appointmentItems = requests
      .filter((request) => request.status === "PENDING_REVIEW" || request.status === "SLOT_OFFERED")
      .map(buildAppointmentQueueItem);

    return [...leadItems, ...callItems, ...messageItems, ...appointmentItems]
      .sort((a, b) => {
        if (a.sortWeight !== b.sortWeight) return a.sortWeight - b.sortWeight;
        return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      })
      .slice(0, 6);
  }, [calls, leads, requests, threads]);

  const activityItems = useMemo(() => {
    const callActivity: ActivityItem[] = calls.slice(0, 2).map((call) => ({
      id: `activity-call-${call.id}`,
      title: "Call Logged",
      detail: `Incoming call from ${call.fromNumber} handled by AI agent.`,
      occurredAt: call.startedAt,
      icon: "call"
    }));
    const bookingActivity: ActivityItem[] = requests.slice(0, 1).map((request) => ({
      id: `activity-request-${request.id}`,
      title: "Booking Confirmed",
      detail: `${request.customerName} requested ${request.requestedTimeLabel || "a visit"}${request.requestedPreference ? ` (${request.requestedPreference})` : ""}.`,
      occurredAt: request.lastEventAt || request.createdAt,
      icon: "booking"
    }));
    const messageActivity: ActivityItem[] = threads.slice(0, 1).map((thread) => ({
      id: `activity-thread-${thread.id}`,
      title: "SMS Response",
      detail: `New message from ${thread.contactName || thread.contactPhone}.`,
      occurredAt: thread.lastMessageAt,
      icon: "message"
    }));
    const leadActivity: ActivityItem[] = leads.slice(0, 1).map((lead) => ({
      id: `activity-lead-${lead.id}`,
      title: "New Lead Created",
      detail: `Added lead ${lead.name || lead.phone} via ${lead.source === "WEB_FORM" ? "Web Form" : lead.source || "Front Desk"}.`,
      occurredAt: lead.createdAt,
      icon: "lead"
    }));

    return [...callActivity, ...bookingActivity, ...messageActivity, ...leadActivity]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 4);
  }, [calls, leads, requests, threads]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Front desk"
        title="System Overview"
        description="Work the highest-priority front desk actions first, then continue in the linked queue."
        actions={
          <Badge className={clientBadgeClass(health?.level === "RED" ? "critical" : health?.level === "YELLOW" ? "warning" : "success")}>
            {health?.level === "RED" ? "Needs attention" : "System live"}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[16px] border-primary/10 shadow-sm">
          <CardContent className="p-6">
            <div className="mb-4 flex items-start justify-between">
              <span className="rounded bg-red-100 p-2 text-red-600">
                <span className="material-symbols-outlined">priority_high</span>
              </span>
              <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">Live</span>
            </div>
            <p className="mb-1 text-sm font-medium text-slate-500">Urgent Actions Needed</p>
            <h3 className="text-3xl font-bold text-slate-950">{metrics.urgentActions}</h3>
          </CardContent>
        </Card>

        <Card className="rounded-[16px] border-primary/10 shadow-sm">
          <CardContent className="p-6">
            <div className="mb-4 flex items-start justify-between">
              <span className="rounded bg-primary/10 p-2 text-primary">
                <span className="material-symbols-outlined">call</span>
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                {health?.metrics?.recentActivityAt ? timeAgo(health.metrics.recentActivityAt) : "today"}
              </span>
            </div>
            <p className="mb-1 text-sm font-medium text-slate-500">Calls Today</p>
            <h3 className="text-3xl font-bold text-slate-950">{metrics.callsToday}</h3>
          </CardContent>
        </Card>

        <Card className="rounded-[16px] border-primary/10 shadow-sm">
          <CardContent className="p-6">
            <div className="mb-4 flex items-start justify-between">
              <span className="rounded bg-green-100 p-2 text-green-600">
                <span className="material-symbols-outlined">person_add</span>
              </span>
              <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-bold text-green-600">
                {leads.filter((lead) => lead.source === "WEB_FORM").length} web
              </span>
            </div>
            <p className="mb-1 text-sm font-medium text-slate-500">Leads Captured</p>
            <h3 className="text-3xl font-bold text-slate-950">{metrics.leadsCaptured}</h3>
          </CardContent>
        </Card>

        <Card className="rounded-[16px] border-primary/10 shadow-sm">
          <CardContent className="p-6">
            <div className="mb-4 flex items-start justify-between">
              <span className="rounded bg-amber-100 p-2 text-amber-600">
                <span className="material-symbols-outlined">event_available</span>
              </span>
              <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-bold text-green-600">
                {requests.filter((request) => request.status === "SCHEDULED").length} booked
              </span>
            </div>
            <p className="mb-1 text-sm font-medium text-slate-500">Active Bookings</p>
            <h3 className="text-3xl font-bold text-slate-950">{metrics.activeBookings}</h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">Action Needed Queue</h2>
            <Button asChild variant="ghost" className="px-0 text-primary hover:text-primary">
              <Link href="/app/leads">View All</Link>
            </Button>
          </div>

          <Card className="overflow-hidden rounded-[16px] border-primary/10 shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="px-6 py-10 text-sm text-slate-500">Loading front desk queue...</div>
              ) : queueItems.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="border-b border-primary/10 bg-slate-50">
                      <tr>
                        {["Status", "Time", "Customer", "Last Action", "Action"].map((label) => (
                          <th key={label} className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary/5">
                      {queueItems.map((item) => (
                        <tr key={item.id} className="transition-colors hover:bg-primary/5">
                          <td className="px-6 py-4">
                            <Badge className={clientBadgeClass(queueTone(item.status))}>{item.status}</Badge>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-500">{timeLabel(item.occurredAt)}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                                {initials(item.customer)}
                              </div>
                              <span className="text-sm font-bold text-slate-950">{item.customer}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">{item.lastAction}</td>
                          <td className="px-6 py-4 text-right">
                            <Button asChild size="sm" variant={item.status === "Urgent" ? "default" : "outline"}>
                              <Link href={item.href}>{item.ctaLabel}</Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-10 text-sm text-slate-500">No front desk actions need attention right now.</div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">Recent Activity</h2>
            <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
              <span className="material-symbols-outlined text-sm">filter_list</span>
            </button>
          </div>

          <Card className="rounded-[16px] border-primary/10 shadow-sm">
            <CardContent className="flex flex-col gap-6 p-6">
              {loading ? (
                <div className="text-sm text-slate-500">Loading activity...</div>
              ) : activityItems.length ? (
                activityItems.map((item, index) => (
                  <div key={item.id} className="relative flex gap-4">
                    {index < activityItems.length - 1 ? (
                      <div className="absolute bottom-[-1.5rem] left-[1.125rem] top-8 w-0.5 bg-primary/10" />
                    ) : null}
                    <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${activityIconClass(item.icon)}`}>
                      <span className="material-symbols-outlined text-sm">{activityIconName(item.icon)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-950">{item.title}</p>
                      <p className="mb-1 text-xs text-slate-500">{item.detail}</p>
                      <p className="text-[10px] font-bold text-primary">{timeAgo(item.occurredAt)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">No recent activity yet.</div>
              )}

              <Button asChild variant="outline" className="mt-2 w-full uppercase tracking-widest text-slate-500">
                <Link href="/app/messages">Load Older Activity</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
