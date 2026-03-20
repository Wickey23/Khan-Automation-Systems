"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, Filter, Mail, Phone, Search } from "lucide-react";
import { fetchCustomerBase } from "@/lib/api";
import type { CustomerBaseRecord } from "@/lib/types";

type FilterKey = "all" | "active" | "degraded" | "new";

function deriveStatus(customer: CustomerBaseRecord): "ACTIVE" | "DEGRADED" | "NEW" {
  if (customer.lead && customer.nameConfidence !== "LOW") return "ACTIVE";
  if (!customer.lead && customer.totalCalls <= 1) return "NEW";
  return "DEGRADED";
}

function statusClass(status: "ACTIVE" | "DEGRADED" | "NEW") {
  if (status === "ACTIVE") return "bg-blue-100 text-blue-700";
  if (status === "NEW") return "bg-emerald-100 text-emerald-700";
  return "bg-violet-100 text-violet-700";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function CustomerBasePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerBaseRecord[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    let mounted = true;
    void fetchCustomerBase()
      .then((res) => {
        if (!mounted) return;
        setCustomers(res.customers || []);
      })
      .catch(() => {
        if (!mounted) return;
        setError("Could not load customer base data right now.");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const totalCustomers = customers.length;
  const returningPct = totalCustomers ? (customers.filter((c) => c.totalCalls > 1).length / totalCustomers) * 100 : 0;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const newThisMonth = customers.filter((c) => {
    const first = new Date(c.firstCallAt);
    return !Number.isNaN(first.getTime()) && first >= monthStart;
  }).length;

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return customers.filter((customer) => {
      const status = deriveStatus(customer);
      if (filter !== "all" && status.toLowerCase() !== filter) return false;
      if (!normalizedQuery) return true;
      return (
        customer.displayName.toLowerCase().includes(normalizedQuery) ||
        customer.phoneNumber.toLowerCase().includes(normalizedQuery) ||
        (customer.lead?.email || "").toLowerCase().includes(normalizedQuery) ||
        (customer.lead?.business || "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [customers, filter, query]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Dashboard / Customer Base</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">Customer Base</h1>
          </div>
          <button className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard title="TOTAL CUSTOMERS" value={String(totalCustomers)} />
        <MetricCard title="RETURNING CUSTOMERS (%)" value={`${returningPct.toFixed(1)}%`} badge="LIVE" />
        <MetricCard title="NEW THIS MONTH" value={String(newThisMonth)} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-[#e8edf3] p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative min-w-[320px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, email or phone..."
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm"
            />
          </div>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-[#dce3eb] text-sm">
            <FilterTab label="All" active={filter === "all"} onClick={() => setFilter("all")} />
            <FilterTab label="Active" active={filter === "active"} onClick={() => setFilter("active")} />
            <FilterTab label="Degraded" active={filter === "degraded"} onClick={() => setFilter("degraded")} />
            <FilterTab label="New" active={filter === "new"} onClick={() => setFilter("new")} />
          </div>
          <button className="rounded-lg bg-[#cfe0ef] p-2" type="button">
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-[1.2fr_1.1fr_0.8fr_0.8fr_0.8fr] border-b border-slate-200 bg-[#f5f7fa] px-6 py-4 text-xs font-bold uppercase tracking-[0.15em] text-slate-600">
          <p>Customer Name</p>
          <p>Contact Details</p>
          <p>Status</p>
          <p>Total Calls</p>
          <p>Last Activity</p>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-sm text-slate-500">Loading customer base...</div>
        ) : error ? (
          <div className="px-6 py-8 text-sm text-red-600">{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-500">No matching customers found.</div>
        ) : (
          filteredRows.map((row) => {
            const status = deriveStatus(row);
            return (
              <div key={row.phoneNumber} className="grid grid-cols-[1.2fr_1.1fr_0.8fr_0.8fr_0.8fr] items-center border-b border-slate-100 px-6 py-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-200 text-xs font-bold text-slate-700">
                    {initials(row.displayName)}
                  </div>
                  <div>
                    <p className="text-lg font-medium leading-none">{row.displayName}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.lead?.id || row.phoneNumber}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <p className="flex items-center gap-2"><Mail className="h-4 w-4" />{row.lead?.email || "No email on file"}</p>
                  <p className="flex items-center gap-2"><Phone className="h-4 w-4" />{row.phoneNumber}</p>
                </div>
                <div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass(status)}`}>{status}</span>
                </div>
                <p className="text-xl font-semibold">{row.totalCalls}</p>
                <p className="text-slate-700">{formatDate(row.lastCallAt)}</p>
              </div>
            );
          })
        )}

        <div className="flex items-center justify-between px-6 py-5 text-sm text-slate-600">
          <p>
            Showing <span className="font-semibold">{filteredRows.length}</span> of <span className="font-semibold">{totalCustomers}</span> customers
          </p>
          <div className="flex items-center gap-3">
            <Link href="/app/calls" className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold">Open Calls</Link>
            <Link href="/app/messages" className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold">Open Messages</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function FilterTab({
  label,
  active = false,
  onClick
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={`px-5 py-2 ${active ? "bg-white font-semibold text-blue-700" : "text-slate-700"}`}>
      {label}
    </button>
  );
}

function MetricCard({
  title,
  value,
  badge
}: {
  title: string;
  value: string;
  badge?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">{title}</p>
      <div className="mt-3 flex items-center gap-3">
        <p className="text-4xl font-semibold leading-none">{value}</p>
        {badge ? <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">{badge}</span> : null}
      </div>
    </div>
  );
}
