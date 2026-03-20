"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Briefcase,
  Download,
  Filter,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Mail,
  Phone,
  Search,
  Settings,
  Users
} from "lucide-react";
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
    <div className="min-h-screen bg-[#eef2f6] text-slate-800">
      <div className="grid min-h-screen grid-cols-[280px_1fr]">
        <aside className="flex flex-col border-r border-slate-200 bg-[#e9eef4] p-6">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-white">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[30px] font-semibold leading-none tracking-tight">ClientPortal</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">Operational Suite</p>
            </div>
          </div>

          <nav className="space-y-1">
            <NavItem icon={LayoutDashboard} label="Dashboard" href="/app" />
            <NavItem icon={Users} label="Customer Base" active href="/app/customer-base" />
            <NavItem icon={Briefcase} label="Projects" href="/app/leads" />
            <NavItem icon={Briefcase} label="Financials" href="/app/billing" />
            <NavItem icon={HelpCircle} label="Support" href="/app/settings" />
          </nav>

          <div className="mt-auto space-y-4 pt-6">
            <Link href="/app/appointments" className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow">
              + New Entry
            </Link>
              <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" type="button">
                <HelpCircle className="h-5 w-5" />
                Help Center
              </button>
            <Link href="/auth/logout" className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100">
              <LogOut className="h-5 w-5" />
              Sign Out
            </Link>
          </div>
        </aside>

        <div className="flex flex-col">
          <header className="flex h-20 items-center justify-between border-b border-slate-200 px-8">
            <h1 className="text-4xl font-medium tracking-tight">Khan Systems</h1>
            <div className="flex items-center gap-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  readOnly
                  value=""
                  placeholder="Global search..."
                  className="h-11 w-[350px] rounded-2xl border border-slate-200 bg-[#e6ebf1] pl-10 pr-4 text-sm outline-none"
                />
              </div>
              <Bell className="h-5 w-5 text-slate-700" />
              <Settings className="h-5 w-5 text-slate-700" />
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-200 text-xs font-bold text-orange-900">R</div>
            </div>
          </header>

          <main className="p-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Dashboard / <span className="text-blue-700">Customer Base</span></p>
                <h2 className="mt-2 text-5xl font-medium tracking-tight text-slate-900">Customer Base</h2>
              </div>
              <button className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>

            <section className="mb-6 grid grid-cols-3 gap-6">
              <MetricCard title="TOTAL CUSTOMERS" value={String(totalCustomers)} />
              <MetricCard title="RETURNING CUSTOMERS (%)" value={`${returningPct.toFixed(1)}%`} badge="LIVE" />
              <MetricCard title="NEW THIS MONTH" value={String(newThisMonth)} />
            </section>

            <section className="mb-6 rounded-xl border border-slate-200 bg-[#e8edf3] p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="relative w-[460px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by name, email or phone..."
                    className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm"
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
                          <p className="text-xl font-medium leading-none">{row.displayName}</p>
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
                      <p className="text-2xl font-semibold">{row.totalCalls}</p>
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
          </main>
        </div>
      </div>
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  href,
  active = false
}: {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[30px] ${
        active ? "bg-white text-blue-700 shadow-sm" : "text-slate-700 hover:bg-white/70"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </Link>
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
  badge,
  subtitle
}: {
  title: string;
  value: string;
  badge?: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">{title}</p>
      <div className="mt-3 flex items-center gap-3">
        <p className="text-5xl font-semibold leading-none">{value}</p>
        {badge ? (
          <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">{badge}</span>
        ) : null}
      </div>
      {subtitle ? <p className="mt-2 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}
