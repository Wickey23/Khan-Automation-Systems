"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { OutreachSubnav } from "@/components/admin/outreach-subnav";
import { PageHeader, PageShell, SectionHeading, SectionShell, WorkflowHint } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "../../../components/ui/status-badge";
import { StateCard } from "../../../components/ui/state-card";
import { fetchAdminOutreachOverview, runAdminOutreachTick } from "@/lib/api";
import type { OutreachOverview } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";

type AttentionItem = {
  title: string;
  text: string;
  href: string;
  state: string;
};

export default function AdminOutreachOverviewPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<OutreachOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const overview = await fetchAdminOutreachOverview();
      setData(overview);
    } catch (error) {
      showToast({
        title: "Could not load outreach",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runTick() {
    try {
      const result = await runAdminOutreachTick();
      showToast({
        title: "Runner completed",
        description: `Processed ${result.processed}, emailed ${result.sent}, AI calls ${result.phoneStarted ?? 0}, failed ${result.failed}.`
      });
      await load();
    } catch (error) {
      showToast({
        title: "Runner failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  const scorecards = useMemo(
    () => [
      { label: "Total leads", value: data?.totalLeads ?? 0 },
      { label: "Email lanes live", value: data?.activeEnrollments ?? 0 },
      { label: "Caller AI lanes live", value: data?.activePhoneEnrollments ?? 0 },
      { label: "Email failures", value: data?.failedEmails ?? 0, state: (data?.failedEmails ?? 0) > 0 ? "failed" : "ready" },
      { label: "Call failures", value: data?.failedCalls ?? 0, state: (data?.failedCalls ?? 0) > 0 ? "failed" : "ready" },
      { label: "Replied leads", value: data?.replies ?? 0, state: (data?.replies ?? 0) > 0 ? "warning" : "ready" },
      { label: "Dual-channel conflicts", value: data?.activeMultiChannelLeads ?? 0, state: (data?.activeMultiChannelLeads ?? 0) > 0 ? "warning" : "ready" },
      { label: "Unsubscribes", value: data?.unsubscribes ?? 0 }
    ],
    [data]
  );

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    if ((data?.failedCalls ?? 0) > 0) {
      items.push({
        title: "Caller AI failures need review",
        text: `${data?.failedCalls ?? 0} call attempts failed. Review Events first, then fix the Caller AI provider setup before retrying.`,
        href: "/admin/outreach/events?channel=PHONE&eventType=FAILED",
        state: "failed"
      });
    }
    if ((data?.failedEmails ?? 0) > 0) {
      items.push({
        title: "Email sends are failing",
        text: `${data?.failedEmails ?? 0} email events failed. Review the email log before restarting the sequences.`,
        href: "/admin/outreach/events?channel=EMAIL&eventType=FAILED",
        state: "failed"
      });
    }
    if ((data?.replies ?? 0) > 0) {
      items.push({
        title: "Replied leads need a decision",
        text: `${data?.replies ?? 0} leads replied. Move them forward or archive them to keep outreach calm.`,
        href: "/admin/outreach/leads?status=REPLIED",
        state: "warning"
      });
    }
    if ((data?.activeMultiChannelLeads ?? 0) > 0) {
      items.push({
        title: "Dual-channel conflicts",
        text: `${data?.activeMultiChannelLeads ?? 0} leads are live in both email and phone. Prioritize how you want to handle each case.`,
        href: "/admin/outreach/leads",
        state: "warning"
      });
    }
    return items;
  }, [data]);

  const operationalRead = useMemo(
    () => [
      {
        title: "Email lane",
        state: (data?.failedEmails ?? 0) > 0 ? "failed" : data?.activeEnrollments ? "processing" : "locked",
        primary: data?.activeEnrollments
          ? `${data.activeEnrollments} email lanes are live.`
          : "No active email lanes are live right now.",
        secondary: data?.failedEmails ? "Failed sends need review before adding new leads." : "Email throughput is healthy."
      },
      {
        title: "Caller AI lane",
        state: (data?.failedCalls ?? 0) > 0 ? "failed" : data?.activePhoneEnrollments ? "processing" : "locked",
        primary: data?.activePhoneEnrollments
          ? `${data.activePhoneEnrollments} Caller AI lanes are running.`
          : "No Caller AI lanes are queued or running.",
        secondary: data?.failedCalls ? "Fix provider or AI profile issues before retrying calls." : "Caller AI is stable."
      },
      {
        title: "Lead handling",
        state: (data?.replies ?? 0) > 0 ? "warning" : (data?.activeMultiChannelLeads ?? 0) > 0 ? "warning" : "ready",
        primary: data?.replies
          ? `${data.replies} replied leads need a decision.`
          : "No replied leads are waiting on follow-up.",
        secondary:
          (data?.activeMultiChannelLeads ?? 0) > 0
            ? `${data?.activeMultiChannelLeads ?? 0} dual-lane conflicts are live. Clean them up to rein in outreach.`
            : "Lead routing looks healthy."
      }
    ],
    [data]
  );

  return (
    <AdminGuard requireSuperAdmin>
      <PageShell className="space-y-6">
        <AdminTopTabs />

        <SectionShell className="surface-panel space-y-6">
          <PageHeader
            eyebrow="Internal growth"
            title="Outreach"
            description="Manage outbound AI calling and email automation while keeping logs, replies, and lane health visible in one calm control surface."
            actions={
              <div className="flex flex-wrap gap-2">
                <Link href="/admin/outreach/events?channel=EMAIL">
                  <Button variant="outline">Email log</Button>
                </Link>
                <Link href="/admin/outreach/events?channel=PHONE">
                  <Button variant="outline">Call log</Button>
                </Link>
                <Button variant="outline" onClick={() => void load()}>
                  Refresh
                </Button>
                <Button onClick={() => void runTick()}>Run outreach</Button>
              </div>
            }
          />
          <OutreachSubnav />
        </SectionShell>

        <SectionShell className="surface-panel">
          <PageHeader
            eyebrow="Guides and playbooks"
            title="How to run outreach"
            description="Keep the outbound machine calm: clear failures, assign lanes, and verify Caller AI before ramping volume."
          />
          <WorkflowHint
            title="Playbook"
            items={[
              { label: "Overview", text: "Check for email or call failures, replied leads, and dual-lane conflicts on this page before scaling." },
              { label: "Do first", text: "Resolve failing sends and calls to keep the automation trustworthy." },
              { label: "Go next", text: "Use Leads, Email log, and Call log to review outcomes and confirm Caller AI readiness." }
            ]}
          />
        </SectionShell>

        <SectionShell className="surface-panel space-y-6">
          <SectionHeading
            title="Outreach metrics"
            description="High-level counts for current leads, lane health, and areas that need rapid attention."
          />
          {loading ? (
            <StateCard variant="loading" />
          ) : (
            <div className="metric-grid">
              {scorecards.map((item) => (
                <div key={item.label} className="metric-card flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    {item.state ? (
                      <StatusBadge kind="job" state={item.state} label={item.state === "ready" ? "Healthy" : undefined} size="xs" />
                    ) : null}
                  </div>
                  <p className={`text-2xl font-black text-slate-950 ${item.state === "failed" ? "text-rose-600" : item.state === "warning" ? "text-amber-600" : ""}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionShell>

        <SectionShell className="surface-panel space-y-6">
          <SectionHeading title="Action needed now" description="Poor outcomes, replied leads, and dual-lane conflicts that require a decision." />
          {loading ? (
            <StateCard variant="loading" title="Assessing outreach health" description="Checking for failures and attention items." />
          ) : attentionItems.length ? (
            <div className="space-y-3">
              {attentionItems.map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.34)]">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <StatusBadge kind="job" state={item.state} label={item.state === "failed" ? "Issue" : humanize(item.state)} size="xs" />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{item.text}</p>
                  <div className="mt-3">
                    <Link href={item.href} className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                      Open related page
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <StateCard
              variant="empty"
              title="No immediate issues"
              description="Outreach is healthy. Continue loading leads, tuning sequences, and monitoring the logs."
            />
          )}
        </SectionShell>

        <SectionShell className="surface-panel space-y-6">
          <SectionHeading
            title="Operational read"
            description="Lane-level context showing whether the email lane, Caller AI lane, or lead handling needs intervention."
          />
          {loading ? (
            <StateCard variant="loading" title="Gathering lane insights" description="Pulling the latest lane health data." />
          ) : (
            <div className="space-y-4">
              {operationalRead.map((lane) => (
                <div key={lane.title} className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.34)]">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold text-slate-900">{lane.title}</p>
                    <StatusBadge kind="job" state={lane.state} label={humanize(lane.state)} size="xs" />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{lane.primary}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{lane.secondary}</p>
                </div>
              ))}
            </div>
          )}
        </SectionShell>

        <SectionShell className="surface-panel space-y-6">
          <SectionHeading title="Recent activity" description="Email and Caller AI events with context, errors, and timestamps." />
          {loading ? (
            <StateCard variant="loading" title="Loading events" description="Fetching recent outreach activity." />
          ) : data?.recentEvents?.length ? (
            <div className="space-y-3">
              {data.recentEvents.map((event) => (
                <div key={`${event.channel}-${event.id}`} className="rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-[0_14px_24px_-22px_rgba(15,23,42,0.32)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold text-slate-900">
                        {event.channel} - {event.eventType}
                        <span className="ml-2 text-xs uppercase tracking-[0.18em] text-slate-400">{event.channel === "EMAIL" ? "Email" : "Phone"}</span>
                      </p>
                      <p className="text-sm text-slate-500">{event.channel === "EMAIL" ? event.subject || "Email outreach" : event.summary || "Phone outreach"}</p>
                    </div>
                    <StatusBadge kind={event.channel === "PHONE" ? "call" : "sms"} state={event.eventType} label={humanize(event.eventType)} size="xs" />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                    <span>{new Date(event.createdAt).toLocaleString()}</span>
                    <span>
                      {event.channel === "EMAIL" ? event.toEmail : event.toPhone}
                      {event.errorMessage ? ` - ${event.errorMessage}` : ""}
                    </span>
                  </div>
                  {event.channel === "PHONE" && event.summary ? <p className="mt-2 text-sm text-slate-500">{event.summary}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <StateCard variant="empty" title="No outreach activity" description="No email or Caller AI events recorded yet." />
          )}
        </SectionShell>
      </PageShell>
    </AdminGuard>
  );
}

function humanize(value?: string | null) {
  if (!value) return "Unknown";
  return value.replaceAll("_", " ");
}

