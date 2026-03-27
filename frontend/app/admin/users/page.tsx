"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { fetchAdminUsers, getMe, updateAdminUser } from "@/lib/api";
import type { AdminUserRecord } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, SectionHeading, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";
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
  const [loading, setLoading] = useState(true);
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

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminUsers(query);
      const rows = data.users || [];
      setUsers(rows);
      setDraftRoleByUserId(Object.fromEntries(rows.map((user) => [user.id, user.role])) as Record<string, AdminUserRecord["role"]>);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const canEditUsers = actorRole === "SUPER_ADMIN";

  async function saveUser(user: AdminUserRecord) {
    if (!canEditUsers) return;
    const nextRole = draftRoleByUserId[user.id] || user.role;
    if (nextRole === user.role) return;

    setSavingUserId(user.id);
    try {
      const result = await updateAdminUser(user.id, { role: nextRole });
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

  const stats = useMemo(
    () => ({
      total: users.length,
      superAdmins: users.filter((user) => user.role === "SUPER_ADMIN").length,
      clientAdmins: users.filter((user) => user.role === "CLIENT_ADMIN").length
    }),
    [users]
  );

  return (
    <AdminGuard>
      <PageShell className="space-y-5">
        <AdminTopTabs />
        <PageHeader
          eyebrow="User directory"
          title="Identity and role management"
          description="Review login activity, tenant linkage, and access roles for all user accounts."
          actions={
            <Button variant="outline" onClick={() => void loadUsers()}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          }
        />

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Total users</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Super admins</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{stats.superAdmins}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Client admins</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{stats.clientAdmins}</p>
          </div>
        </div>

        <SectionShell className="surface-panel space-y-4">
          <SectionHeading
            title="Filter users"
            description={canEditUsers ? "Super admin edit mode enabled." : "Read-only mode. Super admin role required for edits."}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input placeholder="Search email, user ID, org, client..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={role} onChange={(event) => setRole(event.target.value as (typeof roleOptions)[number])}>
              {roleOptions.map((option) => (
                <option key={option} value={option}>{option === "ALL" ? "All roles" : option}</option>
              ))}
            </select>
            <div className="text-sm text-slate-500 lg:col-span-2 lg:flex lg:items-center">Loaded users: <span className="ml-1 font-semibold text-slate-900">{users.length}</span></div>
          </div>
        </SectionShell>

        <SectionShell className="surface-panel">
          <SectionHeading title="User table" description="Role assignments, login metadata, and tenant associations." />
          {loading ? (
            <div className="mt-3">
              <StateCard variant="loading" title="Loading users" />
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[1450px] text-left text-sm">
                <thead className="bg-slate-50">
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
                        <p className="font-mono text-xs text-slate-500">{user.id}</p>
                      </td>
                      <td className="p-3">
                        {canEditUsers ? (
                          <select
                            className="h-8 rounded-md border bg-background px-2 text-xs"
                            value={draftRoleByUserId[user.id] || user.role}
                            onChange={(event) =>
                              setDraftRoleByUserId((current) => ({ ...current, [user.id]: event.target.value as AdminUserRecord["role"] }))
                            }
                          >
                            {roleOptions.filter((option) => option !== "ALL").map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : user.role}
                      </td>
                      <td className="p-3">
                        {canEditUsers ? (
                          <Button size="sm" variant="outline" disabled={savingUserId === user.id} onClick={() => void saveUser(user)}>
                            {savingUserId === user.id ? "Saving..." : "Save"}
                          </Button>
                        ) : "-"}
                      </td>
                      <td className="p-3">
                        <p>{user.organization?.name || "-"}</p>
                        <p className="text-xs text-slate-500">{user.organization ? `${user.organization.status}${user.organization.live ? " - LIVE" : ""}` : "-"}</p>
                      </td>
                      <td className="p-3">
                        <p>{user.client?.name || "-"}</p>
                        <p className="text-xs text-slate-500">{user.client?.status || "-"}</p>
                      </td>
                      <td className="p-3">{formatDate(user.createdAt)}</td>
                      <td className="p-3"><p>{formatDate(user.login.lastLoginAt)}</p><p className="text-xs text-slate-500">via: {user.login.lastLoginVia || "-"}</p></td>
                      <td className="p-3"><p>{formatDate(user.login.lastOtpVerifiedAt)}</p><p className="text-xs text-slate-500">OTP requested: {formatDate(user.login.lastOtpRequestedAt)}</p></td>
                      <td className="p-3"><p>{formatDate(user.login.lastLoginFailAt)}</p><p className="text-xs text-slate-500">{user.login.lastLoginFailReason || "-"}</p></td>
                      <td className="p-3"><p>Success: {user.login.successCount}</p><p className="text-xs text-slate-500">Fail: {user.login.failCount}</p></td>
                    </tr>
                  ))}
                  {!users.length ? (
                    <tr>
                      <td colSpan={10} className="p-3">
                        <StateCard variant="empty" title="No users found" description="Adjust filters and search terms to load matching users." />
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </SectionShell>
      </PageShell>
    </AdminGuard>
  );
}

