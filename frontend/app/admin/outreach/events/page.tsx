"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { OutreachSubnav } from "@/components/admin/outreach-subnav";
import { fetchAdminOutreachEvents } from "@/lib/api";
import type { OutreachActivityEvent } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";

export default function AdminOutreachEventsPage() {
  const { showToast } = useToast();
  const [eventType, setEventType] = useState("ALL");
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState<OutreachActivityEvent[]>([]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (eventType !== "ALL") params.set("eventType", eventType);
    if (search.trim()) params.set("search", search.trim());
    return `?${params.toString()}`;
  }, [eventType, search]);

  useEffect(() => {
    async function load() {
      try {
        const eventData = await fetchAdminOutreachEvents(query);
        setEvents(eventData.events || []);
      } catch (error) {
        showToast({
          title: "Could not load outreach events",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "error"
        });
      }
    }
    void load();
  }, [query, showToast]);

  return (
    <AdminGuard requireSuperAdmin>
      <div className="container py-10 space-y-6">
        <AdminTopTabs />
        <PageHeader
          eyebrow="Internal growth"
          title="Outreach Events"
          description="Review every email send, AI call attempt, provider response, reply, and failure from internal outreach."
        />
        <OutreachSubnav />

        <Card>
          <CardContent className="grid gap-3 p-5 md:grid-cols-2">
            <select
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
            >
              <option value="ALL">All event types</option>
              {["QUEUED", "SENT", "STARTED", "COMPLETED", "FAILED", "REPLIED", "UNSUBSCRIBED", "BOUNCED"].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <Input placeholder="Search email, phone, company, subject, or summary" value={search} onChange={(event) => setSearch(event.target.value)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Event history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.length ? (
              events.map((event) => (
                <div key={`${event.channel}-${event.id}`} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {event.channel === "EMAIL"
                          ? event.subject || "Email outreach"
                          : event.summary || `${event.callerConfig?.name || "Caller AI"} phone outreach`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {event.channel === "EMAIL" ? event.toEmail : event.toPhone}
                        {event.lead?.companyName ? ` • ${event.lead.companyName}` : ""}
                      </div>
                    </div>
                    <div className="text-sm">{event.channel} • {event.eventType}</div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                    {event.channel === "EMAIL" && event.providerMessageId ? ` • provider ${event.providerMessageId}` : ""}
                    {event.channel === "PHONE" && event.providerCallId ? ` • call ${event.providerCallId}` : ""}
                  </div>
                  {event.channel === "PHONE" && event.status ? (
                    <div className="mt-2 text-sm text-muted-foreground">Status: {event.status}</div>
                  ) : null}
                  {event.channel === "PHONE" && event.summary ? (
                    <div className="mt-2 text-sm text-foreground">{event.summary}</div>
                  ) : null}
                  {event.errorMessage ? <div className="mt-2 text-sm text-red-700">{event.errorMessage}</div> : null}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No outreach events yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminGuard>
  );
}
