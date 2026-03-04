"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toRoleInput(role: TeamMember["role"]): "admin" | "manager" | "viewer" {
  if (role === "ADMIN") return "admin";
  if (role === "MANAGER") return "manager";
  return "viewer";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

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

  async function load() {
    setLoading(true);
    try {
      const [me, billing] = await Promise.all([getMe(), getBillingStatus()]);
      setCurrentUserId(me.user.userId || null);
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
          activeMembers: 1,
          pendingInvites: 0,
          upgradeHint: "Upgrade to Pro to unlock team seats and invites."
        }));
        return;
      }
      const data = await fetchTeamMembers();
      setCanManage(data.canManage);
      setMembers(data.members || []);
      setSeats((prev) => ({
        ...prev,
        ...data.seats
      }));
    } catch (error) {
      showToast({
        title: "Could not load team",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
      setMembers([]);
      setCurrentUserId(null);
      setProEnabled(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeCount = useMemo(
    () => members.filter((member) => member.status === "ACTIVE").length,
    [members]
  );
  const pendingCount = useMemo(
    () => members.filter((member) => member.status === "INVITED").length,
    [members]
  );
  const usedSeats = (seats.activeMembers ?? activeCount) + (seats.pendingInvites ?? pendingCount);
  const seatsFull = usedSeats >= seats.allowedSeats;

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
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Team</h1>
        <p className="text-sm text-muted-foreground">Invite users, assign roles, and manage seat usage.</p>
      </div>

      {!proEnabled ? (
        <Card>
          <CardContent className="pt-6 text-sm">
            Team management is a Pro feature. Upgrade to Pro to invite and manage multiple users.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Seat usage</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-4">
          <div>Active members: <span className="font-semibold">{seats.activeMembers ?? activeCount}</span></div>
          <div>Pending invites: <span className="font-semibold">{seats.pendingInvites ?? 0}</span></div>
          <div>Included seats: <span className="font-semibold">{seats.includedSeats}</span></div>
          <div>Purchased seats: <span className="font-semibold">{seats.purchasedSeats}</span></div>
          <div>Allowed seats: <span className="font-semibold">{seats.allowedSeats}</span></div>
          <div>Used seats: <span className="font-semibold">{usedSeats}</span></div>
          <div className="text-muted-foreground">Policy: {seats.seatPolicy}</div>
          {seatsFull ? (
            <p className="md:col-span-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              {seats.upgradeHint || "You have reached your seat limit. Add additional seats to invite more users."}
              {" "}
              <Link href="/app/billing" className="font-medium underline">
                Manage seats in billing
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {canManage && proEnabled ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite user</CardTitle>
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

      <Card className={!proEnabled ? "opacity-60" : ""}>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading team...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="p-2">Email</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Invited</th>
                    <th className="p-2">Joined</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b">
                      <td className="p-2">{member.user?.email || member.invitedEmail}</td>
                      <td className="p-2">
                        {canManage ? (
                          (() => {
                            const isSelf = member.user?.id === currentUserId;
                            return (
                          <select
                            className="h-8 rounded-md border bg-background px-2 text-xs"
                            value={toRoleInput(member.role)}
                            onChange={(event) =>
                              void onRoleChange(member, event.target.value as "admin" | "manager" | "viewer")
                            }
                            disabled={savingId === member.id || isSelf}
                            title={isSelf ? "You cannot change your own role." : undefined}
                          >
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="viewer">Viewer</option>
                          </select>
                            );
                          })()
                        ) : (
                          member.role
                        )}
                      </td>
                      <td className="p-2">{member.status}</td>
                      <td className="p-2">{formatDate(member.invitedAt)}</td>
                      <td className="p-2">{formatDate(member.acceptedAt)}</td>
                      <td className="p-2">
                        {canManage && proEnabled ? (
                          <div className="flex gap-2">
                            {member.status === "INVITED" ? (
                              <Button size="sm" variant="outline" onClick={() => void onResend(member)} disabled={savingId === member.id}>
                                Resend
                              </Button>
                            ) : null}
                            {member.user?.id === currentUserId ? (
                              <span className="text-xs text-muted-foreground">Current user</span>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => void onRemove(member)} disabled={savingId === member.id}>
                                Remove
                              </Button>
                            )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                  {!members.length ? (
                    <tr>
                      <td className="p-2 text-muted-foreground" colSpan={6}>
                        No team members yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
