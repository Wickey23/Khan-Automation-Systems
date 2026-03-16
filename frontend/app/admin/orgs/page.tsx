"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, Filter, RefreshCcw, ShieldAlert } from "lucide-react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { backfillMissedVapiCalls, clearAllSystemData, fetchAdminOrgs } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AdminOrg = {
  id: string;
  name: string;
  status: string;
  live: boolean;
  createdAt: string;
  phoneNumbers?: Array<{ e164Number: string; status: string }>;
  aiAgentConfigs?: Array<{ vapiAgentId?: string | null; status: string }>;
  subscriptions?: Array<{ plan?: string; status?: string }>;
};

function statusClasses(status: string) {
  if (status === "LIVE") return "bg-emerald-100 text-emerald-700";
  if (status === "PAUSED") return "bg-red-100 text-red-700";
  if (status === "TESTING") return "bg-amber-100 text-amber-700";
  return "bg-blue-100 text-blue-700";
}

function onboardingPct(org: AdminOrg) {
  if (org.status === "LIVE") return 100;
  if (org.status === "PAUSED") return 88;
  if (org.status === "TESTING") return 92;
  if (org.status === "PROVISIONING") return 65;
  if (org.status === "APPROVED") return 45;
  if (org.status === "SUBMITTED") return 35;
  if (org.status === "ONBOARDING") return 20;
  return 10;
}

function planLabel(org: AdminOrg) {
  const plan = org.subscriptions?.[0]?.plan;
  if (!plan) return "No active plan";
  if (plan === "PRO") return "Professional Plan";
  if (plan === "STARTER") return "Starter Plan";
  return plan;
}

function estimatedMrr(org: AdminOrg) {
  const plan = org.subscriptions?.[0]?.plan;
  if (org.status === "PAUSED") return "$0.00";
  if (plan === "PRO") return "$299";
  if (plan === "STARTER") return "$99";
  return "$0";
}

export default function AdminOrgsPage() {
  const { showToast } = useToast();
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | string>("ALL");
  const [search, setSearch] = useState("");
  const [clearPassword, setClearPassword] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [clearLoading, setClearLoading] = useState(false);
  const [backfillLoading, setBackfillLoading] = useState(false);

  async function load() {
    try {
      const data = await fetchAdminOrgs();
      setOrgs(data.orgs as AdminOrg[]);
    } catch {
      setOrgs([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredOrgs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orgs.filter((org) => {
      if (statusFilter !== "ALL" && org.status !== statusFilter) return false;
      if (!q) return true;
      return org.name.toLowerCase().includes(q) || org.id.toLowerCase().includes(q);
    });
  }, [orgs, search, statusFilter]);

  const metrics = useMemo(() => {
    const active = orgs.filter((org) => org.status === "LIVE").length;
    const provisioning = orgs.filter((org) => ["ONBOARDING", "SUBMITTED", "APPROVED", "PROVISIONING", "TESTING"].includes(org.status)).length;
    const blocked = orgs.filter((org) => org.status === "PAUSED").length;
    return { active, provisioning, blocked, total: orgs.length };
  }, [orgs]);

  async function clearData() {
    setClearLoading(true);
    try {
      const data = await clearAllSystemData(clearPassword, confirmationText);
      setOrgs([]);
      setClearPassword("");
      setConfirmationText("");
      showToast({
        title: "System data cleared",
        description: `Deleted ${data.deleted.leads} leads, ${data.deleted.callLogs} call logs, ${data.deleted.organizations} orgs.`
      });
    } catch (error) {
      showToast({
        title: "Clear data failed",
        description: error instanceof Error ? error.message : "Request failed.",
        variant: "error"
      });
    } finally {
      setClearLoading(false);
    }
  }

  async function backfillCalls() {
    setBackfillLoading(true);
    try {
      const data = await backfillMissedVapiCalls();
      showToast({
        title: "Backfill completed",
        description: `Scanned ${data.scanned}, resolved ${data.resolved}, skipped ${data.skipped}.`
      });
    } catch (error) {
      showToast({
        title: "Backfill failed",
        description: error instanceof Error ? error.message : "Request failed.",
        variant: "error"
      });
    } finally {
      setBackfillLoading(false);
    }
  }

  return (
    <AdminGuard>
      <div className="page-shell space-y-6">
        <AdminTopTabs />

        <section className="rounded-[18px] border border-slate-300 bg-white px-6 py-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                Live
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">Organization Management</h1>
              <p className="mt-2 text-sm text-slate-600">
                Monitoring {metrics.total} tenant environments across onboarding, provisioning, and live runtime.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Active", value: metrics.active, hint: `${metrics.total} total orgs`, tone: "text-slate-950" },
            { label: "Provisioning", value: metrics.provisioning, hint: "In progress", tone: "text-primary" },
            { label: "Billing Blocked", value: metrics.blocked, hint: "Requires action", tone: "text-red-600" },
            { label: "Platform Health", value: "99.98%", hint: "All core systems healthy", tone: "text-slate-950" }
          ].map((metric) => (
            <div key={metric.label} className="rounded-[18px] border border-slate-300 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
              <p className={`mt-2 text-3xl font-semibold tracking-[-0.05em] ${metric.tone}`}>{metric.value}</p>
              <p className="mt-1 text-sm text-slate-500">{metric.hint}</p>
            </div>
          ))}
        </section>

        <Card className="rounded-[18px] border-slate-300 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <CardContent className="p-4">
            <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
              <select
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm shadow-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All statuses</option>
                <option value="NEW">NEW</option>
                <option value="ONBOARDING">ONBOARDING</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="APPROVED">APPROVED</option>
                <option value="PROVISIONING">PROVISIONING</option>
                <option value="TESTING">TESTING</option>
                <option value="LIVE">LIVE</option>
                <option value="PAUSED">PAUSED</option>
              </select>
              <Input placeholder="Search by org name, ID, or domain..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-[18px] border border-slate-300 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <table className="w-full table-fixed text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                <th className="w-[28%] px-6 py-3">Organization Name</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Plan Type</th>
                <th className="px-6 py-3 text-right">MRR</th>
                <th className="px-6 py-3">Onboarding %</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrgs.map((org) => {
                const progress = onboardingPct(org);
                return (
                  <tr key={org.id} className={`transition-colors hover:bg-slate-50 ${org.status === "PAUSED" ? "bg-red-50/30" : ""}`}>
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <Link href={`/admin/orgs/${org.id}`} className="text-sm font-semibold text-slate-950 hover:text-primary hover:underline">
                          {org.name}
                        </Link>
                        <span className="font-mono text-xs text-slate-400">ID: {org.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${statusClasses(org.status)}`}>
                        {org.status === "LIVE" ? "Active" : org.status === "PAUSED" ? "Billing Blocked" : org.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-slate-800">{planLabel(org)}</td>
                    <td className={`px-6 py-3 text-right text-sm font-bold ${org.status === "PAUSED" ? "text-red-500" : "text-slate-950"}`}>{estimatedMrr(org)}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full ${org.status === "PAUSED" ? "bg-red-500" : org.status === "LIVE" ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${progress}%` }} />
                        </div>
                        <span className={`text-xs font-bold ${org.status === "PAUSED" ? "text-red-500" : "text-slate-700"}`}>{progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/admin/orgs/${org.id}`}>Open</Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/orgs/${org.id}/testing`}>Testing</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredOrgs.length ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                    No organizations found for the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
            <p className="text-xs font-medium text-slate-500">Showing 1 to {filteredOrgs.length} of {metrics.total} results</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Previous</Button>
              <Button size="sm">1</Button>
              <Button variant="outline" size="sm">Next</Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="rounded-[18px] border-slate-300 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
            <CardContent className="space-y-4 p-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">System tools</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Keep provider reconciliation and operational maintenance separate from the org grid.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-950">Missed call backfill</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Re-scan provider records when ingestion needs reconciliation.</p>
                </div>
                <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-950">Org readiness review</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Use org detail pages to clear blockers before go-live.</p>
                </div>
              </div>
              <Button variant="outline" disabled={backfillLoading} onClick={() => void backfillCalls()}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                {backfillLoading ? "Backfilling..." : "Backfill missed Vapi calls"}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[18px] border-red-200 shadow-[0_10px_24px_rgba(127,29,29,0.08)]">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-red-50 text-red-700">
                  <ShieldAlert className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-2xl font-semibold tracking-[-0.04em] text-red-900">Clear tenant data</h2>
                </div>
              </div>
              <p className="text-sm leading-6 text-red-800">
                Permanently clears organizations, leads, call logs, and subscriptions. Admin accounts are preserved.
              </p>
              <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <p>This action is irreversible. Confirm the environment and intended scope before proceeding.</p>
                </div>
              </div>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="clear-password">Admin password</Label>
                  <Input id="clear-password" type="password" value={clearPassword} onChange={(event) => setClearPassword(event.target.value)} placeholder="Enter admin password" />
                </div>
                <div>
                  <Label htmlFor="clear-confirmation">Type DELETE ALL DATA</Label>
                  <Input id="clear-confirmation" value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} placeholder="DELETE ALL DATA" />
                </div>
              </div>
              <Button
                variant="destructive"
                disabled={clearLoading || confirmationText !== "DELETE ALL DATA" || clearPassword.length < 8}
                onClick={() => void clearData()}
              >
                {clearLoading ? "Clearing..." : "Clear all data"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminGuard>
  );
}
