"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchOrgSettings, updateOrgSettings } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
type HoursRow = { open: string; close: string; closed: boolean };

type FormState = {
  timezone: string;
  afterHoursMode: "TAKE_MESSAGE" | "TRANSFER" | "VOICEMAIL";
  transferNumbers: string;
  notificationEmails: string;
  notificationPhones: string;
  languages: string;
  services: string;
  warrantyPolicy: string;
  cancellationPolicy: string;
  diagnosticsPolicy: string;
  smsWelcomeMessage: string;
  smsMarketingEnabled: boolean;
  smsMarketingBlurb: string;
  smsConsentText: string;
  recordingConsentEnabled: boolean;
  hours: Record<DayKey, HoursRow>;
};

const DAYS: Array<{ key: DayKey; label: string }> = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" }
];

const defaultHours = () =>
  DAYS.reduce<Record<DayKey, HoursRow>>((acc, day) => {
    acc[day.key] = {
      open: day.key === "saturday" || day.key === "sunday" ? "09:00" : "08:00",
      close: day.key === "saturday" || day.key === "sunday" ? "13:00" : "17:00",
      closed: day.key === "sunday"
    };
    return acc;
  }, {} as Record<DayKey, HoursRow>);

const defaults: FormState = {
  timezone: "America/New_York",
  afterHoursMode: "TAKE_MESSAGE",
  transferNumbers: "",
  notificationEmails: "",
  notificationPhones: "",
  languages: "English",
  services: "",
  warrantyPolicy: "",
  cancellationPolicy: "",
  diagnosticsPolicy: "",
  smsWelcomeMessage: "",
  smsMarketingEnabled: false,
  smsMarketingBlurb: "",
  smsConsentText: "",
  recordingConsentEnabled: false,
  hours: defaultHours()
};

function fromJsonArray(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function fromJsonObject(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toLines(values: string[]) {
  return values.join("\n");
}

function fromLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function AppSettingsPage() {
  const { showToast } = useToast();
  const [state, setState] = useState<FormState>(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchOrgSettings()
      .then(({ settings }) => {
        const hoursRoot = fromJsonObject(settings.hoursJson);
        const scheduleRaw =
          hoursRoot && typeof hoursRoot.schedule === "object" && hoursRoot.schedule !== null && !Array.isArray(hoursRoot.schedule)
            ? (hoursRoot.schedule as Record<string, unknown>)
            : {};
        const parsedHours = defaultHours();
        for (const day of DAYS) {
          const existing = scheduleRaw[day.key];
          if (!existing || typeof existing !== "object") continue;
          const row = existing as Record<string, unknown>;
          parsedHours[day.key] = {
            open: String(row.open || parsedHours[day.key].open),
            close: String(row.close || parsedHours[day.key].close),
            closed: Boolean(row.closed)
          };
        }

        const policies = fromJsonObject(settings.policiesJson);
        setState({
          timezone: settings.timezone || "America/New_York",
          afterHoursMode: settings.afterHoursMode,
          transferNumbers: toLines(fromJsonArray(settings.transferNumbersJson)),
          notificationEmails: toLines(fromJsonArray(settings.notificationEmailsJson)),
          notificationPhones: toLines(fromJsonArray(settings.notificationPhonesJson)),
          languages: toLines(fromJsonArray(settings.languagesJson)),
          services: toLines(fromJsonArray(settings.servicesJson)),
          warrantyPolicy: String(policies.warrantyPolicy || ""),
          cancellationPolicy: String(policies.cancellationPolicy || ""),
          diagnosticsPolicy: String(policies.diagnosticsPolicy || ""),
          smsWelcomeMessage: String(policies.smsWelcomeMessage || ""),
          smsMarketingEnabled: Boolean(policies.smsMarketingEnabled),
          smsMarketingBlurb: String(policies.smsMarketingBlurb || ""),
          smsConsentText: settings.smsConsentText,
          recordingConsentEnabled: settings.recordingConsentEnabled,
          hours: parsedHours
        });
      })
      .catch((error) =>
        showToast({
          title: "Could not load settings",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "error"
        })
      );
  }, [showToast]);

  const readinessHints = useMemo(() => {
    const transfer = fromLines(state.transferNumbers);
    const emails = fromLines(state.notificationEmails);
    const phones = fromLines(state.notificationPhones);
    const hasHours = DAYS.some((day) => !state.hours[day.key].closed);
    return {
      transfer,
      emails,
      phones,
      hasHours
    };
  }, [state.transferNumbers, state.notificationEmails, state.notificationPhones, state.hours]);

  async function onSave() {
    const transfer = readinessHints.transfer;
    const emails = readinessHints.emails;
    const phones = readinessHints.phones;
    if (!readinessHints.hasHours) {
      showToast({ title: "Add business hours", description: "At least one day must be open.", variant: "error" });
      return;
    }
    if (!transfer.length) {
      showToast({ title: "Add transfer number", description: "At least one transfer number is required.", variant: "error" });
      return;
    }
    if (!emails.length && !phones.length) {
      showToast({
        title: "Add notification contact",
        description: "Add at least one notification email or phone.",
        variant: "error"
      });
      return;
    }

    setSaving(true);
    try {
      const schedule = DAYS.reduce<Record<string, unknown>>((acc, day) => {
        acc[day.key] = state.hours[day.key];
        return acc;
      }, {});
      await updateOrgSettings({
        timezone: state.timezone.trim() || "America/New_York",
        afterHoursMode: state.afterHoursMode,
        hoursJson: JSON.stringify({
          timezone: state.timezone.trim() || "America/New_York",
          schedule
        }),
        transferNumbersJson: JSON.stringify(transfer),
        notificationEmailsJson: JSON.stringify(emails),
        notificationPhonesJson: JSON.stringify(phones),
        languagesJson: JSON.stringify(fromLines(state.languages)),
        servicesJson: JSON.stringify(fromLines(state.services)),
        policiesJson: JSON.stringify({
          warrantyPolicy: state.warrantyPolicy.trim(),
          cancellationPolicy: state.cancellationPolicy.trim(),
          diagnosticsPolicy: state.diagnosticsPolicy.trim(),
          smsWelcomeMessage: state.smsWelcomeMessage.trim(),
          smsMarketingEnabled: state.smsMarketingEnabled,
          smsMarketingBlurb: state.smsMarketingBlurb.trim()
        }),
        smsConsentText: state.smsConsentText.trim(),
        recordingConsentEnabled: state.recordingConsentEnabled
      });
      showToast({ title: "Business settings saved", description: "Readiness should now pass business settings checks." });
    } catch (error) {
      showToast({ title: "Save failed", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Business Settings</h1>
        <p className="text-sm text-muted-foreground">Foolproof setup for routing, notifications, and readiness.</p>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">Required for Go-Live</h2>
        <ul className="mt-2 text-sm text-muted-foreground">
          <li>Transfer numbers: {readinessHints.transfer.length > 0 ? "Configured" : "Missing"}</li>
          <li>Notification emails: {readinessHints.emails.length > 0 ? "Configured" : "Missing"}</li>
          <li>Notification phones: {readinessHints.phones.length > 0 ? "Configured" : "Missing"}</li>
          <li>Business hours: {readinessHints.hasHours ? "Configured" : "Missing"}</li>
        </ul>
      </section>

      <section className="grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-2">
        <div>
          <Label>Timezone</Label>
          <Input value={state.timezone} onChange={(e) => setState((p) => ({ ...p, timezone: e.target.value }))} />
        </div>
        <div>
          <Label>After-hours Mode</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            value={state.afterHoursMode}
            onChange={(e) => setState((p) => ({ ...p, afterHoursMode: e.target.value as FormState["afterHoursMode"] }))}
          >
            <option value="TAKE_MESSAGE">Take message</option>
            <option value="TRANSFER">Transfer</option>
            <option value="VOICEMAIL">Voicemail</option>
          </select>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">Business Hours</h2>
        <div className="mt-3 grid gap-3">
          {DAYS.map((day) => {
            const row = state.hours[day.key];
            return (
              <div key={day.key} className="grid items-center gap-3 sm:grid-cols-[160px_1fr_1fr_auto]">
                <Label>{day.label}</Label>
                <Input
                  type="time"
                  value={row.open}
                  disabled={row.closed}
                  onChange={(e) =>
                    setState((p) => ({
                      ...p,
                      hours: { ...p.hours, [day.key]: { ...p.hours[day.key], open: e.target.value } }
                    }))
                  }
                />
                <Input
                  type="time"
                  value={row.close}
                  disabled={row.closed}
                  onChange={(e) =>
                    setState((p) => ({
                      ...p,
                      hours: { ...p.hours, [day.key]: { ...p.hours[day.key], close: e.target.value } }
                    }))
                  }
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.closed}
                    onChange={(e) =>
                      setState((p) => ({
                        ...p,
                        hours: { ...p.hours, [day.key]: { ...p.hours[day.key], closed: e.target.checked } }
                      }))
                    }
                  />
                  Closed
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-2">
        <div>
          <Label>Transfer Numbers (one per line)</Label>
          <Textarea value={state.transferNumbers} onChange={(e) => setState((p) => ({ ...p, transferNumbers: e.target.value }))} />
        </div>
        <div>
          <Label>Services (one per line)</Label>
          <Textarea value={state.services} onChange={(e) => setState((p) => ({ ...p, services: e.target.value }))} />
        </div>
        <div>
          <Label>Notification Emails (one per line)</Label>
          <Textarea
            value={state.notificationEmails}
            onChange={(e) => setState((p) => ({ ...p, notificationEmails: e.target.value }))}
          />
        </div>
        <div>
          <Label>Notification Phones (one per line)</Label>
          <Textarea
            value={state.notificationPhones}
            onChange={(e) => setState((p) => ({ ...p, notificationPhones: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Languages (one per line)</Label>
          <Textarea value={state.languages} onChange={(e) => setState((p) => ({ ...p, languages: e.target.value }))} />
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-2">
        <div>
          <Label>Warranty policy</Label>
          <Textarea value={state.warrantyPolicy} onChange={(e) => setState((p) => ({ ...p, warrantyPolicy: e.target.value }))} />
        </div>
        <div>
          <Label>Cancellation policy</Label>
          <Textarea
            value={state.cancellationPolicy}
            onChange={(e) => setState((p) => ({ ...p, cancellationPolicy: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Diagnostics policy</Label>
          <Textarea value={state.diagnosticsPolicy} onChange={(e) => setState((p) => ({ ...p, diagnosticsPolicy: e.target.value }))} />
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <Label>SMS First Message (sent on first inbound text)</Label>
        <Textarea
          placeholder="Thanks for texting {{businessName}}. Our team will ask a few quick questions to help you faster."
          value={state.smsWelcomeMessage}
          onChange={(e) => setState((p) => ({ ...p, smsWelcomeMessage: e.target.value }))}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Use <code>{"{{businessName}}"}</code> to insert your business name.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.smsMarketingEnabled}
            onChange={(e) => setState((p) => ({ ...p, smsMarketingEnabled: e.target.checked }))}
          />
          Enable marketing blurb on first inbound text
        </label>
        <Label className="mt-3">SMS Marketing Blurb (optional)</Label>
        <Textarea
          placeholder="Ask us about seasonal specials and maintenance plans."
          value={state.smsMarketingBlurb}
          onChange={(e) => setState((p) => ({ ...p, smsMarketingBlurb: e.target.value }))}
        />
        <Label>SMS Consent Text</Label>
        <Textarea value={state.smsConsentText} onChange={(e) => setState((p) => ({ ...p, smsConsentText: e.target.value }))} />
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.recordingConsentEnabled}
            onChange={(e) => setState((p) => ({ ...p, recordingConsentEnabled: e.target.checked }))}
          />
          Recording consent required
        </label>
      </section>

      <Button onClick={onSave} disabled={saving}>
        {saving ? "Saving..." : "Save business settings"}
      </Button>
    </div>
  );
}
