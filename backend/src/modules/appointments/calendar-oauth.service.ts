import crypto from "crypto";
import { CalendarProvider, type PrismaClient } from "@prisma/client";
import { env } from "../../config/env";
import { decryptField, encryptField } from "../../lib/crypto-fields";

type ProviderKind = "GOOGLE" | "OUTLOOK";

type OAuthStatePayload = {
  orgId: string;
  userId: string;
  provider: ProviderKind;
  expiresAt: number;
};

type NormalizedTokenPayload = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
  accountEmail: string;
};

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;
const oauthStateStore = new Map<string, OAuthStatePayload>();

function getProviderConfig(provider: ProviderKind) {
  if (provider === "GOOGLE") {
    return {
      clientId: String(process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim(),
      clientSecret: String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim(),
      callbackUrl:
        String(process.env.GOOGLE_OAUTH_CALLBACK_URL || "").trim() || `${env.API_BASE_URL}/api/org/calendar/google/callback`,
      scopes: ["openid", "email", "profile", "https://www.googleapis.com/auth/calendar.events"],
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token"
    };
  }
  return {
    clientId: String(process.env.OUTLOOK_OAUTH_CLIENT_ID || "").trim(),
    clientSecret: String(process.env.OUTLOOK_OAUTH_CLIENT_SECRET || "").trim(),
    callbackUrl:
      String(process.env.OUTLOOK_OAUTH_CALLBACK_URL || "").trim() || `${env.API_BASE_URL}/api/org/calendar/outlook/callback`,
    scopes: ["offline_access", "User.Read", "Calendars.ReadWrite"],
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token"
  };
}

function ensureProviderConfigured(provider: ProviderKind) {
  const config = getProviderConfig(provider);
  if (!config.clientId || !config.clientSecret || !config.callbackUrl) {
    throw new Error(`${provider.toLowerCase()}_oauth_not_configured`);
  }
  return config;
}

function cleanupExpiredStates(now = Date.now()) {
  for (const [state, payload] of oauthStateStore.entries()) {
    if (payload.expiresAt <= now) oauthStateStore.delete(state);
  }
}

function withTimeout<T>(promise: Promise<T>) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("calendar_request_timeout")), REQUEST_TIMEOUT_MS)
    )
  ]);
}

async function fetchJson(url: string, init: RequestInit) {
  const response = await withTimeout(fetch(url, init));
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  return { ok: response.ok, status: response.status, payload };
}

async function resolveGoogleAccountEmail(accessToken: string) {
  const profile = await fetchJson("https://openidconnect.googleapis.com/v1/userinfo", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!profile.ok) return "";
  const email = String((profile.payload as { email?: string } | null)?.email || "").trim().toLowerCase();
  return email;
}

async function resolveOutlookAccountEmail(accessToken: string) {
  const profile = await fetchJson("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!profile.ok) return "";
  const row = profile.payload as { mail?: string; userPrincipalName?: string } | null;
  const email = String(row?.mail || row?.userPrincipalName || "").trim().toLowerCase();
  return email;
}

export function createCalendarConnectUrl(input: { provider: ProviderKind; orgId: string; userId: string }) {
  cleanupExpiredStates();
  const config = ensureProviderConfigured(input.provider);
  const state = crypto.randomBytes(18).toString("base64url");
  oauthStateStore.set(state, {
    orgId: input.orgId,
    userId: input.userId,
    provider: input.provider,
    expiresAt: Date.now() + OAUTH_STATE_TTL_MS
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    response_type: "code",
    scope: config.scopes.join(" "),
    state
  });
  if (input.provider === "GOOGLE") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
    params.set("include_granted_scopes", "true");
  } else {
    params.set("response_mode", "query");
  }
  return `${config.authUrl}?${params.toString()}`;
}

export function consumeCalendarOauthState(input: {
  provider: ProviderKind;
  state: string;
  orgId: string;
  userId: string;
}) {
  cleanupExpiredStates();
  const payload = oauthStateStore.get(input.state);
  oauthStateStore.delete(input.state);
  if (!payload) return null;
  if (payload.provider !== input.provider) return null;
  if (payload.orgId !== input.orgId || payload.userId !== input.userId) return null;
  if (payload.expiresAt <= Date.now()) return null;
  return payload;
}

export async function exchangeCalendarCode(input: { provider: ProviderKind; code: string }): Promise<NormalizedTokenPayload> {
  const config = ensureProviderConfigured(input.provider);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.callbackUrl,
    code: input.code
  });
  if (input.provider === "OUTLOOK") {
    body.set("scope", config.scopes.join(" "));
  }
  const token = await fetchJson(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!token.ok) throw new Error(`${input.provider.toLowerCase()}_oauth_exchange_failed`);

  const payload = token.payload as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  const accessToken = String(payload?.access_token || "").trim();
  const refreshToken = String(payload?.refresh_token || "").trim();
  if (!accessToken || !refreshToken) throw new Error(`${input.provider.toLowerCase()}_oauth_token_missing`);
  const expiresIn = Number(payload?.expires_in || 3600);
  const scopes = String(payload?.scope || "")
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean);
  const accountEmail =
    input.provider === "GOOGLE"
      ? await resolveGoogleAccountEmail(accessToken)
      : await resolveOutlookAccountEmail(accessToken);
  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + Math.max(300, expiresIn - 60) * 1000),
    scopes,
    accountEmail: accountEmail || `unknown-${input.provider.toLowerCase()}@calendar.local`
  };
}

export async function upsertCalendarConnection(input: {
  prisma: PrismaClient;
  orgId: string;
  provider: ProviderKind;
  accountEmail: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
}) {
  return input.prisma.calendarConnection.upsert({
    where: {
      orgId_provider_accountEmail: {
        orgId: input.orgId,
        provider: input.provider as CalendarProvider,
        accountEmail: input.accountEmail
      }
    },
    update: {
      accessTokenEnc: encryptField(input.accessToken),
      refreshTokenEnc: encryptField(input.refreshToken),
      expiresAt: input.expiresAt,
      scopesJson: JSON.stringify(input.scopes),
      isActive: true
    },
    create: {
      orgId: input.orgId,
      provider: input.provider as CalendarProvider,
      accountEmail: input.accountEmail,
      accessTokenEnc: encryptField(input.accessToken),
      refreshTokenEnc: encryptField(input.refreshToken),
      expiresAt: input.expiresAt,
      scopesJson: JSON.stringify(input.scopes),
      isActive: true
    }
  });
}

async function refreshAccessToken(input: {
  provider: ProviderKind;
  refreshToken: string;
}) {
  const config = ensureProviderConfigured(input.provider);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: input.refreshToken
  });
  if (input.provider === "OUTLOOK") {
    body.set("scope", config.scopes.join(" "));
  }
  const token = await fetchJson(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!token.ok) throw new Error(`${input.provider.toLowerCase()}_token_refresh_failed`);

  const payload = token.payload as { access_token?: string; refresh_token?: string; expires_in?: number };
  const accessToken = String(payload?.access_token || "").trim();
  const refreshToken = String(payload?.refresh_token || "").trim() || input.refreshToken;
  const expiresIn = Number(payload?.expires_in || 3600);
  if (!accessToken) throw new Error(`${input.provider.toLowerCase()}_token_refresh_missing_access`);
  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + Math.max(300, expiresIn - 60) * 1000)
  };
}

async function ensureUsableAccessToken(input: {
  prisma: PrismaClient;
  connectionId: string;
  provider: ProviderKind;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  expiresAt: Date;
}) {
  const nowMs = Date.now();
  const accessToken = decryptField(input.accessTokenEnc);
  const refreshToken = decryptField(input.refreshTokenEnc);
  if (input.expiresAt.getTime() > nowMs + 30_000) return { accessToken, refreshToken, expiresAt: input.expiresAt };

  const refreshed = await refreshAccessToken({ provider: input.provider, refreshToken });
  await input.prisma.calendarConnection.update({
    where: { id: input.connectionId },
    data: {
      accessTokenEnc: encryptField(refreshed.accessToken),
      refreshTokenEnc: encryptField(refreshed.refreshToken),
      expiresAt: refreshed.expiresAt,
      isActive: true
    }
  });
  return refreshed;
}

async function createGoogleEvent(input: {
  accessToken: string;
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
}) {
  const response = await fetchJson("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      summary: input.title,
      description: input.description,
      start: { dateTime: input.startAt.toISOString(), timeZone: input.timezone },
      end: { dateTime: input.endAt.toISOString(), timeZone: input.timezone }
    })
  });
  if (!response.ok) throw new Error("google_event_create_failed");
  const payload = response.payload as { id?: string };
  return String(payload?.id || "");
}

async function createOutlookEvent(input: {
  accessToken: string;
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
}) {
  const response = await fetchJson("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      subject: input.title,
      body: { contentType: "Text", content: input.description },
      start: { dateTime: input.startAt.toISOString(), timeZone: input.timezone },
      end: { dateTime: input.endAt.toISOString(), timeZone: input.timezone }
    })
  });
  if (!response.ok) throw new Error("outlook_event_create_failed");
  const payload = response.payload as { id?: string };
  return String(payload?.id || "");
}

export async function createCalendarEventFromConnection(input: {
  prisma: PrismaClient;
  connectionId: string;
  orgId: string;
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
}) {
  const connection = await input.prisma.calendarConnection.findFirst({
    where: { id: input.connectionId, orgId: input.orgId, isActive: true }
  });
  if (!connection) throw new Error("calendar_connection_not_found");
  const provider = connection.provider as ProviderKind;
  const token = await ensureUsableAccessToken({
    prisma: input.prisma,
    connectionId: connection.id,
    provider,
    accessTokenEnc: connection.accessTokenEnc,
    refreshTokenEnc: connection.refreshTokenEnc,
    expiresAt: connection.expiresAt
  });
  try {
    const externalEventId =
      provider === "GOOGLE"
        ? await createGoogleEvent({
            accessToken: token.accessToken,
            title: input.title,
            description: input.description,
            startAt: input.startAt,
            endAt: input.endAt,
            timezone: input.timezone
          })
        : await createOutlookEvent({
            accessToken: token.accessToken,
            title: input.title,
            description: input.description,
            startAt: input.startAt,
            endAt: input.endAt,
            timezone: input.timezone
          });
    return { provider, externalEventId };
  } catch (error) {
    // Graceful degradation: deactivate broken tokens.
    if (String((error as Error)?.message || "").includes("token")) {
      await input.prisma.calendarConnection.update({
        where: { id: connection.id },
        data: { isActive: false }
      });
    }
    throw error;
  }
}

