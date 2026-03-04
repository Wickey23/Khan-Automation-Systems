"use client";

import { useEffect, useMemo, useState } from "react";
import {
  connectGoogleCalendar,
  connectOutlookCalendar,
  disconnectCalendar,
  deleteOrgKnowledgeFile,
  fetchCalendarProviders,
  fetchAuthSecurityStatus,
  getMe,
  fetchOrgKnowledgeFiles,
  fetchOrgProfile,
  fetchOrgNotifications,
  fetchOrgSettings,
  markAllOrgNotificationsRead,
  markOrgNotificationRead,
  runCalendarSyncTest,
  sendAuthTestOtpEmail,
  updateOrgSettings,
  uploadOrgKnowledgeFile
} from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AuthSecurityStatus, CalendarConnection, OrgFeatureFlags, OrgKnowledgeFile, OrgNotification } from "@/lib/types";

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
  averageJobValueUsd: number;
  appointmentDurationMinutes: number;
  appointmentBufferMinutes: number;
  bookingLeadTimeHours: number;
  bookingMaxDaysAhead: number;
  classificationShadowMode: boolean;
  classificationLlmDailyCap: number;
  notificationEmailRecipients: string;
  notifyNewLeadEmail: boolean;
  notifyAppointmentBookedEmail: boolean;
  notifyMissedRecoveryEmail: boolean;
  notifyEmergencyEmail: boolean;
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
  averageJobValueUsd: 650,
  appointmentDurationMinutes: 60,
  appointmentBufferMinutes: 15,
  bookingLeadTimeHours: 2,
  bookingMaxDaysAhead: 14,
  classificationShadowMode: true,
  classificationLlmDailyCap: 100,
  notificationEmailRecipients: "",
  notifyNewLeadEmail: true,
  notifyAppointmentBookedEmail: true,
  notifyMissedRecoveryEmail: true,
  notifyEmergencyEmail: true,
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
  const [knowledgeFiles, setKnowledgeFiles] = useState<OrgKnowledgeFile[]>([]);
  const [uploadingKnowledge, setUploadingKnowledge] = useState(false);
  const [security, setSecurity] = useState<AuthSecurityStatus | null>(null);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [calendarProviders, setCalendarProviders] = useState<CalendarConnection[]>([]);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarSyncProvider, setCalendarSyncProvider] = useState<"" | "GOOGLE" | "OUTLOOK">("");
  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<OrgNotification[]>([]);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [canManageCalendar, setCanManageCalendar] = useState(false);
  const [featureFlags, setFeatureFlags] = useState({
    calendarOauthEnabled: false,
    notificationsEnabled: false,
    classificationEnabled: false
  });
  const unreadNotificationCount = useMemo(() => notifications.filter((row) => !row.readAt).length, [notifications]);

  useEffect(() => {
    void Promise.all([
      fetchOrgSettings(),
      fetchOrgKnowledgeFiles(),
      fetchOrgProfile().catch(() => ({
        organization: null,
        assignedPhoneNumber: null,
        assignedNumberProvider: null,
        features: {}
      }))
    ])
      .then(async ([{ settings }, { files }, profile]) => {
        const profileFeatures: OrgFeatureFlags = profile.features || {};
        const [calendar, notifications] = await Promise.all([
          profileFeatures.calendarOauthEnabled === true
            ? fetchCalendarProviders().catch(() => ({ providers: [] }))
            : Promise.resolve({ providers: [] }),
          profileFeatures.notificationsEnabled === true
            ? fetchOrgNotifications().catch(() => ({ notifications: [] }))
            : Promise.resolve({ notifications: [] })
        ]);
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
        const notificationToggles = fromJsonObject(settings.notificationTogglesJson);
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
          averageJobValueUsd: settings.averageJobValueUsd || 650,
          appointmentDurationMinutes: settings.appointmentDurationMinutes || 60,
          appointmentBufferMinutes: settings.appointmentBufferMinutes || 15,
          bookingLeadTimeHours: settings.bookingLeadTimeHours || 2,
          bookingMaxDaysAhead: settings.bookingMaxDaysAhead || 14,
          classificationShadowMode: settings.classificationShadowMode ?? true,
          classificationLlmDailyCap: settings.classificationLlmDailyCap || 100,
          notificationEmailRecipients: toLines(fromJsonArray(settings.notificationEmailRecipientsJson)),
          notifyNewLeadEmail: notificationToggles.NEW_LEAD_CAPTURED_EMAIL_ENABLED !== false,
          notifyAppointmentBookedEmail: notificationToggles.APPOINTMENT_BOOKED_EMAIL_ENABLED !== false,
          notifyMissedRecoveryEmail: notificationToggles.MISSED_CALL_RECOVERY_NEEDED_EMAIL_ENABLED !== false,
          notifyEmergencyEmail: notificationToggles.EMERGENCY_CALL_FLAGGED_EMAIL_ENABLED !== false,
          hours: parsedHours
        });
        setKnowledgeFiles(files || []);
        setFeatureFlags({
          calendarOauthEnabled: profileFeatures.calendarOauthEnabled === true,
          notificationsEnabled: profileFeatures.notificationsEnabled === true,
          classificationEnabled: profileFeatures.classificationEnabled === true
        });
        setCalendarProviders(calendar.providers || []);
        setNotifications(notifications.notifications || []);
        setNotificationCount((notifications.notifications || []).length);
      })
      .catch((error) =>
        showToast({
          title: "Could not load settings",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "error"
        })
      );
  }, [showToast]);

  useEffect(() => {
    void fetchAuthSecurityStatus()
      .then((data) => setSecurity(data))
      .catch(() => setSecurity(null));
    void getMe()
      .then((data) => {
        const role = data.user.role;
        setCanManageCalendar(role === "CLIENT_ADMIN" || role === "ADMIN" || role === "SUPER_ADMIN");
      })
      .catch(() => setCanManageCalendar(false));
  }, []);

  async function onSendTestVerificationEmail() {
    setSendingTestEmail(true);
    try {
      await sendAuthTestOtpEmail();
      const latest = await fetchAuthSecurityStatus();
      setSecurity(latest);
      showToast({ title: "Test email sent", description: "Check inbox/spam for your verification code email." });
    } catch (error) {
      showToast({
        title: "Could not send test email",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSendingTestEmail(false);
    }
  }

  async function onMarkNotificationRead(id: string) {
    setNotificationsBusy(true);
    try {
      await markOrgNotificationRead(id);
      setNotifications((prev) => {
        const next = prev.map((row) => (row.id === id ? { ...row, readAt: row.readAt || new Date().toISOString() } : row));
        setNotificationCount(next.length);
        return next;
      });
    } finally {
      setNotificationsBusy(false);
    }
  }

  async function onMarkAllNotificationsRead() {
    setNotificationsBusy(true);
    try {
      await markAllOrgNotificationsRead();
      const now = new Date().toISOString();
      setNotifications((prev) => {
        const next = prev.map((row) => ({ ...row, readAt: row.readAt || now }));
        setNotificationCount(next.length);
        return next;
      });
    } finally {
      setNotificationsBusy(false);
    }
  }

  async function onKnowledgeFileSelected(file: File | null) {
    if (!file) return;
    const allowed = ["text/plain", "text/markdown", "application/json", "text/csv"];
    if (!allowed.includes(file.type || "text/plain")) {
      showToast({
        title: "Unsupported file type",
        description: "Use .txt, .md, .json, or .csv files.",
        variant: "error"
      });
      return;
    }
    if (file.size > 200_000) {
      showToast({
        title: "File too large",
        description: "Max file size is 200 KB.",
        variant: "error"
      });
      return;
    }

    setUploadingKnowledge(true);
    try {
      const contentText = await file.text();
      const { file: saved } = await uploadOrgKnowledgeFile({
        fileName: file.name,
        mimeType: file.type || "text/plain",
        sizeBytes: file.size,
        contentText
      });
      setKnowledgeFiles((prev) => [saved, ...prev]);
      showToast({
        title: "Knowledge file uploaded",
        description: "Run Generate AI Prompt in Admin to apply this context to the assistant."
      });
    } catch (error) {
      showToast({ title: "Upload failed", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
    } finally {
      setUploadingKnowledge(false);
    }
  }

  async function onDeleteKnowledgeFile(fileId: string) {
    try {
      await deleteOrgKnowledgeFile(fileId);
      setKnowledgeFiles((prev) => prev.filter((item) => item.id !== fileId));
      showToast({ title: "Knowledge file removed" });
    } catch (error) {
      showToast({ title: "Delete failed", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
    }
  }

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
        notificationEmailRecipientsJson: JSON.stringify(fromLines(state.notificationEmailRecipients)),
        servicesJson: JSON.stringify(fromLines(state.services)),
        policiesJson: JSON.stringify({
          warrantyPolicy: state.warrantyPolicy.trim(),
          cancellationPolicy: state.cancellationPolicy.trim(),
          diagnosticsPolicy: state.diagnosticsPolicy.trim(),
          smsWelcomeMessage: state.smsWelcomeMessage.trim(),
          smsMarketingEnabled: state.smsMarketingEnabled,
          smsMarketingBlurb: state.smsMarketingBlurb.trim()
        }),
        notificationTogglesJson: JSON.stringify({
          NEW_LEAD_CAPTURED_EMAIL_ENABLED: state.notifyNewLeadEmail,
          APPOINTMENT_BOOKED_EMAIL_ENABLED: state.notifyAppointmentBookedEmail,
          MISSED_CALL_RECOVERY_NEEDED_EMAIL_ENABLED: state.notifyMissedRecoveryEmail,
          EMERGENCY_CALL_FLAGGED_EMAIL_ENABLED: state.notifyEmergencyEmail
        }),
        smsConsentText: state.smsConsentText.trim(),
        recordingConsentEnabled: state.recordingConsentEnabled,
        averageJobValueUsd: state.averageJobValueUsd,
        appointmentDurationMinutes: state.appointmentDurationMinutes,
        appointmentBufferMinutes: state.appointmentBufferMinutes,
        bookingLeadTimeHours: state.bookingLeadTimeHours,
        bookingMaxDaysAhead: state.bookingMaxDaysAhead,
        classificationShadowMode: state.classificationShadowMode,
        classificationLlmDailyCap: state.classificationLlmDailyCap
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

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">Security & Email Verification</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify your login email can receive codes and confirm whether 2FA is enforced for your role.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded border px-2 py-1 text-sm">
            Email: <span className="font-medium">{security?.email || "Unknown"}</span>
          </div>
          <div className="rounded border px-2 py-1 text-sm">
            2FA required: <span className="font-medium">{security?.twoFactorEnabledForAccount ? "Yes" : "No"}</span>
          </div>
          <div className="rounded border px-2 py-1 text-sm">
            Provider: <span className="font-medium">{security?.emailProviderConfigured ? "Configured" : "Missing"}</span>
          </div>
          <div className="rounded border px-2 py-1 text-sm">
            Last OTP sent:{" "}
            <span className="font-medium">
              {security?.lastOtpEmailSentAt ? new Date(security.lastOtpEmailSentAt).toLocaleString() : "-"}
            </span>
          </div>
          <div className="rounded border px-2 py-1 text-sm">
            Last OTP verified:{" "}
            <span className="font-medium">
              {security?.lastOtpVerifiedAt ? new Date(security.lastOtpVerifiedAt).toLocaleString() : "-"}
            </span>
          </div>
          <div className="rounded border px-2 py-1 text-sm">
            Last failure: <span className="font-medium">{security?.lastOtpFailureReason || "-"}</span>
          </div>
        </div>
        <div className="mt-3">
          <Button variant="outline" onClick={() => void onSendTestVerificationEmail()} disabled={sendingTestEmail}>
            {sendingTestEmail ? "Sending..." : "Send test verification email"}
          </Button>
        </div>
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
        <h2 className="text-lg font-semibold">Calendar Connections</h2>
        {!featureFlags.calendarOauthEnabled ? (
          <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Calendar OAuth is currently disabled for this workspace.
          </p>
        ) : null}
        <p className="mt-1 text-sm text-muted-foreground">
          Connect Google or Outlook for create-only appointment event writes.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={calendarBusy || !canManageCalendar || !featureFlags.calendarOauthEnabled}
            onClick={() =>
              void (async () => {
                setCalendarBusy(true);
                try {
                  const data = await connectGoogleCalendar();
                  window.location.href = data.url;
                } catch (error) {
                  showToast({ title: "Google connect failed", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
                } finally {
                  setCalendarBusy(false);
                }
              })()
            }
          >
            Connect Google
          </Button>
          <Button
            variant="outline"
            disabled={calendarBusy || !canManageCalendar || !featureFlags.calendarOauthEnabled}
            onClick={() =>
              void (async () => {
                setCalendarBusy(true);
                try {
                  const data = await connectOutlookCalendar();
                  window.location.href = data.url;
                } catch (error) {
                  showToast({ title: "Outlook connect failed", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
                } finally {
                  setCalendarBusy(false);
                }
              })()
            }
          >
            Connect Outlook
          </Button>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={calendarSyncProvider}
            onChange={(event) => setCalendarSyncProvider(event.target.value as "" | "GOOGLE" | "OUTLOOK")}
            disabled={calendarBusy || !canManageCalendar || !featureFlags.calendarOauthEnabled}
          >
            <option value="">Any active provider</option>
            <option value="GOOGLE">Google</option>
            <option value="OUTLOOK">Outlook</option>
          </select>
          <Button
            variant="outline"
            disabled={calendarBusy || !canManageCalendar || !featureFlags.calendarOauthEnabled}
            onClick={() =>
              void (async () => {
                setCalendarBusy(true);
                try {
                  const result = await runCalendarSyncTest(
                    calendarSyncProvider ? { provider: calendarSyncProvider } : {}
                  );
                  showToast({ title: "Calendar sync test", description: result.message });
                } catch (error) {
                  showToast({ title: "Sync test failed", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
                } finally {
                  setCalendarBusy(false);
                }
              })()
            }
          >
            Run sync test
          </Button>
        </div>
        {!canManageCalendar ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Calendar connection management requires an admin role.
          </p>
        ) : null}
        <div className="mt-3 space-y-2 text-sm">
          {calendarProviders.length ? calendarProviders.map((provider) => (
            <div key={provider.id} className="flex items-center justify-between rounded border p-2">
              <div>
                <p className="font-medium">{provider.provider} - {provider.accountEmail}</p>
                <p className="text-xs text-muted-foreground">
                  {provider.isActive ? "Active" : "Inactive"} - Expires {new Date(provider.expiresAt).toLocaleString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!canManageCalendar || !featureFlags.calendarOauthEnabled}
                onClick={() =>
                  void (async () => {
                    await disconnectCalendar({ provider: provider.provider as "GOOGLE" | "OUTLOOK", accountEmail: provider.accountEmail });
                    setCalendarProviders((prev) => prev.map((row) => row.id === provider.id ? { ...row, isActive: false } : row));
                  })()
                }
              >
                Disconnect
              </Button>
            </div>
          )) : (
            <p className="text-muted-foreground">No calendar providers connected.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">Operations Controls</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure ROI defaults, scheduling windows, notification recipients, and classification policy.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Average job value (USD)</Label>
            <Input type="number" min={0} value={state.averageJobValueUsd} onChange={(e) => setState((p) => ({ ...p, averageJobValueUsd: Number(e.target.value || 0) }))} />
          </div>
          <div>
            <Label>Appointment duration (minutes)</Label>
            <Input type="number" min={5} value={state.appointmentDurationMinutes} onChange={(e) => setState((p) => ({ ...p, appointmentDurationMinutes: Number(e.target.value || 60) }))} />
          </div>
          <div>
            <Label>Appointment buffer (minutes)</Label>
            <Input type="number" min={0} value={state.appointmentBufferMinutes} onChange={(e) => setState((p) => ({ ...p, appointmentBufferMinutes: Number(e.target.value || 15) }))} />
          </div>
          <div>
            <Label>Booking lead time (hours)</Label>
            <Input type="number" min={0} value={state.bookingLeadTimeHours} onChange={(e) => setState((p) => ({ ...p, bookingLeadTimeHours: Number(e.target.value || 2) }))} />
          </div>
          <div>
            <Label>Max days ahead</Label>
            <Input type="number" min={1} value={state.bookingMaxDaysAhead} onChange={(e) => setState((p) => ({ ...p, bookingMaxDaysAhead: Number(e.target.value || 14) }))} />
          </div>
          <div>
            <Label>LLM classification daily cap</Label>
            <Input
              type="number"
              min={0}
              disabled={!featureFlags.classificationEnabled}
              value={state.classificationLlmDailyCap}
              onChange={(e) => setState((p) => ({ ...p, classificationLlmDailyCap: Number(e.target.value || 100) }))}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Label>Notification email recipients (one per line)</Label>
            <Textarea value={state.notificationEmailRecipients} onChange={(e) => setState((p) => ({ ...p, notificationEmailRecipients: e.target.value }))} />
            <p className="mt-1 text-xs text-muted-foreground">
              Notifications: {unreadNotificationCount} unread / {notificationCount} total
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={state.notifyNewLeadEmail} onChange={(e) => setState((p) => ({ ...p, notifyNewLeadEmail: e.target.checked }))} />
            Email on new lead captured
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={state.notifyAppointmentBookedEmail} onChange={(e) => setState((p) => ({ ...p, notifyAppointmentBookedEmail: e.target.checked }))} />
            Email on appointment booked
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={state.notifyMissedRecoveryEmail} onChange={(e) => setState((p) => ({ ...p, notifyMissedRecoveryEmail: e.target.checked }))} />
            Email on missed-call recovery needed
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={state.notifyEmergencyEmail} onChange={(e) => setState((p) => ({ ...p, notifyEmergencyEmail: e.target.checked }))} />
            Email on emergency call flagged
          </label>
          <label className="sm:col-span-2 lg:col-span-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.classificationShadowMode}
              disabled={!featureFlags.classificationEnabled}
              onChange={(e) => setState((p) => ({ ...p, classificationShadowMode: e.target.checked }))}
            />
            Classification shadow mode (log only, do not mutate lead fields)
          </label>
          {!featureFlags.classificationEnabled ? (
            <p className="sm:col-span-2 lg:col-span-3 text-xs text-muted-foreground">
              Classification controls are unavailable while classification is disabled for this workspace.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Notifications</h2>
            <p className="text-sm text-muted-foreground">Operational alerts for leads, appointments, missed recovery, and emergencies.</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={notificationsBusy || notifications.length === 0 || !featureFlags.notificationsEnabled}
            onClick={() => void onMarkAllNotificationsRead()}
          >
            Mark all read
          </Button>
        </div>
        {!featureFlags.notificationsEnabled ? (
          <p className="mt-2 text-sm text-muted-foreground">Notifications v1 is disabled for this workspace.</p>
        ) : null}
        <div className="mt-3 space-y-2">
          {!featureFlags.notificationsEnabled ? (
            <p className="text-sm text-muted-foreground">Enable notifications feature to view operational alerts.</p>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            notifications.slice(0, 20).map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-2 text-sm">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.body}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.severity} · {new Date(item.createdAt).toLocaleString()} · {item.readAt ? "Read" : "Unread"}
                  </p>
                </div>
                {!item.readAt ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={notificationsBusy || !featureFlags.notificationsEnabled}
                    onClick={() => void onMarkNotificationRead(item.id)}
                  >
                    Mark read
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">Assistant Knowledge Files</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload business detail files so your assistant can answer with your exact policies, services, and process details.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Input
            type="file"
            accept=".txt,.md,.json,.csv,text/plain,text/markdown,application/json,text/csv"
            onChange={(event) => void onKnowledgeFileSelected(event.target.files?.[0] || null)}
            disabled={uploadingKnowledge}
            className="max-w-sm"
          />
          {uploadingKnowledge ? <span className="text-xs text-muted-foreground">Uploading...</span> : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Allowed: .txt, .md, .json, .csv. Max 200KB per file. Keep documents concise and factual.
        </p>
        <div className="mt-3 space-y-2">
          {knowledgeFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No knowledge files uploaded yet.</p>
          ) : (
            knowledgeFiles.map((file) => (
              <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <div>
                  <p className="font-medium">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {file.mimeType} • {(file.sizeBytes / 1024).toFixed(1)} KB • {new Date(file.createdAt).toLocaleString()}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void onDeleteKnowledgeFile(file.id)}>
                  Remove
                </Button>
              </div>
            ))
          )}
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
