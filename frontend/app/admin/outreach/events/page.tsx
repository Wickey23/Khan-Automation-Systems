"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { OutreachSubnav } from "@/components/admin/outreach-subnav";
import { OutreachPhoneEventDetailCard } from "@/components/admin/outreach-phone-event-detail";
import { fetchAdminOutreachEvents, fetchAdminOutreachPhoneEvent, retryAdminOutreachEvent } from "@/lib/api";
import type { OutreachActivityEvent, OutreachPhoneEventDetail } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, PageShell, SectionHeading, SectionShell, WorkflowHint } from "@/components/ui/page";
import { StatusBadge } from "../../../../components/ui/status-badge";
import { StateCard } from "../../../../components/ui/state-card";

const EVENT_TYPES = ["QUEUED", "SENT", "STARTED", "COMPLETED", "FAILED", "REPLIED", "UNSUBSCRIBED", "BOUNCED"] as const;

function humanize(value?: string) {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ").toLowerCase();
}

export default function AdminOutreachEventsPage() {
  const { showToast } = useToast();
  const [eventType, setEventType] = useState("ALL");
  const [channel, setChannel] = useState("ALL");
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState<OutreachActivityEvent[]>([]);
  const [selectedPhoneEvent, setSelectedPhoneEvent] = useState<OutreachPhoneEventDetail | null>(null);
  const [loadingEventId, setLoadingEventId] = useState<string | null>(null);
  const [retryingEventId, setRetryingEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (eventType !== "ALL") params.set("eventType", eventType);
    if (channel !== "ALL") params.set("channel", channel);
    if (search.trim()) params.set("search", search.trim());
    const queryString = params.toString();
    return queryString ? `?${queryString}` : "";
  }, [channel, eventType, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const eventData = await fetchAdminOutreachEvents(query);
      setEvents(eventData.events || []);
    } catch (error) {
      showToast({
        title: "Could not load outreach events",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  }, [query, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openPhoneEvent(id: string) {
    try {
      setLoadingEventId(id);
      const data = await fetchAdminOutreachPhoneEvent(id);
      setSelectedPhoneEvent(data.event);
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

  const handleRetryEvent = useCallback(
    async (event: OutreachActivityEvent) => {
      setRetryingEventId(event.id);
      try {
        const result = await retryAdminOutreachEvent({ eventId: event.id, channel: event.channel });
        showToast({
          title: "Retry queued",
          description: result.message || "This outreach event will be reprocessed shortly.",
          variant: "success"
        });
        await load();
      } catch (error) {
        showToast({
          title: "Retry failed",
          description: error instanceof Error ? error.message : "Try again later.",
          variant: "error"
        });
      } finally {
        setRetryingEventId(null);
      }
    },
    [load, showToast]
  );

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
      <PageShell className="space-y-5">
        <AdminTopTabs />

        <SectionShell className="surface-panel">
          <PageHeader
            eyebrow="Internal growth"
            title="Outreach Logs"
            description="Review every email send and Caller AI attempt with status badges, timestamps, and call detail links."
            actions={
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void load()}>
                  Refresh log
                </Button>
              </div>
            }
          />
          <OutreachSubnav />
        </SectionShell>

        <SectionShell className="surface-panel">
          <WorkflowHint
            title="How to read this log"
            items={[
              { label: "Start here", text: "Use the channel filter as your log switch. Email only shows outbound email events; Caller AI only shows phone activity." },
              { label: "Phone failures", text: "Failed or completed phone events include a link to the intake call detail for transcripts and recordings." },
              { label: "Operator rule", text: "Fix the setup for failed events before running more outreach, and move replied leads into follow-up paths." },
              { label: "Retry action", text: "Manual Retry appears on failed events tied to enrollments after you resolve setup or blocking issues." }
            ]}
          />
        </SectionShell>

        <SectionShell className="surface-panel space-y-5">
          <SectionHeading title="Event volume" description="Counts by channel and priority statuses for quick situational awareness." />
          {loading ? (
            <StateCard variant="loading" title="Loading events" />
          ) : (
            <div className="metric-grid">
              {[
                { label: "Visible events", value: events.length, state: "ready" },
                { label: "Email events", value: summary.email, state: "processing" },
                { label: "Phone events", value: summary.phone, state: summary.failed > 0 ? "failed" : "processing" },
                { label: "Failures in view", value: summary.failed, state: summary.failed > 0 ? "failed" : "ready" }
              ].map((item) => (
                <div key={item.label} className="metric-card space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <StatusBadge kind="job" state={item.state} label={item.state === "ready" ? "Healthy" : undefined} size="xs" />
                  </div>
                  <p className="text-2xl font-black text-slate-950">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </SectionShell>

        <FiltersSection
          channel={channel}
          setChannel={setChannel}
          eventType={eventType}
          setEventType={setEventType}
          search={search}
          setSearch={setSearch}
          load={load}
        />

        <EventsListSection
          events={events}
          loading={loading}
          loadingEventId={loadingEventId}
          retryingEventId={retryingEventId}
          onRetry={handleRetryEvent}
          openPhoneEvent={openPhoneEvent}
        />

        {selectedPhoneEvent ? (
          <OutreachPhoneEventDetailCard event={selectedPhoneEvent} onClose={() => setSelectedPhoneEvent(null)} />
        ) : null}
      </PageShell>
    </AdminGuard>
  );
}

function FiltersSection({
  channel,
  setChannel,
  eventType,
  setEventType,
  search,
  setSearch,
  load
}: {
  channel: string;
  setChannel: (value: string) => void;
  eventType: string;
  setEventType: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  load: () => Promise<void>;
}) {
  return (
    <SectionShell className="surface-panel space-y-4">
      <SectionHeading title="Filters & search" description="Limit the log by channel, event type, or keywords." />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Channel</p>
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
          >
            <option value="ALL">All channels</option>
            <option value="EMAIL">Email only</option>
            <option value="PHONE">Caller AI only</option>
          </select>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Event type</p>
          <select
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
          >
            <option value="ALL">All event types</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {humanize(type)}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Search</p>
          <div className="mt-2 flex items-center gap-3">
            <Input
              className="pl-3"
              placeholder="Search email, phone, company, subject, or summary"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button variant="ghost" size="sm" onClick={() => void load()}>
              Go
            </Button>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

function EventsListSection({
  events,
  loading,
  loadingEventId,
  retryingEventId,
  onRetry,
  openPhoneEvent
}: {
  events: OutreachActivityEvent[];
  loading: boolean;
  loadingEventId: string | null;
  retryingEventId: string | null;
  onRetry: (event: OutreachActivityEvent) => Promise<void>;
  openPhoneEvent: (id: string) => Promise<void>;
}) {
  return (
    <SectionShell className="surface-panel space-y-4">
      <SectionHeading title="Event history" description="Each row summarizes the outcome, status, and links to related data." />
      {loading ? (
        <StateCard variant="loading" title="Loading history" description="Refreshing event activity." />
      ) : events.length ? (
        <div className="space-y-3">
          {events.map((event) => {
            const isFailed = event.eventType === "FAILED";
            const hasEnrollment = Boolean(event.enrollmentId);
            const hasCallerConfig = event.channel === "EMAIL" || Boolean(event.callerConfigId);
            const canRetry = isFailed && hasEnrollment && hasCallerConfig;
            const retryHint = !isFailed
              ? "Only failed outreach events can be retried."
              : !hasEnrollment
                ? "This event must stay tied to an enrollment to be retried."
                : event.channel === "PHONE" && !event.callerConfigId
                  ? "Caller AI configuration is required for phone retries."
                  : "Retry is not available for this event.";
            return (
              <div key={`${event.channel}-${event.id}`} className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.34)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="max-w-[65%]">
                  <p className="text-lg font-semibold text-slate-900">
                    {event.channel === "EMAIL" ? event.subject || "Email outreach" : event.summary || `${event.callerConfig?.name || "Caller AI"} phone outreach`}
                  </p>
                  <p className="text-sm text-slate-500">
                    {event.channel === "EMAIL" ? event.toEmail : event.toPhone}
                    {event.lead?.companyName ? ` - ${event.lead.companyName}` : ""}
                  </p>
                </div>
                <StatusBadge kind={event.channel === "PHONE" ? "call" : "sms"} state={event.eventType} label={humanize(event.eventType)} size="xs" />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <span>{new Date(event.createdAt).toLocaleString()}</span>
                <span>
                  {event.channel === "EMAIL" && event.providerMessageId ? `provider ${event.providerMessageId}` : ""}
                  {event.channel === "PHONE" && event.providerCallId ? `call ${event.providerCallId}` : ""}
                </span>
              </div>
              {event.channel === "PHONE" && event.status ? (
                <div className="mt-2 text-sm text-slate-500">Status: {humanize(event.status)}</div>
              ) : null}
              {event.channel === "PHONE" && event.summary ? (
                <div className="mt-2 text-sm text-slate-600">{event.summary}</div>
              ) : null}
              {event.errorMessage ? <div className="mt-2 text-sm text-rose-600">{event.errorMessage}</div> : null}
              {event.channel === "PHONE" ? (
                <div className="mt-3">
                  <Button
                    className="inline-flex items-center gap-2"
                    size="sm"
                    variant="outline"
                    disabled={loadingEventId === event.id}
                    onClick={() => void openPhoneEvent(event.id)}
                  >
                    {loadingEventId === event.id ? "Loading..." : "Open call detail"}
                  </Button>
                </div>
              ) : null}
              <div className="mt-3">
                {canRetry ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={retryingEventId === event.id}
                    onClick={() => void onRetry(event)}
                  >
                    {retryingEventId === event.id ? "Retrying..." : "Retry event"}
                  </Button>
                ) : (
                  <p className="text-xs text-slate-500">{retryHint}</p>
                )}
              </div>
            </div>
          );
          })}
        </div>
      ) : (
        <StateCard variant="empty" title="No outreach events" description="No email or Caller AI activity found for the current filters." />
      )}
    </SectionShell>
  );
}


