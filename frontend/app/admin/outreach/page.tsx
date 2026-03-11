"use client";

import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { OutreachSubnav } from "@/components/admin/outreach-subnav";
import { fetchAdminOutreachOverview, runAdminOutreachTick } from "@/lib/api";
import type { OutreachOverview } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { useToast } from "@/components/site/toast-provider";

export default function AdminOutreachOverviewPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<OutreachOverview | null>(null);

  async function load() {
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
  }

  useEffect(() => {
    void load();
  }, []);

  async function runTick() {
    try {
      const result = await runAdminOutreachTick();
      showToast({
        title: "Runner completed",
        description: `Processed ${result.processed}, sent ${result.sent}, failed ${result.failed}.`
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

  return (
    <AdminGuard requireSuperAdmin>
      <div className="container py-10 space-y-6">
        <AdminTopTabs />
        <PageHeader
          eyebrow="Internal growth"
          title="Outreach"
          description="Manage internal outbound cold email for Khan Automation and track the full prospecting pipeline."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void load()}>
                Refresh
              </Button>
              <Button onClick={() => void runTick()}>Run sender</Button>
            </div>
          }
        />
        <OutreachSubnav />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Total leads", value: data?.totalLeads ?? 0 },
            { label: "Active enrollments", value: data?.activeEnrollments ?? 0 },
            { label: "Emails sent", value: data?.emailsSent ?? 0 },
            { label: "Replies", value: data?.replies ?? 0 },
            { label: "Unsubscribes", value: data?.unsubscribes ?? 0 }
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="p-5">
                <p className="page-eyebrow">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.recentEvents?.length ? (
              data.recentEvents.map((event) => (
                <div key={event.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">
                      {event.eventType} · {event.subject || "No subject"}
                    </div>
                    <div className="text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="mt-1 text-muted-foreground">{event.toEmail}</div>
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
