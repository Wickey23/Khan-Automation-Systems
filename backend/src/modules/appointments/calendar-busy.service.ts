import type { CalendarProvider, PrismaClient } from "@prisma/client";
import { ensureUsableAccessToken } from "./calendar-oauth.service";

const REQUEST_TIMEOUT_MS = 12_000;

export class CalendarUnavailableError extends Error {
  code = "calendar_unavailable" as const;

  constructor(message: string) {
    super(message);
  }
}

function classifyHardAuthFailure(status: number | undefined, payload: unknown) {
  if (status === 401 || status === 403) return true;
  const errorText = String(
    (payload as { error?: string } | null)?.error ||
      (payload as { error?: { code?: string; message?: string } } | null)?.error?.code ||
      (payload as { error?: { code?: string; message?: string } } | null)?.error?.message ||
      ""
  ).toLowerCase();
  return errorText.includes("invalid_grant") || errorText.includes("revoked");
}

async function fetchJson(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }
    return { ok: response.ok, status: response.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

function toIsoString(value: unknown) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

async function getConnection(input: { prisma: PrismaClient; orgId: string; provider?: CalendarProvider }) {
  return input.prisma.calendarConnection.findFirst({
    where: {
      orgId: input.orgId,
      isActive: true,
      ...(input.provider ? { provider: input.provider } : {})
    },
    orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }]
  });
}

async function maybeDeactivateOnHardAuth(input: {
  prisma: PrismaClient;
  connectionId: string;
  status?: number;
  payload?: unknown;
  message?: string;
}) {
  const hardByStatus = classifyHardAuthFailure(input.status, input.payload);
  const hardByMessage = String(input.message || "").toLowerCase().includes("hard_auth_failed");
  if (!hardByStatus && !hardByMessage) return;
  await input.prisma.calendarConnection.update({
    where: { id: input.connectionId },
    data: { isActive: false }
  });
}

async function getGoogleBusy(input: {
  accessToken: string;
  calendarId: string;
  fromUtc: Date;
  toUtc: Date;
}) {
  const response = await fetchJson("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      timeMin: input.fromUtc.toISOString(),
      timeMax: input.toUtc.toISOString(),
      items: [{ id: input.calendarId }]
    })
  });
  if (!response.ok) {
    throw new Error(`google_busy_fetch_failed:${response.status}`);
  }
  const payload = response.payload as {
    calendars?: Record<string, { busy?: Array<{ start?: string; end?: string }> }>;
  };
  const calendar = payload?.calendars?.[input.calendarId] || payload?.calendars?.primary;
  const windows = Array.isArray(calendar?.busy) ? calendar?.busy : [];
  return windows
    .map((row) => {
      const startIso = toIsoString(row.start);
      const endIso = toIsoString(row.end);
      if (!startIso || !endIso) return null;
      return { startUtc: new Date(startIso), endUtc: new Date(endIso) };
    })
    .filter(Boolean) as Array<{ startUtc: Date; endUtc: Date }>;
}

async function getOutlookBusy(input: {
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
    $select: "start,end,showAs"
  }).toString();
  const response = await fetchJson(`https://graph.microsoft.com/v1.0/${calendarPath}?${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(`outlook_busy_fetch_failed:${response.status}`);
  }
  const payload = response.payload as {
    value?: Array<{
      showAs?: string;
      start?: { dateTime?: string };
      end?: { dateTime?: string };
    }>;
  };
  const rows = Array.isArray(payload?.value) ? payload.value : [];
  const busyLike = new Set(["busy", "tentative", "oof", "workingelsewhere"]);
  return rows
    .filter((row) => busyLike.has(String(row.showAs || "").toLowerCase()))
    .map((row) => {
      const startIso = toIsoString(row.start?.dateTime);
      const endIso = toIsoString(row.end?.dateTime);
      if (!startIso || !endIso) return null;
      return { startUtc: new Date(startIso), endUtc: new Date(endIso) };
    })
    .filter(Boolean) as Array<{ startUtc: Date; endUtc: Date }>;
}

export async function getBusyBlocks(input: {
  prisma: PrismaClient;
  orgId: string;
  fromUtc: Date;
  toUtc: Date;
  provider?: CalendarProvider;
  calendarId?: string;
}) {
  const connection = await getConnection({
    prisma: input.prisma,
    orgId: input.orgId,
    provider: input.provider
  });
  if (!connection) {
    throw new CalendarUnavailableError("calendar_unavailable");
  }

  const provider = connection.provider;
  const resolvedCalendarId =
    provider === "GOOGLE"
      ? String(input.calendarId || connection.selectedCalendarId || "primary").trim() || "primary"
      : String(input.calendarId || connection.selectedCalendarId || "").trim() || null;

  try {
    const token = await ensureUsableAccessToken({
      prisma: input.prisma,
      connectionId: connection.id,
      provider: provider as "GOOGLE" | "OUTLOOK",
      accessTokenEnc: connection.accessTokenEnc,
      refreshTokenEnc: connection.refreshTokenEnc,
      expiresAt: connection.expiresAt
    });
    const busy =
      provider === "GOOGLE"
        ? await getGoogleBusy({
            accessToken: token.accessToken,
            calendarId: resolvedCalendarId || "primary",
            fromUtc: input.fromUtc,
            toUtc: input.toUtc
          })
        : await getOutlookBusy({
            accessToken: token.accessToken,
            calendarId: resolvedCalendarId,
            fromUtc: input.fromUtc,
            toUtc: input.toUtc
          });
    return busy.sort((a, b) => {
      const byStart = a.startUtc.getTime() - b.startUtc.getTime();
      if (byStart !== 0) return byStart;
      return a.endUtc.getTime() - b.endUtc.getTime();
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "calendar_unavailable";
    const statusMatch = /:(\d{3})$/.exec(message);
    const status = statusMatch ? Number(statusMatch[1]) : undefined;
    await maybeDeactivateOnHardAuth({
      prisma: input.prisma,
      connectionId: connection.id,
      status,
      message
    });
    throw new CalendarUnavailableError("calendar_unavailable");
  }
}

