"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { fetchAdminEvents } from "@/lib/api";
import type { AuditEvent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, PageShell, SectionHeading, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";

export default function AdminEventsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [orgId, setOrgId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    try {
      const data = await fetchAdminEvents(query);
      setEvents(data.events);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const eventStats = useMemo(
    () => ({
      total: events.length,
      uniqueActions: new Set(events.map((row) => row.action)).size,
      orgScoped: events.filter((row) => Boolean(row.orgId)).length
    }),
    [events]
  );

  return (
    <AdminGuard>
      <PageShell className="space-y-6">
        <AdminTopTabs />

        <PageHeader
          eyebrow="Audit events"
          title="System and operator event timeline"
          description="Inspect organization and actor actions across admin and system workflows."
          actions={
            <Button variant="outline" onClick={() => void load()}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          }
        />

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Events loaded</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{eventStats.total}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Unique actions</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{eventStats.uniqueActions}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Org-scoped events</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{eventStats.orgScoped}</p>
          </div>
        </div>

        <SectionShell className="surface-panel space-y-4">
          <SectionHeading
            title="Filter timeline"
            description="Use org, action, and date range filters to narrow investigations."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input placeholder="Org ID" value={orgId} onChange={(event) => setOrgId(event.target.value)} />
            <Input placeholder="Action type" value={action} onChange={(event) => setAction(event.target.value)} />
            <Input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
            <Button variant="outline" onClick={() => void load()}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </SectionShell>

        <SectionShell className="surface-panel">
          <SectionHeading title="Event table" description="Latest entries for the selected filter scope." />
          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Org</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {events.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="p-3">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="p-3">{row.action}</td>
                    <td className="p-3 font-mono text-xs">{row.orgId || "-"}</td>
                    <td className="p-3 font-mono text-xs">{row.actorUserId}</td>
                    <td className="p-3">{row.actorRole}</td>
                    <td className="p-3">
                      <pre className="max-h-28 overflow-auto whitespace-pre-wrap text-xs text-slate-600">
                        {row.metadataJson || "{}"}
                      </pre>
                    </td>
                  </tr>
                ))}
                {!events.length && !loading ? (
                  <tr>
                    <td colSpan={6} className="p-3">
                      <StateCard variant="empty" title="No events found" description="Adjust filters and refresh to load matching entries." />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionShell>
      </PageShell>
    </AdminGuard>
  );
}
