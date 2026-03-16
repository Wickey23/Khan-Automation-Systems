"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchLeads } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { siteConfig } from "@/lib/config";

function riskForLead(lead: Lead) {
  if (lead.status === "LOST") return "CRITICAL";
  if (lead.status === "CONTACTED") return "MEDIUM";
  return "LOW";
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [status, setStatus] = useState("ALL");
  const [industry, setIndustry] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (industry) params.set("industry", industry);
    if (search) params.set("search", search);
    params.set("limit", "100");
    return `?${params.toString()}`;
  }, [industry, search, status]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchLeads(query);
        if (!active) return;
        setLeads(data.leads);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load leads.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [query]);

  return (
    <div className="page-shell space-y-6">
      <AdminTopTabs />

      <section className="rounded-[18px] border border-slate-300 bg-white px-6 py-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <span>Investigation Hub</span>
              <span>/</span>
              <span className="text-primary">Global Leads</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">Lead Tracking</h1>
            <p className="max-w-3xl text-sm text-slate-600">
              Monitor lead lineage, conversion state, and cross-organization queue health without leaving the admin console.
            </p>
          </div>
          <Button asChild variant="outline">
            <a href={`${siteConfig.apiBase}/api/admin/export/leads.csv`} target="_blank" rel="noreferrer">
              Export CSV
            </a>
          </Button>
        </div>
      </section>

      <section className="rounded-[18px] border border-slate-300 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
        <div className="grid gap-3 lg:grid-cols-[180px_180px_180px_minmax(0,1fr)]">
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="WON">Won</option>
            <option value="LOST">Lost</option>
          </select>
          <Input placeholder="Industry" value={industry} onChange={(event) => setIndustry(event.target.value)} />
          <button className="h-10 rounded-lg bg-slate-100 px-3 text-left text-sm text-slate-700">Time: Last 24 Hours</button>
          <Input placeholder="Lead name, business, email, or phone..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </section>

      {error ? (
        <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="overflow-hidden rounded-[18px] border border-slate-300 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
              <th className="px-4 py-3">Source Org</th>
              <th className="px-4 py-3">Investigation Linkage</th>
              <th className="px-4 py-3">Latest Activity</th>
              <th className="px-4 py-3">Status / Risk</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => (
              <tr key={lead.id} className="transition-colors hover:bg-slate-50">
                <td className="px-4 py-4 align-top">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/15 text-xs font-bold text-primary">
                      {(lead.business || lead.name || "LD").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                          <p className="text-sm font-semibold text-slate-950">{lead.business || "Unknown org"}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Lead ID: {lead.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-slate-700">
                      {lead.name || "Unknown contact"} {lead.email ? `(${lead.email})` : ""}
                    </div>
                    <div className="border-l-2 border-slate-200 pl-3 text-sm text-slate-500">
                      {lead.phone || "No phone"} • {lead.serviceRequested || "General inquiry"}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 align-top">
                  <p className="max-w-[260px] truncate text-sm text-slate-700">{lead.notes || "No notes recorded yet."}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{new Date(lead.updatedAt).toLocaleString()}</p>
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="flex flex-col gap-1.5">
                    <span className={`inline-flex w-fit rounded px-2 py-0.5 text-[10px] font-bold ${
                      lead.status === "WON"
                        ? "bg-emerald-100 text-emerald-700"
                        : lead.status === "LOST"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                    }`}>
                      {lead.status}
                    </span>
                    <span className="inline-flex w-fit rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      {riskForLead(lead)}_RISK
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-right align-top">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/leads/${lead.id}`}>Inspect</Link>
                  </Button>
                </td>
              </tr>
            ))}
            {!leads.length && !loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  No leads found.
                </td>
              </tr>
            ) : null}
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  Loading leads...
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
