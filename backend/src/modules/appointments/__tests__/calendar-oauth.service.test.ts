import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeCalendarOauthState,
  createCalendarConnectUrl,
  createCalendarEventFromConnection
} from "../calendar-oauth.service";

function withOauthEnv<T>(fn: () => T) {
  const previous = {
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_CALLBACK_URL: process.env.GOOGLE_OAUTH_CALLBACK_URL,
    OUTLOOK_OAUTH_CLIENT_ID: process.env.OUTLOOK_OAUTH_CLIENT_ID,
    OUTLOOK_OAUTH_CLIENT_SECRET: process.env.OUTLOOK_OAUTH_CLIENT_SECRET,
    OUTLOOK_OAUTH_CALLBACK_URL: process.env.OUTLOOK_OAUTH_CALLBACK_URL
  };
  process.env.GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || "google-test-client-id";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "google-test-client-secret";
  process.env.GOOGLE_OAUTH_CALLBACK_URL =
    process.env.GOOGLE_OAUTH_CALLBACK_URL || "https://api.example.com/api/org/calendar/google/callback";
  process.env.OUTLOOK_OAUTH_CLIENT_ID = process.env.OUTLOOK_OAUTH_CLIENT_ID || "outlook-test-client-id";
  process.env.OUTLOOK_OAUTH_CLIENT_SECRET = process.env.OUTLOOK_OAUTH_CLIENT_SECRET || "outlook-test-client-secret";
  process.env.OUTLOOK_OAUTH_CALLBACK_URL =
    process.env.OUTLOOK_OAUTH_CALLBACK_URL || "https://api.example.com/api/org/calendar/outlook/callback";
  try {
    return fn();
  } finally {
    process.env.GOOGLE_OAUTH_CLIENT_ID = previous.GOOGLE_OAUTH_CLIENT_ID;
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = previous.GOOGLE_OAUTH_CLIENT_SECRET;
    process.env.GOOGLE_OAUTH_CALLBACK_URL = previous.GOOGLE_OAUTH_CALLBACK_URL;
    process.env.OUTLOOK_OAUTH_CLIENT_ID = previous.OUTLOOK_OAUTH_CLIENT_ID;
    process.env.OUTLOOK_OAUTH_CLIENT_SECRET = previous.OUTLOOK_OAUTH_CLIENT_SECRET;
    process.env.OUTLOOK_OAUTH_CALLBACK_URL = previous.OUTLOOK_OAUTH_CALLBACK_URL;
  }
}

test("oauth state is scoped and single-use for google", () =>
  withOauthEnv(() => {
    const url = createCalendarConnectUrl({
      provider: "GOOGLE",
      orgId: "org_1",
      userId: "user_1"
    });
    const state = new URL(url).searchParams.get("state");
    assert.equal(Boolean(state), true);

    const accepted = consumeCalendarOauthState({
      provider: "GOOGLE",
      state: String(state),
      orgId: "org_1",
      userId: "user_1"
    });
    assert.equal(Boolean(accepted), true);

    const replay = consumeCalendarOauthState({
      provider: "GOOGLE",
      state: String(state),
      orgId: "org_1",
      userId: "user_1"
    });
    assert.equal(replay, null);
  }));

test("oauth state rejects mismatched org/user/provider", () =>
  withOauthEnv(() => {
    const url = createCalendarConnectUrl({
      provider: "OUTLOOK",
      orgId: "org_1",
      userId: "user_1"
    });
    const state = String(new URL(url).searchParams.get("state"));

    const wrongProvider = consumeCalendarOauthState({
      provider: "GOOGLE",
      state,
      orgId: "org_1",
      userId: "user_1"
    });
    assert.equal(wrongProvider, null);
  }));

test("oauth state rejects mismatched org and user", () =>
  withOauthEnv(() => {
    const url = createCalendarConnectUrl({
      provider: "GOOGLE",
      orgId: "org_abc",
      userId: "user_abc"
    });
    const state = String(new URL(url).searchParams.get("state"));

    const wrongOrg = consumeCalendarOauthState({
      provider: "GOOGLE",
      state,
      orgId: "org_other",
      userId: "user_abc"
    });
    assert.equal(wrongOrg, null);
  }));

test("calendar event auth failure marks connection inactive", async () => {
  const originalFetch = global.fetch;
  const updates: Array<{ id: string; isActive: boolean }> = [];
  global.fetch = (async () =>
    ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "unauthorized" })
    }) as unknown as Response) as typeof fetch;

  const prisma = {
    calendarConnection: {
      findFirst: async () => ({
        id: "conn_1",
        orgId: "org_1",
        provider: "GOOGLE",
        accountEmail: "ops@example.com",
        accessTokenEnc: "token_access",
        refreshTokenEnc: "token_refresh",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        scopesJson: "[]",
        isActive: true,
        isPrimary: true
      }),
      update: async ({ where, data }: { where: { id: string }; data: { isActive: boolean } }) => {
        updates.push({ id: where.id, isActive: data.isActive });
        return null;
      }
    }
  } as any;

  try {
    await assert.rejects(
      () =>
        createCalendarEventFromConnection({
          prisma,
          connectionId: "conn_1",
          orgId: "org_1",
          title: "test",
          description: "test",
          startAt: new Date("2026-03-10T15:00:00.000Z"),
          endAt: new Date("2026-03-10T15:15:00.000Z"),
          timezone: "America/New_York"
        }),
      /auth_failed/
    );
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0], { id: "conn_1", isActive: false });
  } finally {
    global.fetch = originalFetch;
  }
});
