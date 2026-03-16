"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchCalendarProviders,
  fetchOrgNotifications,
  fetchOrgProfile,
  fetchOrgSettings,
  updateOrgSettings
} from "@/lib/api";
import type { CalendarConnection, OrgNotification } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page";
import { Textarea } from "@/components/ui/textarea";
import { clientBadgeClass } from "@/lib/client-badges";

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
type HoursRow = { open: string; close: string; closed: boolean };

const days: Array<{ key: DayKey; label: string }> = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" }
];

const defaultHours = () =>
  days.reduce<Record<DayKey, HoursRow>>((acc, day) => {
    acc[day.key] = {
      open: day.key === "saturday" || day.key === "sunday" ? "09:00" : "08:00",
      close: day.key === "saturday" || day.key === "sunday" ? "13:00" : "18:00",
      closed: day.key === "sunday"
    };
    return acc;
  }, {} as Record<DayKey, HoursRow>);

function fromJsonArray(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
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
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

export default function AppSettingsPage() {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState<string | null>(null);
  const [assignedNumberProvider, setAssignedNumberProvider] = useState<"TWILIO" | "VAPI" | null>(null);
  const [calendarProviders, setCalendarProviders] = useState<CalendarConnection[]>([]);
  const [notifications, setNotifications] = useState<OrgNotification[]>([]);
  const [aiName, setAiName] = useState("Receptionist");
  const [language, setLanguage] = useState("English");
  const [voiceModel, setVoiceModel] = useState("Professional");
  const [prompt, setPrompt] = useState("");
  const [afterHoursMode, setAfterHoursMode] = useState<"TAKE_MESSAGE" | "TRANSFER" | "VOICEMAIL">("TAKE_MESSAGE");
  const [voiceRoutingMode, setVoiceRoutingMode] = useState<"AI_FIRST" | "PASSIVE_FORWARDING" | "HUMAN_FIRST_AI_FALLBACK">("AI_FIRST");
  const [voiceForwardingEnabled, setVoiceForwardingEnabled] = useState(false);
  const [voiceForwardingNumber, setVoiceForwardingNumber] = useState("");
  const [transferNumbers, setTransferNumbers] = useState("");
  const [notificationEmails, setNotificationEmails] = useState("");
  const [notificationPhones, setNotificationPhones] = useState("");
  const [notificationEmailRecipients, setNotificationEmailRecipients] = useState("");
  const [notifyAppointmentBookedEmail, setNotifyAppointmentBookedEmail] = useState(true);
  const [notifyEmergencyEmail, setNotifyEmergencyEmail] = useState(true);
  const [voiceCallRecordingEnabled, setVoiceCallRecordingEnabled] = useState(false);
  const [recordingConsentEnabled, setRecordingConsentEnabled] = useState(false);
  const [appointmentBufferMinutes, setAppointmentBufferMinutes] = useState(30);
  const [bookingLeadTimeHours, setBookingLeadTimeHours] = useState(24);
  const [hours, setHours] = useState<Record<DayKey, HoursRow>>(defaultHours());

  useEffect(() => {
    void Promise.all([
      fetchOrgSettings(),
      fetchOrgProfile(),
      fetchCalendarProviders().catch(() => ({ providers: [] })),
      fetchOrgNotifications().catch(() => ({ notifications: [] }))
    ])
      .then(([settingsData, profile, calendar, notificationData]) => {
        const settings = settingsData.settings;
        const policies = fromJsonObject(settings.policiesJson);
        const hoursRoot = fromJsonObject(settings.hoursJson);
        const schedule = hoursRoot.schedule && typeof hoursRoot.schedule === "object" ? (hoursRoot.schedule as Record<string, unknown>) : {};
        const nextHours = defaultHours();
        for (const day of days) {
          const row = schedule[day.key];
          if (row && typeof row === "object") {
            const cast = row as Record<string, unknown>;
            nextHours[day.key] = {
              open: String(cast.open || nextHours[day.key].open),
              close: String(cast.close || nextHours[day.key].close),
              closed: Boolean(cast.closed)
            };
          }
        }

        const toggles = fromJsonObject(settings.notificationTogglesJson);
        setAssignedPhoneNumber(profile.assignedPhoneNumber);
        setAssignedNumberProvider(profile.assignedNumberProvider);
        setCalendarProviders(calendar.providers || []);
        setNotifications(notificationData.notifications || []);
        setPrompt(String(policies.personalityPrompt || ""));
        setAiName(String(policies.aiName || "Receptionist"));
        setLanguage(fromJsonArray(settings.languagesJson)[0] || "English");
        setVoiceModel(String(policies.voiceModel || "Professional"));
        setAfterHoursMode(settings.afterHoursMode);
        setVoiceRoutingMode(settings.voiceRoutingMode || "AI_FIRST");
        setVoiceForwardingEnabled(settings.voiceForwardingEnabled === true);
        setVoiceForwardingNumber(settings.voiceForwardingNumber || "");
        setTransferNumbers(toLines(fromJsonArray(settings.transferNumbersJson)));
        setNotificationEmails(toLines(fromJsonArray(settings.notificationEmailsJson)));
        setNotificationPhones(toLines(fromJsonArray(settings.notificationPhonesJson)));
        setNotificationEmailRecipients(toLines(fromJsonArray(settings.notificationEmailRecipientsJson)));
        setNotifyAppointmentBookedEmail(toggles.APPOINTMENT_BOOKED_EMAIL_ENABLED !== false);
        setNotifyEmergencyEmail(toggles.EMERGENCY_CALL_FLAGGED_EMAIL_ENABLED !== false);
        setVoiceCallRecordingEnabled(settings.voiceCallRecordingEnabled === true);
        setRecordingConsentEnabled(settings.recordingConsentEnabled === true);
        setAppointmentBufferMinutes(settings.appointmentBufferMinutes || 30);
        setBookingLeadTimeHours(settings.bookingLeadTimeHours || 24);
        setHours(nextHours);
      })
      .catch((error) => {
        showToast({
          title: "Could not load settings",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "error"
        });
      });
  }, [showToast]);

  const activeCalendar = useMemo(
    () => calendarProviders.find((provider) => provider.isActive) || null,
    [calendarProviders]
  );

  async function onSave() {
    setSaving(true);
    try {
      await updateOrgSettings({
        afterHoursMode,
        voiceRoutingMode,
        voiceForwardingEnabled,
        voiceForwardingNumber,
        transferNumbersJson: JSON.stringify(fromLines(transferNumbers)),
        notificationEmailsJson: JSON.stringify(fromLines(notificationEmails)),
        notificationPhonesJson: JSON.stringify(fromLines(notificationPhones)),
        notificationEmailRecipientsJson: JSON.stringify(fromLines(notificationEmailRecipients)),
        notificationTogglesJson: JSON.stringify({
          APPOINTMENT_BOOKED_EMAIL_ENABLED: notifyAppointmentBookedEmail,
          EMERGENCY_CALL_FLAGGED_EMAIL_ENABLED: notifyEmergencyEmail
        }),
        voiceCallRecordingEnabled,
        recordingConsentEnabled,
        appointmentBufferMinutes,
        bookingLeadTimeHours,
        languagesJson: JSON.stringify([language]),
        hoursJson: JSON.stringify({ schedule: hours }),
        policiesJson: JSON.stringify({
          aiName,
          personalityPrompt: prompt,
          voiceModel
        })
      });
      showToast({ title: "Settings saved" });
    } catch (error) {
      showToast({
        title: "Could not save settings",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Receptionist control"
        title="Settings"
        description="Operational control center for your AI receptionist."
        actions={
          <div className="flex gap-3">
            <Badge className={clientBadgeClass("success")}>Live</Badge>
            <Button onClick={() => void onSave()} disabled={saving}>
              {saving ? "Saving..." : "Save All Changes"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-[16px] border border-slate-300 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Receptionist Control</p>
          <div className="space-y-2 text-sm">
            {["AI Config", "Availability", "Escalation", "Phone Number", "Billing", "Team Access"].map((item, index) => (
              <div key={item} className={`rounded-[12px] px-3 py-2.5 ${index === 0 ? "bg-primary font-semibold text-white" : "text-slate-600"}`}>
                {item}
              </div>
            ))}
          </div>
        </aside>

        <section className="grid gap-8 xl:grid-cols-2">
          <div className="rounded-[16px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
            <h3 className="mb-6 text-xl font-semibold text-slate-950">Core AI Identity & Voice</h3>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>AI Name</Label>
                  <Input value={aiName} onChange={(event) => setAiName(event.target.value)} />
                </div>
                <div>
                  <Label>Primary Language</Label>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={language} onChange={(event) => setLanguage(event.target.value)}>
                    <option>English</option>
                    <option>Spanish</option>
                    <option>French</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>Voice Model</Label>
                <Input value={voiceModel} onChange={(event) => setVoiceModel(event.target.value)} />
              </div>
              <div>
                <Label>Personality Prompt</Label>
                <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="min-h-[120px]" />
              </div>
            </div>
          </div>

          <div className="rounded-[16px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
            <h3 className="mb-6 text-xl font-semibold text-slate-950">Operational Hours</h3>
            <div className="space-y-4">
              {days.map((day) => {
                const row = hours[day.key];
                return (
                  <div key={day.key} className="grid items-center gap-3 sm:grid-cols-[150px_1fr_1fr_auto]">
                    <span className="text-sm font-medium text-slate-700">{day.label}</span>
                    <Input type="time" value={row.open} disabled={row.closed} onChange={(event) => setHours((prev) => ({ ...prev, [day.key]: { ...prev[day.key], open: event.target.value } }))} />
                    <Input type="time" value={row.close} disabled={row.closed} onChange={(event) => setHours((prev) => ({ ...prev, [day.key]: { ...prev[day.key], close: event.target.value } }))} />
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={row.closed} onChange={(event) => setHours((prev) => ({ ...prev, [day.key]: { ...prev[day.key], closed: event.target.checked } }))} />
                      Closed
                    </label>
                  </div>
                );
              })}
              <div className="border-t border-slate-200 pt-4">
                <Label>Non-Operational Call Routing</Label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setAfterHoursMode("VOICEMAIL")} className={`rounded-[12px] border p-3 text-left ${afterHoursMode === "VOICEMAIL" ? "border-blue-300 bg-blue-50" : "border-slate-200"}`}>
                    <p className="font-semibold text-slate-950">Voicemail</p>
                    <p className="text-xs text-slate-500">AI records message</p>
                  </button>
                  <button type="button" onClick={() => setAfterHoursMode("TRANSFER")} className={`rounded-[12px] border p-3 text-left ${afterHoursMode === "TRANSFER" ? "border-blue-300 bg-blue-50" : "border-slate-200"}`}>
                    <p className="font-semibold text-slate-950">Redirect</p>
                    <p className="text-xs text-slate-500">Forward to mobile</p>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[16px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
            <h3 className="mb-6 text-xl font-semibold text-slate-950">Human Handoff Protocols</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-[12px] bg-slate-50 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Hand-off to Human</p>
                  <p className="text-xs text-slate-500">Transfer when caller needs a person</p>
                </div>
                <input type="checkbox" checked={voiceForwardingEnabled} onChange={(event) => setVoiceForwardingEnabled(event.target.checked)} />
              </div>
              <div>
                <Label>Escalation Number</Label>
                <Input value={voiceForwardingNumber} onChange={(event) => setVoiceForwardingNumber(event.target.value)} />
              </div>
              <div>
                <Label>Routing Mode</Label>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={voiceRoutingMode} onChange={(event) => setVoiceRoutingMode(event.target.value as typeof voiceRoutingMode)}>
                  <option value="AI_FIRST">AI first</option>
                  <option value="PASSIVE_FORWARDING">Passive forwarding</option>
                  <option value="HUMAN_FIRST_AI_FALLBACK">Human first, AI fallback</option>
                </select>
              </div>
              <div>
                <Label>Transfer numbers</Label>
                <Textarea value={transferNumbers} onChange={(event) => setTransferNumbers(event.target.value)} className="min-h-[110px]" />
              </div>
            </div>
          </div>

          <div className="rounded-[16px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
            <h3 className="mb-6 text-xl font-semibold text-slate-950">Connectivity & Telephony</h3>
            <div className="space-y-5">
              <div className="flex items-center gap-4 rounded-[14px] border border-emerald-200 bg-emerald-50 p-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">OK</div>
                <div className="flex-1">
                  <p className="text-lg font-semibold text-slate-950">{assignedPhoneNumber || "No number assigned"}</p>
                  <p className="text-xs text-emerald-700">{assignedNumberProvider || "Provider pending"} • Messaging readiness depends on provisioning</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[12px] bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Recording</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{voiceCallRecordingEnabled ? "Enabled" : "Disabled"}</p>
                </div>
                <div className="rounded-[12px] bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Consent</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{recordingConsentEnabled ? "Required" : "Not required"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[16px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
            <h3 className="mb-6 text-xl font-semibold text-slate-950">Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Operator Email Alerts</span>
                <input type="checkbox" checked={notifyAppointmentBookedEmail} onChange={(event) => setNotifyAppointmentBookedEmail(event.target.checked)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Urgent SMS Alerts</span>
                <input type="checkbox" checked={notifyEmergencyEmail} onChange={(event) => setNotifyEmergencyEmail(event.target.checked)} />
              </div>
              <div>
                <Label>Notification emails</Label>
                <Textarea value={notificationEmails} onChange={(event) => setNotificationEmails(event.target.value)} className="min-h-[100px]" />
              </div>
              <div>
                <Label>Notification phones</Label>
                <Textarea value={notificationPhones} onChange={(event) => setNotificationPhones(event.target.value)} className="min-h-[100px]" />
              </div>
              <div className="rounded-[12px] border border-blue-200 bg-blue-50 p-3 text-xs text-slate-700">
                Alert logic: notify admin immediately for any booking cancellation or escalation event.
              </div>
            </div>
          </div>

          <div className="rounded-[16px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
            <h3 className="mb-6 text-xl font-semibold text-slate-950">Scheduling Integration</h3>
            <div className="space-y-4">
              <div className="rounded-[12px] border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-950">{activeCalendar ? activeCalendar.provider : "No active calendar connection"}</p>
                <p className="mt-1 text-xs text-slate-500">{activeCalendar ? activeCalendar.accountEmail : "Calendar sync is not active for this workspace."}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Buffer Time</Label>
                  <Input type="number" min={0} value={appointmentBufferMinutes} onChange={(event) => setAppointmentBufferMinutes(Number(event.target.value || 0))} />
                </div>
                <div>
                  <Label>Min Notice (hours)</Label>
                  <Input type="number" min={0} value={bookingLeadTimeHours} onChange={(event) => setBookingLeadTimeHours(Number(event.target.value || 0))} />
                </div>
              </div>
              <div>
                <Label>Operational alert recipients</Label>
                <Textarea value={notificationEmailRecipients} onChange={(event) => setNotificationEmailRecipients(event.target.value)} className="min-h-[100px]" />
              </div>
              <div className="text-xs text-slate-500">
                Notification inbox: {notifications.length} persisted operational alerts for this workspace.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
