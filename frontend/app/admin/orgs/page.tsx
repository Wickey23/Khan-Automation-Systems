"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Filter, Plus, Search } from "lucide-react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { backfillMissedVapiCalls, clearAllSystemData, fetchAdminOrgs } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AdminOrg = {
  id: string;
  name: string;
  status: string;
  live: boolean;
  createdAt: string;
  phoneNumbers?: Array<{ e164Number: string; status: string }>;
  aiAgentConfigs?: Array<{ vapiAgentId?: string | null; status: string }>;
};

export default function AdminOrgsPage() {
  const { showToast } = useToast();
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | string>("ALL");
  const [search, setSearch] = useState("");
  const [clearPassword, setClearPassword] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [clearLoading, setClearLoading] = useState(false);
  const [backfillLoading, setBackfillLoading] = useState(false);

  useEffect(() => {
    void fetchAdminOrgs().then((data) => setOrgs(data.orgs as AdminOrg[])).catch(() => setOrgs([]));
  }, []);

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
      showToast({ title: "Clear data failed", description: error instanceof Error ? error.message : "Request failed.", variant: "error" });
    } finally {
      setClearLoading(false);
    }
  }

  async function backfillCalls() {
    setBackfillLoading(true);
    try {
      const data = await backfillMissedVapiCalls();
      showToast({ title: "Backfill completed", description: `Scanned ${data.scanned}, resolved ${data.resolved}, skipped ${data.skipped}.` });
    } catch (error) {
      showToast({ title: "Backfill failed", description: error instanceof Error ? error.message : "Request failed.", variant: "error" });
    } finally {
      setBackfillLoading(false);
    }
  }

  const metrics = useMemo(() => {
    const total = orgs.length;
    return {
      total,
      live: orgs.filter((org) => org.live).length,
      needsConfig: orgs.filter((org) => org.status === "ONBOARDING" || org.status === "PROVISIONING" || org.status === "TESTING").length,
      paused: orgs.filter((org) => org.status === "PAUSED").length
    };
  }, [orgs]);

  const filteredOrgs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orgs.filter((org) => {
      if (statusFilter !== "ALL" && org.status !== statusFilter) return false;
      if (!q) return true;
      return org.name.toLowerCase().includes(q) || org.id.toLowerCase().includes(q);
    });
  }, [orgs, search, statusFilter]);

  function statusClasses(status: string) {
    if (status === "LIVE") return "bg-emerald-50 border-emerald-200 text-emerald-700";
    if (status === "PAUSED") return "bg-zinc-100 border-zinc-200 text-zinc-700";
    if (status === "TESTING") return "bg-amber-50 border-amber-200 text-amber-700";
    if (status === "PROVISIONING" || status === "ONBOARDING" || status === "SUBMITTED") return "bg-blue-50 border-blue-200 text-blue-700";
    return "bg-muted border-border text-foreground";
  }

  return (
    <AdminGuard>
      <div className="page-shell space-y-6">
        <AdminTopTabs />

        <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-950 px-8 py-6 text-white">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Admin Control Plane</p>
              <div>
                <h1 className="text-3xl font-black tracking-tight">Organizations</h1>
                <p className="mt-1 text-sm text-slate-400">Review onboarding, provisioning, and launch readiness across active tenant environments.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" className="rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" disabled={backfillLoading} onClick={() => void backfillCalls()}>
                {backfillLoading ? "Syncing..." : "Sync missed Vapi calls"}
              </Button>
              <Button className="rounded-2xl bg-primary px-5 shadow-lg shadow-sky-200/70 hover:bg-sky-500">
                <Plus className="mr-2 h-4 w-4" />
                Provision new org
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-8 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search by org ID, name, or domain"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-11 w-[360px] rounded-2xl border-slate-200 bg-slate-50 pl-10"
                />
              </label>
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                {["ALL", "LIVE", "TESTING", "PAUSED"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStatusFilter(option)}
                    className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                      statusFilter === option ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {option === "ALL" ? "All orgs" : option}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm"
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
              <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:text-primary">
                <Filter className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-4 px-8 py-6 md:grid-cols-4">
            {[
              { label: "Total orgs", value: metrics.total, detail: "Across all lifecycle states" },
              { label: "Live", value: metrics.live, detail: "Handling production traffic" },
              { label: "Needs setup", value: metrics.needsConfig, detail: "Provisioning or testing" },
              { label: "Paused", value: metrics.paused, detail: "Requires billing or ops review" }
            ].map((item) => (
              <Card key={item.label} className="rounded-3xl border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <p className="page-eyebrow">{item.label}</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{item.value}</p>
                  <p className="mt-2 text-xs text-slate-500">{item.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Voice setup</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Next step</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <Link href={`/admin/orgs/${org.id}`} className="font-semibold text-slate-900 transition hover:text-primary">
                        {org.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{org.id}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${statusClasses(org.status)}`}>
                      {org.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p>{org.phoneNumbers?.[0]?.e164Number ? "Number assigned" : "No number"}</p>
                      <p className="text-xs text-muted-foreground">{org.aiAgentConfigs?.[0]?.vapiAgentId ? "Agent configured" : "No agent configured"}</p>
                    </div>
                  </TableCell>
                  <TableCell>{new Date(org.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/orgs/${org.id}`}>Open workspace</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!filteredOrgs.length ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="empty-state">No organizations found for the current filters.</div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="rounded-[30px] border-slate-200 shadow-sm">
            <CardContent className="space-y-4 p-6">
              <div>
                <p className="page-eyebrow">System tools</p>
                <h2 className="text-2xl font-black tracking-tight text-slate-900">Operational maintenance</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Run maintenance actions here instead of mixing them into the main organization grid.</p>
              </div>
              <Button variant="outline" disabled={backfillLoading} onClick={() => void backfillCalls()}>
                {backfillLoading ? "Backfilling..." : "Backfill missed Vapi calls"}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[30px] border-red-200 shadow-sm">
            <CardContent className="space-y-4 p-6">
              <div>
                <p className="page-eyebrow text-red-700">Danger zone</p>
                <h2 className="text-2xl font-black tracking-tight text-red-900">Clear tenant data</h2>
                <p className="mt-2 text-sm leading-6 text-red-800">
                  Permanently clears tenant data including organizations, client users, leads, call logs, and subscriptions. Admin users are preserved.
                </p>
              </div>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="clear-password">Admin password</Label>
                  <Input id="clear-password" type="password" value={clearPassword} onChange={(e) => setClearPassword(e.target.value)} placeholder="Enter admin password" />
                </div>
                <div>
                  <Label htmlFor="clear-confirmation">Type DELETE ALL DATA</Label>
                  <Input id="clear-confirmation" value={confirmationText} onChange={(e) => setConfirmationText(e.target.value)} placeholder="DELETE ALL DATA" />
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
