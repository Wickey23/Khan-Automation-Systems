import { overlapsLocked } from "./overlap.service";

type HoursWindow = { start: string; end: string };
type HoursSchedule = Record<string, HoursWindow[]>;

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const SLOT_STEP_MINUTES = 15;

export type SlotWindow = { startAt: Date; endAt: Date };
export type BusyWindow = { startAt: Date; endAt: Date };

type GenerateSlotsInput = {
  hoursJson?: string | null;
  timezone?: string | null;
  appointmentDurationMinutes: number;
  appointmentBufferMinutes: number;
  bookingLeadTimeHours: number;
  bookingMaxDaysAhead: number;
  now?: Date;
  maxSlots?: number;
  from?: Date;
  to?: Date;
  existingAppointments?: Array<{
    startAt: Date;
    endAt: Date;
    status?: string;
  }>;
  externalBusyBlocks?: BusyWindow[];
};

type ValidateSlotInput = {
  hoursJson?: string | null;
  timezone?: string | null;
  slotStartAt: Date;
  appointmentDurationMinutes: number;
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekdayShort: string;
};

function parseTimeToMinutes(value: string) {
  const [hour, minute] = String(value || "")
    .split(":")
    .map((part) => Number(part));
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function parseHoursPayload(hoursJson?: string | null): { timezone: string; schedule: HoursSchedule } {
  const fallback = { timezone: "America/New_York", schedule: {} as HoursSchedule };
  if (!hoursJson) return fallback;
  try {
    const parsed = JSON.parse(hoursJson) as { timezone?: string; schedule?: HoursSchedule };
    return {
      timezone: String(parsed.timezone || fallback.timezone),
      schedule: parsed.schedule && typeof parsed.schedule === "object" ? parsed.schedule : {}
    };
  } catch {
    return fallback;
  }
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short"
  });
  const parts = formatter.formatToParts(date);
  const map = new Map<string, string>();
  for (const part of parts) map.set(part.type, part.value);
  return {
    year: Number(map.get("year")),
    month: Number(map.get("month")),
    day: Number(map.get("day")),
    hour: Number(map.get("hour")),
    minute: Number(map.get("minute")),
    weekdayShort: String(map.get("weekday") || "Sun").toLowerCase().slice(0, 3)
  };
}

function zonedDateToUtc(timeZone: string, year: number, month: number, day: number, hour: number, minute: number) {
  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  for (let i = 0; i < 3; i += 1) {
    const actual = getZonedParts(utc, timeZone);
    const desiredEpoch = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const actualEpoch = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, 0, 0);
    const deltaMs = desiredEpoch - actualEpoch;
    if (deltaMs === 0) break;
    utc = new Date(utc.getTime() + deltaMs);
  }
  return utc;
}

function ceilToStep(minutes: number, step = SLOT_STEP_MINUTES) {
  if (minutes <= 0) return 0;
  return Math.ceil(minutes / step) * step;
}

function getWindowsForDay(schedule: HoursSchedule, weekdayShort: string): Array<{ startMin: number; endMin: number }> {
  const windows = Array.isArray(schedule[weekdayShort]) ? schedule[weekdayShort] : [];
  return windows
    .map((window) => {
      const startMin = parseTimeToMinutes(window.start);
      const endMin = parseTimeToMinutes(window.end);
      if (startMin === null || endMin === null || endMin <= startMin) return null;
      return { startMin, endMin };
    })
    .filter(Boolean) as Array<{ startMin: number; endMin: number }>;
}

export function computeAvailabilityWindow(input: {
  now?: Date;
  from?: Date;
  to?: Date;
  bookingLeadTimeHours: number;
  bookingMaxDaysAhead: number;
}) {
  const now = input.now ? new Date(input.now) : new Date();
  const leadHours = Math.max(0, Math.floor(input.bookingLeadTimeHours));
  const maxDays = Math.max(1, Math.floor(input.bookingMaxDaysAhead));
  const from = input.from ? new Date(input.from) : new Date(now.getTime() + leadHours * 60 * 60 * 1000);
  const to = input.to ? new Date(input.to) : new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);
  return { from, to };
}

export function buildExpandedBusyIntervals(input: {
  internalBusy?: BusyWindow[];
  externalBusy?: BusyWindow[];
  bufferMinutes: number;
}) {
  const bufferMs = Math.max(0, Math.floor(input.bufferMinutes)) * 60 * 1000;
  const source = [...(input.internalBusy || []), ...(input.externalBusy || [])];
  const normalized = source
    .map((row) => {
      const startAt = new Date(row.startAt);
      const endAt = new Date(row.endAt);
      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) return null;
      return {
        startUtc: new Date(startAt.getTime() - bufferMs),
        endUtc: new Date(endAt.getTime() + bufferMs)
      };
    })
    .filter(Boolean) as Array<{ startUtc: Date; endUtc: Date }>;
  normalized.sort((a, b) => {
    const diff = a.startUtc.getTime() - b.startUtc.getTime();
    if (diff !== 0) return diff;
    return a.endUtc.getTime() - b.endUtc.getTime();
  });
  const merged: Array<{ startUtc: Date; endUtc: Date }> = [];
  for (const current of normalized) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...current });
      continue;
    }
    if (last.endUtc.getTime() >= current.startUtc.getTime()) {
      if (current.endUtc.getTime() > last.endUtc.getTime()) {
        last.endUtc = current.endUtc;
      }
      continue;
    }
    merged.push({ ...current });
  }
  return merged;
}

function overlapsBusyIntervals(
  intervals: Array<{ startUtc: Date; endUtc: Date }>,
  slotStartAt: Date,
  slotEndAt: Date
) {
  return intervals.some((row) => overlapsLocked(row.startUtc, row.endUtc, slotStartAt, slotEndAt));
}

export function validateSlotWithinBusinessHours(input: ValidateSlotInput) {
  const parsed = parseHoursPayload(input.hoursJson);
  const timeZone = String(input.timezone || parsed.timezone || "America/New_York");
  const parts = getZonedParts(input.slotStartAt, timeZone);
  const dayWindows = getWindowsForDay(parsed.schedule, parts.weekdayShort);
  if (!dayWindows.length) {
    return { ok: false as const, reason: "business_closed_day" };
  }

  const startMinutes = parts.hour * 60 + parts.minute;
  if (startMinutes % SLOT_STEP_MINUTES !== 0) {
    return { ok: false as const, reason: "slot_not_step_aligned" };
  }

  const endMinutes = startMinutes + Math.max(1, Math.floor(input.appointmentDurationMinutes));
  for (const window of dayWindows) {
    if (startMinutes >= window.startMin && endMinutes <= window.endMin) {
      return { ok: true as const };
    }
  }
  return { ok: false as const, reason: "slot_exceeds_business_hours" };
}

export function generateAvailabilitySlots(input: GenerateSlotsInput): SlotWindow[] {
  const parsed = parseHoursPayload(input.hoursJson);
  const timeZone = String(input.timezone || parsed.timezone || "America/New_York");
  const now = input.now ? new Date(input.now) : new Date();
  const duration = Math.max(1, Math.floor(input.appointmentDurationMinutes));
  const maxSlots = Math.max(1, Math.floor(input.maxSlots || 10));
  const window = computeAvailabilityWindow({
    now,
    from: input.from,
    to: input.to,
    bookingLeadTimeHours: input.bookingLeadTimeHours,
    bookingMaxDaysAhead: input.bookingMaxDaysAhead
  });

  const earliestParts = getZonedParts(window.from, timeZone);
  const earliestCutoffMinutes = ceilToStep(earliestParts.hour * 60 + earliestParts.minute, SLOT_STEP_MINUTES);
  const startOfCurrentZonedDayUtc = zonedDateToUtc(
    timeZone,
    earliestParts.year,
    earliestParts.month,
    earliestParts.day,
    0,
    0
  );

  const latestParts = getZonedParts(window.to, timeZone);
  const endOfLatestDayUtc = zonedDateToUtc(timeZone, latestParts.year, latestParts.month, latestParts.day, 23, 59);
  const horizonEndMs = endOfLatestDayUtc.getTime();

  const internalBusy = (input.existingAppointments || [])
    .filter((row) => String(row.status || "").toUpperCase() !== "CANCELED")
    .map((row) => ({ startAt: new Date(row.startAt), endAt: new Date(row.endAt) }));
  const externalBusy = (input.externalBusyBlocks || []).map((row) => ({
    startAt: new Date(row.startAt),
    endAt: new Date(row.endAt)
  }));
  const mergedBusy = buildExpandedBusyIntervals({
    internalBusy,
    externalBusy,
    bufferMinutes: input.appointmentBufferMinutes
  });

  const results: SlotWindow[] = [];
  let dayOffset = 0;
  while (results.length < maxSlots) {
    const dayAnchorUtc = new Date(startOfCurrentZonedDayUtc.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    if (dayAnchorUtc.getTime() > horizonEndMs) break;
    const dayParts = getZonedParts(dayAnchorUtc, timeZone);
    const windows = getWindowsForDay(parsed.schedule, dayParts.weekdayShort);
    if (windows.length) {
      for (const windowRange of windows) {
        const firstMinute = dayOffset === 0 ? Math.max(windowRange.startMin, earliestCutoffMinutes) : windowRange.startMin;
        let slotStartMin = ceilToStep(firstMinute, SLOT_STEP_MINUTES);
        while (slotStartMin + duration <= windowRange.endMin && results.length < maxSlots) {
          const slotEndMin = slotStartMin + duration;
          if (slotEndMin <= windowRange.endMin) {
            const slotStartAt = zonedDateToUtc(
              timeZone,
              dayParts.year,
              dayParts.month,
              dayParts.day,
              Math.floor(slotStartMin / 60),
              slotStartMin % 60
            );
            const slotEndAt = zonedDateToUtc(
              timeZone,
              dayParts.year,
              dayParts.month,
              dayParts.day,
              Math.floor(slotEndMin / 60),
              slotEndMin % 60
            );
            if (slotStartAt.getTime() >= window.from.getTime() && slotStartAt.getTime() <= window.to.getTime()) {
              const overlapsBusy = overlapsBusyIntervals(mergedBusy, slotStartAt, slotEndAt);
              if (!overlapsBusy) {
                results.push({ startAt: slotStartAt, endAt: slotEndAt });
              }
            }
          }
          slotStartMin += SLOT_STEP_MINUTES;
        }
      }
    }
    dayOffset += 1;
  }

  return results.sort((a, b) => a.startAt.getTime() - b.startAt.getTime()).slice(0, maxSlots);
}

