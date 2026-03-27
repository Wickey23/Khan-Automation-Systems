"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, Mail, Plus, Search, Shield } from "lucide-react";
import {
  fetchTeamMembers,
  getBillingStatus,
  getMe,
  inviteTeamMember,
  removeTeamMember,
  resendTeamInvite,
  updateTeamMemberRole
} from "@/lib/api";
import type { TeamMember } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { CommandHeader } from "@/components/ops";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientGateCard } from "@/components/ui/client-module";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHelpFab } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";
import { frontDeskEmptyStateClass, frontDeskLoadingCardClass, frontDeskMetricCardClass, frontDeskSkeletonLineClass, frontDeskWorkspaceCardClass } from "@/lib/front-desk-ui";

function toRoleInput(role: TeamMember["role"]): "admin" | "manager" | "viewer" {
  if (role === "ADMIN") return "admin";
  if (role === "MANAGER") return "manager";
  return "viewer";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

const ROLE_SUMMARY: Record<"ADMIN" | "MANAGER" | "VIEWER", string> = {
  ADMIN: "Workspace admin access",
  MANAGER: "Operator actions + routing",
  VIEWER: "Read-only visibility"
};

export default function TeamPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [seats, setSeats] = useState({
    seatPolicy: "activeMembers + pendingInvites <= allowedSeats",
    includedSeats: 1,
    purchasedSeats: 0,
    allowedSeats: 1,
    activeMembers: 0,
    pendingInvites: 0,
    upgradeHint: ""
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "viewer">("viewer");
  const [inviting, setInviting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [proEnabled, setProEnabled] = useState(true);
  const [roleBlocked, setRoleBlocked] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"all" | "admins" | "operators">("all");
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [me, billing] = await Promise.all([getMe(), getBillingStatus()]);
      setCurrentUserId(me.user.userId || null);
      const userRole = String(me.user.role || "");
      const canViewTeam = userRole === "CLIENT_ADMIN" || userRole === "CLIENT_STAFF" || userRole === "ADMIN" || userRole === "SUPER_ADMIN";
      if (!canViewTeam) {
        setRoleBlocked(true);
        setCanManage(false);
        setMembers([]);
        setLoading(false);
        return;
      }
      setRoleBlocked(false);
      const isProActive =
        (billing.subscription?.plan || null) === "PRO" &&
        ["active", "trialing"].includes(String(billing.subscription?.status || "").toLowerCase());
      setProEnabled(isProActive);
      if (!isProActive) {
        setCanManage(false);
        setMembers([]);
        setSeats((prev) => ({
          ...prev,
          includedSeats: 1,
          purchasedSeats: 0,
          allowedSeats: 1,
          activeMembers: 0,
          pendingInvites: 0,
          upgradeHint: "Upgrade to Pro to unlock team seats and invites."
        }));
        return;
      }
      const data = await fetchTeamMembers();
      setCanManage(data.canManage);
      setMembers(data.members || []);
      const seatPatch = {
        ...(data.seats || {}),
        ...(data.seatPolicy ? { seatPolicy: data.seatPolicy } : {}),
        ...(typeof data.activeMembers === "number" ? { activeMembers: data.activeMembers } : {}),
        ...(typeof data.pendingInvites === "number" ? { pendingInvites: data.pendingInvites } : {}),
        ...(typeof data.allowedSeats === "number" ? { allowedSeats: data.allowedSeats } : {}),
        ...(typeof data.upgradeHint === "string" ? { upgradeHint: data.upgradeHint } : {})
      };
      setSeats((prev) => ({
        ...prev,
        ...seatPatch
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("team_pro_required") || message.toLowerCase().includes("pro feature")) {
        setCanManage(false);
        setMembers([]);
        setProEnabled(false);
        setRoleBlocked(false);
        return;
      }
      if (message.toLowerCase().includes("forbidden")) {
        setRoleBlocked(true);
        setCanManage(false);
        setMembers([]);
        return;
      }
      showToast({
        title: "Could not load team",
        description: message || "Try again.",
        variant: "error"
      });
      setLoadError(message || "Failed to load team members.");
      setMembers([]);
      setCurrentUserId(null);
      setProEnabled(false);
      setRoleBlocked(false);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = useMemo(
    () => members.filter((member) => member.status === "ACTIVE").length,
    [members]
  );
  const pendingCount = useMemo(
    () => members.filter((member) => member.status === "INVITED").length,
    [members]
  );
  const adminCount = useMemo(
    () => members.filter((member) => member.role === "ADMIN").length,
    [members]
  );
  const operatorCount = useMemo(
    () => members.filter((member) => member.role === "MANAGER" || member.role === "VIEWER").length,
    [members]
  );
  const usedSeats = (seats.activeMembers ?? activeCount) + (seats.pendingInvites ?? pendingCount);
  const seatsFull = usedSeats >= seats.allowedSeats;
  const visibleMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((member) => {
      const email = String(member.user?.email || member.invitedEmail || "").toLowerCase();
      const role = String(member.role || "").toLowerCase();
      const matchesSearch = !term || email.includes(term) || role.includes(term);
      const matchesView =
        view === "all"
          ? true
          : view === "admins"
            ? member.role === "ADMIN"
            : member.role === "MANAGER" || member.role === "VIEWER";
      return matchesSearch && matchesView;
    });
  }, [members, search, view]);

  async function onInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteTeamMember({ email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail("");
      await load();
      showToast({ title: "Invite sent" });
    } catch (error) {
      showToast({
        title: "Invite failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setInviting(false);
    }
  }

  async function onRoleChange(member: TeamMember, role: "admin" | "manager" | "viewer") {
    setSavingId(member.id);
    try {
      await updateTeamMemberRole({ membershipId: member.id, role });
      await load();
      showToast({ title: "Role updated" });
    } catch (error) {
      showToast({
        title: "Could not update role",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSavingId(null);
    }
  }

  async function onResend(member: TeamMember) {
    setSavingId(member.id);
    try {
      await resendTeamInvite(member.id);
      showToast({ title: "Invite resent" });
      await load();
    } catch (error) {
      showToast({
        title: "Could not resend invite",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSavingId(null);
    }
  }

  async function onRemove(member: TeamMember) {
    setSavingId(member.id);
    try {
      await removeTeamMember(member.id);
      showToast({ title: "Member removed" });
      await load();
    } catch (error) {
      showToast({
        title: "Could not remove member",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <CommandHeader
        eyebrow="People and permissions"
        title="Team & Routing"
        description="Control who receives escalations, who can manage the workspace, and how your available seats are being used."
        actions={
          <Button asChild variant="outline">
            <Link href="/app/settings">Open assistant settings</Link>
          </Button>
        }
      />

      {loadError ? (
        <StateCard
          variant="error"
          title="Team data unavailable"
          description={loadError}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      ) : null}

      <PageHelpFab
        items={[
          {
            label: "Use this page",
            text: "Use Team & Routing when the right person needs to receive alerts, escalations, and access to the shared workspace."
          },
          {
            label: "Start here",
            text: "Review seat usage and active members first, then invite teammates or update roles when the current routing no longer matches the office."
          },
          {
            label: "Go next",
            text: "Return to Front Desk, Call Queue, Inbox, or Booking Queue to verify the right people are now receiving live work and urgent handoffs."
          }
        ]}
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={`${frontDeskMetricCardClass()} text-sm`}>
          <p className="page-eyebrow">Seat usage</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{usedSeats}/{seats.allowedSeats}</p>
          <p className="mt-1 text-xs text-slate-500">{seatsFull ? "Seat cap reached" : "Seats available"}</p>
        </div>
        <div className={`${frontDeskMetricCardClass()} text-sm`}>
          <p className="page-eyebrow">Active members</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{seats.activeMembers ?? activeCount}</p>
          <p className="mt-1 text-xs text-slate-500">Members with active access</p>
        </div>
        <div className={`${frontDeskMetricCardClass()} text-sm`}>
          <p className="page-eyebrow">Admins</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{adminCount}</p>
          <p className="mt-1 text-xs text-slate-500">Can manage invites and roles</p>
        </div>
        <div className={`${frontDeskMetricCardClass()} text-sm`}>
          <p className="page-eyebrow">Operators</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{operatorCount}</p>
          <p className="mt-1 text-xs text-slate-500">Manager and viewer seats</p>
        </div>
      </div>

      <Card className={frontDeskWorkspaceCardClass("default")}>
        <CardHeader className="pb-3">
          <CardTitle>Team structure</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="page-eyebrow">Seat capacity</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {usedSeats}/{seats.allowedSeats} seats used
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {seatsFull ? (seats.upgradeHint || "Seat limit reached. Add seats in billing.") : "You can invite more members."}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="page-eyebrow">Admin coverage</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{adminCount} admin seats</p>
            <p className="mt-1 text-xs text-slate-600">Admins can invite, remove, and change roles.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="page-eyebrow">Invite state</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{pendingCount} pending invite{pendingCount === 1 ? "" : "s"}</p>
            <p className="mt-1 text-xs text-slate-600">Pending invites consume seats until accepted or removed.</p>
          </div>
        </CardContent>
      </Card>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-8 py-6">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Team Management</h2>
            <p className="mt-1 text-sm text-slate-500">Manage your team members, roles, and permissions.</p>
          </div>
          {canManage && proEnabled && !roleBlocked ? (
            <Button onClick={() => void onInvite()} disabled={inviting || seatsFull || !inviteEmail.trim()} className="gap-2">
              <Plus className="h-4 w-4" />
              {inviting ? "Sending..." : "Invite Member"}
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-8 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search members..."
                className="w-80 rounded-xl border-slate-200 bg-slate-50 pl-10"
              />
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {[
                { key: "all", label: "All Members" },
                { key: "admins", label: "Admins" },
                { key: "operators", label: "Operators" }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setView(item.key as typeof view)}
                  className={`rounded-md px-4 py-1.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    view === item.key ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <span className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500">
            {visibleMembers.length} member{visibleMembers.length === 1 ? "" : "s"} shown
          </span>
        </div>

        <div className="p-8">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <div className={frontDeskLoadingCardClass()}>
                <div className="space-y-3">
                  <div className={frontDeskSkeletonLineClass("md")} />
                  <div className={frontDeskSkeletonLineClass()} />
                  <div className={frontDeskSkeletonLineClass("lg")} />
                </div>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-8 py-4">Member</th>
                    <th className="px-8 py-4">Role</th>
                    <th className="px-8 py-4">Status</th>
                    <th className="px-8 py-4">Last Active</th>
                    <th className="px-8 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleMembers.map((member) => {
                    const email = member.user?.email || member.invitedEmail || "Pending invite";
                    const initials = email.slice(0, 2).toUpperCase();
                    const isPending = member.status === "INVITED";
                    const isSelf = member.user?.id === currentUserId;
                    const roleLabel =
                      member.role === "ADMIN" ? "Admin" : member.role === "MANAGER" ? "Operator" : "Viewer";

                    return (
                      <tr key={member.id} className="group hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 font-bold text-primary shadow-sm">
                              {initials}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">{email.split("@")[0]}</h4>
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                                <Mail className="h-3 w-3" />
                                {email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-slate-400" />
                            {canManage ? (
                              <select
                                className="h-8 rounded-md border bg-background px-2 text-xs font-bold"
                                value={toRoleInput(member.role)}
                                onChange={(event) => void onRoleChange(member, event.target.value as "admin" | "manager" | "viewer")}
                                disabled={savingId === member.id || isSelf}
                                title={isSelf ? "You cannot change your own role." : undefined}
                              >
                                <option value="admin">Admin</option>
                                <option value="manager">Manager</option>
                                <option value="viewer">Viewer</option>
                              </select>
                            ) : (
                              <span className="text-sm font-bold text-slate-700">{roleLabel}</span>
                            )}
                            <span className="text-[11px] text-slate-500">{ROLE_SUMMARY[member.role]}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${isPending ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}>
                            {isPending ? <Clock3 className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                            {isPending ? "Pending" : "Active"}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <Clock3 className="h-4 w-4" />
                            {formatDate(member.acceptedAt || member.invitedAt)}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          {canManage && proEnabled ? (
                            <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                              {isPending ? (
                                <Button size="sm" variant="outline" onClick={() => void onResend(member)} disabled={savingId === member.id}>
                                  Resend
                                </Button>
                              ) : null}
                              {isSelf ? (
                                <span className="text-xs text-muted-foreground">Current user</span>
                              ) : (
                                <Button size="sm" variant="outline" onClick={() => void onRemove(member)} disabled={savingId === member.id}>
                                  Remove
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!visibleMembers.length ? (
                    <tr>
                      <td className="px-8 py-8" colSpan={5}>
                        <div className={frontDeskEmptyStateClass()}>
                          No matching team members yet. Invited teammates and active operators will appear here once the office starts sharing access.
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </section>

      {roleBlocked ? (
        <ClientGateCard
          title="Team management is locked for this user."
          description="This role cannot manage workspace seats or routing ownership. Contact the workspace admin if access needs to change."
          badgeLabel="Role restricted"
          badgeTone="warning"
        />
      ) : null}

      {!proEnabled && !roleBlocked ? (
        <ClientGateCard
          title="Team management is locked on the current plan."
          description="Upgrade when the office needs multiple seats, teammate invites, and shared routing ownership inside the portal."
          badgeLabel="Locked"
          badgeTone="warning"
          actions={[{ href: "/app/billing", label: "Open Billing" }]}
        />
      ) : null}

      {canManage && proEnabled && !roleBlocked ? (
        <Card className={frontDeskWorkspaceCardClass("default")}>
          <CardHeader className="pb-3">
            <CardTitle>Invite team member</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="teammate@company.com"
              />
            </div>
            <div>
              <Label>Role</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as "admin" | "manager" | "viewer")}
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" disabled={inviting || seatsFull} onClick={() => void onInvite()}>
                {inviting ? "Sending..." : "Send invite"}
              </Button>
            </div>
            {seatsFull ? (
              <p className="md:col-span-4 text-xs text-amber-700">
                Invite disabled while seat usage is full (active + pending invites). Add seats, upgrade, or remove pending invites.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

    </div>
  );
}




