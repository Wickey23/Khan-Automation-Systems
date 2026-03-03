import type { BusinessSettings } from "@prisma/client";

type ValidationIssue = {
  field: string;
  message: string;
};

function parseObject(value: string | null | undefined) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseArray(value: string | null | undefined) {
  if (!value) return [] as unknown[];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isValidE164(value: string) {
  return /^\+[1-9]\d{9,14}$/.test(String(value || "").trim());
}

function parseTimeToMin(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || "").trim());
  if (!match) return -1;
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
}

function validateHours(hoursJson: string | null | undefined, issues: ValidationIssue[]) {
  const hours = parseObject(hoursJson);
  const timezone = String(hours.timezone || "").trim();
  if (!timezone) issues.push({ field: "hours.timezone", message: "Timezone missing in business hours." });

  const schedule = hours.schedule;
  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) {
    issues.push({ field: "hours.schedule", message: "Business hours schedule is missing or invalid." });
    return;
  }

  for (const [day, ranges] of Object.entries(schedule as Record<string, unknown>)) {
    if (!Array.isArray(ranges)) continue;
    const normalized = ranges
      .map((range) => (range && typeof range === "object" ? (range as Record<string, unknown>) : null))
      .filter(Boolean) as Array<Record<string, unknown>>;

    const windows = normalized
      .map((range) => ({
        start: parseTimeToMin(String(range.start || "")),
        end: parseTimeToMin(String(range.end || ""))
      }))
      .filter((window) => window.start >= 0 && window.end > window.start)
      .sort((a, b) => a.start - b.start);

    if (windows.length !== normalized.length) {
      issues.push({ field: `hours.schedule.${day}`, message: `Invalid time range format on ${day}.` });
      continue;
    }

    for (let i = 1; i < windows.length; i += 1) {
      if (windows[i].start < windows[i - 1].end) {
        issues.push({ field: `hours.schedule.${day}`, message: `Overlapping business-hour ranges on ${day}.` });
        break;
      }
    }
  }
}

function validateHolidayCalendar(policiesJson: string | null | undefined, issues: ValidationIssue[]) {
  const policies = parseObject(policiesJson);
  const holidaysRaw = policies.holidayCalendar;
  if (!Array.isArray(holidaysRaw)) return;

  const periods = holidaysRaw
    .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null))
    .filter(Boolean)
    .map((entry) => {
      const row = entry as Record<string, unknown>;
      const start = new Date(String(row.start || row.date || ""));
      const end = new Date(String(row.end || row.date || ""));
      return {
        start: Number.isNaN(start.getTime()) ? null : start,
        end: Number.isNaN(end.getTime()) ? null : end
      };
    });

  if (periods.some((period) => !period.start || !period.end || period.start > period.end)) {
    issues.push({ field: "policies.holidayCalendar", message: "Holiday calendar has invalid date range(s)." });
    return;
  }

  const sorted = periods
    .map((period) => ({ start: period.start as Date, end: period.end as Date }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].start.getTime() <= sorted[i - 1].end.getTime()) {
      issues.push({ field: "policies.holidayCalendar", message: "Holiday calendar entries overlap." });
      break;
    }
  }
}

function validatePolicyBounds(policiesJson: string | null | undefined, issues: ValidationIssue[]) {
  const policies = parseObject(policiesJson);
  const overflow = Number(policies.overflowThresholdPer5m);
  if (Number.isFinite(overflow) && (overflow < 1 || overflow > 200)) {
    issues.push({ field: "policies.overflowThresholdPer5m", message: "Overflow threshold must be between 1 and 200." });
  }

  const recoveryCap = Number(policies.autoRecoveryDailyCap);
  if (Number.isFinite(recoveryCap) && (recoveryCap < 1 || recoveryCap > 500)) {
    issues.push({ field: "policies.autoRecoveryDailyCap", message: "Auto-recovery daily cap must be between 1 and 500." });
  }

  const dedupeHours = Number(policies.autoRecoveryDedupeWindowHours);
  if (Number.isFinite(dedupeHours) && (dedupeHours < 1 || dedupeHours > 72)) {
    issues.push({
      field: "policies.autoRecoveryDedupeWindowHours",
      message: "Auto-recovery dedupe window must be between 1 and 72 hours."
    });
  }
}

function validateTransferNumbers(transferNumbersJson: string | null | undefined, issues: ValidationIssue[]) {
  const transferNumbers = parseArray(transferNumbersJson).map((value) => String(value || "").trim()).filter(Boolean);
  if (!transferNumbers.length) {
    issues.push({ field: "transferNumbers", message: "At least one transfer number is required." });
    return;
  }
  const invalid = transferNumbers.filter((value) => !isValidE164(value));
  if (invalid.length) {
    issues.push({ field: "transferNumbers", message: `Invalid transfer number(s): ${invalid.join(", ")}` });
  }
}

export function validateGoLiveBusinessConfig(settings: BusinessSettings | null) {
  const issues: ValidationIssue[] = [];
  if (!settings) {
    return {
      ok: false,
      issues: [{ field: "settings", message: "Business settings are missing." }]
    };
  }

  validateHours(settings.hoursJson, issues);
  validateTransferNumbers(settings.transferNumbersJson, issues);
  validatePolicyBounds(settings.policiesJson, issues);
  validateHolidayCalendar(settings.policiesJson, issues);

  return { ok: issues.length === 0, issues };
}
