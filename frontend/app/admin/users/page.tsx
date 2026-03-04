"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { fetchAdminUsers } from "@/lib/api";
import type { AdminUserRecord } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const roleOptions = ["ALL", "SUPER_ADMIN", "ADMIN", "CLIENT_ADMIN", "CLIENT_STAFF", "CLIENT"] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<(typeof roleOptions)[number]>("ALL");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "500");
    if (search.trim()) params.set("search", search.trim());
    if (role !== "ALL") params.set("role", role);
    return `?${params.toString()}`;
  }, [search, role]);

  useEffect(() => {
    let active = true;
    void fetchAdminUsers(query)
      .then((data) => {
        if (!active) return;
        setUsers(data.users || []);
      })
      .catch(() => {
        if (!active) return;
        setUsers([]);
      });
    return () => {
      active = false;
    };
  }, [query]);

  return (
    <AdminGuard>
      <div className="container py-10">
        <AdminTopTabs className="mb-3" />
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All user accounts with login activity, role, tenant linkage, and recent auth outcomes.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Search email, user ID, org, client..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={role}
            onChange={(event) => setRole(event.target.value as (typeof roleOptions)[number])}
          >
            {roleOptions.map((option) => (
              <option key={option} value={option}>
                {option === "ALL" ? "All roles" : option}
              </option>
            ))}
          </select>
          <div className="text-sm text-muted-foreground lg:col-span-1 lg:flex lg:items-center">
            Total users: <span className="ml-1 font-semibold text-foreground">{users.length}</span>
          </div>
          <Button variant="outline" onClick={() => void fetchAdminUsers(query).then((data) => setUsers(data.users || []))}>
            Refresh
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[1300px] text-left text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Role</th>
                <th className="p-3">Organization</th>
                <th className="p-3">Client</th>
                <th className="p-3">Created</th>
                <th className="p-3">Last Login</th>
                <th className="p-3">Last OTP Verified</th>
                <th className="p-3">Last Login Failure</th>
                <th className="p-3">Login Counts</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t align-top">
                  <td className="p-3">
                    <p className="font-medium">{user.email}</p>
                    <p className="font-mono text-xs text-muted-foreground">{user.id}</p>
                  </td>
                  <td className="p-3">{user.role}</td>
                  <td className="p-3">
                    <p>{user.organization?.name || "-"}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.organization ? `${user.organization.status}${user.organization.live ? " · LIVE" : ""}` : "-"}
                    </p>
                  </td>
                  <td className="p-3">
                    <p>{user.client?.name || "-"}</p>
                    <p className="text-xs text-muted-foreground">{user.client?.status || "-"}</p>
                  </td>
                  <td className="p-3">{formatDate(user.createdAt)}</td>
                  <td className="p-3">
                    <p>{formatDate(user.login.lastLoginAt)}</p>
                    <p className="text-xs text-muted-foreground">via: {user.login.lastLoginVia || "-"}</p>
                  </td>
                  <td className="p-3">
                    <p>{formatDate(user.login.lastOtpVerifiedAt)}</p>
                    <p className="text-xs text-muted-foreground">OTP requested: {formatDate(user.login.lastOtpRequestedAt)}</p>
                  </td>
                  <td className="p-3">
                    <p>{formatDate(user.login.lastLoginFailAt)}</p>
                    <p className="text-xs text-muted-foreground">{user.login.lastLoginFailReason || "-"}</p>
                  </td>
                  <td className="p-3">
                    <p>Success: {user.login.successCount}</p>
                    <p className="text-xs text-muted-foreground">Fail: {user.login.failCount}</p>
                  </td>
                </tr>
              ))}
              {!users.length ? (
                <tr>
                  <td colSpan={9} className="p-3 text-muted-foreground">
                    No users found.
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

