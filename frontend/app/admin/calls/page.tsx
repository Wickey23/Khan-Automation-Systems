"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { deleteAdminCall, fetchAdminCalls } from "@/lib/api";
import type { AdminCallRecord } from "@/lib/types";
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
  const [selectedCall, setSelectedCall] = useState<AdminCallRecord | null>(null);
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState("ALL");
  const [deletePassword, setDeletePassword] = useState("123");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
                <th className="p-3">Outcome</th>
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
                  <td className="p-3">{call.outcome.replaceAll("_", " ")}</td>
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
                    <Button size="sm" variant="outline" onClick={() => setSelectedCall(call)}>
                      View
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
                  <td className="p-3 text-muted-foreground" colSpan={9}>
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
              <div><span className="text-muted-foreground">Outcome:</span> {selectedCall.outcome.replaceAll("_", " ")}</div>
              <div className="sm:col-span-2 lg:col-span-3"><span className="text-muted-foreground">Call SID:</span> <span className="font-mono text-xs">{selectedCall.providerCallId || "-"}</span></div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded border p-3">
                <p className="text-sm font-medium">Summary</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{selectedCall.aiSummary || selectedCall.summary || "-"}</p>
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
            <div className="mt-4 rounded border p-3">
              <p className="text-sm font-medium">Transcript</p>
              <p className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">
                {selectedCall.transcript || "-"}
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </AdminGuard>
  );
}
