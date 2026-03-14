"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { OutreachSubnav } from "@/components/admin/outreach-subnav";
import { OutreachPhoneEventDetailCard } from "@/components/admin/outreach-phone-event-detail";
import { fetchAdminOutreachEvents, fetchAdminOutreachPhoneEvent } from "@/lib/api";
import type { OutreachActivityEvent, OutreachPhoneEventDetail } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader, WorkflowHint } from "@/components/ui/page";

export default function AdminOutreachEventsPage() {
  const { showToast } = useToast();
  const [eventType, setEventType] = useState("ALL");
  const [channel, setChannel] = useState("ALL");
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState<OutreachActivityEvent[]>([]);
  const [selectedPhoneEvent, setSelectedPhoneEvent] = useState<OutreachPhoneEventDetail | null>(null);
  const [loadingEventId, setLoadingEventId] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (eventType !== "ALL") params.set("eventType", eventType);
    if (channel !== "ALL") params.set("channel", channel);
    if (search.trim()) params.set("search", search.trim());
    const queryString = params.toString();
    return queryString ? `?${queryString}` : "";
  }, [channel, eventType, search]);

  const load = useCallback(async () => {
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
  }, [query, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openPhoneEvent(id: string) {
    try {
      setLoadingEventId(id);
      const event = await fetchAdminOutreachPhoneEvent(id);
      setSelectedPhoneEvent(event);
    } catch (error) {
      showToast({
        title: "Could not load outreach call detail",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setLoadingEventId(null);
    }
  }

  const summary = useMemo(() => {
    return {
      email: events.filter((event) => event.channel === "EMAIL").length,
      phone: events.filter((event) => event.channel === "PHONE").length,
      failed: events.filter((event) => event.eventType === "FAILED").length,
      replies: events.filter((event) => event.eventType === "REPLIED").length
    };
  }, [events]);

  return (
    <AdminGuard requireSuperAdmin>
      <div className="container py-10 space-y-6">
        <AdminTopTabs />
        <PageHeader
          eyebrow="Internal growth"
          title="Outreach Logs"
          description="Review the email log and call log for every send, AI call attempt, provider response, reply, and failure."
        />
        <OutreachSubnav />
        <WorkflowHint
          title="How to read this log"
          items={[
            { label: "Start here", text: "Use the channel filter as your log switch. Email only is your email log. Caller AI only is your call log." },
            { label: "Phone failures", text: "Open the call detail for failed or completed phone events to inspect transcript, summary, recording link, provider call ID, and the caller profile used." },
            { label: "Operator rule", text: "A failed event means fix the setup before running more outreach in that lane. A replied lead means move it into a real follow-up path." }
          ]}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="p-5"><p className="page-eyebrow">Visible events</p><p className="mt-2 text-2xl font-semibold">{events.length}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="page-eyebrow">Email events</p><p className="mt-2 text-2xl font-semibold">{summary.email}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="page-eyebrow">Phone events</p><p className="mt-2 text-2xl font-semibold">{summary.phone}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="page-eyebrow">Failures in view</p><p className={`mt-2 text-2xl font-semibold ${summary.failed ? "text-red-700" : ""}`}>{summary.failed}</p></CardContent></Card>
        </div>

        <Card>
          <CardContent className="grid gap-3 p-5 md:grid-cols-3">
            <select
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
            >
              <option value="ALL">All channels</option>
              <option value="EMAIL">Email only</option>
              <option value="PHONE">Caller AI only</option>
            </select>
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
                        {event.lead?.companyName ? ` · ${event.lead.companyName}` : ""}
                      </div>
                    </div>
                    <div className="text-sm">{event.channel} · {event.eventType}</div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                    {event.channel === "EMAIL" && event.providerMessageId ? ` · provider ${event.providerMessageId}` : ""}
                    {event.channel === "PHONE" && event.providerCallId ? ` · call ${event.providerCallId}` : ""}
                  </div>
                  {event.channel === "PHONE" && event.status ? (
                    <div className="mt-2 text-sm text-muted-foreground">Status: {event.status}</div>
                  ) : null}
                  {event.channel === "PHONE" && event.summary ? (
                    <div className="mt-2 text-sm text-foreground">{event.summary}</div>
                  ) : null}
                  {event.errorMessage ? <div className="mt-2 text-sm text-red-700">{event.errorMessage}</div> : null}
                  {event.channel === "PHONE" ? (
                    <div className="mt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loadingEventId === event.id}
                        onClick={() => void openPhoneEvent(event.id)}
                      >
                        {loadingEventId === event.id ? "Loading..." : "View call details"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No outreach events yet.</div>
            )}
          </CardContent>
        </Card>

        {selectedPhoneEvent ? (
          <OutreachPhoneEventDetailCard
            event={selectedPhoneEvent}
            onClose={() => setSelectedPhoneEvent(null)}
          />
        ) : null}
      </div>
    </AdminGuard>
  );
}
