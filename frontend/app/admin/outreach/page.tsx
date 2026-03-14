"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { OutreachSubnav } from "@/components/admin/outreach-subnav";
import { fetchAdminOutreachOverview, runAdminOutreachTick } from "@/lib/api";
import type { OutreachOverview } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, WorkflowHint } from "@/components/ui/page";
import { useToast } from "@/components/site/toast-provider";

export default function AdminOutreachOverviewPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<OutreachOverview | null>(null);

  const load = useCallback(async () => {
    try {
      const overview = await fetchAdminOutreachOverview();
      setData(overview);
    } catch (error) {
      showToast({
        title: "Could not load outreach",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
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

  const scorecards = useMemo(() => [
    { label: "Total leads", value: data?.totalLeads ?? 0, tone: "default" },
    { label: "Email lanes live", value: data?.activeEnrollments ?? 0, tone: "default" },
    { label: "Caller AI lanes live", value: data?.activePhoneEnrollments ?? 0, tone: "default" },
    { label: "Email failures", value: data?.failedEmails ?? 0, tone: (data?.failedEmails ?? 0) > 0 ? "danger" : "default" },
    { label: "Call failures", value: data?.failedCalls ?? 0, tone: (data?.failedCalls ?? 0) > 0 ? "danger" : "default" },
    { label: "Replied leads", value: data?.replies ?? 0, tone: (data?.replies ?? 0) > 0 ? "warning" : "default" },
    { label: "Dual-channel conflicts", value: data?.activeMultiChannelLeads ?? 0, tone: (data?.activeMultiChannelLeads ?? 0) > 0 ? "warning" : "default" },
    { label: "Unsubscribes", value: data?.unsubscribes ?? 0, tone: "default" }
  ], [data]);

  const attentionItems = useMemo(() => {
    const items: Array<{ title: string; text: string; href: string }> = [];
    if ((data?.failedCalls ?? 0) > 0) {
      items.push({
        title: "Caller AI failures need review",
        text: `${data?.failedCalls ?? 0} call attempts failed. Review Events first, then fix the Caller AI profile or provider setup before retrying.`,
        href: "/admin/outreach/events?channel=PHONE&eventType=FAILED"
      });
    }
    if ((data?.failedEmails ?? 0) > 0) {
      items.push({
        title: "Email sends are failing",
        text: `${data?.failedEmails ?? 0} email events failed. Check the failing subjects and provider responses before starting more email outreach.`,
        href: "/admin/outreach/events?channel=EMAIL&eventType=FAILED"
      });
    }
    if ((data?.replies ?? 0) > 0) {
      items.push({
        title: "Replied leads need a decision",
        text: `${data?.replies ?? 0} leads have replied. Move them out of outreach or hand them off to a real follow-up step.`,
        href: "/admin/outreach/leads?status=REPLIED"
      });
    }
    if ((data?.activeMultiChannelLeads ?? 0) > 0) {
      items.push({
        title: "Some leads are live in both lanes",
        text: `${data?.activeMultiChannelLeads ?? 0} leads have both email and phone lanes active. Decide which lane is primary so outreach does not feel chaotic.`,
        href: "/admin/outreach/leads"
      });
    }
    if (!items.length) {
      items.push({
        title: "No active issues in the last pull",
        text: "Use Leads to load fresh prospects, Sequences to tune the email lane, and Caller AI to verify the phone lane before scaling volume.",
        href: "/admin/outreach/leads"
      });
    }
    return items;
  }, [data]);

  return (
    <AdminGuard requireSuperAdmin>
      <div className="container py-10 space-y-6">
        <AdminTopTabs />
        <PageHeader
          eyebrow="Internal growth"
          title="Outreach"
          description="Manage internal outbound outreach across email and AI calling, and monitor what was sent, called, replied to, or failed."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void load()}>
                Refresh
              </Button>
              <Button onClick={() => void runTick()}>Run outreach</Button>
            </div>
          }
        />
        <OutreachSubnav />
        <WorkflowHint
          title="How to run outreach"
          items={[
            { label: "Overview", text: "Use this page to see whether email or Caller AI is failing, whether replies are stacking up, and whether too many leads are live in both lanes." },
            { label: "Do first", text: "Clear failed sends and failed calls before loading more leads. Broken outbound infrastructure makes the rest of the workflow noisy." },
            { label: "Go next", text: "Open Leads to assign the right lane per prospect, Events to inspect failures, and Caller AI to verify the live outbound setup." }
          ]}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {scorecards.map((item) => (
            <Card key={item.label}>
              <CardContent className="p-5">
                <p className="page-eyebrow">{item.label}</p>
                <p className={`mt-2 text-2xl font-semibold ${item.tone === "danger" ? "text-red-700" : item.tone === "warning" ? "text-amber-700" : ""}`}>
                  {item.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Action needed now</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {attentionItems.map((item) => (
                <div key={item.title} className="rounded-lg border p-4">
                  <div className="font-medium text-slate-950">{item.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                  <div className="mt-3">
                    <Link href={item.href} className="text-sm font-medium text-primary underline underline-offset-4">
                      Open related page
                    </Link>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operational read</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-lg border p-4">
                <div className="font-medium text-foreground">Email lane</div>
                <p className="mt-1">
                  {data?.activeEnrollments
                    ? `${data.activeEnrollments} active email lanes are currently live.`
                    : "No active email lanes are live right now."}{" "}
                  {data?.failedEmails ? "There are failed email attempts to review." : "No email failures are currently surfaced."}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <div className="font-medium text-foreground">Caller AI lane</div>
                <p className="mt-1">
                  {data?.activePhoneEnrollments
                    ? `${data.activePhoneEnrollments} active Caller AI lanes are queued or running.`
                    : "No active Caller AI lanes are queued right now."}{" "}
                  {data?.failedCalls ? "Failed call attempts need provider or profile review." : "No call failures are currently surfaced."}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <div className="font-medium text-foreground">Lead handling</div>
                <p className="mt-1">
                  {data?.replies
                    ? `${data.replies} leads have replied and need a human decision.`
                    : "No replied leads are waiting on a follow-up decision right now."}{" "}
                  {(data?.activeMultiChannelLeads ?? 0) > 0
                    ? `${data?.activeMultiChannelLeads ?? 0} leads are active in both lanes and should be cleaned up.`
                    : "No dual-lane conflicts are currently surfaced."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.recentEvents?.length ? (
              data.recentEvents.map((event) => (
                <div key={`${event.channel}-${event.id}`} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">
                      {event.channel} · {event.eventType} · {event.channel === "EMAIL" ? event.subject || "Email outreach" : event.summary || "Phone outreach"}
                    </div>
                    <div className="text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="mt-1 text-muted-foreground">{event.channel === "EMAIL" ? event.toEmail : event.toPhone}</div>
                  {event.channel === "PHONE" && event.summary ? <div className="mt-1">{event.summary}</div> : null}
                  {event.errorMessage ? <div className="mt-1 text-red-700">{event.errorMessage}</div> : null}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No outreach activity recorded yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminGuard>
  );
}
