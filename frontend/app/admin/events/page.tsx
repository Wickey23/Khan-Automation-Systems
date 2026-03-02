"use client";

import { useEffect, useMemo, useState } from "react";
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

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (orgId.trim()) params.set("orgId", orgId.trim());
    if (action.trim()) params.set("action", action.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `?${params.toString()}`;
  }, [action, from, orgId, to]);

  useEffect(() => {
    let active = true;
    void fetchAdminEvents(query)
      .then((data) => {
        if (!active) return;
        setEvents(data.events);
      })
      .catch(() => {
        if (!active) return;
        setEvents([]);
      });
    return () => {
      active = false;
    };
  }, [query]);

  return (
    <AdminGuard>
      <div className="container py-10">
        <AdminTopTabs className="mb-3" />
        <h1 className="text-3xl font-bold">Admin Events</h1>
        <p className="mt-1 text-sm text-muted-foreground">Audit timeline of admin and system actions.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input placeholder="Org ID" value={orgId} onChange={(event) => setOrgId(event.target.value)} />
          <Input placeholder="Action type" value={action} onChange={(event) => setAction(event.target.value)} />
          <Input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
          <Button variant="outline" onClick={() => void fetchAdminEvents(query).then((data) => setEvents(data.events))}>
            Refresh
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40">
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
                    <pre className="max-h-28 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                      {row.metadataJson || "{}"}
                    </pre>
                  </td>
                </tr>
              ))}
              {!events.length ? (
                <tr>
                  <td colSpan={6} className="p-3 text-muted-foreground">
                    No events found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AdminGuard>
  );
}

