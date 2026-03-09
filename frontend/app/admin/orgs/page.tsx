"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { backfillMissedVapiCalls, clearAllSystemData, fetchAdminOrgs } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page";
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

        <PageHeader
          eyebrow="Admin operations"
          title="Organizations"
          description="Review onboarding, provisioning, and go-live readiness with calmer structure and clearer next steps."
          actions={
            <Button variant="outline" disabled={backfillLoading} onClick={() => void backfillCalls()}>
              {backfillLoading ? "Syncing..." : "Sync missed Vapi calls"}
            </Button>
          }
        />

        <div className="metric-grid">
          {[
            { label: "Total orgs", value: metrics.total },
            { label: "Live", value: metrics.live },
            { label: "Needs setup", value: metrics.needsConfig },
            { label: "Paused", value: metrics.paused }
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="p-5">
                <p className="page-eyebrow">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="data-toolbar grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
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
          <Input placeholder="Search organization name or ID" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>

        <div className="table-shell">
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
                      <Link href={`/admin/orgs/${org.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
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
          <Card>
            <CardContent className="space-y-4 p-6">
              <div>
                <p className="page-eyebrow">System tools</p>
                <h2 className="text-2xl">Operational maintenance</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Run maintenance actions here instead of mixing them into the main organization grid.</p>
              </div>
              <Button variant="outline" disabled={backfillLoading} onClick={() => void backfillCalls()}>
                {backfillLoading ? "Backfilling..." : "Backfill missed Vapi calls"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-red-200">
            <CardContent className="space-y-4 p-6">
              <div>
                <p className="page-eyebrow text-red-700">Danger zone</p>
                <h2 className="text-2xl text-red-900">Clear tenant data</h2>
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
