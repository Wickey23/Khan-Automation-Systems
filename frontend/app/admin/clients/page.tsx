"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchAdminClients } from "@/lib/api";
import type { Client } from "@/lib/types";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetchAdminClients()
      .then((data) => setClients(data.clients))
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(
    () => ({
      total: clients.length,
      live: clients.filter((client) => client.status === "LIVE").length,
      paused: clients.filter((client) => client.status === "PAUSED").length
    }),
    [clients]
  );

  return (
    <AdminGuard>
      <PageShell className="space-y-5">
        <AdminTopTabs />
        <PageHeader
          eyebrow="Client workspaces"
          title="Client account management"
          description="Open a client workspace to manage status, telephony setup, and AI configuration."
        />

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Total clients</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Live</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{stats.live}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Paused</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{stats.paused}</p>
          </div>
        </div>

        {loading ? (
          <StateCard variant="loading" title="Loading clients" />
        ) : (
          <div className="grid gap-4">
            {clients.map((client) => (
              <Card key={client.id} className="border-slate-200 bg-white shadow-sm">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="font-semibold text-slate-900">{client.name}</p>
                    <p className="text-sm text-slate-500">Status: {client.status}</p>
                  </div>
                  <Link href={`/admin/clients/${client.id}`} className="text-sm font-semibold text-primary">
                    Manage
                  </Link>
                </CardContent>
              </Card>
            ))}
            {!clients.length ? (
              <StateCard variant="empty" title="No clients yet" description="Provision a client workspace to start onboarding and telephony setup." />
            ) : null}
          </div>
        )}
      </PageShell>
    </AdminGuard>
  );
}

