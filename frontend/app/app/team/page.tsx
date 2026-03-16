"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
import { clientBadgeClass } from "@/lib/client-badges";

function toRoleInput(role: TeamMember["role"]): "admin" | "manager" | "viewer" {
  if (role === "ADMIN") return "admin";
  if (role === "MANAGER") return "manager";
  return "viewer";
}

export default function TeamPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "viewer">("viewer");
  const [inviting, setInviting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [proEnabled, setProEnabled] = useState(true);
  const [roleBlocked, setRoleBlocked] = useState(false);
  const [seats, setSeats] = useState({
    includedSeats: 1,
    purchasedSeats: 0,
    allowedSeats: 1,
    activeMembers: 0,
    pendingInvites: 0,
    upgradeHint: ""
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me, billing] = await Promise.all([getMe(), getBillingStatus()]);
      setCurrentUserId(me.user.userId || null);
      const canView = ["CLIENT_ADMIN", "CLIENT_STAFF", "ADMIN", "SUPER_ADMIN"].includes(me.user.role);
      if (!canView) {
        setRoleBlocked(true);
        setMembers([]);
        setCanManage(false);
        return;
      }
      setRoleBlocked(false);
      const isProActive =
        (billing.subscription?.plan || null) === "PRO" &&
        ["active", "trialing"].includes(String(billing.subscription?.status || "").toLowerCase());
      setProEnabled(isProActive);
      if (!isProActive) {
        setMembers([]);
        setCanManage(false);
        return;
      }
      const data = await fetchTeamMembers();
      setCanManage(data.canManage);
      setMembers(data.members || []);
      setSeats({
        includedSeats: data.seats.includedSeats,
        purchasedSeats: data.seats.purchasedSeats,
        allowedSeats: data.seats.allowedSeats,
        activeMembers: data.seats.activeMembers,
        pendingInvites: data.seats.pendingInvites || 0,
        upgradeHint: data.seats.upgradeHint || ""
      });
    } catch (error) {
      showToast({
        title: "Could not load team",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
      setMembers([]);
      setCanManage(false);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeMembers = useMemo(() => members.filter((member) => member.status === "ACTIVE"), [members]);
  const usedSeats = seats.activeMembers + seats.pendingInvites;
  const seatsFull = usedSeats >= seats.allowedSeats;

  async function onInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteTeamMember({ email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail("");
      showToast({ title: "Invite sent" });
      await load();
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
      showToast({ title: "Role updated" });
      await load();
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="People and routing"
        title="Team & Routing"
        description="Manage seats, access, escalation coverage, and routing ownership so the right people receive the right front-desk work."
        actions={
          <div className="flex gap-3">
            <Button variant="outline">Export logs</Button>
            <Button disabled={!canManage || !proEnabled || seatsFull || roleBlocked} onClick={() => void onInvite()}>
              Invite member
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-[16px] border border-slate-300 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-950">Team Management</h3>
              <Badge className={clientBadgeClass(proEnabled ? "success" : "warning")}>Active seats</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em]">Member</th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em]">Role</th>
                    <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em]">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-sm text-slate-500">Loading team members...</td>
                    </tr>
                  ) : members.length ? (
                    members.map((member) => (
                      <tr key={member.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                              {(member.user?.email || member.invitedEmail).slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-slate-950">{member.user?.email || member.invitedEmail}</div>
                              <div className="text-xs text-slate-500">{member.status === "ACTIVE" ? "Workspace access active" : "Invite pending"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {canManage ? (
                            <select
                              className="h-9 rounded-md border bg-background px-3 text-xs"
                              value={toRoleInput(member.role)}
                              onChange={(event) => void onRoleChange(member, event.target.value as "admin" | "manager" | "viewer")}
                              disabled={savingId === member.id || member.user?.id === currentUserId}
                            >
                              <option value="admin">Admin</option>
                              <option value="manager">Manager</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          ) : (
                            <Badge className={clientBadgeClass("pending")}>{member.role}</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${member.status === "ACTIVE" ? "bg-emerald-500" : "bg-slate-300"}`} />
                            <span className="text-sm text-slate-600">{member.status === "ACTIVE" ? "Online" : "Offline / invited"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {member.status === "INVITED" ? (
                              <Button size="sm" variant="outline" disabled={savingId === member.id} onClick={() => void onResend(member)}>
                                Resend
                              </Button>
                            ) : null}
                            {member.user?.id === currentUserId ? (
                              <span className="text-xs text-slate-500">Current user</span>
                            ) : (
                              <Button size="sm" variant="outline" disabled={savingId === member.id} onClick={() => void onRemove(member)}>
                                Remove
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8">
                        <div className="empty-state">No team members yet.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[16px] border border-slate-300 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-950">Escalation Coverage</h3>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-950">General inquiries</h4>
                    <p className="mt-1 text-xs text-slate-500">Escalates to operator pool</p>
                  </div>
                  <Badge className={clientBadgeClass("success")}>Active</Badge>
                </div>
                <p className="mt-3 text-xs text-slate-600">{activeMembers.length} active members currently available to receive general front-desk work.</p>
              </div>
              <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-950">Urgent / emergency</h4>
                    <p className="mt-1 text-xs text-slate-500">Escalates to admin-level coverage</p>
                  </div>
                  <Badge className={clientBadgeClass("success")}>Active</Badge>
                </div>
                <p className="mt-3 text-xs text-slate-600">
                  {activeMembers.find((member) => member.role === "ADMIN")?.user?.email || activeMembers[0]?.user?.email || "No active admin assigned yet."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[16px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-950">Seat Usage</h3>
            </div>
            <div className="mb-2 flex items-end justify-between">
              <div className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                {usedSeats}
                <span className="text-lg font-normal text-slate-400">/{seats.allowedSeats}</span>
              </div>
              <div className="text-xs font-semibold text-blue-700">
                {Math.round((usedSeats / Math.max(seats.allowedSeats, 1)) * 100)}% utilized
              </div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-blue-700" style={{ width: `${Math.min(100, (usedSeats / Math.max(seats.allowedSeats, 1)) * 100)}%` }} />
            </div>
            <p className="mt-3 text-xs leading-6 text-slate-500">
              {seats.allowedSeats - usedSeats} seats remaining in the current plan.
            </p>
            <Button asChild className="mt-4 w-full" variant="outline">
              <Link href="/app/billing">Upgrade plan</Link>
            </Button>
          </div>

          <div className="rounded-[16px] border border-slate-300 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-950">Routing Ownership</h3>
            </div>
            <div className="space-y-3 p-6 text-sm">
              {[
                { label: "New Leads", owner: activeMembers[0]?.user?.email || "Unassigned" },
                { label: "Appointments", owner: activeMembers[1]?.user?.email || activeMembers[0]?.user?.email || "Unassigned" },
                { label: "Billing & Payments", owner: activeMembers.find((member) => member.role === "ADMIN")?.user?.email || "Unassigned" }
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-[12px] border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-600">{item.owner}</span>
                </div>
              ))}
              <Button asChild variant="ghost" className="w-full justify-start px-0 text-blue-700 hover:bg-transparent">
                <Link href="/app/settings">Configure routing rules</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[16px] border border-blue-200 bg-blue-50/80 p-6 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <h4 className="text-lg font-semibold text-slate-950">AI Assistant Status</h4>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Front Desk AI is sharing load with the current team structure. Keep escalation coverage and owner assignments aligned with real staff availability.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-blue-100">
                <div className="h-full bg-blue-700" style={{ width: "82%" }} />
              </div>
              <span className="text-xs font-semibold text-blue-700">82%</span>
            </div>
          </div>
        </div>
      </div>

      {canManage && proEnabled && !roleBlocked ? (
        <div className="rounded-[16px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
          <h3 className="text-lg font-semibold text-slate-950">Invite Member</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.3fr)_220px_180px]">
            <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@company.com" />
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "admin" | "manager" | "viewer")}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
            <Button disabled={inviting || seatsFull} onClick={() => void onInvite()}>
              {inviting ? "Sending..." : "Send invite"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
