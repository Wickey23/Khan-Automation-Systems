type HoursPayload = {
  timezone?: string;
  schedule?: Record<string, Array<{ start: string; end: string }>>;
};

const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function parseTimeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map((value) => Number(value));
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

export function isWithinBusinessHours(hoursJson?: string | null) {
  if (!hoursJson) return true;
  try {
    const parsed = JSON.parse(hoursJson) as HoursPayload;
    const timezone = parsed.timezone || "America/New_York";
    const date = new Date();
    const localText = date.toLocaleString("en-US", {
      timeZone: timezone,
      hour12: false,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
    const parts = localText.split(" ");
    const weekday = parts[0].toLowerCase().slice(0, 3);
    const time = parts[1];
    const dayKey = weekdayKeys.find((value) => value === weekday);
    if (!dayKey) return true;
    const windows = parsed.schedule?.[dayKey] || [];
    if (!windows.length) return false;
    const nowMinutes = parseTimeToMinutes(time);
    if (nowMinutes === null) return true;
    return windows.some((window) => {
      const start = parseTimeToMinutes(window.start);
      const end = parseTimeToMinutes(window.end);
      if (start === null || end === null) return false;
      return nowMinutes >= start && nowMinutes <= end;
    });
  } catch {
    return true;
  }
}
