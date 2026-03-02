"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchLeads } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { LeadsTable } from "@/components/admin/leads-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { siteConfig } from "@/lib/config";

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

  if (error) {
    return (
      <div className="container py-14">
        <Card>
          <CardContent className="space-y-3 p-6">
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
    <div className="container py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Admin Leads</h1>
          <p className="text-sm text-muted-foreground">Manage lead status, tags, notes, and exports.</p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Link href="/admin/prospects" className="text-primary">Prospects</Link>
            <span className="text-muted-foreground">/</span>
            <Link href="/admin/calls" className="text-primary">Calls</Link>
            <span className="text-muted-foreground">/</span>
            <Link href="/admin/orgs" className="text-primary">Organizations</Link>
          </div>
        </div>
        <Button asChild variant="outline">
          <a href={`${siteConfig.apiBase}/api/admin/export/leads.csv`} target="_blank" rel="noreferrer">
            Export CSV
          </a>
        </Button>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <select
          className="h-10 rounded-md border border-input bg-white px-3 text-sm"
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
        <Input placeholder="Search name/business/email" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading leads...</p> : <LeadsTable leads={leads} />}
    </div>
  );
}
