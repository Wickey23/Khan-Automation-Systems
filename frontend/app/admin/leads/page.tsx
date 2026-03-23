"use client";

import Link from "next/link";
import { BarChart3, Search, Shield, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchLeads } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { LeadsTable } from "@/components/admin/leads-table";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, PageShell, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";
import { siteConfig } from "@/lib/config";

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [status, setStatus] = useState("ALL");
  const [industry, setIndustry] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletePassword, setDeletePassword] = useState("123");

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

  async function reloadLeads() {
    const data = await fetchLeads(query);
    setLeads(data.leads);
  }

  const stats = useMemo(() => {
    const qualified = leads.filter((lead) => lead.status === "QUALIFIED");
    const won = leads.filter((lead) => lead.status === "WON");
    const phoneOriginated = leads.filter((lead) => lead.source === "PHONE_CALL");
    return [
      { label: "Loaded leads", value: leads.length, note: "Current global pipeline window" },
      { label: "Qualified", value: qualified.length, note: "Ready for high-touch follow-up" },
      { label: "Won", value: won.length, note: "Converted demand" },
      { label: "Phone-originated", value: phoneOriginated.length, note: "From calls and missed-call recovery" }
    ];
  }, [leads]);

  if (error) {
    return (
      <AdminGuard>
        <PageShell className="space-y-6">
          <AdminTopTabs />
          <StateCard
            variant="error"
            title="Unable to load leads"
            description={error}
            action={
              <Button asChild variant="outline">
                <Link href="/admin/login">Back to login</Link>
              </Button>
            }
          />
        </PageShell>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
    <PageShell className="space-y-6">
      <AdminTopTabs />

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 bg-slate-950 px-6 py-5 text-white sm:px-8">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              <Shield className="h-3.5 w-3.5" />
              Global Control Plane
            </p>
            <h1 className="mt-2 text-[30px] font-black tracking-[-0.04em]">Global Lead Pipeline</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Monitor captured demand across organizations, isolate pipeline hygiene issues, and export clean operating data without losing urgency context.
            </p>
          </div>
          <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <BarChart3 className="h-5 w-5 text-primary" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Pipeline visibility</p>
              <p className="mt-1 text-sm font-semibold text-white">Cross-org review enabled</p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
              <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">{item.value}</p>
              <p className="mt-1 text-xs text-slate-500">{item.note}</p>
            </div>
          ))}
        </div>
      </div>

      <PageHeader
        eyebrow="Admin pipeline"
        title="Lead review and status hygiene"
        description="Manage lead status, notes, tags, and exports from a denser control-plane view while keeping the pipeline easy to audit."
        actions={
          <Button asChild variant="outline">
            <a href={`${siteConfig.apiBase}/api/admin/export/leads.csv`} target="_blank" rel="noreferrer">
              Export CSV
            </a>
          </Button>
        }
      />

      <div className="data-toolbar grid gap-4 xl:grid-cols-[220px_220px_minmax(0,1fr)_280px_auto]">
        <select
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="ALL">All statuses</option>
          <option value="NEW">NEW</option>
          <option value="CONTACTED">CONTACTED</option>
          <option value="QUALIFIED">QUALIFIED</option>
          <option value="WON">WON</option>
          <option value="LOST">LOST</option>
        </select>
        <Input placeholder="Filter by industry" value={industry} onChange={(event) => setIndustry(event.target.value)} />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search name, business, or email" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Input type="password" placeholder="Delete password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} />
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
          <Target className="h-3.5 w-3.5 text-primary" />
          Pipeline review
        </div>
      </div>

      <SectionShell className="surface-panel">
        {loading ? (
          <StateCard variant="loading" title="Loading leads" />
        ) : (
          <div className="table-shell">
            <LeadsTable leads={leads} deletePassword={deletePassword} onDeleted={reloadLeads} />
          </div>
        )}
      </SectionShell>
    </PageShell>
    </AdminGuard>
  );
}
