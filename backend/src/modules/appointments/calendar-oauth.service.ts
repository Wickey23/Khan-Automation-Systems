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

export type CalendarAuthErrorCode =
  | "HARD_AUTH_FAILURE"
  | "TRANSIENT_FAILURE"
  | "UNKNOWN_FAILURE";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;
const oauthStateStore = new Map<string, OAuthStatePayload>();
const consumedStateStore = new Map<string, number>();

type SignedStatePayload = {
  o: string;
  u: string;
  p: ProviderKind;
  e: number;
  n: string;
};

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
  for (const [state, expiresAt] of consumedStateStore.entries()) {
    if (expiresAt <= now) consumedStateStore.delete(state);
  }
}

function getStateSigningKey() {
  return String(env.JWT_SECRET || "").trim();
}

function createSignedStateToken(payload: SignedStatePayload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", getStateSigningKey()).update(body).digest("base64url");
  return `v1.${body}.${sig}`;
}

function parseSignedStateToken(state: string) {
  const parts = String(state || "").split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, body, sig] = parts;
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", getStateSigningKey()).update(body).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedStatePayload;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
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

function extractOauthError(payload: unknown) {
  const directError = String((payload as { error?: string } | null)?.error || "").toLowerCase();
  const nestedError = String(
    ((payload as { error?: { code?: string; message?: string } } | null)?.error?.code ||
      (payload as { error?: { code?: string; message?: string } } | null)?.error?.message ||
      "")
  ).toLowerCase();
  return `${directError} ${nestedError}`.trim();
}

function classifyFailure(status: number | undefined, payload: unknown): CalendarAuthErrorCode {
  if (status === 401 || status === 403) return "HARD_AUTH_FAILURE";
  const text = extractOauthError(payload);
  if (text.includes("invalid_grant") || text.includes("revoked")) return "HARD_AUTH_FAILURE";
  if ((status || 0) >= 500) return "TRANSIENT_FAILURE";
  return "UNKNOWN_FAILURE";
}

function extractProviderFailureDetail(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const top = payload as Record<string, unknown>;
  const direct = String(top.error_description || top.error || top.message || "").trim();
  if (direct) return direct;
  const nested = (top.error as Record<string, unknown> | undefined) || undefined;
  if (nested) {
    const nestedText = String(nested.message || nested.code || "").trim();
    if (nestedText) return nestedText;
    const nestedErrors = Array.isArray(nested.errors) ? nested.errors : [];
    const firstNested = nestedErrors[0] as Record<string, unknown> | undefined;
    if (firstNested) {
      const firstMessage = String(firstNested.message || firstNested.reason || "").trim();
      if (firstMessage) return firstMessage;
    }
  }
  try {
    const raw = JSON.stringify(payload);
    if (raw && raw !== "{}" && raw !== "null") return raw.slice(0, 300);
  } catch {
    // ignore
  }
  return "";
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
  const nonce = crypto.randomBytes(18).toString("base64url");
  const expiresAt = Date.now() + OAUTH_STATE_TTL_MS;
  const state = createSignedStateToken({
    o: input.orgId,
    u: input.userId,
    p: input.provider,
    e: expiresAt,
    n: nonce
  });
  oauthStateStore.set(state, {
    orgId: input.orgId,
    userId: input.userId,
    provider: input.provider,
    expiresAt
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
  if (consumedStateStore.has(input.state)) return null;

  const payload = oauthStateStore.get(input.state);
  oauthStateStore.delete(input.state);
  if (payload) {
    if (payload.provider !== input.provider) return null;
    if (payload.orgId !== input.orgId || payload.userId !== input.userId) return null;
    if (payload.expiresAt <= Date.now()) return null;
    consumedStateStore.set(input.state, payload.expiresAt);
    return payload;
  }

  const signed = parseSignedStateToken(input.state);
  if (!signed) return null;
  if (signed.p !== input.provider) return null;
  if (signed.o !== input.orgId || signed.u !== input.userId) return null;
  if (signed.e <= Date.now()) return null;

  consumedStateStore.set(input.state, signed.e);
  return {
    orgId: signed.o,
    userId: signed.u,
    provider: signed.p,
    expiresAt: signed.e
  };
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
  if (!token.ok) {
    const failure = classifyFailure(token.status, token.payload);
    const code =
      failure === "HARD_AUTH_FAILURE"
        ? `${input.provider.toLowerCase()}_token_refresh_hard_auth_failed`
        : `${input.provider.toLowerCase()}_token_refresh_failed`;
    throw new Error(code);
  }

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

export async function ensureUsableAccessToken(input: {
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

function isHardAuthErrorMessage(message: string) {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("token_refresh_hard_auth_failed") ||
    normalized.includes("invalid_grant") ||
    normalized.includes("revoked")
  );
}

async function createGoogleEvent(input: {
  accessToken: string;
  calendarId?: string | null;
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
}) {
  const calendarId = String(input.calendarId || "primary").trim() || "primary";
  const response = await fetchJson(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
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
  if (!response.ok) {
    const detail = extractProviderFailureDetail(response.payload);
    if (response.status === 401 || response.status === 403) {
      throw new Error(`google_event_auth_failed:${response.status}:${detail}`);
    }
    throw new Error(`google_event_create_failed:${response.status}:${detail}`);
  }
  const payload = response.payload as { id?: string };
  return String(payload?.id || "");
}

async function createOutlookEvent(input: {
  accessToken: string;
  calendarId?: string | null;
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
}) {
  const calendarPath = String(input.calendarId || "").trim()
    ? `me/calendars/${encodeURIComponent(String(input.calendarId).trim())}/events`
    : "me/events";
  const response = await fetchJson(`https://graph.microsoft.com/v1.0/${calendarPath}`, {
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
  if (!response.ok) {
    const detail = extractProviderFailureDetail(response.payload);
    if (response.status === 401 || response.status === 403) {
      throw new Error(`outlook_event_auth_failed:${response.status}:${detail}`);
    }
    throw new Error(`outlook_event_create_failed:${response.status}:${detail}`);
  }
  const payload = response.payload as { id?: string };
  return String(payload?.id || "");
}

function toIsoString(value: unknown) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

async function listGoogleEvents(input: {
  accessToken: string;
  calendarId?: string | null;
  fromUtc: Date;
  toUtc: Date;
}) {
  const calendarId = String(input.calendarId || "primary").trim() || "primary";
  const query = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: input.fromUtc.toISOString(),
    timeMax: input.toUtc.toISOString(),
    maxResults: "250"
  }).toString();
  const response = await fetchJson(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${query}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json"
      }
    }
  );
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("google_event_auth_failed");
    }
    throw new Error("google_event_list_failed");
  }
  const payload = response.payload as {
    items?: Array<{
      id?: string;
      summary?: string;
      htmlLink?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
  };
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items
    .map((item) => {
      const startIso = toIsoString(item.start?.dateTime || item.start?.date);
      const endIso = toIsoString(item.end?.dateTime || item.end?.date);
      if (!startIso || !endIso) return null;
      return {
        id: String(item.id || ""),
        provider: "GOOGLE" as const,
        title: String(item.summary || "Busy"),
        viewUrl: item.htmlLink ? String(item.htmlLink) : null,
        startAt: new Date(startIso),
        endAt: new Date(endIso)
      };
    })
    .filter(Boolean) as Array<{ id: string; provider: "GOOGLE"; title: string; viewUrl: string | null; startAt: Date; endAt: Date }>;
}

async function listOutlookEvents(input: {
  accessToken: string;
  calendarId?: string | null;
  fromUtc: Date;
  toUtc: Date;
}) {
  const calendarPath = String(input.calendarId || "").trim()
    ? `me/calendars/${encodeURIComponent(String(input.calendarId).trim())}/calendarView`
    : "me/calendarView";
  const query = new URLSearchParams({
    startDateTime: input.fromUtc.toISOString(),
    endDateTime: input.toUtc.toISOString(),
    $select: "id,subject,start,end,showAs,webLink"
  }).toString();
  const response = await fetchJson(`https://graph.microsoft.com/v1.0/${calendarPath}?${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json"
    }
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("outlook_event_auth_failed");
    }
    throw new Error("outlook_event_list_failed");
  }
  const payload = response.payload as {
    value?: Array<{
      id?: string;
      subject?: string;
      webLink?: string;
      start?: { dateTime?: string };
      end?: { dateTime?: string };
      showAs?: string;
    }>;
  };
  const items = Array.isArray(payload?.value) ? payload.value : [];
  return items
    .map((item) => {
      const startIso = toIsoString(item.start?.dateTime);
      const endIso = toIsoString(item.end?.dateTime);
      if (!startIso || !endIso) return null;
      return {
        id: String(item.id || ""),
        provider: "OUTLOOK" as const,
        title: String(item.subject || "Busy"),
        viewUrl: item.webLink ? String(item.webLink) : null,
        startAt: new Date(startIso),
        endAt: new Date(endIso)
      };
    })
    .filter(Boolean) as Array<{ id: string; provider: "OUTLOOK"; title: string; viewUrl: string | null; startAt: Date; endAt: Date }>;
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
            calendarId: connection.selectedCalendarId,
            title: input.title,
            description: input.description,
            startAt: input.startAt,
            endAt: input.endAt,
            timezone: input.timezone
          })
        : await createOutlookEvent({
            accessToken: token.accessToken,
            calendarId: connection.selectedCalendarId,
            title: input.title,
            description: input.description,
            startAt: input.startAt,
            endAt: input.endAt,
            timezone: input.timezone
          });
    return { provider, externalEventId };
  } catch (error) {
    const message = String((error as Error)?.message || "");
    if (isHardAuthErrorMessage(message)) {
      await input.prisma.calendarConnection.update({
        where: { id: connection.id },
        data: { isActive: false }
      });
    }
    throw error;
  }
}

export async function listCalendarEventsFromConnection(input: {
  prisma: PrismaClient;
  connectionId: string;
  orgId: string;
  fromUtc: Date;
  toUtc: Date;
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
    return provider === "GOOGLE"
      ? await listGoogleEvents({
          accessToken: token.accessToken,
          calendarId: connection.selectedCalendarId,
          fromUtc: input.fromUtc,
          toUtc: input.toUtc
        })
      : await listOutlookEvents({
          accessToken: token.accessToken,
          calendarId: connection.selectedCalendarId,
          fromUtc: input.fromUtc,
          toUtc: input.toUtc
        });
  } catch (error) {
    const message = String((error as Error)?.message || "");
    if (isHardAuthErrorMessage(message)) {
      await input.prisma.calendarConnection.update({
        where: { id: connection.id },
        data: { isActive: false }
      });
    }
    throw error;
  }
}
