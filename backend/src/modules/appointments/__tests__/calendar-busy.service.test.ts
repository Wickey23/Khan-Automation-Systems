import assert from "node:assert/strict";
import test from "node:test";
import { getBusyBlocks, CalendarUnavailableError } from "../calendar-busy.service";

function createPrismaMock(provider: "GOOGLE" | "OUTLOOK") {
  const updates: Array<{ id: string; isActive: boolean }> = [];
  const prisma = {
    calendarConnection: {
      findFirst: async () => ({
        id: "conn_1",
        orgId: "org_1",
        provider,
        accountEmail: "ops@example.com",
        accessTokenEnc: "access_token",
        refreshTokenEnc: "refresh_token",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        scopesJson: "[]",
        isActive: true,
        isPrimary: true,
        selectedCalendarId: provider === "GOOGLE" ? "primary" : null,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      update: async ({ where, data }: { where: { id: string }; data: { isActive: boolean } }) => {
        updates.push({ id: where.id, isActive: data.isActive });
        return null;
      }
    }
  } as any;
  return { prisma, updates };
}

test("google busy adapter deactivates on hard auth failure", async () => {
  const originalFetch = global.fetch;
  const mock = createPrismaMock("GOOGLE");
  global.fetch = (async () =>
    ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "invalid_grant" })
    }) as unknown as Response) as typeof fetch;
  try {
    await assert.rejects(
      () =>
        getBusyBlocks({
          prisma: mock.prisma,
          orgId: "org_1",
          fromUtc: new Date("2026-03-05T12:00:00.000Z"),
          toUtc: new Date("2026-03-05T18:00:00.000Z")
        }),
      (error) => error instanceof CalendarUnavailableError
    );
    assert.equal(mock.updates.length, 1);
    assert.deepEqual(mock.updates[0], { id: "conn_1", isActive: false });
  } finally {
    global.fetch = originalFetch;
  }
});

test("google busy adapter does not deactivate on transient failure", async () => {
  const originalFetch = global.fetch;
  const mock = createPrismaMock("GOOGLE");
  global.fetch = (async () =>
    ({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ error: "server_error" })
    }) as unknown as Response) as typeof fetch;
  try {
    await assert.rejects(
      () =>
        getBusyBlocks({
          prisma: mock.prisma,
          orgId: "org_1",
          fromUtc: new Date("2026-03-05T12:00:00.000Z"),
          toUtc: new Date("2026-03-05T18:00:00.000Z")
        }),
      (error) => error instanceof CalendarUnavailableError
    );
    assert.equal(mock.updates.length, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test("outlook busy adapter ignores free rows and returns deterministic sorted windows", async () => {
  const originalFetch = global.fetch;
  const mock = createPrismaMock("OUTLOOK");
  global.fetch = (async () =>
    ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          value: [
            {
              showAs: "free",
              start: { dateTime: "2026-03-05T14:00:00.000Z" },
              end: { dateTime: "2026-03-05T15:00:00.000Z" }
            },
            {
              showAs: "busy",
              start: { dateTime: "2026-03-05T16:00:00.000Z" },
              end: { dateTime: "2026-03-05T17:00:00.000Z" }
            },
            {
              showAs: "tentative",
              start: { dateTime: "2026-03-05T13:00:00.000Z" },
              end: { dateTime: "2026-03-05T13:30:00.000Z" }
            }
          ]
        })
    }) as unknown as Response) as typeof fetch;
  try {
    const rows = await getBusyBlocks({
      prisma: mock.prisma,
      orgId: "org_1",
      fromUtc: new Date("2026-03-05T12:00:00.000Z"),
      toUtc: new Date("2026-03-05T18:00:00.000Z")
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.startUtc.toISOString(), "2026-03-05T13:00:00.000Z");
    assert.equal(rows[1]?.startUtc.toISOString(), "2026-03-05T16:00:00.000Z");
  } finally {
    global.fetch = originalFetch;
  }
});
