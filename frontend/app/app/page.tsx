"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2, Mail, Phone, RefreshCw, Sparkles, UserPlus } from "lucide-react";
import {
  fetchAppointmentRequests,
  fetchOrgCalls,
  fetchOrgLeads,
  fetchOrgMessages,
  fetchOrgOnboarding
} from "@/lib/api";
import type { AppointmentRequest, Lead, OrgCallRecord, OrgMessageThread } from "@/lib/types";
import { cn } from "@/lib/utils";

type DashboardState = {
  calls: OrgCallRecord[];
  leads: Lead[];
  requests: AppointmentRequest[];
  threads: OrgMessageThread[];
  onboardingStatus: string | null;
};

function formatRelative(value: string | null | undefined) {
  if (!value) return "Just now";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "FD";
}

function leadStatusTone(priority?: string | null) {
  if (priority === "urgent") return { color: "text-red-600", bg: "bg-red-100", label: "Urgent" };
  if (priority === "high") return { color: "text-amber-600", bg: "bg-amber-100", label: "Pending" };
  if (priority === "normal") return { color: "text-blue-600", bg: "bg-blue-100", label: "New" };
  return { color: "text-slate-600", bg: "bg-slate-100", label: "Follow-up" };
}

function bookingLabel(request: AppointmentRequest) {
  switch (request.status) {
    case "PENDING_REVIEW":
      return "Needs review";
    case "APPROVED":
      return "Ready to book";
    case "SLOT_OFFERED":
      return "Offer sent";
    case "SCHEDULED":
      return "Booked";
    default:
      return "Request";
  }
}

function threadPreview(thread: OrgMessageThread) {
  const latest = [...(thread.messages || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  return latest?.body || "Customer thread opened.";
}

export default function AppOverviewPage() {
  const [state, setState] = useState<DashboardState>({
    calls: [],
    leads: [],
    requests: [],
    threads: [],
    onboardingStatus: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetchOrgCalls({ page: 1, pageSize: 10 }),
      fetchOrgLeads(),
      fetchAppointmentRequests(),
      fetchOrgMessages(),
      fetchOrgOnboarding()
    ])
      .then(([calls, leads, requests, messages, onboarding]) => {
        if (!active) return;
        setState({
          calls: calls.calls || [],
          leads: leads.leads || [],
          requests: requests.requests || [],
          threads: messages.threads || [],
          onboardingStatus: onboarding.submission?.status || null
        });
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const callsToday = state.calls.filter((call) => {
      const date = new Date(call.startedAt);
      const now = new Date();
      return date.toDateString() === now.toDateString();
    }).length;
    const activeLeads = state.leads.filter((lead) => lead.frontDesk?.needsFollowUp || lead.pipelineStage !== "COMPLETED").length;
    const bookings = state.requests.filter((request) => request.status === "SCHEDULED" || request.status === "APPROVED").length;
    return [
      { label: "Total Calls", value: String(state.calls.length), trend: callsToday > 0 ? `+${callsToday} today` : "No calls today", icon: Phone, color: "text-emerald-500", path: "M0,15 Q25,5 50,15 T100,5" },
      { label: "Active Leads", value: String(activeLeads), trend: state.leads.length ? `${state.leads.length} in queue` : "No leads yet", icon: UserPlus, color: "text-emerald-500", path: "M0,18 Q30,15 45,5 T80,12 T100,2" },
      { label: "Bookings", value: String(bookings), trend: state.requests.length ? `${state.requests.length} requests` : "No bookings yet", icon: Calendar, color: "text-emerald-500", path: "M0,10 Q10,20 30,5 T70,15 T100,5" }
    ];
  }, [state.calls, state.leads, state.requests]);

  const actionItems = useMemo(() => {
    const urgentCalls = state.calls
      .filter((call) => call.frontDesk?.needsFollowUp)
      .slice(0, 2)
      .map((call) => ({
        href: `/app/calls?callId=${encodeURIComponent(call.id)}`,
        name: call.frontDesk?.callerName || call.displayName || call.fromNumber,
        source: call.frontDesk?.serviceRequested || "Call queue",
        status: call.frontDesk?.frontDeskPriority || "normal",
        time: formatRelative(call.startedAt),
        action: String(call.frontDesk?.recommendedAction || "Review"),
        initials: initials(call.frontDesk?.callerName || call.displayName || call.fromNumber)
      }));
    const urgentLeads = state.leads
      .filter((lead) => lead.frontDesk?.needsFollowUp)
      .slice(0, 2)
      .map((lead) => ({
        href: `/app/leads?leadId=${encodeURIComponent(lead.id)}`,
        name: lead.name || lead.phone || "New lead",
        source: lead.source || lead.serviceRequested || "Lead queue",
        status: lead.frontDesk?.frontDeskPriority || "normal",
        time: formatRelative(lead.updatedAt),
        action: String(lead.frontDesk?.recommendedAction || "Review"),
        initials: initials(lead.name || lead.phone || "Lead")
      }));
    return [...urgentCalls, ...urgentLeads].slice(0, 4);
  }, [state.calls, state.leads]);

  const activityItems = useMemo(() => {
    const items: Array<{ title: string; detail: string; time: string; tone: "primary" | "success" | "info" | "warning" }> = [];
    const latestCall = state.calls[0];
    if (latestCall) {
      items.push({
        title: "Inbound Call Logged",
        detail: latestCall.frontDesk?.summary || latestCall.aiSummary || latestCall.summary || `Incoming call from ${latestCall.fromNumber}.`,
        time: formatRelative(latestCall.startedAt),
        tone: "primary"
      });
    }
    const latestBooked = state.requests.find((request) => request.status === "SCHEDULED" || request.status === "APPROVED");
    if (latestBooked) {
      items.push({
        title: "Booking Updated",
        detail: `${latestBooked.customerName || "Customer"} - ${bookingLabel(latestBooked)}`,
        time: formatRelative(latestBooked.lastEventAt),
        tone: "success"
      });
    }
    const latestThread = state.threads[0];
    if (latestThread) {
      items.push({
        title: "Customer Message",
        detail: threadPreview(latestThread),
        time: formatRelative(latestThread.lastMessageAt),
        tone: "info"
      });
    }
    const latestLead = state.leads[0];
    if (latestLead) {
      items.push({
        title: "Lead Queue Updated",
        detail: `${latestLead.name || latestLead.phone || "Lead"} entered the queue.`,
        time: formatRelative(latestLead.updatedAt),
        tone: "warning"
      });
    }
    return items.slice(0, 4);
  }, [state.calls, state.leads, state.requests, state.threads]);

  const onboardingReady = state.onboardingStatus && ["SUBMITTED", "REVIEWED", "APPROVED"].includes(state.onboardingStatus);

  return (
    <div className="flex-1 flex overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="flex-1 overflow-y-auto bg-background-light p-8">
        <div className="mb-8 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Need to reconfigure your workspace?</h3>
              <p className="text-sm text-slate-500">
                {onboardingReady
                  ? "You can restart the setup wizard to update your business preferences at any time."
                  : "Finish the setup wizard so calls, messages, and bookings follow the right routing rules."}
              </p>
            </div>
          </div>
          <Link href="/app/onboarding" className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50">
            <RefreshCw size={18} />
            <span>{onboardingReady ? "Restart Onboarding" : "Complete Setup"}</span>
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{metric.label}</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <metric.icon size={20} />
                </div>
              </div>
              <div>
                <h3 className="text-4xl font-extrabold leading-tight text-slate-900">{loading ? "-" : metric.value}</h3>
                <div className={cn("mt-1 flex items-center gap-2 text-sm font-bold", metric.color)}>
                  <span>{metric.trend}</span>
                </div>
              </div>
              <div className="mt-2 h-12 w-full opacity-50">
                <svg className="h-full w-full text-emerald-500" preserveAspectRatio="none" viewBox="0 0 100 20">
                  <path d={metric.path} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">Action Needed</h2>
            <Link href="/app/leads" className="text-sm font-semibold text-primary hover:underline">View All</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <th className="px-6 py-3">Lead Name</th>
                  <th className="px-6 py-3">Source</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Waiting Since</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td className="px-6 py-8 text-sm text-slate-500" colSpan={5}>Loading front desk work...</td>
                  </tr>
                ) : actionItems.length ? (
                  actionItems.map((item) => {
                    const tone = leadStatusTone(item.status);
                    return (
                      <tr key={`${item.href}-${item.name}`} className="cursor-pointer transition-colors hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-primary">
                              {item.initials}
                            </div>
                            <span className="text-sm font-medium text-slate-900">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{item.source}</td>
                        <td className="px-6 py-4">
                          <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", tone.bg, tone.color)}>
                            {tone.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{item.time}</td>
                        <td className="px-6 py-4 text-right">
                          <Link href={item.href} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90">
                            {item.action}
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-6 py-8 text-sm text-slate-500" colSpan={5}>No urgent customer work is waiting right now.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <aside className="hidden w-80 shrink-0 flex-col border-l border-slate-200 bg-white xl:flex">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900">Recent Activity</h2>
        </div>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          {loading ? (
            <p className="text-sm text-slate-500">Loading activity...</p>
          ) : activityItems.length ? (
            activityItems.map((item, index) => {
              const icon =
                item.tone === "primary" ? <Phone size={14} /> :
                item.tone === "success" ? <CheckCircle2 size={14} /> :
                item.tone === "info" ? <Mail size={14} /> :
                <UserPlus size={14} />;
              const toneClass =
                item.tone === "primary" ? "bg-primary/10 text-primary" :
                item.tone === "success" ? "bg-emerald-100 text-emerald-600" :
                item.tone === "info" ? "bg-blue-100 text-blue-600" :
                "bg-amber-100 text-amber-600";
              return (
                <div key={`${item.title}-${index}`} className="flex gap-4">
                  <div className="relative">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", toneClass)}>{icon}</div>
                    {index < activityItems.length - 1 ? <div className="absolute left-1/2 top-8 h-10 w-0.5 -translate-x-1/2 bg-slate-100" /> : null}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.time}</p>
                    <p className="mt-2 rounded bg-slate-50 p-2 text-xs italic text-slate-500">{item.detail}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">No recent activity yet.</p>
          )}
        </div>
        <div className="border-t border-slate-200 p-6">
          <button className="w-full text-center text-sm font-semibold text-slate-600 transition-colors hover:text-primary">
            Clear Timeline
          </button>
        </div>
      </aside>
    </div>
  );
}
