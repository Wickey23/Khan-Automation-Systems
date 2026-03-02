"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

  return (
    <AdminGuard>
      <div className="container py-10">
        <h1 className="text-3xl font-bold">Organizations</h1>
        <p className="mt-2 text-sm text-muted-foreground">Review onboarding, provisioning, and go-live readiness.</p>
        <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-3">Organization</th>
                <th className="p-3">Status</th>
                <th className="p-3">Voice</th>
                <th className="p-3">Live</th>
                <th className="p-3">Created</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.id} className="border-t">
                  <td className="p-3">
                    <Link href={`/admin/orgs/${org.id}`} className="font-medium text-primary">
                      {org.name}
                    </Link>
                  </td>
                  <td className="p-3">{org.status}</td>
                  <td className="p-3">
                    {org.phoneNumbers?.[0]?.e164Number ? "Number set" : "No number"} /{" "}
                    {org.aiAgentConfigs?.[0]?.vapiAgentId ? "Agent set" : "No agent"}
                  </td>
                  <td className="p-3">{org.live ? "Yes" : "No"}</td>
                  <td className="p-3">{new Date(org.createdAt).toLocaleDateString()}</td>
                  <td className="p-3">
                    <Link href={`/admin/orgs/${org.id}`} className="text-primary">
                      Configure
                    </Link>
                  </td>
                </tr>
              ))}
              {!orgs.length ? (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={6}>
                    No organizations yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <section className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4">
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
          <Button
            className="mt-4 ml-2"
            variant="outline"
            disabled={backfillLoading}
            onClick={() => void backfillCalls()}
          >
            {backfillLoading ? "Backfilling..." : "Backfill missed Vapi calls"}
          </Button>
        </section>
      </div>
    </AdminGuard>
  );
}
