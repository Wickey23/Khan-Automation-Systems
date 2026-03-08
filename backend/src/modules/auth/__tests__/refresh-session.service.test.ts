import assert from "node:assert/strict";
import test from "node:test";
import {
  createRefreshSession,
  revokeRefreshSessionByToken,
  revokeAllRefreshSessionsForUser,
  rotateRefreshSession
} from "../refresh-session.service";

type Session = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  rotatedFromId: string | null;
  familyId: string;
  createdAt: Date;
};

function createMockPrisma() {
  const sessions = new Map<string, Session>();
  let idSeq = 1;
  const byTokenHash = () => new Map(Array.from(sessions.values()).map((row) => [row.tokenHash, row]));
  return {
    refreshSession: {
      async create({ data }: { data: Partial<Session> }) {
        const row: Session = {
          id: `s_${idSeq++}`,
          userId: String(data.userId),
          tokenHash: String(data.tokenHash || ""),
          expiresAt: (data.expiresAt as Date) || new Date(Date.now() + 1_000),
          revokedAt: (data.revokedAt as Date) || null,
          rotatedFromId: (data.rotatedFromId as string) || null,
          familyId: String(data.familyId),
          createdAt: new Date()
        };
        sessions.set(row.id, row);
        return row;
      },
      async update({ where, data }: { where: { id: string }; data: Partial<Session> }) {
        const row = sessions.get(where.id);
        if (!row) throw new Error("missing");
        const next = { ...row, ...data };
        sessions.set(where.id, next);
        return next;
      },
      async updateMany({ where, data }: { where: Partial<Session>; data: Partial<Session> }) {
        let count = 0;
        for (const row of sessions.values()) {
          const userMatch = where.userId ? row.userId === where.userId : true;
          const familyMatch = where.familyId ? row.familyId === where.familyId : true;
          const revokedMatch = where.revokedAt === null ? row.revokedAt === null : true;
          if (userMatch && familyMatch && revokedMatch) {
            sessions.set(row.id, { ...row, ...data });
            count += 1;
          }
        }
        return { count };
      },
      async findUnique({ where }: { where: { tokenHash: string } }) {
        return byTokenHash().get(where.tokenHash) || null;
      }
    }
  };
}

test("refresh rotates and old token is rejected", async () => {
  const prisma = createMockPrisma() as any;
  const created = await createRefreshSession(prisma, "u1");
  const rotated = await rotateRefreshSession(prisma, created.token);
  assert.equal(rotated.ok, true);
  const reused = await rotateRefreshSession(prisma, created.token);
  assert.equal(reused.ok, false);
});

test("logout-all revokes active refresh sessions", async () => {
  const prisma = createMockPrisma() as any;
  await createRefreshSession(prisma, "u2");
  await createRefreshSession(prisma, "u2");
  const result = await revokeAllRefreshSessionsForUser(prisma, "u2");
  assert.equal(result, undefined);
});

test("revokeRefreshSessionByToken revokes the matching active session", async () => {
  const prisma = createMockPrisma() as any;
  const created = await createRefreshSession(prisma, "u3");
  const revoked = await revokeRefreshSessionByToken(prisma, created.token);
  assert.equal(revoked, true);
  const reused = await rotateRefreshSession(prisma, created.token);
  assert.equal(reused.ok, false);
});

test("revokeRefreshSessionByToken is a no-op for unknown token", async () => {
  const prisma = createMockPrisma() as any;
  const revoked = await revokeRefreshSessionByToken(prisma, "not-a-real-token");
  assert.equal(revoked, false);
});
