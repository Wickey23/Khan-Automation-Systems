"use client";

import { useEffect, useMemo, useState } from "react";
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
  return `${mins}m ${secs}s`;
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

  return (
    <AdminGuard>
      <div className="container py-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <AdminTopTabs className="mb-3" />
            <h1 className="text-3xl font-bold">Admin Calls</h1>
            <p className="text-sm text-muted-foreground">Global call activity across all organizations.</p>
          </div>
          <Button variant="outline" onClick={() => void fetchAdminCalls(query).then((d) => setCalls(d.calls))}>
            Refresh
          </Button>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <select
            className="h-10 rounded-md border border-input bg-white px-3 text-sm"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
          >
            <option value="ALL">All outcomes</option>
            <option value="APPOINTMENT_REQUEST">APPOINTMENT_REQUEST</option>
            <option value="MESSAGE_TAKEN">MESSAGE_TAKEN</option>
            <option value="TRANSFERRED">TRANSFERRED</option>
            <option value="MISSED">MISSED</option>
            <option value="SPAM">SPAM</option>
          </select>
          <Input
            placeholder="Search org, call id, number, transcript..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Input
            type="password"
            placeholder="Delete password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
          />
        </div>

        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-3">Started</th>
                <th className="p-3">Organization</th>
                <th className="p-3">From</th>
                <th className="p-3">To</th>
                <th className="p-3">Forwarded To</th>
                <th className="p-3">Outcome</th>
                <th className="p-3">Status</th>
                <th className="p-3">Service Request</th>
                <th className="p-3">Media Stream</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Recording</th>
                <th className="p-3">Details</th>
                <th className="p-3">Delete</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id} className="border-t">
                  <td className="p-3">{new Date(call.startedAt).toLocaleString()}</td>
                  <td className="p-3">{call.organization?.name || "-"}</td>
                  <td className="p-3 font-mono text-xs">{call.fromNumber}</td>
                  <td className="p-3 font-mono text-xs">{call.toNumber}</td>
                  <td className="p-3 font-mono text-xs">{call.forwardedToNumber || "-"}</td>
                  <td className="p-3">{call.outcome.replaceAll("_", " ")}</td>
                  <td className="p-3">
                    {(call.dialCallStatus || call.callStatus || "-").replaceAll("_", " ")}
                    {call.missedReason ? <div className="text-xs text-muted-foreground">{call.missedReason.replaceAll("_", " ")}</div> : null}
                  </td>
                  <td className="p-3">
                    {call.serviceRequest ? (
                      <>
                        <div>{call.serviceRequest.status.replaceAll("_", " ")}</div>
                        <div className="text-xs text-muted-foreground">
                          {call.serviceRequest.appointmentRequested ? "Appointment requested" : call.serviceRequest.serviceType || "General request"}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-3">
                    {call.hasMediaStream ? (
                      <>
                        <div>{(call.latestStreamStatus || "CONNECTED").replaceAll("_", " ")}</div>
                        {call.latestMediaStream?.streamSid ? (
                          <div className="font-mono text-xs text-muted-foreground">{call.latestMediaStream.streamSid}</div>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-3">{formatDuration(call.durationSec)}</td>
                  <td className="p-3">
                    {call.recordingUrl ? (
                      <a href={call.recordingUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                        Open
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" disabled={detailLoadingId === call.id} onClick={() => void onView(call)}>
                      {detailLoadingId === call.id ? "Loading..." : "View"}
                    </Button>
                  </td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" disabled={deletingId === call.id} onClick={() => void onDelete(call)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {!calls.length && !loading ? (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={13}>
                    No calls found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {selectedCall ? (
          <section className="mt-5 rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-semibold">Call details</h2>
              <Button variant="outline" size="sm" onClick={() => setSelectedCall(null)}>
                Close
              </Button>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div><span className="text-muted-foreground">Organization:</span> {selectedCall.organization?.name || "-"}</div>
              <div><span className="text-muted-foreground">Started:</span> {new Date(selectedCall.startedAt).toLocaleString()}</div>
              <div><span className="text-muted-foreground">Ended:</span> {selectedCall.endedAt ? new Date(selectedCall.endedAt).toLocaleString() : "-"}</div>
              <div><span className="text-muted-foreground">From:</span> {selectedCall.fromNumber}</div>
              <div><span className="text-muted-foreground">To:</span> {selectedCall.toNumber}</div>
              <div><span className="text-muted-foreground">Forwarded to:</span> {selectedCall.forwardedToNumber || "-"}</div>
              <div><span className="text-muted-foreground">Outcome:</span> {selectedCall.outcome.replaceAll("_", " ")}</div>
              <div><span className="text-muted-foreground">Call status:</span> {(selectedCall.callStatus || "-").replaceAll("_", " ")}</div>
              <div><span className="text-muted-foreground">Dial leg status:</span> {(selectedCall.dialCallStatus || "-").replaceAll("_", " ")}</div>
              <div><span className="text-muted-foreground">Answered at:</span> {selectedCall.answeredAt ? new Date(selectedCall.answeredAt).toLocaleString() : "-"}</div>
              <div><span className="text-muted-foreground">Answered by:</span> {selectedCall.answeredBy || "-"}</div>
              <div><span className="text-muted-foreground">Missed reason:</span> {selectedCall.missedReason ? selectedCall.missedReason.replaceAll("_", " ") : "-"}</div>
              <div><span className="text-muted-foreground">Has media stream:</span> {selectedCall.hasMediaStream ? "Yes" : "No"}</div>
              <div><span className="text-muted-foreground">Latest stream status:</span> {(selectedCall.latestStreamStatus || "-").replaceAll("_", " ")}</div>
              <div><span className="text-muted-foreground">Transcript status:</span> {(selectedCall.transcriptStatus || "-").replaceAll("_", " ")}</div>
              <div className="sm:col-span-2 lg:col-span-3"><span className="text-muted-foreground">Call SID:</span> <span className="font-mono text-xs">{selectedCall.providerCallId || "-"}</span></div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded border p-3">
                <p className="text-sm font-medium">Summary</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{selectedCall.aiSummary || selectedCall.summary || "-"}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Generated: {selectedCall.aiSummaryGeneratedAt ? new Date(selectedCall.aiSummaryGeneratedAt).toLocaleString() : "Not yet"}
                </p>
              </div>
              <div className="rounded border p-3">
                <p className="text-sm font-medium">Recording</p>
                <div className="mt-2 text-sm">
                  {selectedCall.recordingUrl ? (
                    <a href={selectedCall.recordingUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                      Open recording
                    </a>
                  ) : (
                    <span className="text-muted-foreground">No recording URL</span>
                  )}
                </div>
              </div>
            </div>
            {selectedCall.lead ? (
              <div className="mt-4 rounded border p-3">
                <p className="text-sm font-medium">Extracted lead data</p>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div><span className="text-muted-foreground">Lead:</span> {selectedCall.lead.name || "-"}</div>
                  <div><span className="text-muted-foreground">Phone:</span> {selectedCall.lead.phone || "-"}</div>
                  <div><span className="text-muted-foreground">Service requested:</span> {selectedCall.lead.serviceRequested || "-"}</div>
                  <div><span className="text-muted-foreground">Urgency:</span> {selectedCall.lead.urgency || "-"}</div>
                  <div><span className="text-muted-foreground">Appointment requested:</span> {selectedCall.lead.appointmentRequested ? "Yes" : "No"}</div>
                  <div><span className="text-muted-foreground">Updated:</span> {selectedCall.lead.updatedAt ? new Date(selectedCall.lead.updatedAt).toLocaleString() : "-"}</div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <span className="text-muted-foreground">Notes:</span> {selectedCall.lead.notes || "-"}
                  </div>
                </div>
              </div>
            ) : null}
            {selectedCall.serviceRequest ? (
              <div className="mt-4 rounded border p-3">
                <p className="text-sm font-medium">Service request</p>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div><span className="text-muted-foreground">Status:</span> {selectedCall.serviceRequest.status.replaceAll("_", " ")}</div>
                  <div><span className="text-muted-foreground">Requested:</span> {new Date(selectedCall.serviceRequest.requestedAt).toLocaleString()}</div>
                  <div><span className="text-muted-foreground">Follow-up sent:</span> {selectedCall.serviceRequest.followUpSentAt ? new Date(selectedCall.serviceRequest.followUpSentAt).toLocaleString() : "-"}</div>
                  <div><span className="text-muted-foreground">Customer:</span> {selectedCall.serviceRequest.customerName || "-"}</div>
                  <div><span className="text-muted-foreground">Phone:</span> {selectedCall.serviceRequest.phone}</div>
                  <div><span className="text-muted-foreground">Linked lead:</span> {selectedCall.serviceRequest.leadId || "-"}</div>
                  <div><span className="text-muted-foreground">Service type:</span> {selectedCall.serviceRequest.serviceType || "-"}</div>
                  <div><span className="text-muted-foreground">Urgency:</span> {selectedCall.serviceRequest.urgency || "-"}</div>
                  <div><span className="text-muted-foreground">Appointment requested:</span> {selectedCall.serviceRequest.appointmentRequested ? "Yes" : "No"}</div>
                  <div className="sm:col-span-2 lg:col-span-3"><span className="text-muted-foreground">Service address:</span> {selectedCall.serviceRequest.serviceAddress || "-"}</div>
                  <div className="sm:col-span-2 lg:col-span-3"><span className="text-muted-foreground">Notes:</span> {selectedCall.serviceRequest.notes || "-"}</div>
                </div>
              </div>
            ) : null}
            {selectedCall.latestMediaStream ? (
              <div className="mt-4 rounded border p-3">
                <p className="text-sm font-medium">Media stream</p>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div><span className="text-muted-foreground">Stream SID:</span> <span className="font-mono text-xs">{selectedCall.latestMediaStream.streamSid || "-"}</span></div>
                  <div><span className="text-muted-foreground">Track strategy:</span> {selectedCall.latestMediaStream.trackStrategy.replaceAll("_", " ")}</div>
                  <div><span className="text-muted-foreground">Status:</span> {selectedCall.latestMediaStream.streamStatus.replaceAll("_", " ")}</div>
                  <div><span className="text-muted-foreground">Socket connected:</span> {selectedCall.latestMediaStream.websocketConnectedAt ? new Date(selectedCall.latestMediaStream.websocketConnectedAt).toLocaleString() : "-"}</div>
                  <div><span className="text-muted-foreground">Media started:</span> {selectedCall.latestMediaStream.mediaStartedAt ? new Date(selectedCall.latestMediaStream.mediaStartedAt).toLocaleString() : "-"}</div>
                  <div><span className="text-muted-foreground">Media ended:</span> {selectedCall.latestMediaStream.mediaEndedAt ? new Date(selectedCall.latestMediaStream.mediaEndedAt).toLocaleString() : "-"}</div>
                  <div><span className="text-muted-foreground">Packets:</span> {selectedCall.latestMediaStream.mediaEventCount}</div>
                  <div><span className="text-muted-foreground">Inbound chunks:</span> {selectedCall.latestMediaStream.inboundChunkCount}</div>
                  <div><span className="text-muted-foreground">Outbound chunks:</span> {selectedCall.latestMediaStream.outboundChunkCount}</div>
                  <div className="sm:col-span-2 lg:col-span-3"><span className="text-muted-foreground">Stop reason:</span> {selectedCall.latestMediaStream.stopReason || "-"}</div>
                </div>
              </div>
            ) : null}
            <div className="mt-4 rounded border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Transcript</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Generated: {selectedCall.transcriptGeneratedAt ? new Date(selectedCall.transcriptGeneratedAt).toLocaleString() : "Not yet"}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  Sessions: {selectedCall.transcriptSessions?.length || 0}
                </div>
              </div>
              {selectedCall.transcriptSessions?.length ? (
                <div className="mt-3 space-y-4">
                  {selectedCall.transcriptSessions.map((session) => (
                    <div key={session.id} className="rounded border border-dashed p-3">
                      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                        <div>Provider: {session.provider}</div>
                        <div>Status: {session.sessionStatus.replaceAll("_", " ")}</div>
                        <div>Started: {new Date(session.startedAt).toLocaleString()}</div>
                        <div>Ended: {session.endedAt ? new Date(session.endedAt).toLocaleString() : "-"}</div>
                      </div>
                      {session.errorText ? <p className="mt-2 text-xs text-red-600">Error: {session.errorText}</p> : null}
                      <div className="mt-3 space-y-2">
                        {session.segments.length ? (
                          session.segments.map((segment) => (
                            <div key={segment.id} className="rounded bg-slate-50 px-3 py-2 text-sm">
                              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                <span className="font-medium text-slate-700">{segment.speaker}</span>
                                <span>
                                  {Math.round(segment.startTimeMs / 100) / 10}s - {Math.round(segment.endTimeMs / 100) / 10}s
                                  {segment.confidence != null ? ` • ${Math.round(segment.confidence * 100)}%` : ""}
                                  {segment.isFinal ? " • final" : ""}
                                </span>
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-slate-900">{segment.text}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No persisted transcript segments yet.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No transcript sessions recorded yet.</p>
              )}
              <div className="mt-4 rounded bg-slate-50 p-3">
                <p className="text-sm font-medium">Assembled transcript</p>
                <p className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">
                  {selectedCall.transcript || "-"}
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </AdminGuard>
  );
}
