"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchLeads } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { LeadsTable } from "@/components/admin/leads-table";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
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

  if (error) {
    return (
      <div className="page-shell space-y-6">
        <Card>
          <CardContent className="space-y-4 p-6">
            <p className="font-medium text-red-700">{error}</p>
            <Button asChild variant="outline">
              <Link href="/admin/login">Back to login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6">
      <AdminTopTabs />

      <PageHeader
        eyebrow="Admin pipeline"
        title="Leads"
        description="Manage lead status, notes, tags, and exports without turning the table into a crowded operations dump."
        actions={
          <Button asChild variant="outline">
            <a href={`${siteConfig.apiBase}/api/admin/export/leads.csv`} target="_blank" rel="noreferrer">
              Export CSV
            </a>
          </Button>
        }
      />

      <div className="metric-grid">
        {[
          { label: "Loaded leads", value: leads.length },
          { label: "New", value: leads.filter((lead) => lead.status === "NEW").length },
          { label: "Qualified", value: leads.filter((lead) => lead.status === "QUALIFIED").length },
          { label: "Won", value: leads.filter((lead) => lead.status === "WON").length }
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5">
              <p className="page-eyebrow">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="data-toolbar grid gap-4 xl:grid-cols-[220px_220px_minmax(0,1fr)_280px]">
        <select
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
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
        <Input placeholder="Search name, business, or email" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Input type="password" placeholder="Delete password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} />
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="empty-state">Loading leads...</div>
          </CardContent>
        </Card>
      ) : (
        <div className="table-shell">
          <LeadsTable leads={leads} deletePassword={deletePassword} onDeleted={reloadLeads} />
        </div>
      )}
    </div>
  );
}
