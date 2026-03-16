"use client";

import { AudioLines, Phone, Radio, Search, Shield, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
import { useToast } from "@/components/site/toast-provider";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { deleteAdminCall, fetchAdminCallDetail, fetchAdminCalls } from "@/lib/api";
import type { AdminCallDetail, AdminCallRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

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

function outcomeTone(outcome: AdminCallRecord["outcome"]) {
  switch (outcome) {
    case "APPOINTMENT_REQUEST":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "TRANSFERRED":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "SPAM":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "MISSED":
    case "ABANDONED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
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

  async function reloadCalls() {
    const data = await fetchAdminCalls(query);
    setCalls(data.calls);
  }

  async function onDelete(call: AdminCallRecord) {
    if (!deletePassword.trim()) {
      showToast({ title: "Delete password required", description: "Enter delete password first.", variant: "error" });
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
    setDetailLoadingId(call.id);
    try {
      const data = await fetchAdminCallDetail(call.id);
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

  const stats = useMemo(() => {
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

  const selectedTranscriptSessions = selectedCall?.transcriptSessions || [];

  return (
    <AdminGuard>
      <div className="page-shell space-y-6">
        <AdminTopTabs />

        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 bg-slate-950 px-6 py-5 text-white sm:px-8">
            <div>
              <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                <Shield className="h-3.5 w-3.5" />
                Global Control Plane
              </p>
              <h1 className="mt-2 text-[30px] font-black tracking-[-0.04em]">Global Call Review</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-400">
                Review all organization traffic, failed outcomes, transcript health, and extracted follow-up data from one control surface.
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
          <div className="grid gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{stat.label}</p>
                <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">{stat.value}</p>
                <p className="mt-1 text-xs text-slate-500">{stat.note}</p>
              </div>
            ))}
          </div>
        </div>

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

        <div className="data-toolbar grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_260px_auto]">
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
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search org, call ID, number, or transcript..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Input
            type="password"
            placeholder="Delete password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
          />
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            <Radio className="h-3.5 w-3.5 text-primary" />
            Review queue
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_420px]">
          <div className="table-shell overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Call investigations</p>
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
                        <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]", outcomeTone(call.outcome))}>
                          {call.outcome.replaceAll("_", " ")}
                        </span>
                        <p className="mt-2 text-xs text-slate-500">
                          {(call.dialCallStatus || call.callStatus || "-").replaceAll("_", " ")}
                        </p>
                        {call.missedReason ? <p className="mt-1 text-xs text-rose-600">{call.missedReason.replaceAll("_", " ")}</p> : null}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-1.5 text-xs text-slate-500">
                          <p>Duration {formatDuration(call.durationSec)}</p>
                          <p>{call.serviceRequest ? call.serviceRequest.status.replaceAll("_", " ") : "No service request"}</p>
                          <p>{call.hasMediaStream ? (call.latestStreamStatus || "CONNECTED").replaceAll("_", " ") : "No media stream"}</p>
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
                  {!calls.length && !loading ? (
                    <tr>
                      <td className="px-6 py-10 text-center text-sm text-slate-500" colSpan={6}>
                        No calls found for this filter set.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Investigation pane</p>
            </div>
            {!selectedCall ? (
              <div className="px-5 py-8 text-sm leading-6 text-slate-500">
                Select a call to inspect transcript sessions, extracted lead data, service-request state, and media-stream diagnostics.
              </div>
            ) : (
              <div className="max-h-[980px] space-y-5 overflow-auto px-5 py-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-950">{selectedCall.providerCallId || selectedCall.id}</p>
                      <p className="mt-1 text-xs text-slate-500">{selectedCall.organization?.name || "Unknown organization"}</p>
                    </div>
                    <span className={cn("inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em]", outcomeTone(selectedCall.outcome))}>
                      {selectedCall.outcome.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">From</p>
                      <p className="mt-1 font-mono text-xs text-slate-700">{selectedCall.fromNumber}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">To</p>
                      <p className="mt-1 font-mono text-xs text-slate-700">{selectedCall.toNumber}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Started</p>
                      <p className="mt-1 text-xs text-slate-700">{formatWhen(selectedCall.startedAt)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Answered</p>
                      <p className="mt-1 text-xs text-slate-700">{formatWhen(selectedCall.answeredAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">AI summary</p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{selectedCall.aiSummary || selectedCall.summary || "-"}</p>
                  <p className="mt-3 text-xs text-slate-500">Generated {formatWhen(selectedCall.aiSummaryGeneratedAt)}</p>
                </div>

                {selectedCall.serviceRequest ? (
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Service request</p>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div><span className="text-slate-500">Status:</span> {selectedCall.serviceRequest.status.replaceAll("_", " ")}</div>
                      <div><span className="text-slate-500">Urgency:</span> {selectedCall.serviceRequest.urgency || "-"}</div>
                      <div><span className="text-slate-500">Customer:</span> {selectedCall.serviceRequest.customerName || "-"}</div>
                      <div><span className="text-slate-500">Phone:</span> {selectedCall.serviceRequest.phone}</div>
                      <div className="sm:col-span-2"><span className="text-slate-500">Address:</span> {selectedCall.serviceRequest.serviceAddress || "-"}</div>
                      <div className="sm:col-span-2"><span className="text-slate-500">Notes:</span> {selectedCall.serviceRequest.notes || "-"}</div>
                    </div>
                  </div>
                ) : null}

                {selectedCall.lead ? (
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Extracted lead</p>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div><span className="text-slate-500">Lead:</span> {selectedCall.lead.name || "-"}</div>
                      <div><span className="text-slate-500">Phone:</span> {selectedCall.lead.phone || "-"}</div>
                      <div><span className="text-slate-500">Service:</span> {selectedCall.lead.serviceRequested || "-"}</div>
                      <div><span className="text-slate-500">Urgency:</span> {selectedCall.lead.urgency || "-"}</div>
                      <div className="sm:col-span-2"><span className="text-slate-500">Notes:</span> {selectedCall.lead.notes || "-"}</div>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Transcript sessions</p>
                    <p className="text-xs text-slate-500">{selectedTranscriptSessions.length} session(s)</p>
                  </div>
                  {selectedTranscriptSessions.length ? (
                    <div className="mt-3 space-y-3">
                      {selectedTranscriptSessions.map((session) => (
                        <div key={session.id} className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3">
                          <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                            <p>Provider {session.provider}</p>
                            <p>Status {session.sessionStatus.replaceAll("_", " ")}</p>
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
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No transcript sessions recorded yet.</p>
                  )}
                  <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">Assembled transcript</p>
                    <p className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {selectedCall.transcript || "-"}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Media and recording</p>
                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="inline-flex items-center gap-2">
                      <AudioLines className="h-4 w-4 text-primary" />
                      <span>{selectedCall.latestStreamStatus ? selectedCall.latestStreamStatus.replaceAll("_", " ") : "No media stream"}</span>
                    </div>
                    <div className="inline-flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <span>{formatDuration(selectedCall.durationSec)}</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    {selectedCall.recordingUrl ? (
                      <a href={selectedCall.recordingUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary hover:underline">
                        Open recording
                      </a>
                    ) : (
                      <p className="text-sm text-slate-500">No recording URL available.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </AdminGuard>
  );
}
