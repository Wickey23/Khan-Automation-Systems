import type { PrismaClient } from "@prisma/client";
import { generateFamilyId, hashToken, signRefreshToken, verifyRefreshToken } from "../../lib/auth";
import { env } from "../../config/env";

function refreshExpiryDate() {
  const ttl = Number.parseInt(env.REFRESH_TOKEN_TTL_DAYS, 10);
  const days = Number.isFinite(ttl) ? ttl : 14;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function createRefreshSession(prisma: PrismaClient, userId: string, familyId?: string) {
  const created = await prisma.refreshSession.create({
    data: {
      userId,
      tokenHash: "pending",
      expiresAt: refreshExpiryDate(),
      familyId: familyId || generateFamilyId()
    }
  });
  const token = signRefreshToken({ userId, sessionId: created.id, familyId: created.familyId });
  const tokenHash = hashToken(token);
  await prisma.refreshSession.update({
    where: { id: created.id },
    data: { tokenHash }
  });
  return { token, session: { ...created, tokenHash } };
}

export async function rotateRefreshSession(prisma: PrismaClient, token: string) {
  const payload = verifyRefreshToken(token);
  const tokenHash = hashToken(token);
  const existing = await prisma.refreshSession.findUnique({
    where: { tokenHash }
  });
  if (!existing || existing.id !== payload.sessionId || existing.userId !== payload.userId) {
    return { ok: false as const, reason: "invalid" };
  }
  if (existing.expiresAt <= new Date()) {
    return { ok: false as const, reason: "expired", userId: existing.userId, familyId: existing.familyId };
  }
  if (existing.revokedAt) {
    await revokeRefreshFamily(prisma, existing.familyId);
    return { ok: false as const, reason: "reuse", userId: existing.userId, familyId: existing.familyId };
  }

  await prisma.refreshSession.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() }
  });
  const created = await prisma.refreshSession.create({
    data: {
      userId: existing.userId,
      tokenHash: "pending",
      expiresAt: refreshExpiryDate(),
      familyId: existing.familyId,
      rotatedFromId: existing.id
    }
  });
  const nextToken = signRefreshToken({ userId: existing.userId, sessionId: created.id, familyId: existing.familyId });
  await prisma.refreshSession.update({
    where: { id: created.id },
    data: { tokenHash: hashToken(nextToken) }
  });
  return { ok: true as const, userId: existing.userId, familyId: existing.familyId, token: nextToken };
}

export async function revokeRefreshFamily(prisma: PrismaClient, familyId: string) {
  await prisma.refreshSession.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export async function revokeAllRefreshSessionsForUser(prisma: PrismaClient, userId: string) {
  await prisma.refreshSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
