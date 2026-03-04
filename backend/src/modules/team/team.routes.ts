import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  Prisma,
  TeamMembershipRole,
  TeamMembershipStatus,
  UserRole,
  type PrismaClient,
  type Prisma as PrismaTypes,
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
import { buildSeatSnapshot, canAcceptSeat, canInviteSeat } from "./team-seat.service";

export const teamRouter = Router();

const INVITE_EXP_HOURS = 72;
const TX_ISOLATION = Prisma.TransactionIsolationLevel.Serializable;
type DbClient = PrismaClient | PrismaTypes.TransactionClient;

class TeamCapacityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamCapacityError";
  }
}

class TeamConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamConflictError";
  }
}

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

async function syncLegacyOrgUsersToMemberships(db: DbClient, orgId: string) {
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

async function resolveSeatSnapshot(db: DbClient, orgId: string) {
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
  const snapshot = buildSeatSnapshot({
    isPro,
    purchasedSeats: org?.purchasedSeats || 0,
    activeMembers,
    pendingInvites
  });

  if (org && (org.includedSeats !== snapshot.includedSeats || org.purchasedSeats !== snapshot.purchasedSeats)) {
    await db.organization.update({
      where: { id: orgId },
      data: { includedSeats: snapshot.includedSeats, purchasedSeats: snapshot.purchasedSeats }
    });
  }

  return snapshot;
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
  let userId = existingUser?.id || null;
  try {
    await prisma.$transaction(
      async (tx) => {
        await syncLegacyOrgUsersToMemberships(tx, invite.organizationId);
        const seatSnapshot = await resolveSeatSnapshot(tx, invite.organizationId);
        if (!canAcceptSeat(seatSnapshot)) {
          throw new TeamCapacityError("Seat limit reached. Ask your admin to add seats before accepting this invite.");
        }

        if (!userId) {
          const createdUser = await tx.user.create({
            data: {
              email,
              passwordHash,
              role: toUserRole(invite.role),
              orgId: invite.organizationId
            }
          });
          userId = createdUser.id;
        }

        await tx.user.update({
          where: { id: String(userId) },
          data: {
            role: toUserRole(invite.role),
            orgId: invite.organizationId,
            ...(existingUser ? {} : { passwordHash })
          }
        });
        await tx.organizationMembership.update({
          where: { id: invite.id },
          data: {
            userId: String(userId),
            status: TeamMembershipStatus.ACTIVE,
            acceptedAt: new Date(),
            inviteTokenHash: null,
            inviteExpiresAt: null
          }
        });
        await tx.auditLog.create({
          data: {
            orgId: invite.organizationId,
            actorUserId: String(userId),
            actorRole: toUserRole(invite.role),
            action: "TEAM_INVITE_ACCEPTED",
            metadataJson: JSON.stringify({ membershipId: invite.id, email })
          }
        });
      },
      { isolationLevel: TX_ISOLATION }
    );
  } catch (error) {
    if (error instanceof TeamCapacityError) {
      return res.status(409).json({ ok: false, message: error.message });
    }
    const code = String((error as { code?: string } | null)?.code || "");
    if (code === "P2034" || code === "P2002") {
      return res.status(409).json({
        ok: false,
        message: "Invite acceptance conflicted with a concurrent seat update. Please try again."
      });
    }
    throw error;
  }

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
  const actorUserId = req.auth?.userId;
  const actorRole = req.auth?.role;
  if (!orgId || !actorUserId || !actorRole) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = inviteTeamMemberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid invite payload." });

  const email = normalizeEmail(parsed.data.email);
  const token = crypto.randomBytes(32).toString("base64url");
  const inviteRole = toTeamRole(parsed.data.role);
  let invite: PrismaTypes.OrganizationMembershipGetPayload<{
    include: { organization: { select: { name: true } } };
  }>;
  try {
    invite = await prisma.$transaction(
      async (tx) => {
        await syncLegacyOrgUsersToMemberships(tx, orgId);
        const seat = await resolveSeatSnapshot(tx, orgId);
        if (!canInviteSeat(seat)) {
          throw new TeamCapacityError("You have reached your seat limit. Add additional seats to invite more users.");
        }

        const existingActive = await tx.organizationMembership.findFirst({
          where: {
            organizationId: orgId,
            status: TeamMembershipStatus.ACTIVE,
            invitedEmail: email
          }
        });
        if (existingActive) throw new TeamConflictError("User is already an active team member.");
        const existingInvite = await tx.organizationMembership.findFirst({
          where: {
            organizationId: orgId,
            status: TeamMembershipStatus.INVITED,
            invitedEmail: email
          }
        });
        if (existingInvite) throw new TeamConflictError("An invite is already pending for this email.");

        return tx.organizationMembership.create({
          data: {
            organizationId: orgId,
            role: inviteRole,
            status: TeamMembershipStatus.INVITED,
            invitedEmail: email,
            invitedBy: actorUserId,
            invitedAt: new Date(),
            inviteTokenHash: hashToken(token),
            inviteExpiresAt: new Date(Date.now() + INVITE_EXP_HOURS * 60 * 60 * 1000)
          },
          include: { organization: { select: { name: true } } }
        });
      },
      { isolationLevel: TX_ISOLATION }
    );
  } catch (error) {
    if (error instanceof TeamCapacityError || error instanceof TeamConflictError) {
      return res.status(409).json({ ok: false, message: error.message });
    }
    const code = String((error as { code?: string } | null)?.code || "");
    if (code === "P2034" || code === "P2002") {
      return res.status(409).json({
        ok: false,
        message: "Invite conflicted with a concurrent update. Please retry."
      });
    }
    throw error;
  }

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
      actorUserId,
      actorRole,
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
