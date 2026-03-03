import assert from "node:assert/strict";
import test from "node:test";
import type { BusinessSettings } from "@prisma/client";
import { validateGoLiveBusinessConfig } from "../config-validation.service";

function baseSettings(): BusinessSettings {
  return {
    id: "bs_1",
    orgId: "org_1",
    hoursJson: JSON.stringify({
      timezone: "America/New_York",
      schedule: {
        monday: [{ start: "09:00", end: "17:00" }]
      }
    }),
    afterHoursMode: "TAKE_MESSAGE",
    transferNumbersJson: JSON.stringify(["+15165551234"]),
    notificationEmailsJson: "[]",
    notificationPhonesJson: "[]",
    languagesJson: "[]",
    recordingConsentEnabled: false,
    smsConsentText: "",
    timezone: "America/New_York",
    servicesJson: "[]",
    policiesJson: "{}",
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

test("go-live config validation passes sane settings", () => {
  const result = validateGoLiveBusinessConfig(baseSettings());
  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
});

test("go-live config validation fails invalid transfer number", () => {
  const settings = baseSettings();
  settings.transferNumbersJson = JSON.stringify(["516-000-1234"]);
  const result = validateGoLiveBusinessConfig(settings);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.field === "transferNumbers"));
});

test("go-live config validation fails overlapping holiday windows", () => {
  const settings = baseSettings();
  settings.policiesJson = JSON.stringify({
    holidayCalendar: [
      { start: "2026-12-24", end: "2026-12-26" },
      { start: "2026-12-25", end: "2026-12-27" }
    ]
  });
  const result = validateGoLiveBusinessConfig(settings);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.field === "policies.holidayCalendar"));
});
