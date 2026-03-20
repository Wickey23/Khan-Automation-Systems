"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calendar, MessageSquare, PhoneCall, RefreshCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { fetchAppointmentRequests, fetchOrgAnalytics, fetchOrgCalls, fetchOrgHealth, fetchOrgMessages, fetchOrgProfile, getBillingStatus } from "@/lib/api";
import type { AppointmentRequest, BillingStatusPayload, OrgAnalytics, OrgCallRecord, OrgHealth, OrgMessageThread } from "@/lib/types";
import { PageShell, SectionShell } from "@/components/stitch/components/app/PageShell";
import { PageHeader } from "@/components/stitch/components/app/PageHeader";
import { MetricCard } from "@/components/stitch/components/app/MetricCard";
import { NeedsAttention } from "@/components/stitch/components/app/NeedsAttention";
import { ActivityTimeline } from "@/components/stitch/components/app/ActivityTimeline";
import { StateCard } from "@/components/stitch/components/app/StateCard";
import { StatusStrip } from "@/components/stitch/components/app/StatusStrip";

type ActivityItem = {
  id: string;
  type: "call" | "sms" | "booking" | "system";
  title: string;
  description: string;
  timestamp: string;
  status: "answered" | "missed" | "sent" | "received" | "confirmed" | "pending" | "active" | "error";
};

function formatWhen(value: string | null | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

type OrgProfileData = Awaited<ReturnType<typeof fetchOrgProfile>>;

function workspaceLive(profile: OrgProfileData | null) {
  if (!profile?.access) return false;
  const coreReady = (["calls", "sms", "appointments"] as const).every(
    (key) => profile.access.features[key]?.status === "ready"
  );
  const readinessReady = profile.access.readinessChecklist.every((item) => item.status === "ready");
  return coreReady && readinessReady;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null);
  const [health, setHealth] = useState<OrgHealth | null>(null);
  const [profile, setProfile] = useState<OrgProfileData | null>(null);
  const [billing, setBilling] = useState<BillingStatusPayload | null>(null);
  const [calls, setCalls] = useState<OrgCallRecord[]>([]);
  const [threads, setThreads] = useState<OrgMessageThread[]>([]);
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.allSettled([
      fetchOrgAnalytics({ range: "7d" }),
      fetchOrgHealth(),
      fetchOrgProfile(),
      getBillingStatus(),
      fetchOrgCalls({ page: 1, pageSize: 8 }),
      fetchOrgMessages(),
      fetchAppointmentRequests()
    ])
      .then((results) => {
        if (!mounted) return;
        const [analyticsRes, healthRes, profileRes, billingRes, callsRes, messagesRes, requestsRes] = results;
        if (analyticsRes.status === "fulfilled") setAnalytics(analyticsRes.value);
        if (healthRes.status === "fulfilled") setHealth(healthRes.value);
        if (profileRes.status === "fulfilled") setProfile(profileRes.value);
        if (billingRes.status === "fulfilled") setBilling(billingRes.value);
        if (callsRes.status === "fulfilled") setCalls(callsRes.value.calls || []);
        if (messagesRes.status === "fulfilled") setThreads(messagesRes.value.threads || []);
        if (requestsRes.status === "fulfilled") setRequests(requestsRes.value.requests || []);

        const failedAll = results.every((item) => item.status === "rejected");
        if (failedAll) {
          setError("Could not load dashboard data. Check API connectivity and try again.");
        }
      })
      .catch(() => {
        if (mounted) setError("Could not load dashboard data. Check API connectivity and try again.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [refreshTick]);

  const live = useMemo(() => workspaceLive(profile), [profile]);
  const pendingReviewCount = useMemo(
    () => requests.filter((item) => item.status === "PENDING_REVIEW" || item.status === "SLOT_OFFERED").length,
    [requests]
  );

  const metrics = useMemo(
    () => [
      {
        title: "Inbound Calls",
        value: analytics?.kpis.totalCalls ?? 0,
        icon: PhoneCall,
        href: "/app/calls"
      },
      {
        title: "SMS Threads",
        value: analytics?.kpis.smsThreads ?? 0,
        icon: MessageSquare,
        href: "/app/messages"
      },
      {
        title: "Booking Requests",
        value: analytics?.kpis.appointmentRequests ?? 0,
        icon: Calendar,
        href: "/app/appointments"
      },
      {
        title: "System Health",
        value: health?.score ? `${health.score}%` : "N/A",
        icon: ShieldCheck,
        href: "/app/activation"
      }
    ],
    [analytics, health]
  );

  const attentionItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      description: string;
      priority: "high" | "medium" | "low";
      icon: typeof AlertTriangle;
      ctaText: string;
      ctaHref: string;
      type: "blocked" | "review" | "setup";
    }> = [];

    if (billing?.subscription && !["active", "trialing"].includes(billing.subscription.status)) {
      items.push({
        id: "billing",
        title: "Billing needs action",
        description: "Subscription is not active. Some runtime automation may be limited until billing is resolved.",
        priority: "high",
        icon: AlertTriangle,
        ctaText: "Open billing",
        ctaHref: "/app/billing",
        type: "blocked"
      });
    }

    const readinessIssues = profile?.access?.readinessChecklist.filter((item) => item.status !== "ready") || [];
    readinessIssues.slice(0, 2).forEach((issue, index) => {
      items.push({
        id: `readiness-${issue.key}-${index}`,
        title: issue.label,
        description: issue.description,
        priority: issue.status === "blocked" ? "high" : "medium",
        icon: AlertTriangle,
        ctaText: "Continue activation",
        ctaHref: "/app/activation",
        type: issue.status === "blocked" ? "blocked" : "setup"
      });
    });

    if (pendingReviewCount > 0) {
      items.push({
        id: "booking-review",
        title: "Booking requests need review",
        description: `${pendingReviewCount} booking request(s) are waiting for manual review or assignment.`,
        priority: "medium",
        icon: AlertTriangle,
        ctaText: "Open appointments",
        ctaHref: "/app/appointments",
        type: "review"
      });
    }

    if (health?.level === "RED") {
      items.push({
        id: "runtime-red",
        title: "Runtime health is critical",
        description: health.summary,
        priority: "high",
        icon: AlertTriangle,
        ctaText: "Open activation",
        ctaHref: "/app/activation",
        type: "blocked"
      });
    } else if (health?.level === "YELLOW") {
      items.push({
        id: "runtime-yellow",
        title: "Runtime health needs attention",
        description: health.summary,
        priority: "low",
        icon: AlertTriangle,
        ctaText: "Review health",
        ctaHref: "/app/activation",
        type: "setup"
      });
    }

    return items.slice(0, 5);
  }, [billing, health, pendingReviewCount, profile?.access?.readinessChecklist]);

  const activity = useMemo<ActivityItem[]>(() => {
    const callItems: ActivityItem[] = calls.slice(0, 4).map((call) => ({
      id: `call-${call.id}`,
      type: "call",
      title: `Call ${call.outcome.replace(/_/g, " ").toLowerCase()}`,
      description: call.summary || `${call.fromNumber} -> ${call.toNumber}`,
      timestamp: formatWhen(call.startedAt),
      status: call.outcome === "MISSED" || call.outcome === "ABANDONED" ? "missed" : "answered"
    }));
    const smsItems: ActivityItem[] = threads.slice(0, 3).map((thread) => ({
      id: `sms-${thread.id}`,
      type: "sms",
      title: `Message thread with ${thread.contactName || thread.contactPhone}`,
      description: thread.messages?.[thread.messages.length - 1]?.body || "Conversation updated",
      timestamp: formatWhen(thread.lastMessageAt),
      status: "received"
    }));
    const bookingItems: ActivityItem[] = requests.slice(0, 3).map((request) => ({
      id: `booking-${request.id}`,
      type: "booking",
      title: `Booking request ${request.status.replace(/_/g, " ").toLowerCase()}`,
      description: `${request.customerName} - ${request.issueSummary}`,
      timestamp: formatWhen(request.lastEventAt || request.createdAt),
      status: request.status === "APPROVED" || request.status === "SCHEDULED" ? "confirmed" : "pending"
    }));
    return [...callItems, ...smsItems, ...bookingItems].sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }).slice(0, 10);
  }, [calls, requests, threads]);

  return (
    <PageShell className="p-6 space-y-8">
      <PageHeader
        title="Dashboard"
        description={profile?.organization?.name ? `Operational view for ${profile.organization.name}` : "Operational view for your workspace"}
        actions={
          <button
            onClick={() => setRefreshTick((value) => value + 1)}
            className="flex items-center gap-2 rounded-lg bg-surface-container-high px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-container-highest"
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
        }
      />

      {loading ? (
        <StateCard type="loading" title="Loading dashboard" description="Fetching calls, messages, bookings, and health signals." />
      ) : null}
      {!loading && error ? (
        <StateCard
          type="error"
          title="Dashboard unavailable"
          description={error}
          ctaText="Retry"
          ctaHref="/app"
        />
      ) : null}

      {!loading && !error ? (
        <>
          <StatusStrip
            progress={profile?.access?.readinessChecklist?.length ? Math.round((profile.access.readinessChecklist.filter((item) => item.status === "ready").length / profile.access.readinessChecklist.length) * 100) : 0}
            isLive={live}
            isProvenLive={Boolean(profile?.organization?.firstSuccessAt)}
            message={
              live
                ? "Workspace is live. Calls, messages, and booking workflows are active."
                : "Workspace still needs setup before full runtime automation."
            }
          />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard key={metric.title} title={metric.title} value={metric.value} icon={metric.icon} href={metric.href} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="space-y-8 lg:col-span-7">
              <SectionShell title="Needs attention" description="Items that currently block or reduce value.">
                <NeedsAttention items={attentionItems} />
              </SectionShell>
              <SectionShell title="Recent activity" description="Latest calls, messages, and booking events.">
                <ActivityTimeline items={activity} />
              </SectionShell>
            </div>

            <div className="space-y-8 lg:col-span-5">
              <SectionShell title="Health summary" description="Current runtime and readiness posture.">
                <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5">
                  <p className="text-sm font-bold text-on-surface">{health?.summary || "Health data unavailable."}</p>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    Last activity: {formatWhen(health?.metrics?.recentActivityAt)}
                  </p>
                </div>
              </SectionShell>
              <SectionShell title="Next steps">
                <div className="space-y-3 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5 text-sm">
                  <Link className="block font-semibold text-primary hover:underline" href="/app/calls">
                    View live calls
                  </Link>
                  <Link className="block font-semibold text-primary hover:underline" href="/app/messages">
                    Open messages
                  </Link>
                  <Link className="block font-semibold text-primary hover:underline" href="/app/appointments">
                    Review bookings
                  </Link>
                  <Link className="block font-semibold text-primary hover:underline" href="/app/activation">
                    Continue activation
                  </Link>
                </div>
              </SectionShell>
            </div>
          </div>
        </>
      ) : null}
    </PageShell>
  );
}
