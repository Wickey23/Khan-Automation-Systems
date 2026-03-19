"use client";

import { AudioLines, Phone, Radio, Search, Shield, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, PageShell, SectionHeading, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";
import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";
import { useToast } from "@/components/site/toast-provider";
import { deleteAdminCall, fetchAdminCallDetail, fetchAdminCalls, retriggerCallFollowUp, updateCallReviewState } from "@/lib/api";
import type { AdminCallDetail, AdminCallRecord, CallReviewState } from "@/lib/types";

type TimelineEntry = {
  id: string;
  label: string;
  detail?: string;
  time: string;
  kind: "transition" | "job" | "audit" | "booking";
  state?: string;
};

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return "-";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatWhen(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function humanize(value?: string | null) {
  if (!value) return "Unknown";
  return value.replaceAll("_", " ");
}

export default function AdminCallsPage() {
  const { showToast } = useToast();
  const [calls, setCalls] = useState<AdminCallRecord[]>([]);
  const [selectedCall, setSelectedCall] = useState<AdminCallDetail | null>(null);
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState("ALL");
  const [deletePassword, setDeletePassword] = useState("123");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "150");
    if (search.trim()) params.set("search", search.trim());
    if (outcome !== "ALL") params.set("outcome", outcome);
    return `?${params.toString()}`;
  }, [search, outcome]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const data = await fetchAdminCalls(query);
        if (!active) return;
        setCalls(data.calls);
      } catch (error) {
        if (!active) return;
        showToast({
          title: "Failed to load calls",
          description: error instanceof Error ? error.message : "Request failed.",
          variant: "error"
        });
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [query, showToast]);

  async function loadCallDetail(callId: string) {
    setDetailLoadingId(callId);
    try {
      const data = await fetchAdminCallDetail(callId);
      setSelectedCall(data.call);
    } catch (error) {
      showToast({
        title: "Failed to load call details",
        description: error instanceof Error ? error.message : "Request failed.",
        variant: "error"
      });
    } finally {
      setDetailLoadingId(null);
    }
  }

  async function reloadCalls() {
    const data = await fetchAdminCalls(query);
    setCalls(data.calls);
  }

  async function onDelete(call: AdminCallRecord) {
    if (!deletePassword.trim()) {
      showToast({ title: "Delete password required", description: "Enter delete password before deleting.", variant: "error" });
      return;
    }
    if (!window.confirm(`Delete call ${call.providerCallId || call.id}?`)) return;
    setDeletingId(call.id);
    try {
      await deleteAdminCall(call.id, deletePassword);
      setCalls((current) => current.filter((row) => row.id !== call.id));
      if (selectedCall?.id === call.id) setSelectedCall(null);
      showToast({ title: "Call deleted" });
    } catch (error) {
      showToast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Request failed.",
        variant: "error"
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function onView(call: AdminCallRecord) {
    await loadCallDetail(call.id);
  }

  async function refreshSelectedCall() {
    if (!selectedCall) return;
    await loadCallDetail(selectedCall.id);
  }

  const heroStats = useMemo(() => {
    const appointmentRequests = calls.filter((call) => call.outcome === "APPOINTMENT_REQUEST").length;
    const failed = calls.filter((call) => ["MISSED", "ABANDONED"].includes(call.outcome)).length;
    const activeStreams = calls.filter((call) => call.hasMediaStream).length;
    const recorded = calls.filter((call) => !!call.recordingUrl).length;
    return [
      { label: "Calls loaded", value: calls.length, note: "Current review window" },
      { label: "Appointment intent", value: appointmentRequests, note: "Needs scheduling accuracy" },
      { label: "Failed or missed", value: failed, note: "Recovery and quality review" },
      { label: "Media streams", value: activeStreams, note: `${recorded} recordings available` }
    ];
  }, [calls]);

  const timelineEntries = useMemo(() => {
    if (!selectedCall) return [];
    const entries: TimelineEntry[] = [];

    selectedCall.stateTransitions?.forEach((transition) => {
      entries.push({
        id: transition.id,
        label: "State transition",
        detail: `${humanize(transition.fromState)} → ${humanize(transition.toState)}`,
        time: transition.at,
        kind: "transition",
        state: transition.toState
      });
    });

    selectedCall.callAuditTrail?.forEach((entry) => {
      const metadataString = entry.metadata ? JSON.stringify(entry.metadata) : undefined;
      entries.push({
        id: entry.id,
        label: entry.action,
        detail: metadataString,
        time: entry.createdAt,
        kind: "audit",
        state: entry.action
      });
    });

    selectedCall.webhookJobs?.forEach((job) => {
      entries.push({
        id: job.jobId,
        label: job.type,
        detail: job.message || job.status,
        time: job.createdAt,
        kind: "job",
        state: job.status
      });
    });

    if (selectedCall.finalizeBookingJob) {
      entries.push({
        id: selectedCall.finalizeBookingJob.id,
        label: "Booking finalizer",
        detail: selectedCall.finalizeBookingJob.error ?? selectedCall.finalizeBookingJob.status,
        time: selectedCall.finalizeBookingJob.createdAt,
        kind: "booking",
        state: selectedCall.finalizeBookingJob.status
      });
    }

    return entries.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [selectedCall]);

  return (
    <AdminGuard>
      <PageShell className="space-y-6">
        <AdminTopTabs />

        <StatusSummaryHero stats={heroStats} />

        <PageHeader
          eyebrow="Call diagnostics"
          title="Investigate outcomes, recordings, and transcript sessions"
          description="Use the filters to isolate failure patterns, then inspect the selected call for summary quality, media-stream health, and extracted lead or service-request data."
          actions={
            <Button variant="outline" onClick={() => void reloadCalls()}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          }
        />

        <SectionShell className="surface-panel">
          <FiltersToolbar
            outcome={outcome}
            setOutcome={setOutcome}
            search={search}
            setSearch={setSearch}
            deletePassword={deletePassword}
            setDeletePassword={setDeletePassword}
            reloadCalls={reloadCalls}
          />
        </SectionShell>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_420px]">
          <CallListPanel
            calls={calls}
            loading={loading}
            detailLoadingId={detailLoadingId}
            deletingId={deletingId}
            onView={onView}
            onDelete={onDelete}
            reloadCalls={reloadCalls}
          />

          <InvestigationPane
            selectedCall={selectedCall}
            detailLoadingId={detailLoadingId}
            reloadCalls={reloadCalls}
            refreshDetail={refreshSelectedCall}
            timelineEntries={timelineEntries}
          />
        </div>
      </PageShell>
    </AdminGuard>
  );
}

function StatusSummaryHero({ stats }: { stats: { label: string; value: number; note: string }[] }) {
  return (
    <SectionShell className="surface-panel space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-eyebrow flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            <Shield className="h-3.5 w-3.5" />
            Global control plane
          </p>
          <h1 className="mt-2 text-[30px] font-black tracking-[-0.04em]">Global call review</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Review organization traffic, failed outcomes, transcript health, and extracted follow-up data from a single control surface.
          </p>
        </div>
        <div className="grid min-w-[220px] gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Active streams</p>
            <p className="mt-1 text-2xl font-black text-white">{stats[3]?.value ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Failed review</p>
            <p className="mt-1 text-2xl font-black text-rose-300">{stats[2]?.value ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="metric-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="metric-card">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">{stat.value}</p>
            <p className="mt-1 text-xs text-slate-500">{stat.note}</p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function FiltersToolbar({
  outcome,
  setOutcome,
  search,
  setSearch,
  deletePassword,
  setDeletePassword,
  reloadCalls
}: {
  outcome: string;
  setOutcome: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  deletePassword: string;
  setDeletePassword: (value: string) => void;
  reloadCalls: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="page-eyebrow text-xs text-slate-500">Filters</div>
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_260px_auto]">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Outcome</label>
          <select
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
          >
            <option value="ALL">All outcomes</option>
            <option value="APPOINTMENT_REQUEST">Appointment request</option>
            <option value="MESSAGE_TAKEN">Message taken</option>
            <option value="TRANSFERRED">Transferred</option>
            <option value="MISSED">Missed</option>
            <option value="SPAM">Spam</option>
          </select>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search org, call ID, number, or transcript..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Delete password</label>
          <Input
            type="password"
            placeholder="Delete password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
          />
        </div>
        <Button variant="outline" className="items-center gap-2" onClick={() => void reloadCalls()}>
          <Radio className="h-3.5 w-3.5 text-primary" />
          Review queue
        </Button>
      </div>
    </div>
  );
}

function CallListPanel({
  calls,
  loading,
  detailLoadingId,
  deletingId,
  onView,
  onDelete,
  reloadCalls
}: {
  calls: AdminCallRecord[];
  loading: boolean;
  detailLoadingId: string | null;
  deletingId: string | null;
  onView: (call: AdminCallRecord) => Promise<void>;
  onDelete: (call: AdminCallRecord) => Promise<void>;
  reloadCalls: () => Promise<void>;
}) {
  return (
    <SectionShell className="surface-panel">
      <SectionHeading
        title="Call investigations"
        description="Review failure patterns, queue signals, and call health before digging into the detail pane."
        actions={
          <Button variant="ghost" size="sm" onClick={() => void reloadCalls()}>
            Refresh list
          </Button>
        }
      />
      <div className="overflow-hidden rounded-[24px] border border-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
          Overview
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-6 py-4">Call / org</th>
                <th className="px-6 py-4">Numbers</th>
                <th className="px-6 py-4">Summary</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Signals</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calls.map((call) => (
                <tr key={call.id} className="bg-white transition-colors hover:bg-slate-50/80">
                  <td className="px-6 py-4 align-top">
                    <button type="button" className="space-y-1 text-left" onClick={() => void onView(call)}>
                      <p className="text-sm font-bold text-slate-950">{call.providerCallId || call.id}</p>
                      <p className="text-xs text-slate-500">{call.organization?.name || "Unknown organization"}</p>
                      <p className="text-xs text-slate-400">{formatWhen(call.startedAt)}</p>
                    </button>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <p className="font-mono text-xs text-slate-700">{call.fromNumber}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500">{call.toNumber}</p>
                    {call.forwardedToNumber ? <p className="mt-1 font-mono text-xs text-slate-400">Fwd {call.forwardedToNumber}</p> : null}
                  </td>
                  <td className="px-6 py-4 align-top">
                    <p className="max-w-[320px] text-sm leading-6 text-slate-700">
                      {call.aiSummary || call.summary || "No AI summary generated yet."}
                    </p>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <StatusBadge kind="call" state={call.outcome} label={humanize(call.outcome)} />
                    <div className="mt-2 text-xs text-slate-500">
                      <StatusBadge
                        kind="call"
                        state={call.dialCallStatus || call.callStatus}
                        label={humanize(call.dialCallStatus || call.callStatus)}
                        size="xs"
                      />
                    </div>
                    {call.missedReason ? <p className="mt-1 text-xs text-rose-600">{humanize(call.missedReason)}</p> : null}
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="space-y-1 text-xs text-slate-500">
                      <p>Duration {formatDuration(call.durationSec)}</p>
                      <p>{call.serviceRequest ? humanize(call.serviceRequest.status) : "No service request"}</p>
                      <p>{call.hasMediaStream ? humanize(call.latestStreamStatus) : "No media stream"}</p>
                      <p>{call.recordingUrl ? "Recording ready" : "No recording"}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" disabled={detailLoadingId === call.id} onClick={() => void onView(call)}>
                        {detailLoadingId === call.id ? "Loading..." : "Inspect"}
                      </Button>
                      <Button size="sm" variant="outline" disabled={deletingId === call.id} onClick={() => void onDelete(call)}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && calls.length ? (
                <tr>
                  <td className="px-6 py-10" colSpan={6}>
                    <StateCard variant="loading" />
                  </td>
                </tr>
              ) : null}
              {!calls.length && !loading ? (
                <tr>
                  <td className="px-6 py-10" colSpan={6}>
                    <StateCard
                      variant="empty"
                      title="No calls match filters"
                      description="Adjust the search or filters to bring fresh traffic into view."
                      action={
                        <Button variant="outline" onClick={() => void reloadCalls()}>
                          Refresh
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </SectionShell>
  );
}

function InvestigationPane({
  selectedCall,
  detailLoadingId,
  reloadCalls,
  refreshDetail,
  timelineEntries
}: {
  selectedCall: AdminCallDetail | null;
  detailLoadingId: string | null;
  reloadCalls: () => Promise<void>;
  refreshDetail: () => Promise<void>;
  timelineEntries: TimelineEntry[];
}) {
  if (detailLoadingId && !selectedCall) {
    return (
      <SectionShell className="surface-panel">
        <StateCard variant="loading" title="Loading call" description="Fetching the selected call detail..." />
      </SectionShell>
    );
  }

  if (!selectedCall) {
    return (
      <SectionShell className="surface-panel">
        <StateCard
          variant="empty"
          title="Select a call"
          description="Pick a row to surface transcripts, automation logs, and follow-up data."
          action={
            <Button variant="outline" onClick={() => void reloadCalls()}>
              Refresh calls
            </Button>
          }
        />
      </SectionShell>
    );
  }

  return (
    <SectionShell className="surface-panel space-y-5">
      <SectionHeading
        title="Investigation pane"
        description="Inspect the selected call for AI summaries, service requests, transcripts, recordings, and audit events."
      />
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-950">{selectedCall.providerCallId || selectedCall.id}</p>
              <p className="mt-1 text-xs text-slate-500">{selectedCall.organization?.name || "Unknown organization"}</p>
            </div>
            <StatusBadge kind="call" state={selectedCall.outcome} label={humanize(selectedCall.outcome)} />
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <InfoRow label="From" value={selectedCall.fromNumber} />
            <InfoRow label="To" value={selectedCall.toNumber} />
            <InfoRow label="Started" value={formatWhen(selectedCall.startedAt)} />
            <InfoRow label="Answered" value={formatWhen(selectedCall.answeredAt)} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">AI summary</p>
          <p className="text-sm leading-6 text-slate-700">{selectedCall.aiSummary || selectedCall.summary || "-"}</p>
          <p className="text-xs text-slate-500">Generated {formatWhen(selectedCall.aiSummaryGeneratedAt)}</p>
        </div>

        {selectedCall.serviceRequest ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Service request</p>
              <StatusBadge kind="feature" state={selectedCall.serviceRequest.status} label={humanize(selectedCall.serviceRequest.status)} size="xs" />
            </div>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <InfoRow label="Status" value={humanize(selectedCall.serviceRequest.status)} />
              <InfoRow label="Urgency" value={selectedCall.serviceRequest.urgency || "-"} />
              <InfoRow label="Customer" value={selectedCall.serviceRequest.customerName || "-"} />
              <InfoRow label="Phone" value={selectedCall.serviceRequest.phone} />
              <InfoRow label="Address" value={selectedCall.serviceRequest.serviceAddress || "-"} span={2} />
              <InfoRow label="Notes" value={selectedCall.serviceRequest.notes || "-"} span={2} />
            </div>
          </div>
        ) : null}

        {selectedCall.lead ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Extracted lead</p>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <InfoRow label="Lead" value={selectedCall.lead.name || "-"} />
              <InfoRow label="Phone" value={selectedCall.lead.phone || "-"} />
              <InfoRow label="Service" value={selectedCall.lead.serviceRequested || "-"} />
              <InfoRow label="Urgency" value={selectedCall.lead.urgency || "-"} />
              <InfoRow label="Notes" value={selectedCall.lead.notes || "-"} span={2} />
            </div>
          </div>
        ) : null}

        <FollowUpActionsSection
          callId={selectedCall.id}
          finalizeBookingJob={selectedCall.finalizeBookingJob}
          reloadCalls={reloadCalls}
          onActionSuccess={refreshDetail}
          appointmentRequestId={selectedCall.appointmentRequestId}
        />

        <ReviewStateSection
          callId={selectedCall.id}
          reviewState={selectedCall.reviewState ?? null}
          reloadCalls={reloadCalls}
          refreshDetail={refreshDetail}
        />

        <TranscriptSection
          sessions={selectedCall.transcriptSessions || []}
          assembled={selectedCall.transcript}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Media & recording</p>
            <StatusBadge
              kind="job"
              state={selectedCall.recordingUrl ? "recording_ready" : "recording_missing"}
              label={selectedCall.recordingUrl ? "Recording ready" : "No recording"}
              size="xs"
            />
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="inline-flex items-center gap-2 text-slate-700">
              <AudioLines className="h-4 w-4 text-primary" />
              <span>{selectedCall.latestStreamStatus ? humanize(selectedCall.latestStreamStatus) : "No media stream"}</span>
            </div>
            <div className="inline-flex items-center gap-2 text-slate-700">
              <Phone className="h-4 w-4 text-slate-400" />
              <span>{formatDuration(selectedCall.durationSec)}</span>
            </div>
          </div>
          <div>
            {selectedCall.recordingUrl ? (
              <a href={selectedCall.recordingUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary hover:underline">
                Open recording
              </a>
            ) : (
              <StateCard variant="empty" title="Recording missing" description="No recording URL available for this call." />
            )}
          </div>
        </div>

        <AuditTimelineSection entries={timelineEntries} />
      </div>
    </SectionShell>
  );
}

function TranscriptSection({
  sessions,
  assembled
}: {
  sessions?: AdminCallDetail["transcriptSessions"];
  assembled?: string | null;
}) {
  const normalizedSessions = sessions || [];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Transcript sessions</p>
        <span className="text-xs text-slate-500">{normalizedSessions.length} session(s)</span>
      </div>
      {normalizedSessions.length ? (
        <div className="space-y-3">
          {normalizedSessions.map((session) => {
            const firstSegment = session.segments[0];
            const lastSegment = session.segments[session.segments.length - 1];
            const startSeconds = firstSegment ? Math.round(firstSegment.startTimeMs / 100) / 10 : null;
            const endSeconds = lastSegment ? Math.round(lastSegment.endTimeMs / 100) / 10 : null;
            return (
              <div key={session.id} className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3">
                <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                  <p>Provider {session.provider}</p>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge kind="transcript" state={session.sessionStatus} label={humanize(session.sessionStatus)} size="xs" />
                    <span>
                      {startSeconds !== null ? `${startSeconds}s` : "0s"} - {endSeconds !== null ? `${endSeconds}s` : "0s"}
                      {session.errorText ? ` | error` : ""}
                    </span>
                  </div>
                  <p>Started {formatWhen(session.startedAt)}</p>
                  <p>Ended {formatWhen(session.endedAt)}</p>
                </div>
                {session.errorText ? <p className="mt-2 text-xs text-rose-600">{session.errorText}</p> : null}
                <div className="mt-3 space-y-2">
                  {session.segments.length ? (
                    session.segments.map((segment) => (
                      <div key={segment.id} className="rounded-xl bg-white px-3 py-2">
                        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">{segment.speaker}</span>
                          <span>
                            {Math.round(segment.startTimeMs / 100) / 10}s - {Math.round(segment.endTimeMs / 100) / 10}s
                            {segment.confidence != null ? ` | ${Math.round(segment.confidence * 100)}%` : ""}
                            {segment.isFinal ? " | final" : ""}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{segment.text}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No persisted segments yet.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <StateCard variant="empty" title="No transcript sessions" description="Transcript data is still pending." />
      )}
      <div className="mt-4 rounded-2xl bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-900">Assembled transcript</p>
        {assembled ? (
          <p className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-600">{assembled}</p>
        ) : (
          <StateCard variant="empty" description="Transcript assembly is not available yet." />
        )}
      </div>
    </div>
  );
}

function AuditTimelineSection({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Audit timeline</p>
        <span className="text-xs text-slate-500">{entries.length} entries</span>
      </div>
      {entries.length ? (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{entry.label}</p>
                  {entry.detail ? <p className="text-xs text-slate-500">{entry.detail}</p> : null}
                </div>
                <StatusBadge kind={entry.kind === "booking" ? "booking" : entry.kind === "job" ? "job" : "call"} state={entry.state} label={humanize(entry.state)} size="xs" />
              </div>
              <p className="text-[11px] uppercase text-slate-400">{formatWhen(entry.time)}</p>
            </div>
          ))}
        </div>
      ) : (
        <StateCard variant="empty" title="No audit events" description="We haven't captured any transitions yet." />
      )}
    </div>
  );
}

function FollowUpActionsSection({
  callId,
  finalizeBookingJob,
  reloadCalls,
  onActionSuccess,
  appointmentRequestId
}: {
  callId: string;
  finalizeBookingJob: AdminCallDetail["finalizeBookingJob"];
  reloadCalls: () => Promise<void>;
  onActionSuccess: () => Promise<void>;
  appointmentRequestId?: string | null;
}) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const state = describeBookingFinalizerState(finalizeBookingJob);
  const handleAction = async () => {
    if (!state.eligible || submitting) return;
    setSubmitting(true);
    try {
      const payload = await retriggerCallFollowUp(callId);
      showToast({ title: "Booking finalizer retriggered", description: payload.reason });
      await onActionSuccess();
      await reloadCalls();
    } catch (error) {
      showToast({
        title: "Unable to retrigger finalizer",
        description: error instanceof Error ? error.message : "Request failed.",
        variant: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Booking finalizer</p>
          <p className="text-xs text-slate-500">Safe retry controls for booking follow-up jobs.</p>
        </div>
        <StatusBadge
          kind="booking"
          state={finalizeBookingJob?.status || "queued"}
          label={finalizeBookingJob?.status ? humanize(finalizeBookingJob.status) : "Not run"}
          size="xs"
        />
      </div>
      <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
        <p>Attempts: {finalizeBookingJob?.attemptCount ?? 0}</p>
        <p>{finalizeBookingJob?.smsSentAt ? `SMS sent ${formatWhen(finalizeBookingJob.smsSentAt)}` : "SMS pending"}</p>
        {finalizeBookingJob?.processedAt ? <p>Processed {formatWhen(finalizeBookingJob.processedAt)}</p> : <p>Processing time pending</p>}
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge kind="booking" state={finalizeBookingJob?.status || "queued"} label="Finalizer state" size="xs" />
        <StatusBadge kind="sms" state={finalizeBookingJob?.smsSentAt ? "sent" : "pending"} label={finalizeBookingJob?.smsSentAt ? "SMS followed up" : "SMS pending"} size="xs" />
      </div>
      <p className="text-xs text-slate-500">Intervention status: {state.description}</p>
      <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-primary">
        {callId ? (
          <Link href={`/admin/calls/${callId}`} className="underline-offset-4 hover:underline">
            View call audit
          </Link>
        ) : null}
        {appointmentRequestId ? (
          <Link href={`/app/appointments?requestId=${encodeURIComponent(appointmentRequestId)}`} className="underline-offset-4 hover:underline">
            Open booking triage
          </Link>
        ) : null}
        <Link href="/app/settings#settings-calendar" className="underline-offset-4 hover:underline">
          Open calendar settings
        </Link>
      </div>
      <StateCard
        variant={state.variant}
        title={state.title}
        description={state.description}
        action={
          state.eligible ? (
            <Button size="sm" variant="outline" onClick={handleAction} disabled={submitting}>
              {submitting ? "Scheduling..." : state.actionLabel}
            </Button>
          ) : null
        }
      />
    </div>
  );
}

type BookingFinalizerStateVariant = "loading" | "empty" | "retry" | "error";

type BookingFinalizerState = {
  variant: BookingFinalizerStateVariant;
  title: string;
  description: string;
  eligible: boolean;
  actionLabel: string;
};

function describeBookingFinalizerState(job: AdminCallDetail["finalizeBookingJob"]): BookingFinalizerState {
  if (!job) {
    return {
      variant: "empty",
      title: "Finalizer not triggered",
      description: "The booking finalizer has not run yet, so a retry is safe.",
      eligible: true,
      actionLabel: "Run finalizer"
    };
  }
  const status = String(job.status || "queued").toLowerCase();
  const errorText = job.error ? `Last error: ${job.error}` : "";
  switch (status) {
    case "done":
      return {
        variant: "empty",
        title: "Finalizer complete",
        description: job.error ? `Completed with error: ${job.error}` : "The booking finalizer finished successfully.",
        eligible: false,
        actionLabel: "Retry finalizer"
      };
    case "processing":
      return {
        variant: "loading",
        title: "Finalizer running",
        description: "The booking automation is in progress. Wait before retrying.",
        eligible: false,
        actionLabel: "Retry finalizer"
      };
    case "queued":
      return {
        variant: "retry",
        title: "Finalizer queued",
        description: errorText || "Job is waiting in the queue; manual retry keeps it safe.",
        eligible: true,
        actionLabel: "Retry finalizer"
      };
    case "failed":
      return {
        variant: "retry",
        title: "Finalizer failed",
        description: errorText || "Last attempt failed; a manual retry is available.",
        eligible: true,
        actionLabel: "Retry finalizer"
      };
    default:
      return {
        variant: "error",
        title: "Finalizer status unclear",
        description: job.status ? `Status: ${job.status}` : "Finalizer state is ambiguous.",
        eligible: false,
        actionLabel: "Retry finalizer"
      };
  }
}

function ReviewStateSection({
  callId,
  reviewState,
  reloadCalls,
  refreshDetail
}: {
  callId: string;
  reviewState?: CallReviewState | null;
  reloadCalls: () => Promise<void>;
  refreshDetail: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [note, setNote] = useState(reviewState?.note || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setNote(reviewState?.note || "");
  }, [reviewState?.note]);

  const currentStatus = reviewState?.status || "idle";
  const cardMeta = describeReviewCardState(currentStatus, reviewState);
  const actionType = currentStatus === "review_required" ? "resolve" : "mark";
  const buttonLabel = actionType === "resolve" ? "Resolve review" : "Mark for review";
  const badgeState = currentStatus === "review_required" ? "review required" : currentStatus === "resolved" ? "resolved" : "not reviewed";
  const badgeLabel = currentStatus === "review_required" ? "Needs review" : currentStatus === "resolved" ? "Review resolved" : "Clean";

  const handleAction = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const trimmedNote = note.trim();
      const response = await updateCallReviewState(callId, actionType as "mark" | "resolve", trimmedNote || undefined);
      showToast({
        title: actionType === "mark" ? "Marked for review" : "Review resolved",
        description: response.reviewState.note || cardMeta.description
      });
      await refreshDetail();
      await reloadCalls();
    } catch (error) {
      showToast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Unable to update review state.",
        variant: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Review attention</p>
          <p className="text-sm text-slate-700">Flag calls that need human follow-up before automation continues.</p>
        </div>
        <StatusBadge kind="feature" state={badgeState} label={badgeLabel} size="xs" />
      </div>
      <StateCard
        variant={cardMeta.variant}
        title={cardMeta.title}
        description={cardMeta.description}
        action={
          <div className="space-y-2">
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={cardMeta.placeholder}
            />
            <Button size="sm" variant="outline" onClick={handleAction} disabled={submitting}>
              {submitting ? "Saving..." : buttonLabel}
            </Button>
          </div>
        }
      />
      <p className="text-[11px] text-slate-500">
        {reviewState?.updatedAt
          ? `Updated ${formatWhen(reviewState.updatedAt)} by ${reviewState.actorUserId || "system"}`
          : "No review activity recorded yet."}
      </p>
    </div>
  );
}

function describeReviewCardState(status: CallReviewState["status"], reviewState?: CallReviewState | null) {
  const note = reviewState?.note;
  switch (status) {
    case "review_required":
      return {
        variant: "retry" as const,
        title: "Review action requested",
        description: note || "This call needs human attention before automation can proceed.",
        placeholder: "Describe the review reason..."
      };
    case "resolved":
      return {
        variant: "empty" as const,
        title: "Review resolved",
        description:
          note || "A reviewer has confirmed the call can stay on the automation path.",
        placeholder: "Optional note about the resolution..."
      };
    default:
      return {
        variant: "empty" as const,
        title: "No review required",
        description: "Mark this call for manual attention if something looks off.",
        placeholder: "Describe why this call needs review..."
      };
  }
}
function InfoRow({ label, value, span }: { label: string; value: string | null | undefined; span?: number }) {
  return (
    <div className={span ? `sm:col-span-${span}` : undefined}>
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="text-sm text-slate-700">{value || "-"}</p>
    </div>
  );
}
