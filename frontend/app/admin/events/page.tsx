"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { fetchAdminEvents } from "@/lib/api";
import type { AuditEvent } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AdminEventsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [orgId, setOrgId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (orgId.trim()) params.set("orgId", orgId.trim());
    if (action.trim()) params.set("action", action.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `?${params.toString()}`;
  }, [action, from, orgId, to]);

  const load = useCallback(async () => {
    try {
      const data = await fetchAdminEvents(query);
      setEvents(data.events);
      setSelectedEvent((current) => current || data.events[0] || null);
    } catch {
      setEvents([]);
      setSelectedEvent(null);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminGuard>
      <div className="page-shell space-y-6">
        <AdminTopTabs />

        <section className="rounded-[18px] border border-slate-300 bg-white px-6 py-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>Admin Console</span>
                <span>/</span>
                <span className="text-primary">Events</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">System Event Logs</h1>
              <p className="max-w-3xl text-sm text-slate-600">
                Audit and debug system-wide activities with search, filter, and payload-level inspection.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => void load()}>Refresh</Button>
            </div>
          </div>
        </section>

        <section className="rounded-[18px] border border-slate-300 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <div className="grid gap-3 md:grid-cols-4">
            <Input placeholder="Org ID" value={orgId} onChange={(event) => setOrgId(event.target.value)} />
            <Input placeholder="Action type" value={action} onChange={(event) => setAction(event.target.value)} />
            <Input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_450px]">
          <div className="overflow-hidden rounded-[18px] border border-slate-300 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Event Type</th>
                  <th className="px-6 py-3">Organization / User</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((row) => {
                  const isError = row.action.toUpperCase().includes("ERROR") || row.metadataJson.toUpperCase().includes("ERROR");
                  return (
                    <tr
                      key={row.id}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 ${selectedEvent?.id === row.id ? "bg-primary/5" : ""} ${isError ? "bg-red-50/30" : ""}`}
                      onClick={() => setSelectedEvent(row)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-500">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded px-2.5 py-1 text-[10px] font-bold ${isError ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                          {row.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-slate-950">{row.orgId || "System Kernel"}</div>
                        <div className="text-[10px] text-slate-400">user: {row.actorUserId}</div>
                      </td>
                      <td className={`px-6 py-4 text-sm ${isError ? "text-red-600" : "text-slate-600"}`}>
                        {row.metadataJson.slice(0, 120) || "{}"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isError ? "text-red-600" : "text-emerald-600"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isError ? "bg-red-500" : "bg-emerald-500"}`} />
                          {isError ? "Failed" : "Success"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelectedEvent(row)}>
                          View Payload
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!events.length ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">No events found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <aside className="overflow-hidden rounded-[18px] border border-slate-300 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">Event Payload</h2>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{selectedEvent?.id || "No event selected"}</p>
              </div>
              {selectedEvent ? (
                <Button variant="outline" size="sm" onClick={() => setSelectedEvent(null)}>Close</Button>
              ) : null}
            </div>
            <div className="min-h-[640px] bg-slate-950 p-6 font-mono text-xs leading-6 text-primary/80">
              <pre className="whitespace-pre-wrap break-words">
                {selectedEvent
                  ? JSON.stringify(
                      {
                        event_id: selectedEvent.id,
                        timestamp: selectedEvent.createdAt,
                        type: selectedEvent.action,
                        actor: {
                          id: selectedEvent.actorUserId,
                          role: selectedEvent.actorRole
                        },
                        context: {
                          org_id: selectedEvent.orgId
                        },
                        metadata: selectedEvent.metadataJson ? JSON.parse(selectedEvent.metadataJson || "{}") : {}
                      },
                      null,
                      2
                    )
                  : "{\n  \"state\": \"select an event\"\n}"}
              </pre>
            </div>
            <div className="flex gap-3 border-t border-slate-200 px-6 py-4">
              <Button variant="outline" className="flex-1">Copy JSON</Button>
              <Button className="flex-1">Re-run Request</Button>
            </div>
          </aside>
        </section>
      </div>
    </AdminGuard>
  );
}
