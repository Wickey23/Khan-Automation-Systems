"use client";

import { useEffect, useState } from "react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { fetchClientLeads } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function DashboardLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    void fetchClientLeads().then((data) => setLeads(data.leads)).catch(() => setLeads([]));
  }, []);

  return (
    <ClientGuard>
      <div className="container py-10">
        <h1 className="text-3xl font-bold">Leads</h1>
        <div className="mt-5 overflow-auto rounded-md border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted">
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
            </tbody>
          </table>
        </div>
      </div>
    </ClientGuard>
  );
}
