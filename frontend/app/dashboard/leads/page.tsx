"use client";

import { useEffect, useState } from "react";
import { UsersRound } from "lucide-react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { fetchClientLeads } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { PageHeader, PageShell, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";

export default function DashboardLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetchClientLeads()
      .then((data) => setLeads(data.leads))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ClientGuard>
      <PageShell className="space-y-6">
        <PageHeader
          eyebrow="Legacy queue"
          title="Leads"
          description="Recent lead records captured from calls and messaging."
        />
        <SectionShell className="surface-panel">
          {loading ? (
            <StateCard variant="loading" title="Loading leads" />
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
                <p className="inline-flex items-center gap-2 font-medium text-slate-900">
                  <UsersRound className="h-4 w-4 text-slate-500" />
                  Total leads in this view: {leads.length}
                </p>
              </div>
              <div className="overflow-auto rounded-xl border border-slate-200/90 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3 text-left">Created</th>
                      <th className="p-3 text-left">Name</th>
                      <th className="p-3 text-left">Business</th>
                      <th className="p-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id} className="border-t">
                        <td className="p-3">{formatDate(lead.createdAt)}</td>
                        <td className="p-3">{lead.name}</td>
                        <td className="p-3">{lead.business}</td>
                        <td className="p-3">{lead.status}</td>
                      </tr>
                    ))}
                    {!leads.length ? (
                      <tr>
                        <td className="p-3" colSpan={4}>No leads found.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SectionShell>
      </PageShell>
    </ClientGuard>
  );
}
