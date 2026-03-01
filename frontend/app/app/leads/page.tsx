"use client";

import { useEffect, useState } from "react";
import { fetchOrgLeads } from "@/lib/api";
import type { Lead } from "@/lib/types";

export default function AppLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    void fetchOrgLeads().then((data) => setLeads(data.leads)).catch(() => setLeads([]));
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold">Leads</h1>
      <p className="mt-2 text-sm text-muted-foreground">Scoped to your organization.</p>
      <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-3">Created</th>
              <th className="p-3">Name</th>
              <th className="p-3">Business</th>
              <th className="p-3">Source</th>
              <th className="p-3">DNC</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-t">
                <td className="p-3">{new Date(lead.createdAt).toLocaleString()}</td>
                <td className="p-3">{lead.name}</td>
                <td className="p-3">{lead.business}</td>
                <td className="p-3">{lead.source || "-"}</td>
                <td className="p-3">{lead.dnc ? "Yes" : "No"}</td>
                <td className="p-3">{lead.status}</td>
              </tr>
            ))}
            {!leads.length ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={6}>
                  No leads yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
