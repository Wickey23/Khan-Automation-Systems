"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  MessageSquare,
  PhoneCall,
  RefreshCcw,
  Rocket
} from "lucide-react";
import {
  fetchAppointmentRequests,
  fetchOrgAnalytics,
  fetchOrgCalls,
  fetchOrgHealth,
  fetchOrgMessages,
  fetchOrgProfile,
  getBillingStatus
} from "@/lib/api";
import type {
  AppointmentRequest,
  BillingStatusPayload,
  OrgAnalytics,
  OrgCallRecord,
  OrgHealth,
  OrgMessageThread
} from "@/lib/types";
import { StateCard } from "@/components/stitch/components/app/StateCard";
import { cn } from "@/lib/utils";

type ActivityItem = {
  id: string;
  title: string;
  description: string;
  at: string;
  status: "answered" | "requested" | "confirmed" | "missed";
};

function shortRelative(value: string | null | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)} mins ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  if (hours < 48) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

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
      fetchOrgCalls({ page: 1, pageSize: 10 }),
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
        if (failedAll) setError("Could not load dashboard data. Check API connectivity and try again.");
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
      { title: "Total Calls", value: analytics?.kpis.totalCalls ?? 0, icon: PhoneCall, trend: "7-Day Trend", color: "primary", href: "/app/calls" },
      { title: "Missed Calls", value: analytics?.kpis.missedCalls ?? 0, icon: AlertTriangle, trend: analytics?.kpis.missedCalls ? `+${analytics.kpis.missedCalls}%` : "0%", color: "error", href: "/app/calls" },
      { title: "Active Conversations", value: analytics?.kpis.smsThreads ?? 0, icon: MessageSquare, trend: "Live", color: "neutral", href: "/app/messages" },
      { title: "New Bookings", value: analytics?.kpis.appointmentRequests ?? 0, icon: Calendar, trend: "New", color: "purple", href: "/app/appointments" }
    ],
    [analytics]
  );

  const attentionItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      description: string;
      priority: "high" | "medium" | "low";
      ctaText: string;
      ctaHref: string;
      status: string;
    }> = [];

    if (billing?.subscription && !["active", "trialing"].includes(billing.subscription.status)) {
      items.push({
        id: "billing",
        title: "Billing needs action",
        description: "Subscription is not active. Some runtime automation may be limited until billing is resolved.",
        priority: "high",
        ctaText: "Open billing",
        ctaHref: "/app/billing",
        status: "Critical"
      });
    }

    if (pendingReviewCount > 0) {
      items.push({
        id: "booking-review",
        title: `${pendingReviewCount} booking request${pendingReviewCount === 1 ? "" : "s"} pending`,
        description: "System attempted callback and automation follow-up. Requires manual review.",
        priority: "medium",
        ctaText: "Open appointments",
        ctaHref: "/app/appointments",
        status: "Processing"
      });
    }

    if (health?.level === "RED" || health?.level === "YELLOW") {
      items.push({
        id: "runtime",
        title: health.level === "RED" ? "Runtime health is critical" : "Runtime health needs review",
        description: health.summary,
        priority: health.level === "RED" ? "high" : "medium",
        ctaText: "Open activation",
        ctaHref: "/app/activation",
        status: health.level === "RED" ? "Critical" : "Processing"
      });
    }

    if (!items.length) {
      items.push({
        id: "fallback-1",
        title: "No blocking issues",
        description: "System health and queue processing are stable.",
        priority: "low",
        ctaText: "Open calls",
        ctaHref: "/app/calls",
        status: "Healthy"
      });
    }

    return items.slice(0, 2);
  }, [billing, health, pendingReviewCount]);

  const activity = useMemo<ActivityItem[]>(() => {
    const callItems: ActivityItem[] = calls.slice(0, 4).map((call) => ({
      id: `call-${call.id}`,
      title: `Call from ${call.frontDesk?.callerName || call.fromNumber}`,
      description: call.summary || `${call.fromNumber} -> ${call.toNumber}`,
      at: call.startedAt,
      status: call.outcome === "MISSED" || call.outcome === "ABANDONED" ? "missed" : "answered"
    }));
    const smsItems: ActivityItem[] = threads.slice(0, 2).map((thread) => ({
      id: `sms-${thread.id}`,
      title: `SMS with ${thread.contactName || thread.contactPhone}`,
      description: thread.messages?.[thread.messages.length - 1]?.body || "Conversation updated",
      at: thread.lastMessageAt,
      status: "confirmed"
    }));
    const bookingItems: ActivityItem[] = requests.slice(0, 2).map((request) => ({
      id: `booking-${request.id}`,
      title: `Booking requested by ${request.customerName}`,
      description: request.issueSummary || "Customer requested booking assistance.",
      at: request.lastEventAt || request.createdAt,
      status: request.status === "APPROVED" || request.status === "SCHEDULED" ? "confirmed" : "requested"
    }));

    return [...callItems, ...smsItems, ...bookingItems]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 4);
  }, [calls, requests, threads]);

  if (loading) {
    return <StateCard type="loading" title="Loading dashboard" description="Fetching calls, messages, bookings, and health signals." />;
  }

  if (error) {
    return <StateCard type="error" title="Dashboard unavailable" description={error} ctaText="Retry" ctaHref="/app" />;
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[46px] font-semibold tracking-tight text-on-surface">Operational Pulse</h1>
          <p className="text-[30px] text-on-surface-variant">Real-time system performance and volume.</p>
        </div>
        <div className={cn("rounded-md border px-3 py-1.5 text-xs font-semibold", live ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-[#dbe4ea] text-slate-700")}>
          Live View
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Link key={metric.title} href={metric.href} className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-6 shadow-sm transition hover:shadow-md">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl",
                  metric.color === "primary" && "bg-[#e7edff] text-[#3254d4]",
                  metric.color === "error" && "bg-[#fde9e9] text-[#c43b3b]",
                  metric.color === "neutral" && "bg-[#ecf0f5] text-[#667389]",
                  metric.color === "purple" && "bg-[#efeaff] text-[#6b54c8]"
                )}
              >
                <metric.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#3254d4]">{metric.trend}</span>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{metric.title}</p>
            <p className="mt-2 text-5xl font-semibold tracking-tight text-slate-900">{metric.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <section className="space-y-6 xl:col-span-5">
          <div>
            <h2 className="text-[46px] font-semibold tracking-tight text-on-surface">Attention Center</h2>
            <p className="text-[30px] text-on-surface-variant">Actionable critical system alerts.</p>
          </div>

          <div className="space-y-4">
            {attentionItems.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("mt-0.5 rounded-lg p-2", item.priority === "high" ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-600")}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
                      <p className="mt-1 text-[26px] leading-snug text-slate-600">{item.description}</p>
                    </div>
                  </div>
                  <span className={cn("rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]", item.priority === "high" ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-700")}>
                    {item.status}
                  </span>
                </div>
                <Link href={item.ctaHref} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#2f54d8] hover:underline">
                  {item.ctaText}
                </Link>
              </article>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5 shadow-sm">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Quick Navigation</p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/app/calls" className="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <PhoneCall className="mx-auto mb-2 h-4 w-4 text-[#2f54d8]" />
                Calls
              </Link>
              <Link href="/app/messages" className="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <MessageSquare className="mx-auto mb-2 h-4 w-4 text-[#2f54d8]" />
                Messages
              </Link>
              <Link href="/app/appointments" className="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <CalendarDays className="mx-auto mb-2 h-4 w-4 text-[#2f54d8]" />
                Schedules
              </Link>
              <Link href="/app/activation" className="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Rocket className="mx-auto mb-2 h-4 w-4 text-[#2f54d8]" />
                Activation
              </Link>
            </div>
            <button
              onClick={() => setRefreshTick((v) => v + 1)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh data
            </button>
            <p className="mt-3 text-xs text-slate-500">Health summary: {health?.summary || "No health summary available"} (Last activity {formatWhen(health?.metrics?.recentActivityAt)})</p>
          </div>
        </section>

        <section className="xl:col-span-7">
          <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-6 shadow-sm">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[44px] font-semibold tracking-tight text-on-surface">Recent Activity</h2>
                <p className="text-[30px] text-on-surface-variant">System events from the last 7 days.</p>
              </div>
              <Link href="/app/calls" className="text-sm font-semibold text-[#2f54d8] hover:underline">
                View All Feed
              </Link>
            </div>

            <div className="relative space-y-6 pl-6">
              <div className="absolute left-[10px] top-1 bottom-1 w-px bg-slate-200" />
              {activity.map((item) => (
                <div key={item.id} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[20px] top-2 h-4 w-4 rounded-full border-2 border-white",
                      item.status === "answered" && "bg-blue-100",
                      item.status === "requested" && "bg-indigo-100",
                      item.status === "confirmed" && "bg-slate-200",
                      item.status === "missed" && "bg-rose-100"
                    )}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-semibold text-slate-900">{item.title}</p>
                        <span className={cn(
                          "rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                          item.status === "answered" && "bg-blue-100 text-blue-700",
                          item.status === "requested" && "bg-indigo-100 text-indigo-700",
                          item.status === "confirmed" && "bg-slate-200 text-slate-700",
                          item.status === "missed" && "bg-rose-100 text-rose-700"
                        )}>
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[26px] text-slate-600">{item.description}</p>
                    </div>
                    <span className="text-sm text-slate-500">{shortRelative(item.at)}</span>
                  </div>
                </div>
              ))}
              {!activity.length ? (
                <StateCard type="empty" title="No recent activity" description="System events appear here when calls, SMS, or booking activity is detected." />
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
