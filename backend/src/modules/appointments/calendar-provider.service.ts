import { PrismaClient, CalendarProvider } from "@prisma/client";
import { ensureUsableAccessToken } from "./calendar-oauth.service";

export type ExternalCalendarEvent = {
  provider: CalendarProvider;
  externalEventId: string;
};

export class CalendarSyncError extends Error {
  constructor(public message: string, public stage: "FETCH" | "CREATE" | "AUTH") {
    super(message);
  }
}

async function fetchJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  return { ok: response.ok, status: response.status, payload };
}

async function createGoogleEvent(input: {
  accessToken: string;
  calendarId: string;
  summary: string;
  description: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
}) {
  const response = await fetchJson(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.startAt.toISOString(), timeZone: input.timezone },
        end: { dateTime: input.endAt.toISOString(), timeZone: input.timezone }
      })
    }
  );

  if (!response.ok) {
    throw new CalendarSyncError(`Google API Error: ${response.status} ${JSON.stringify(response.payload)}`, "CREATE");
  }

  return response.payload.id as string;
}

async function createOutlookEvent(input: {
  accessToken: string;
  calendarId?: string | null;
  summary: string;
  description: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
}) {
  const calendarPath = input.calendarId ? `me/calendars/${input.calendarId}/events` : "me/events";
  const response = await fetchJson(`https://graph.microsoft.com/v1.0/${calendarPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      subject: input.summary,
      body: { contentType: "HTML", content: input.description },
      start: { dateTime: input.startAt.toISOString(), timeZone: input.timezone },
      end: { dateTime: input.endAt.toISOString(), timeZone: input.timezone }
    })
  });

  if (!response.ok) {
    throw new CalendarSyncError(`Outlook API Error: ${response.status} ${JSON.stringify(response.payload)}`, "CREATE");
  }

  return response.payload.id as string;
}

export async function createExternalCalendarEvent(input: {
  prisma: PrismaClient;
  orgId: string;
  appointmentId: string;
}): Promise<ExternalCalendarEvent> {
  const appointment = await input.prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    include: { organization: true }
  });

  if (!appointment) throw new Error("Appointment not found");
  if (appointment.calendarProvider === "INTERNAL") {
    return { provider: "INTERNAL", externalEventId: "" };
  }

  const connection = await input.prisma.calendarConnection.findFirst({
    where: { orgId: input.orgId, provider: appointment.calendarProvider, isActive: true },
    orderBy: { isPrimary: "desc" }
  });

  if (!connection) {
    throw new CalendarSyncError("No active calendar connection found", "AUTH");
  }

  const token = await ensureUsableAccessToken({
    prisma: input.prisma,
    connectionId: connection.id,
    provider: connection.provider as "GOOGLE" | "OUTLOOK",
    accessTokenEnc: connection.accessTokenEnc,
    refreshTokenEnc: connection.refreshTokenEnc,
    expiresAt: connection.expiresAt
  });

  const summary = `Appointment: ${appointment.customerName}`;
  const description = `Issue: ${appointment.issueSummary}\nPhone: ${appointment.customerPhone}`;
  const calendarId = connection.selectedCalendarId || (connection.provider === "GOOGLE" ? "primary" : null);

  let externalId: string;
  if (connection.provider === "GOOGLE") {
    externalId = await createGoogleEvent({
      accessToken: token.accessToken,
      calendarId: calendarId!,
      summary,
      description,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      timezone: appointment.timezone
    });
  } else {
    externalId = await createOutlookEvent({
      accessToken: token.accessToken,
      calendarId,
      summary,
      description,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      timezone: appointment.timezone
    });
  }

  return { provider: connection.provider, externalEventId: externalId };
}
