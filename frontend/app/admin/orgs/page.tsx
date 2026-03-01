"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { fetchAdminOrgs } from "@/lib/api";

type AdminOrg = {
  id: string;
  name: string;
  status: string;
  live: boolean;
  createdAt: string;
};

export default function AdminOrgsPage() {
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);

  useEffect(() => {
    void fetchAdminOrgs().then((data) => setOrgs(data.orgs as AdminOrg[])).catch(() => setOrgs([]));
  }, []);

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
                <th className="p-3">Live</th>
                <th className="p-3">Created</th>
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
                  <td className="p-3">{org.live ? "Yes" : "No"}</td>
                  <td className="p-3">{new Date(org.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {!orgs.length ? (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={4}>
                    No organizations yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AdminGuard>
  );
}
