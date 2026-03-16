"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { deleteAdminCall, fetchAdminCallDetail, fetchAdminCalls } from "@/lib/api";
import type { AdminCallDetail, AdminCallRecord } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/site/toast-provider";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";

function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return "-";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function toneForStatus(call: AdminCallRecord) {
  if (call.outcome === "MISSED" || call.outcome === "SPAM") return "bg-red-100 text-red-700";
  if (call.outcome === "TRANSFERRED") return "bg-blue-100 text-blue-700";
  return "bg-emerald-100 text-emerald-700";
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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAdminCalls(query);
      setCalls(data.calls);
      setSelectedCall((current) => current ? data.calls.find((row) => row.id === current.id) ? current : null : current);
    } catch (error) {
      showToast({
        title: "Failed to load calls",
        description: error instanceof Error ? error.message : "Request failed.",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  }, [query, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const filteredCount = calls.length;

  return (
    <AdminGuard>
      <div className="page-shell space-y-6">
        <AdminTopTabs />

        <section className="rounded-[18px] border border-slate-300 bg-white px-6 py-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>Admin</span>
                <span>/</span>
                <span className="text-primary">Calls</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">Global Call Review</h1>
              <p className="max-w-3xl text-sm text-slate-600">
                Cross-organization call investigation with trace-level context, transcript review, and destructive cleanup controls.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => void load()}>
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="space-y-4">
            <div className="rounded-[18px] border border-slate-300 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_220px]">
                <Input
                  placeholder="Search by org, call ID, number, or transcript..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <select
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                  value={outcome}
                  onChange={(event) => setOutcome(event.target.value)}
                >
                  <option value="ALL">All statuses</option>
                  <option value="APPOINTMENT_REQUEST">Handled</option>
                  <option value="TRANSFERRED">Transferred</option>
                  <option value="MISSED">Failed</option>
                  <option value="SPAM">Spam</option>
                </select>
                <Input
                  type="password"
                  placeholder="Delete password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-[18px] border border-slate-300 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">Call Inventory</h2>
                  <p className="text-sm text-slate-500">{filteredCount} call traces in the current slice.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Time (UTC)</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Organization / ID</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Duration</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Status</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Intent Detected</th>
                      <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {calls.map((call) => (
                      <tr
                        key={call.id}
                        className={`transition-colors hover:bg-slate-50 ${selectedCall?.id === call.id ? "border-l-4 border-primary bg-primary/5" : ""}`}
                      >
                        <td className="px-6 py-4 font-medium text-slate-900">{new Date(call.startedAt).toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <Link href={call.organization?.id ? `/admin/orgs/${call.organization.id}` : "#"} className="font-semibold text-primary hover:underline">
                              {call.organization?.name || "Unknown org"}
                            </Link>
                            <span className="font-mono text-[11px] text-slate-400">{call.providerCallId || call.id}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{formatDuration(call.durationSec)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${toneForStatus(call)}`}>
                            {(call.outcome || "UNKNOWN").replaceAll("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 italic">
                          {call.lead?.serviceRequested || call.serviceRequest?.serviceType || call.aiSummary || "None"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" disabled={detailLoadingId === call.id} onClick={() => void onView(call)}>
                              {detailLoadingId === call.id ? "Loading..." : "Investigate"}
                            </Button>
                            <Button size="sm" variant="outline" disabled={deletingId === call.id} onClick={() => void onDelete(call)}>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!calls.length && !loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                          No calls found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <aside className="overflow-hidden rounded-[18px] border border-slate-300 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-[-0.04em] text-slate-950">Call Trace Analysis</h2>
                {selectedCall ? (
                  <Button variant="outline" size="sm" onClick={() => setSelectedCall(null)}>
                    Close
                  </Button>
                ) : null}
              </div>
              {selectedCall ? (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Call ID</p>
                    <p className="mt-1 font-mono text-xs text-slate-950">{selectedCall.providerCallId || selectedCall.id}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Provider Latency</p>
                    <p className="mt-1 text-xs font-semibold text-red-600">{selectedCall.latestStreamStatus || "No active stream"}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Select a call to inspect transcript, media, and linked records.</p>
              )}
            </div>

            <div className="max-h-[880px] space-y-5 overflow-y-auto p-6">
              {selectedCall ? (
                <>
                  <section className="space-y-3">
                    <div className="flex gap-2 border-b border-slate-200 pb-3 text-sm">
                      <span className="font-semibold text-primary">Transcript</span>
                      <span className="text-slate-400">System Trace</span>
                      <span className="text-slate-400">Metadata</span>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Summary</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{selectedCall.aiSummary || selectedCall.summary || "No summary recorded."}</p>
                    </div>
                    {selectedCall.transcriptSessions?.length ? (
                      selectedCall.transcriptSessions.flatMap((session) =>
                        session.segments.map((segment) => (
                          <div key={segment.id} className={`flex flex-col gap-1 ${segment.speaker === "CALLER" ? "items-end" : "items-start"}`}>
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                              <span>{Math.round(segment.startTimeMs / 1000)}s</span>
                              <span className={`rounded px-2 py-0.5 ${segment.speaker === "CALLER" ? "bg-slate-100 text-slate-500" : "bg-primary/10 text-primary"}`}>
                                {segment.speaker}
                              </span>
                            </div>
                            <div className={`max-w-[88%] rounded-2xl p-3 text-sm leading-6 ${segment.speaker === "CALLER" ? "bg-primary text-white" : "bg-slate-100 text-slate-800"}`}>
                              {segment.text}
                            </div>
                          </div>
                        ))
                      )
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                        No persisted transcript segments yet.
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">System Error Surface</p>
                    <p className="mt-2 text-sm text-slate-700">
                      Stream status: {(selectedCall.latestStreamStatus || "UNKNOWN").replaceAll("_", " ")}. Transcript status: {(selectedCall.transcriptStatus || "UNKNOWN").replaceAll("_", " ")}.
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Answered by {selectedCall.answeredBy || "system"} • Missed reason {selectedCall.missedReason || "none"}.
                    </p>
                  </section>

                  <section className="grid gap-3">
                    {selectedCall.lead ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Lead Context</p>
                        <div className="mt-3 grid gap-2 text-sm text-slate-700">
                          <p><span className="font-semibold text-slate-950">Lead:</span> {selectedCall.lead.name || "-"}</p>
                          <p><span className="font-semibold text-slate-950">Phone:</span> {selectedCall.lead.phone || "-"}</p>
                          <p><span className="font-semibold text-slate-950">Service:</span> {selectedCall.lead.serviceRequested || "-"}</p>
                          <p><span className="font-semibold text-slate-950">Urgency:</span> {selectedCall.lead.urgency || "-"}</p>
                        </div>
                      </div>
                    ) : null}

                    {selectedCall.serviceRequest ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Service Request</p>
                        <div className="mt-3 grid gap-2 text-sm text-slate-700">
                          <p><span className="font-semibold text-slate-950">Customer:</span> {selectedCall.serviceRequest.customerName || selectedCall.serviceRequest.phone}</p>
                          <p><span className="font-semibold text-slate-950">Status:</span> {selectedCall.serviceRequest.status.replaceAll("_", " ")}</p>
                          <p><span className="font-semibold text-slate-950">Service type:</span> {selectedCall.serviceRequest.serviceType || "-"}</p>
                          <p><span className="font-semibold text-slate-950">Notes:</span> {selectedCall.serviceRequest.notes || "-"}</p>
                        </div>
                      </div>
                    ) : null}

                    {selectedCall.recordingUrl ? (
                      <Button asChild className="w-full">
                        <a href={selectedCall.recordingUrl} target="_blank" rel="noreferrer">
                          Open Full Log Archive
                        </a>
                      </Button>
                    ) : null}
                  </section>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                  Investigation details appear here after you select a call row.
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
    </AdminGuard>
  );
}
