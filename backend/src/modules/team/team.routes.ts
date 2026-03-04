import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  TeamMembershipRole,
  TeamMembershipStatus,
  UserRole,
  type PrismaClient,
  SubscriptionPlan
} from "@prisma/client";
import { Router } from "express";
import { env } from "../../config/env";
import { hashToken } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { requireCsrf } from "../../middleware/csrf";
import { requireAnyRole, requireAuth, type AuthenticatedRequest } from "../../middleware/require-auth";
import { sendTeamInviteEmail } from "../../services/email";
import {
  acceptTeamInviteSchema,
  deleteTeamMemberSchema,
  inviteTeamMemberSchema,
  resendTeamInviteSchema,
  updateTeamRoleSchema
} from "./team.schema";

export const teamRouter = Router();

const INVITE_EXP_HOURS = 72;

function toUserRole(role: TeamMembershipRole): UserRole {
  if (role === TeamMembershipRole.ADMIN) return UserRole.CLIENT_ADMIN;
  if (role === TeamMembershipRole.MANAGER) return UserRole.CLIENT_STAFF;
  return UserRole.CLIENT;
}

function fromUserRole(role: UserRole): TeamMembershipRole {
  if (role === UserRole.CLIENT_ADMIN) return TeamMembershipRole.ADMIN;
  if (role === UserRole.CLIENT_STAFF) return TeamMembershipRole.MANAGER;
  return TeamMembershipRole.VIEWER;
}

function roleLabel(role: TeamMembershipRole): "Admin" | "Manager" | "Viewer" {
  if (role === TeamMembershipRole.ADMIN) return "Admin";
  if (role === TeamMembershipRole.MANAGER) return "Manager";
  return "Viewer";
}

function toTeamRole(input: "admin" | "manager" | "viewer"): TeamMembershipRole {
  if (input === "admin") return TeamMembershipRole.ADMIN;
  if (input === "manager") return TeamMembershipRole.MANAGER;
  return TeamMembershipRole.VIEWER;
}

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

async function syncLegacyOrgUsersToMemberships(db: PrismaClient, orgId: string) {
  const users = await db.user.findMany({
    where: { orgId },
    select: { id: true, email: true, role: true, createdAt: true, updatedAt: true }
  });
  for (const user of users) {
    await db.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: user.id
        }
      },
      update: {
        role: fromUserRole(user.role),
        status: TeamMembershipStatus.ACTIVE,
        acceptedAt: user.updatedAt
      },
      create: {
        organizationId: orgId,
        userId: user.id,
        role: fromUserRole(user.role),
        status: TeamMembershipStatus.ACTIVE,
        invitedEmail: user.email,
        invitedAt: user.createdAt,
        acceptedAt: user.updatedAt
      }
    });
  }
}

async function resolveSeatSnapshot(db: PrismaClient, orgId: string) {
  const [org, subscription, activeMembers, pendingInvites] = await Promise.all([
    db.organization.findUnique({
      where: { id: orgId },
      select: { includedSeats: true, purchasedSeats: true }
    }),
    db.subscription.findFirst({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: { plan: true, status: true }
    }),
    db.organizationMembership.count({
      where: { organizationId: orgId, status: TeamMembershipStatus.ACTIVE }
    }),
    db.organizationMembership.count({
      where: { organizationId: orgId, status: TeamMembershipStatus.INVITED }
    })
  ]);

  const activeStatus = new Set(["active", "trialing"]);
  const subStatus = String(subscription?.status || "").toLowerCase();
  const isPro = subscription?.plan === SubscriptionPlan.PRO && activeStatus.has(subStatus);
  const includedSeats = isPro ? 3 : 1;
  const purchasedSeats = Math.max(0, org?.purchasedSeats || 0);
  const allowedSeats = includedSeats + purchasedSeats;

  if (org && (org.includedSeats !== includedSeats || org.purchasedSeats !== purchasedSeats)) {
    await db.organization.update({
      where: { id: orgId },
      data: { includedSeats, purchasedSeats }
    });
  }

  return {
    seatPolicy: "activeMembers + pendingInvites <= allowedSeats",
    includedSeats,
    purchasedSeats,
    allowedSeats,
    activeMembers,
    pendingInvites,
    upgradeHint:
      activeMembers + pendingInvites >= allowedSeats
        ? "Seat limit reached. Upgrade plan or add seat add-ons to invite more users."
        : ""
  };
}

function canManageTeam(req: AuthenticatedRequest) {
  return req.auth?.role === UserRole.CLIENT_ADMIN || req.auth?.role === UserRole.ADMIN || req.auth?.role === UserRole.SUPER_ADMIN;
}

teamRouter.post("/accept", async (req, res) => {
  const parsed = acceptTeamInviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid invite payload." });

  const tokenHash = hashToken(parsed.data.token);
  const invite = await prisma.organizationMembership.findFirst({
    where: {
      inviteTokenHash: tokenHash,
      status: TeamMembershipStatus.INVITED
    },
    include: {
      organization: {
        select: { id: true, name: true }
      }
    }
  });
  if (!invite || !invite.inviteExpiresAt || invite.inviteExpiresAt < new Date()) {
    return res.status(400).json({ ok: false, message: "Invite is invalid or expired." });
  }

  const email = normalizeEmail(invite.invitedEmail);
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser?.orgId && existingUser.orgId !== invite.organizationId) {
    return res.status(409).json({ ok: false, message: "This email already belongs to another organization." });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user =
    existingUser ||
    (await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: toUserRole(invite.role),
        orgId: invite.organizationId
      }
    }));

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        role: toUserRole(invite.role),
        orgId: invite.organizationId,
        ...(existingUser ? {} : { passwordHash })
      }
    }),
    prisma.organizationMembership.update({
      where: { id: invite.id },
      data: {
        userId: user.id,
        status: TeamMembershipStatus.ACTIVE,
        acceptedAt: new Date(),
        inviteTokenHash: null,
        inviteExpiresAt: null
      }
    }),
    prisma.auditLog.create({
      data: {
        orgId: invite.organizationId,
        actorUserId: user.id,
        actorRole: toUserRole(invite.role),
        action: "TEAM_INVITE_ACCEPTED",
        metadataJson: JSON.stringify({ membershipId: invite.id, email })
      }
    })
  ]);

  return res.json({ ok: true, data: { accepted: true, orgName: invite.organization.name } });
});

teamRouter.use(requireAuth, requireAnyRole([UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN]));

teamRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const orgId = req.auth?.orgId;
  if (!orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });

  await syncLegacyOrgUsersToMemberships(prisma, orgId);
  const [memberships, seat] = await Promise.all([
    prisma.organizationMembership.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: { id: true, email: true, createdAt: true, updatedAt: true }
        }
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }]
    }),
    resolveSeatSnapshot(prisma, orgId)
  ]);

  const members = memberships.map((row) => ({
    id: row.id,
    role: row.role,
    status: row.status,
    invitedEmail: row.invitedEmail,
    invitedAt: row.invitedAt?.toISOString() || null,
    acceptedAt: row.acceptedAt?.toISOString() || null,
    createdAt: row.createdAt.toISOString(),
    user: row.user
      ? {
          id: row.user.id,
          email: row.user.email,
          createdAt: row.user.createdAt.toISOString(),
          updatedAt: row.user.updatedAt.toISOString()
        }
      : null
  }));

  return res.json({
    ok: true,
    data: {
      canManage: canManageTeam(req),
      seats: seat,
      members
    }
  });
});

teamRouter.post("/invite", requireCsrf, async (req: AuthenticatedRequest, res) => {
  if (!canManageTeam(req)) return res.status(403).json({ ok: false, message: "Forbidden" });
  const orgId = req.auth?.orgId;
  if (!orgId || !req.auth?.userId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = inviteTeamMemberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid invite payload." });

  await syncLegacyOrgUsersToMemberships(prisma, orgId);
  const seat = await resolveSeatSnapshot(prisma, orgId);
  if (seat.activeMembers + seat.pendingInvites >= seat.allowedSeats) {
    return res.status(409).json({
      ok: false,
      message: "You have reached your seat limit. Add additional seats to invite more users."
    });
  }

  const email = normalizeEmail(parsed.data.email);
  const existingActive = await prisma.organizationMembership.findFirst({
    where: {
      organizationId: orgId,
      status: TeamMembershipStatus.ACTIVE,
      invitedEmail: email
    }
  });
  if (existingActive) return res.status(409).json({ ok: false, message: "User is already an active team member." });

  const token = crypto.randomBytes(32).toString("base64url");
  const inviteRole = toTeamRole(parsed.data.role);
  const invite = await prisma.organizationMembership.create({
    data: {
      organizationId: orgId,
      role: inviteRole,
      status: TeamMembershipStatus.INVITED,
      invitedEmail: email,
      invitedBy: req.auth.userId,
      invitedAt: new Date(),
      inviteTokenHash: hashToken(token),
      inviteExpiresAt: new Date(Date.now() + INVITE_EXP_HOURS * 60 * 60 * 1000)
    },
    include: { organization: { select: { name: true } } }
  });

  const inviteUrl = `${env.FRONTEND_APP_URL}/auth/accept-invite?token=${encodeURIComponent(token)}`;
  try {
    await sendTeamInviteEmail({
      email,
      organizationName: invite.organization.name,
      roleLabel: roleLabel(inviteRole),
      inviteUrl,
      expiresHours: INVITE_EXP_HOURS
    });
  } catch (error) {
    await prisma.organizationMembership.delete({ where: { id: invite.id } });
    return res.status(503).json({
      ok: false,
      message: error instanceof Error ? error.message : "Could not send invite email."
    });
  }

  await prisma.auditLog.create({
    data: {
      orgId,
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "TEAM_INVITE_SENT",
      metadataJson: JSON.stringify({ invitedEmail: email, role: inviteRole })
    }
  });

  return res.json({ ok: true, data: { invited: true, membershipId: invite.id } });
});

teamRouter.post("/resend", requireCsrf, async (req: AuthenticatedRequest, res) => {
  if (!canManageTeam(req)) return res.status(403).json({ ok: false, message: "Forbidden" });
  const orgId = req.auth?.orgId;
  if (!orgId || !req.auth?.userId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = resendTeamInviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid resend payload." });

  const membership = await prisma.organizationMembership.findFirst({
    where: {
      id: parsed.data.membershipId,
      organizationId: orgId,
      status: TeamMembershipStatus.INVITED
    },
    include: { organization: { select: { name: true } } }
  });
  if (!membership) return res.status(404).json({ ok: false, message: "Invite not found." });

  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.organizationMembership.update({
    where: { id: membership.id },
    data: {
      invitedAt: new Date(),
      inviteTokenHash: hashToken(token),
      inviteExpiresAt: new Date(Date.now() + INVITE_EXP_HOURS * 60 * 60 * 1000)
    }
  });

  const inviteUrl = `${env.FRONTEND_APP_URL}/auth/accept-invite?token=${encodeURIComponent(token)}`;
  await sendTeamInviteEmail({
    email: membership.invitedEmail,
    organizationName: membership.organization.name,
    roleLabel: roleLabel(membership.role),
    inviteUrl,
    expiresHours: INVITE_EXP_HOURS
  });

  await prisma.auditLog.create({
    data: {
      orgId,
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "TEAM_INVITE_RESENT",
      metadataJson: JSON.stringify({ membershipId: membership.id, invitedEmail: membership.invitedEmail })
    }
  });

  return res.json({ ok: true, data: { resent: true } });
});

teamRouter.patch("/role", requireCsrf, async (req: AuthenticatedRequest, res) => {
  if (!canManageTeam(req)) return res.status(403).json({ ok: false, message: "Forbidden" });
  const orgId = req.auth?.orgId;
  if (!orgId || !req.auth?.userId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = updateTeamRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid role payload." });

  const membership = await prisma.organizationMembership.findFirst({
    where: { id: parsed.data.membershipId, organizationId: orgId }
  });
  if (!membership) return res.status(404).json({ ok: false, message: "Member not found." });
  if (membership.userId && membership.userId === req.auth.userId) {
    return res.status(400).json({ ok: false, message: "You cannot change your own role." });
  }

  const nextRole = toTeamRole(parsed.data.role);
  await prisma.organizationMembership.update({
    where: { id: membership.id },
    data: { role: nextRole }
  });
  if (membership.userId) {
    await prisma.user.update({
      where: { id: membership.userId },
      data: { role: toUserRole(nextRole) }
    });
  }

  await prisma.auditLog.create({
    data: {
      orgId,
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "TEAM_ROLE_UPDATED",
      metadataJson: JSON.stringify({ membershipId: membership.id, role: nextRole })
    }
  });

  return res.json({ ok: true, data: { updated: true } });
});

teamRouter.delete("/member", requireCsrf, async (req: AuthenticatedRequest, res) => {
  if (!canManageTeam(req)) return res.status(403).json({ ok: false, message: "Forbidden" });
  const orgId = req.auth?.orgId;
  if (!orgId || !req.auth?.userId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = deleteTeamMemberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid member payload." });

  const membership = await prisma.organizationMembership.findFirst({
    where: { id: parsed.data.membershipId, organizationId: orgId }
  });
  if (!membership) return res.status(404).json({ ok: false, message: "Member not found." });
  if (membership.userId && membership.userId === req.auth.userId) {
    return res.status(400).json({ ok: false, message: "You cannot remove your own account." });
  }

  await prisma.organizationMembership.delete({ where: { id: membership.id } });
  if (membership.userId) {
    await prisma.user.update({
      where: { id: membership.userId },
      data: { orgId: null, role: UserRole.CLIENT }
    });
  }

  await prisma.auditLog.create({
    data: {
      orgId,
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "TEAM_MEMBER_REMOVED",
      metadataJson: JSON.stringify({ membershipId: membership.id, invitedEmail: membership.invitedEmail })
    }
  });

  return res.json({ ok: true, data: { removed: true } });
});
