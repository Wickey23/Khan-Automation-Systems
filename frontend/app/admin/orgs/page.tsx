"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { backfillMissedVapiCalls, clearAllSystemData, fetchAdminOrgs } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
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

  const metrics = useMemo(() => {
    const total = orgs.length;
    const live = orgs.filter((org) => org.live).length;
    const needsConfig = orgs.filter((org) => org.status === "ONBOARDING" || org.status === "PROVISIONING" || org.status === "TESTING").length;
    const paused = orgs.filter((org) => org.status === "PAUSED").length;
    return { total, live, needsConfig, paused };
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
    if (status === "LIVE") return "bg-emerald-50 border-emerald-200 text-emerald-800";
    if (status === "PAUSED") return "bg-zinc-100 border-zinc-300 text-zinc-700";
    if (status === "TESTING") return "bg-amber-50 border-amber-200 text-amber-800";
    if (status === "PROVISIONING" || status === "ONBOARDING" || status === "SUBMITTED") return "bg-blue-50 border-blue-200 text-blue-800";
    return "bg-muted border-border text-foreground";
  }

  return (
    <AdminGuard>
      <div className="container py-10">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <Link href="/admin/leads" className="text-primary">Leads</Link>
          <span className="text-muted-foreground">/</span>
          <Link href="/admin/prospects" className="text-primary">Prospects</Link>
          <span className="text-muted-foreground">/</span>
          <Link href="/admin/clients" className="text-primary">Clients</Link>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Organizations</h1>
            <p className="mt-2 text-sm text-muted-foreground">Review onboarding, provisioning, and go-live readiness.</p>
          </div>
          <Button variant="outline" disabled={backfillLoading} onClick={() => void backfillCalls()}>
            {backfillLoading ? "Backfilling..." : "Sync missed Vapi calls"}
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Orgs</p>
            <p className="mt-1 text-2xl font-semibold">{metrics.total}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Live</p>
            <p className="mt-1 text-2xl font-semibold">{metrics.live}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Needs Setup</p>
            <p className="mt-1 text-2xl font-semibold">{metrics.needsConfig}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Paused</p>
            <p className="mt-1 text-2xl font-semibold">{metrics.paused}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3">
          <select
            className="h-10 rounded-md border border-input bg-white px-3 text-sm"
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
          <Input
            className="max-w-sm"
            placeholder="Search organization name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-3">Organization</th>
                <th className="p-3">Status</th>
                <th className="p-3">Voice</th>
                <th className="p-3">Created</th>
                <th className="p-3">Next Step</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrgs.map((org) => (
                <tr key={org.id} className="border-t">
                  <td className="p-3">
                    <Link href={`/admin/orgs/${org.id}`} className="font-medium text-primary">
                      {org.name}
                    </Link>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusClasses(org.status)}`}>
                      {org.status}
                    </span>
                  </td>
                  <td className="p-3">
                    {org.phoneNumbers?.[0]?.e164Number ? "Number set" : "No number"} /{" "}
                    {org.aiAgentConfigs?.[0]?.vapiAgentId ? "Agent set" : "No agent"}
                  </td>
                  <td className="p-3">{new Date(org.createdAt).toLocaleDateString()}</td>
                  <td className="p-3">
                    <Link href={`/admin/orgs/${org.id}`} className="inline-flex rounded-md border px-2 py-1 text-xs font-medium text-primary hover:bg-muted">
                      Open Workspace
                    </Link>
                  </td>
                </tr>
              ))}
              {!filteredOrgs.length ? (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={6}>
                    No organizations found for current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <section className="mt-8 rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold">System Tools</h2>
          <p className="mt-1 text-sm text-muted-foreground">Operational maintenance actions.</p>
          <Button
            className="mt-3"
            variant="outline"
            disabled={backfillLoading}
            onClick={() => void backfillCalls()}
          >
            {backfillLoading ? "Backfilling..." : "Backfill missed Vapi calls"}
          </Button>
        </section>

        <section className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
          <p className="mt-1 text-sm text-red-800">
            Permanently clears tenant data (organizations, client users, leads, call logs, subscriptions). Admin users are preserved.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="clear-password">Admin password</Label>
              <Input
                id="clear-password"
                type="password"
                value={clearPassword}
                onChange={(e) => setClearPassword(e.target.value)}
                placeholder="Enter admin password"
              />
            </div>
            <div>
              <Label htmlFor="clear-confirmation">Type DELETE ALL DATA</Label>
              <Input
                id="clear-confirmation"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="DELETE ALL DATA"
              />
            </div>
          </div>
          <Button
            className="mt-4 bg-red-600 text-white hover:bg-red-700"
            disabled={clearLoading || confirmationText !== "DELETE ALL DATA" || clearPassword.length < 8}
            onClick={() => void clearData()}
          >
            {clearLoading ? "Clearing..." : "Clear all data"}
          </Button>
        </section>
      </div>
    </AdminGuard>
  );
}
