"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { fetchAdminUsers, getMe, updateAdminUser } from "@/lib/api";
import type { AdminUserRecord } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/site/toast-provider";

const roleOptions = ["ALL", "SUPER_ADMIN", "ADMIN", "CLIENT_ADMIN", "CLIENT_STAFF", "CLIENT"] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function AdminUsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<(typeof roleOptions)[number]>("ALL");
  const [actorRole, setActorRole] = useState<string>("");
  const [draftRoleByUserId, setDraftRoleByUserId] = useState<Record<string, AdminUserRecord["role"]>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "500");
    if (search.trim()) params.set("search", search.trim());
    if (role !== "ALL") params.set("role", role);
    return `?${params.toString()}`;
  }, [search, role]);

  useEffect(() => {
    void getMe()
      .then((data) => setActorRole(data.user.role))
      .catch(() => setActorRole(""));
  }, []);

  useEffect(() => {
    let active = true;
    void fetchAdminUsers(query)
      .then((data) => {
        if (!active) return;
        const rows = data.users || [];
        setUsers(rows);
        setDraftRoleByUserId(Object.fromEntries(rows.map((user) => [user.id, user.role])) as Record<string, AdminUserRecord["role"]>);
      })
      .catch(() => {
        if (!active) return;
        setUsers([]);
      });
    return () => {
      active = false;
    };
  }, [query]);

  const canEditUsers = actorRole === "SUPER_ADMIN";

  async function saveUser(user: AdminUserRecord) {
    if (!canEditUsers) return;
    const nextRole = draftRoleByUserId[user.id] || user.role;
    if (nextRole === user.role) return;

    setSavingUserId(user.id);
    try {
      const result = await updateAdminUser(user.id, {
        role: nextRole
      });
      setUsers((current) => current.map((row) => (row.id === user.id ? { ...row, ...result.user } : row)));
      showToast({ title: "User updated", description: `${result.user.email} updated successfully.` });
    } catch (error) {
      showToast({
        title: "Could not update user",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSavingUserId(null);
    }
  }

  async function reloadUsers() {
    const data = await fetchAdminUsers(query);
    const rows = data.users || [];
    setUsers(rows);
    setDraftRoleByUserId(Object.fromEntries(rows.map((user) => [user.id, user.role])) as Record<string, AdminUserRecord["role"]>);
  }

  return (
    <AdminGuard>
      <div className="container py-10">
        <AdminTopTabs className="mb-3" />
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All user accounts with login activity, role, tenant linkage, and recent auth outcomes.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {canEditUsers ? "Super admin edit mode enabled." : "Read-only mode. Super admin role required for edits."}
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
          <Button variant="outline" onClick={() => void reloadUsers()}>
            Refresh
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[1450px] text-left text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Role</th>
                <th className="p-3">Edit</th>
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
                  <td className="p-3">
                    {canEditUsers ? (
                      <select
                        className="h-8 rounded-md border bg-background px-2 text-xs"
                        value={draftRoleByUserId[user.id] || user.role}
                        onChange={(event) =>
                          setDraftRoleByUserId((current) => ({
                            ...current,
                            [user.id]: event.target.value as AdminUserRecord["role"]
                          }))
                        }
                      >
                        {roleOptions
                          .filter((option) => option !== "ALL")
                          .map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                      </select>
                    ) : (
                      user.role
                    )}
                  </td>
                  <td className="p-3">
                    {canEditUsers ? (
                      <Button size="sm" variant="outline" disabled={savingUserId === user.id} onClick={() => void saveUser(user)}>
                        {savingUserId === user.id ? "Saving..." : "Save"}
                      </Button>
                    ) : (
                      "-"
                    )}
                  </td>
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
                  <td colSpan={10} className="p-3 text-muted-foreground">
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
