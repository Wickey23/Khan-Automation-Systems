"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Bot, Calendar, Clock3, Phone, Shield, User, Zap } from "lucide-react";
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
  selectPrimaryCalendar,
  sendAuthTestOtpEmail,
  updateOrgSettings,
  uploadOrgKnowledgeFile
} from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageHelpFab, SectionHeading, SectionShell } from "@/components/ui/page";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { StateCard } from "@/components/ui/state-card";
import type {
  AccessFeatureKey,
  AccessStatus,
  AuthSecurityStatus,
  CalendarConnection,
  OrgAccessSummary,
  OrgFeatureFlags,
  OrgKnowledgeFile,
  OrgNotification
} from "@/lib/types";
import { frontDeskContextPanelClass, frontDeskWorkspaceCardClass } from "@/lib/front-desk-ui";

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
type HoursRow = { open: string; close: string; closed: boolean };
type SettingsSectionId = "Profile" | "AI Identity" | "Operations" | "Handoff" | "Telephony" | "Calendar" | "Notifications" | "Security";

type FormState = {
  timezone: string;
  afterHoursMode: "TAKE_MESSAGE" | "TRANSFER" | "VOICEMAIL";
  voiceRoutingMode: "AI_FIRST" | "PASSIVE_FORWARDING" | "HUMAN_FIRST_AI_FALLBACK";
  voiceForwardingEnabled: boolean;
  voiceForwardingNumber: string;
  voiceRingTimeoutSeconds: number;
  afterHoursVoiceFallbackEnabled: boolean;
  voiceCallRecordingEnabled: boolean;
  voiceMediaStreamingEnabled: boolean;
  voiceTranscriptionEnabled: boolean;
  serviceRequestAutomationEnabled: boolean;
  transferNumbers: string;
  notificationEmails: string;
  notificationPhones: string;
  languages: string;
  services: string;
  warrantyPolicy: string;
  cancellationPolicy: string;
  diagnosticsPolicy: string;
  smsWelcomeMessage: string;
  smsMissedCallRecoveryTemplate: string;
  smsNewLeadAcknowledgementTemplate: string;
  smsAppointmentConfirmationTemplate: string;
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

const voiceForwardingDialCodeOptions = [
  { value: "+1", label: "US/Canada (+1)" },
  { value: "+44", label: "UK (+44)" },
  { value: "+61", label: "Australia (+61)" },
  { value: "+91", label: "India (+91)" }
] as const;

const timezoneOptions = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Australia/Sydney"
] as const;

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
  voiceRoutingMode: "AI_FIRST",
  voiceForwardingEnabled: false,
  voiceForwardingNumber: "",
  voiceRingTimeoutSeconds: 20,
  afterHoursVoiceFallbackEnabled: false,
  voiceCallRecordingEnabled: false,
  voiceMediaStreamingEnabled: false,
  voiceTranscriptionEnabled: false,
  serviceRequestAutomationEnabled: false,
  transferNumbers: "",
  notificationEmails: "",
  notificationPhones: "",
  languages: "English",
  services: "",
  warrantyPolicy: "",
  cancellationPolicy: "",
  diagnosticsPolicy: "",
  smsWelcomeMessage: "",
  smsMissedCallRecoveryTemplate: "",
  smsNewLeadAcknowledgementTemplate: "",
  smsAppointmentConfirmationTemplate: "",
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

function supportsHumanForwardingMode(
  mode: FormState["voiceRoutingMode"]
) {
  return mode === "PASSIVE_FORWARDING" || mode === "HUMAN_FIRST_AI_FALLBACK";
}

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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not yet";
  return parsed.toLocaleString();
}

function formatAfterHoursMode(value: FormState["afterHoursMode"]) {
  switch (value) {
    case "TRANSFER":
      return "Transfer to office";
    case "VOICEMAIL":
      return "Send to voicemail";
    default:
      return "Take a message";
  }
}

function formatAccessStatusLabel(status?: AccessStatus) {
  if (!status) return "Unknown";
  return status.replace(/_/g, " ");
}

function getNotificationBody(item: OrgNotification) {
  const metadata = item.metadataJson && typeof item.metadataJson === "object" ? item.metadataJson : null;
  const calendarFallbackDetail =
    metadata && typeof metadata.calendarFallbackDetail === "string" ? metadata.calendarFallbackDetail : "";
  if (item.title === "Calendar booking fallback" && calendarFallbackDetail.trim()) {
    return calendarFallbackDetail.trim();
  }
  return item.body;
}

const ACCESS_FEATURE_ORDER: AccessFeatureKey[] = ["calls", "sms", "appointments", "outreach"];

const FEATURE_SECTION_LINKS: Record<AccessFeatureKey, SettingsSectionId> = {
  calls: "Telephony",
  sms: "Telephony",
  appointments: "Calendar",
  outreach: "Handoff"
};

function WorkspaceAccessSection({
  access,
  focusSection
}: {
  access: OrgAccessSummary | null;
  focusSection: (section: SettingsSectionId) => void;
}) {
  if (!access) {
    return (
      <SectionShell className="surface-panel space-y-4">
        <SectionHeading
          title="Workspace readiness"
          description="Pulling gatekeeper and readiness data for every helper workflow."
        />
        <StateCard
          variant="loading"
          title="Assessing access"
          description="Gathering billing status, feature gates, and configuration checks."
        />
      </SectionShell>
    );
  }

  return (
    <SectionShell className="surface-panel space-y-6">
      <SectionHeading
        title="Workspace readiness"
        description="Understand which features are gated, what needs configuration, and where you are approved."
      />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Feature access</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {ACCESS_FEATURE_ORDER.map((key) => {
              const feature = access.features[key];
              const targetSection = FEATURE_SECTION_LINKS[key];
              return (
                <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{feature.label}</p>
                    <StatusBadge
                      kind="feature"
                      state={feature.status}
                      label={formatAccessStatusLabel(feature.status)}
                      size="xs"
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{feature.reason}</p>
                  {feature.status !== "ready" && targetSection ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => focusSection(targetSection)}
                    >
                      Resolve in {targetSection}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Readiness checklist</h3>
          {access.readinessChecklist.map((check) => (
            <div key={check.key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{check.label}</p>
                  <p className="text-sm text-slate-700">{check.description}</p>
                  {check.detail ? <p className="text-xs text-slate-400">{check.detail}</p> : null}
                </div>
                <StatusBadge kind="feature" state={check.status} label={formatAccessStatusLabel(check.status)} size="xs" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

function detectVoiceForwardingDialCode(value: string) {
  const normalized = value.trim();
  if (!normalized.startsWith("+")) return "+1";
  const match = [...voiceForwardingDialCodeOptions]
    .sort((a, b) => b.value.length - a.value.length)
    .find((option) => normalized.startsWith(option.value));
  return match?.value ?? "+1";
}

function getVoiceForwardingLocalNumber(value: string, dialCode: string) {
  const normalized = value.trim();
  if (!normalized) return "";
  if (normalized.startsWith(dialCode)) {
    return normalized.slice(dialCode.length).replace(/[^\d]/g, "");
  }
  return normalized.replace(/^\+/, "").replace(/[^\d]/g, "");
}

function buildVoiceForwardingNumber(dialCode: string, localNumber: string) {
  const digits = localNumber.replace(/[^\d]/g, "");
  if (!digits) return "";
  return `${dialCode}${digits}`;
}

export default function AppSettingsPage() {
  const { showToast } = useToast();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("AI Identity");
  const [state, setState] = useState<FormState>(defaults);
  const [saving, setSaving] = useState(false);
  const [knowledgeFiles, setKnowledgeFiles] = useState<OrgKnowledgeFile[]>([]);
  const [uploadingKnowledge, setUploadingKnowledge] = useState(false);
  const [security, setSecurity] = useState<AuthSecurityStatus | null>(null);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [calendarProviders, setCalendarProviders] = useState<CalendarConnection[]>([]);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarSyncProvider, setCalendarSyncProvider] = useState<"" | "GOOGLE" | "OUTLOOK">("");
  const [selectedPrimaryConnectionId, setSelectedPrimaryConnectionId] = useState("");
  const [selectedCalendarIdInput, setSelectedCalendarIdInput] = useState("");
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
  const voiceForwardingDialCode = useMemo(
    () => detectVoiceForwardingDialCode(state.voiceForwardingNumber),
    [state.voiceForwardingNumber]
  );
  const voiceForwardingLocalNumber = useMemo(
    () => getVoiceForwardingLocalNumber(state.voiceForwardingNumber, voiceForwardingDialCode),
    [state.voiceForwardingNumber, voiceForwardingDialCode]
  );

  useEffect(() => {
    void Promise.all([
      fetchOrgSettings(),
      fetchOrgKnowledgeFiles(),
      fetchOrgProfile().catch(() => ({
        organization: null,
        assignedPhoneNumber: null,
        assignedNumberProvider: null,
        features: {},
        access: null
      }))
    ])
      .then(async ([{ settings }, { files }, profile]) => {
        const profileFeatures: OrgFeatureFlags = profile.features || {};
        setAccessSummary(profile.access || null);
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
          voiceRoutingMode: settings.voiceRoutingMode || "AI_FIRST",
          voiceForwardingEnabled: settings.voiceForwardingEnabled === true,
          voiceForwardingNumber: settings.voiceForwardingNumber || "",
          voiceRingTimeoutSeconds: settings.voiceRingTimeoutSeconds || 20,
          afterHoursVoiceFallbackEnabled: settings.afterHoursVoiceFallbackEnabled === true,
          voiceCallRecordingEnabled: settings.voiceCallRecordingEnabled === true,
          voiceMediaStreamingEnabled: settings.voiceMediaStreamingEnabled === true,
          voiceTranscriptionEnabled: settings.voiceTranscriptionEnabled === true,
          serviceRequestAutomationEnabled: settings.serviceRequestAutomationEnabled === true,
          transferNumbers: toLines(fromJsonArray(settings.transferNumbersJson)),
          notificationEmails: toLines(fromJsonArray(settings.notificationEmailsJson)),
          notificationPhones: toLines(fromJsonArray(settings.notificationPhonesJson)),
          languages: toLines(fromJsonArray(settings.languagesJson)),
          services: toLines(fromJsonArray(settings.servicesJson)),
          warrantyPolicy: String(policies.warrantyPolicy || ""),
          cancellationPolicy: String(policies.cancellationPolicy || ""),
          diagnosticsPolicy: String(policies.diagnosticsPolicy || ""),
          smsWelcomeMessage: String(policies.smsWelcomeMessage || ""),
          smsMissedCallRecoveryTemplate: String(policies.smsMissedCallRecoveryTemplate || ""),
          smsNewLeadAcknowledgementTemplate: String(policies.smsNewLeadAcknowledgementTemplate || ""),
          smsAppointmentConfirmationTemplate: String(policies.smsAppointmentConfirmationTemplate || ""),
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
        const providers = calendar.providers || [];
        const activeProviders = providers.filter((row) => row.isActive);
        setCalendarProviders(providers);
        const primary = activeProviders.find((row) => row.isPrimary) || activeProviders[0] || providers.find((row) => row.isPrimary) || providers[0];
        setSelectedPrimaryConnectionId(primary?.id || "");
        setSelectedCalendarIdInput(String(primary?.selectedCalendarId || ""));
        setNotifications(notifications.notifications || []);
        setNotificationCount((notifications.notifications || []).length);
      })
      .catch((error) => {
        showToast({
          title: "Could not load settings",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "error"
        });
        setAccessSummary(null);
      });
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

  useEffect(() => {
    const current = calendarProviders.find((row) => row.id === selectedPrimaryConnectionId && row.isActive);
    if (!current) {
      const fallback = calendarProviders.find((row) => row.isActive);
      if (fallback && fallback.id !== selectedPrimaryConnectionId) {
        setSelectedPrimaryConnectionId(fallback.id);
        setSelectedCalendarIdInput(String(fallback.selectedCalendarId || ""));
      }
      return;
    }
    setSelectedCalendarIdInput(String(current.selectedCalendarId || ""));
  }, [selectedPrimaryConnectionId, calendarProviders]);

  const activeCalendarProviders = calendarProviders.filter((provider) => provider.isActive);
  const inactiveCalendarProviderCount = Math.max(0, calendarProviders.length - activeCalendarProviders.length);

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
  const transferNumberCount = readinessHints.transfer.length;
  const openDaysCount = DAYS.filter((day) => !state.hours[day.key].closed).length;
  const primaryCalendarConnection =
    activeCalendarProviders.find((provider) => provider.id === selectedPrimaryConnectionId) ||
    activeCalendarProviders.find((provider) => provider.isPrimary) ||
    activeCalendarProviders[0] ||
    null;
  const menuItems: Array<{ id: SettingsSectionId; icon: typeof User; label: string }> = [
    { id: "Profile", icon: User, label: "Operator Profile" },
    { id: "AI Identity", icon: Bot, label: "AI Identity & Voice" },
    { id: "Operations", icon: Clock3, label: "Operational Hours" },
    { id: "Handoff", icon: Zap, label: "Human Handoff Rules" },
    { id: "Telephony", icon: Phone, label: "Telephony Setup" },
    { id: "Calendar", icon: Calendar, label: "Calendar Integration" },
    { id: "Notifications", icon: Bell, label: "Notifications" },
    { id: "Security", icon: Shield, label: "Security" }
  ];
  const activeMenuItem = menuItems.find((item) => item.id === activeSection) ?? menuItems[1];
  const activeSectionDescriptions: Record<SettingsSectionId, string> = {
    Profile: "Manage the core operator-facing profile, business knowledge, and receptionist context used day to day.",
    "AI Identity": "Configure how your AI receptionist sounds, what it says, and the policy guidance it uses live.",
    Operations: "Define office hours, timezone coverage, and the operating window your front desk should follow.",
    Handoff: "Control escalation behavior, human-first routing, and the rules that decide when staff should step in.",
    Telephony: "Keep transfer numbers, services, and contact routing lists current for the live receptionist workflow.",
    Calendar: "Connect provider calendars, assign the primary booking target, and test scheduling reliability.",
    Notifications: "Configure booking alerts, email recipients, and the operational inbox for follow-up issues.",
    Security: "Review verification status, delivery health, and the account safeguards that protect this workspace."
  };

  function focusSection(section: SettingsSectionId) {
    setActiveSection(section);
    if (typeof document === "undefined") return;
    const target = document.getElementById("settings-content-root");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
    if (supportsHumanForwardingMode(state.voiceRoutingMode) && (!state.voiceForwardingEnabled || !state.voiceForwardingNumber.trim())) {
      showToast({
        title: "Forwarding number required",
        description: "Human-first routing requires a live forwarding number.",
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
        voiceRoutingMode: state.voiceRoutingMode,
        voiceForwardingEnabled: state.voiceForwardingEnabled,
        voiceForwardingNumber: state.voiceForwardingNumber.trim(),
        voiceRingTimeoutSeconds: state.voiceRingTimeoutSeconds,
        afterHoursVoiceFallbackEnabled: state.afterHoursVoiceFallbackEnabled,
        voiceCallRecordingEnabled: state.voiceCallRecordingEnabled,
        voiceMediaStreamingEnabled: state.voiceMediaStreamingEnabled,
        voiceTranscriptionEnabled: state.voiceTranscriptionEnabled,
        serviceRequestAutomationEnabled: state.serviceRequestAutomationEnabled,
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
          smsMissedCallRecoveryTemplate: state.smsMissedCallRecoveryTemplate.trim(),
          smsNewLeadAcknowledgementTemplate: state.smsNewLeadAcknowledgementTemplate.trim(),
          smsAppointmentConfirmationTemplate: state.smsAppointmentConfirmationTemplate.trim(),
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
      showToast({ title: "Assistant settings saved", description: "Your receptionist rules and readiness settings have been updated." });
    } catch (error) {
      showToast({ title: "Save failed", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assistant configuration"
        title="Receptionist Setup"
        description="Use this page to decide how your receptionist behaves: call routing, booking rules, alerts, business hours, and the knowledge your team wants the assistant to use."
        actions={
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save assistant settings"}
          </Button>
        }
      />

      <PageHelpFab
        items={[
          {
            label: "Use this page",
            text: "Come here when you need to change how the receptionist behaves: routing, alerts, booking rules, hours, and business knowledge."
          },
          {
            label: "Start here",
            text: "Update the section that controls the live issue you are seeing, then save settings so the front-desk queues reflect the new rules."
          },
          {
            label: "Go next",
            text: "Return to Front Desk, Call Queue, Inbox, or Booking Queue to confirm the live workflow now matches how the office wants calls and texts handled."
          }
        ]}
      />

      <WorkspaceAccessSection access={accessSummary} focusSection={focusSection} />

      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50/60 p-5 lg:border-b-0 lg:border-r">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Control Center</p>
              <h2 className="text-lg font-black tracking-tight text-slate-900">Receptionist settings</h2>
              <p className="text-sm text-slate-500">Move through the main configuration areas the same way the export-5 control center was organized.</p>
            </div>
            <div className="mt-5 space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => focusSection(item.id)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                      active ? "border-slate-200 bg-white text-primary shadow-sm" : "border-transparent bg-transparent text-slate-500"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div id="settings-content-root" className="space-y-6 p-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
                  <activeMenuItem.icon className="h-7 w-7" />
                </div>
                <div className="max-w-2xl">
                  <p className="page-eyebrow">Front Desk Control Center</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{activeMenuItem.label}</h2>
                  <p className="mt-3 text-base leading-7 text-slate-500">{activeSectionDescriptions[activeSection]}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className={frontDeskContextPanelClass()}>
                  <p className="page-eyebrow">Coverage</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{openDaysCount} open day{openDaysCount === 1 ? "" : "s"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{state.timezone} workspace timezone</p>
                </div>
                <div className={frontDeskContextPanelClass()}>
                  <p className="page-eyebrow">Calendar</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{primaryCalendarConnection ? "Connected" : "Manual scheduling"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {primaryCalendarConnection ? `${primaryCalendarConnection.provider} primary connection` : "No active provider selected"}
                  </p>
                </div>
                <div className={frontDeskContextPanelClass()}>
                  <p className="page-eyebrow">Alert routing</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {readinessHints.emails.length + readinessHints.phones.length > 0 ? "Configured" : "Needs routing"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {readinessHints.emails.length + readinessHints.phones.length} active contact point
                    {readinessHints.emails.length + readinessHints.phones.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </div>

      <Accordion type="multiple" defaultValue={["security", "calendar", "booking", "notifications", "knowledge", "business-hours", "services", "policies", "sms"]} className="space-y-4">
      {activeSection === "Security" ? <AccordionItem id="settings-security" value="security" className={frontDeskWorkspaceCardClass("default") + " px-5"}>
        <AccordionTrigger className="py-5 text-base no-underline hover:no-underline">
          Security & Verification
        </AccordionTrigger>
        <AccordionContent className="pb-5">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-sm text-muted-foreground">
                This area is only for account verification and delivery diagnostics. It does not affect day-to-day assistant behavior.
              </p>
              <div className="mt-4 space-y-3">
                <div className={frontDeskContextPanelClass()}>
                  <p className="page-eyebrow">Account email</p>
                  <p className="mt-2 text-sm font-medium text-slate-950">{security?.email || "Unknown"}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={frontDeskContextPanelClass()}>
                    <p className="page-eyebrow">2FA policy</p>
                    <p className="mt-2 text-sm font-medium text-slate-950">{security?.twoFactorEnabledForAccount ? "Required for this account" : "Not required"}</p>
                  </div>
                  <div className={frontDeskContextPanelClass()}>
                    <p className="page-eyebrow">Email provider</p>
                    <p className="mt-2 text-sm font-medium text-slate-950">{security?.emailProviderConfigured ? "Configured" : "Missing"}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className={frontDeskContextPanelClass()}>
                <p className="page-eyebrow">Last code sent</p>
                <p className="mt-2 text-sm font-medium text-slate-950">{formatDateTime(security?.lastOtpEmailSentAt)}</p>
              </div>
              <div className={frontDeskContextPanelClass()}>
                <p className="page-eyebrow">Last code verified</p>
                <p className="mt-2 text-sm font-medium text-slate-950">{formatDateTime(security?.lastOtpVerifiedAt)}</p>
              </div>
              <div className={frontDeskContextPanelClass()}>
                <p className="page-eyebrow">Recent verification issue</p>
                <p className="mt-2 text-sm font-medium text-slate-950">
                  {security?.lastOtpFailureReason ? security.lastOtpFailureReason.replace(/_/g, " ") : "No recent failure recorded"}
                </p>
              </div>
              <Button variant="outline" onClick={() => void onSendTestVerificationEmail()} disabled={sendingTestEmail}>
                {sendingTestEmail ? "Sending..." : "Send test verification email"}
              </Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem> : null}
      {activeSection === "Handoff" ? <section id="settings-handoff" className={`grid gap-4 ${frontDeskWorkspaceCardClass("subtle")} p-5 sm:grid-cols-2`}>
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Call handling</p>
          <h2 className="text-lg font-semibold">Business Info & Call Routing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set your timezone and choose what the receptionist should do after hours.
          </p>
        </div>
        <div className="sm:col-span-2 grid gap-3 sm:grid-cols-4">
          <div className={frontDeskContextPanelClass()}>
            <p className="page-eyebrow">Office coverage</p>
            <p className="mt-2 text-sm font-medium text-slate-950">{openDaysCount} open day{openDaysCount === 1 ? "" : "s"}</p>
          </div>
          <div className={frontDeskContextPanelClass()}>
            <p className="page-eyebrow">After-hours action</p>
            <p className="mt-2 text-sm font-medium text-slate-950">{formatAfterHoursMode(state.afterHoursMode)}</p>
          </div>
          <div className={frontDeskContextPanelClass()}>
            <p className="page-eyebrow">Transfer coverage</p>
            <p className="mt-2 text-sm font-medium text-slate-950">
              {transferNumberCount > 0 ? `${transferNumberCount} number${transferNumberCount === 1 ? "" : "s"}` : "Not configured"}
            </p>
          </div>
          <div className={frontDeskContextPanelClass()}>
            <p className="page-eyebrow">Human-first routing</p>
            <p className="mt-2 text-sm font-medium text-slate-950">
              {supportsHumanForwardingMode(state.voiceRoutingMode) ? "Enabled" : "Off"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {state.voiceForwardingEnabled && state.voiceForwardingNumber.trim()
                ? `${state.voiceForwardingNumber.trim()} • ${state.voiceRingTimeoutSeconds}s ring`
                : "Uses existing AI-first flow"}
            </p>
          </div>
        </div>
        <div>
          <Label>Timezone</Label>
          <select
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            value={state.timezone}
            onChange={(e) => setState((p) => ({ ...p, timezone: e.target.value }))}
          >
            {timezoneOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
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
        <div>
          <Label>Inbound voice mode</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            value={state.voiceRoutingMode}
            onChange={(e) =>
              setState((p) => ({
                ...p,
                voiceRoutingMode: e.target.value as FormState["voiceRoutingMode"]
              }))
            }
          >
            <option value="AI_FIRST">AI first</option>
            <option value="PASSIVE_FORWARDING">Passive forwarding</option>
            <option value="HUMAN_FIRST_AI_FALLBACK">Human first, AI fallback</option>
          </select>
        </div>
        <div>
          <Label>Forwarding ring timeout (seconds)</Label>
          <Input
            type="number"
            min={5}
            max={60}
            value={state.voiceRingTimeoutSeconds}
            onChange={(e) =>
              setState((p) => ({
                ...p,
                voiceRingTimeoutSeconds: Math.max(5, Math.min(60, Number(e.target.value || 20) || 20))
              }))
            }
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Human-first forwarding destination</Label>
          <div className="flex gap-3">
            <select
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={voiceForwardingDialCode}
              onChange={(e) =>
                setState((p) => ({
                  ...p,
                  voiceForwardingNumber: buildVoiceForwardingNumber(e.target.value, voiceForwardingLocalNumber)
                }))
              }
            >
              {voiceForwardingDialCodeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Input
              className="flex-1"
              inputMode="tel"
              placeholder="5165550123"
              value={voiceForwardingLocalNumber}
              onChange={(e) =>
                setState((p) => ({
                  ...p,
                  voiceForwardingNumber: buildVoiceForwardingNumber(voiceForwardingDialCode, e.target.value)
                }))
              }
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Used only when inbound mode is set to a human-first mode. This forwards the live call to your real office
            line and saves the full number in international format.
          </p>
        </div>
        <label className="flex items-start gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={state.voiceForwardingEnabled}
            onChange={(e) => setState((p) => ({ ...p, voiceForwardingEnabled: e.target.checked }))}
          />
          <span>
            <span className="font-medium text-slate-950">Enable human-first forwarding</span>
            <span className="mt-1 block text-muted-foreground">
              Twilio will answer first and bridge the call to your forwarding number before any fallback logic runs.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={state.voiceMediaStreamingEnabled}
            onChange={(e) => setState((p) => ({ ...p, voiceMediaStreamingEnabled: e.target.checked }))}
            disabled={!supportsHumanForwardingMode(state.voiceRoutingMode) || !state.voiceForwardingEnabled}
          />
          <span>
            <span className="font-medium text-slate-950">Enable real-time media streaming</span>
            <span className="mt-1 block text-muted-foreground">
              Forks the live call audio to Khan Automation while the call still forwards normally. No caller-facing AI is added in this mode.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={state.voiceTranscriptionEnabled}
            onChange={(e) => setState((p) => ({ ...p, voiceTranscriptionEnabled: e.target.checked }))}
            disabled={!supportsHumanForwardingMode(state.voiceRoutingMode) || !state.voiceForwardingEnabled || !state.voiceMediaStreamingEnabled}
          />
          <span>
            <span className="font-medium text-slate-950">Enable real-time transcription</span>
            <span className="mt-1 block text-muted-foreground">
              Adds live speech-to-text on top of the media stream for internal call intelligence. It never changes the caller
              experience or blocks forwarding.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={state.serviceRequestAutomationEnabled}
            onChange={(e) => setState((p) => ({ ...p, serviceRequestAutomationEnabled: e.target.checked }))}
          />
          <span>
            <span className="font-medium text-slate-950">Enable service-request automation</span>
            <span className="mt-1 block text-muted-foreground">
              Create an internal request record after call transcript finalization. This does not change live call handling.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={state.afterHoursVoiceFallbackEnabled}
            onChange={(e) => setState((p) => ({ ...p, afterHoursVoiceFallbackEnabled: e.target.checked }))}
          />
          <span>
            <span className="font-medium text-slate-950">Reserve after-hours fallback</span>
            <span className="mt-1 block text-muted-foreground">
              Saved now for later phases. It does not change live routing yet.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={state.voiceCallRecordingEnabled}
            onChange={(e) => setState((p) => ({ ...p, voiceCallRecordingEnabled: e.target.checked }))}
          />
          <span>
            <span className="font-medium text-slate-950">Reserve call recording</span>
            <span className="mt-1 block text-muted-foreground">
              Stores your preference now. Recording stays disabled in this passive-forwarding phase.
            </span>
          </span>
        </label>
      </section> : null}

      {activeSection === "Calendar" ? <AccordionItem id="settings-calendar" value="calendar" className={frontDeskWorkspaceCardClass("default") + " px-5"}>
        <AccordionTrigger className="py-5 text-base no-underline hover:no-underline">
          Calendar connections
        </AccordionTrigger>
        <AccordionContent className="pb-5">
      <section className="rounded-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Advanced</p>
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
                  showToast({
                    title: result.success ? "Calendar sync test succeeded" : "Calendar sync test failed",
                    description: result.message,
                    variant: result.success ? "success" : "error"
                  });
                  const refreshedAfter = await fetchCalendarProviders().catch(() => ({ providers: [] as CalendarConnection[] }));
                  setCalendarProviders(refreshedAfter.providers || []);
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
        {inactiveCalendarProviderCount > 0 && activeCalendarProviders.length === 0 ? (
          <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Calendar connection needs reconnection. A previous calendar connection exists but is inactive.
            Reconnect Google/Outlook, then run sync test.
          </div>
        ) : null}
        {activeCalendarProviders.length ? (
          <div className="mt-3 grid gap-2 rounded border p-3 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <Label>Primary booking connection</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedPrimaryConnectionId}
                onChange={(event) => setSelectedPrimaryConnectionId(event.target.value)}
                disabled={!canManageCalendar || !featureFlags.calendarOauthEnabled}
              >
                {activeCalendarProviders.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.provider} - {provider.accountEmail}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Calendar ID (optional)</Label>
              <Input
                value={selectedCalendarIdInput}
                onChange={(event) => setSelectedCalendarIdInput(event.target.value)}
                placeholder="primary"
                disabled={!canManageCalendar || !featureFlags.calendarOauthEnabled}
              />
            </div>
            <div className="self-end">
              <Button
                variant="outline"
                disabled={!selectedPrimaryConnectionId || !canManageCalendar || !featureFlags.calendarOauthEnabled || calendarBusy}
                onClick={() =>
                  void (async () => {
                    setCalendarBusy(true);
                    try {
                      const selected = activeCalendarProviders.find((row) => row.id === selectedPrimaryConnectionId);
                      const trimmed = selectedCalendarIdInput.trim();
                      const payload = {
                        connectionId: selectedPrimaryConnectionId,
                        ...(selected?.provider === "GOOGLE"
                          ? { selectedCalendarId: trimmed || "primary" }
                          : trimmed
                            ? { selectedCalendarId: trimmed }
                            : {})
                      };
                      const response = await selectPrimaryCalendar(payload);
                      setCalendarProviders((prev) =>
                        prev.map((row) =>
                          row.id === response.provider.id
                            ? { ...row, ...response.provider, isPrimary: true }
                            : { ...row, isPrimary: false }
                        )
                      );
                      showToast({ title: "Primary booking calendar updated" });
                    } catch (error) {
                      showToast({
                        title: "Could not update primary calendar",
                        description: error instanceof Error ? error.message : "Try again.",
                        variant: "error"
                      });
                    } finally {
                      setCalendarBusy(false);
                    }
                  })()
                }
              >
                Save primary
              </Button>
            </div>
          </div>
        ) : null}
        <div className="mt-3 space-y-2 text-sm">
          {activeCalendarProviders.length ? activeCalendarProviders.map((provider) => (
            <div key={provider.id} className="flex items-center justify-between rounded border p-2">
              <div>
                <p className="font-medium">{provider.provider} - {provider.accountEmail}</p>
                <p className="text-xs text-muted-foreground">
                  {provider.isActive ? "Active" : "Inactive"}{provider.isPrimary ? " - Primary" : ""} - Expires {new Date(provider.expiresAt).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Calendar ID: {provider.selectedCalendarId || "(provider default)"}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!canManageCalendar || !featureFlags.calendarOauthEnabled || calendarBusy}
                onClick={() =>
                  void (async () => {
                    setCalendarBusy(true);
                    try {
                      const result = await disconnectCalendar({
                        connectionId: provider.id,
                        provider: provider.provider as "GOOGLE" | "OUTLOOK",
                        accountEmail: provider.accountEmail
                      });
                      const refreshed = await fetchCalendarProviders().catch(() => ({ providers: [] as CalendarConnection[] }));
                      setCalendarProviders(refreshed.providers || []);
                      showToast({
                        title: result.disconnected > 0 ? "Calendar disconnected" : "No matching calendar connection",
                        description:
                          result.disconnected > 0
                            ? `${provider.provider} connection has been marked inactive.`
                            : "Nothing changed. Try refreshing and retrying disconnect."
                      });
                    } catch (error) {
                      showToast({
                        title: "Could not disconnect calendar",
                        description: error instanceof Error ? error.message : "Try again.",
                        variant: "error"
                      });
                    } finally {
                      setCalendarBusy(false);
                    }
                  })()
                }
              >
                Disconnect
              </Button>
            </div>
          )) : <p className="text-muted-foreground">No active calendar providers connected.</p>}
          {inactiveCalendarProviderCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {inactiveCalendarProviderCount} disconnected connection{inactiveCalendarProviderCount === 1 ? "" : "s"} hidden.
            </p>
          ) : null}
        </div>
      </section>
        </AccordionContent>
      </AccordionItem> : null}

      {activeSection === "Notifications" ? <AccordionItem id="settings-notifications" value="booking" className={frontDeskWorkspaceCardClass("default") + " px-5"}>
        <AccordionTrigger className="py-5 text-base no-underline hover:no-underline">
          Booking rules and alerts
        </AccordionTrigger>
        <AccordionContent className="pb-5">
      <section className="rounded-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Booking behavior</p>
        <h2 className="text-lg font-semibold">Booking Rules & Alerts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure scheduling windows, job value defaults, alert recipients, and classification policy.
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
        </AccordionContent>
      </AccordionItem> : null}

      {activeSection === "Notifications" ? <AccordionItem value="notifications" className={frontDeskWorkspaceCardClass("default") + " px-5"}>
        <AccordionTrigger className="py-5 text-base no-underline hover:no-underline">
          Notification inbox
        </AccordionTrigger>
        <AccordionContent className="pb-5">
      <section className="rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Advanced</p>
            <h2 className="text-lg font-semibold">Notification Inbox</h2>
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
            <p className="text-sm text-muted-foreground">
              No setup notifications yet. Calendar issues, booking fallbacks, and other assistant alerts will appear here when your office needs to review them.
            </p>
          ) : (
            notifications.slice(0, 20).map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-2 text-sm">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{getNotificationBody(item)}</p>
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
        </AccordionContent>
      </AccordionItem> : null}

      {activeSection === "Profile" ? <AccordionItem id="settings-profile" value="knowledge" className={frontDeskWorkspaceCardClass("default") + " px-5"}>
        <AccordionTrigger className="py-5 text-base no-underline hover:no-underline">
          Knowledge files
        </AccordionTrigger>
        <AccordionContent className="pb-5">
      <section className="rounded-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Knowledge</p>
        <h2 className="text-lg font-semibold">Knowledge Files</h2>
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
            <p className="text-sm text-muted-foreground">
              No knowledge files uploaded yet. Add service notes, FAQs, pricing rules, or policies here when you want the receptionist to answer with more business-specific context.
            </p>
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
        </AccordionContent>
      </AccordionItem> : null}

      {activeSection === "Operations" ? <AccordionItem id="settings-operations" value="business-hours" className={frontDeskWorkspaceCardClass("default") + " px-5"}>
        <AccordionTrigger className="py-5 text-base no-underline hover:no-underline">
          Business hours
        </AccordionTrigger>
        <AccordionContent className="pb-5">
      <section className="rounded-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Hours</p>
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
        </AccordionContent>
      </AccordionItem> : null}

      {activeSection === "Telephony" ? <AccordionItem id="settings-telephony" value="services" className={frontDeskWorkspaceCardClass("default") + " px-5"}>
        <AccordionTrigger className="py-5 text-base no-underline hover:no-underline">
          Services and routing
        </AccordionTrigger>
        <AccordionContent className="pb-5">
      <section className="grid gap-4 rounded-2xl bg-white sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Services & routing</p>
          <h2 className="text-lg font-semibold">Services, Transfers, and Contact Lists</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep service offerings, transfer numbers, and office notification contacts current.
          </p>
        </div>
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
        </AccordionContent>
      </AccordionItem> : null}

      {activeSection === "AI Identity" ? <AccordionItem id="settings-ai-identity" value="policies" className={frontDeskWorkspaceCardClass("default") + " px-5"}>
        <AccordionTrigger className="py-5 text-base no-underline hover:no-underline">
          Policies and answers
        </AccordionTrigger>
        <AccordionContent className="pb-5">
      <section className="grid gap-4 rounded-2xl bg-white sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Services & FAQs</p>
          <h2 className="text-lg font-semibold">Policies and Customer Answers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These notes help the receptionist answer common service, warranty, and cancellation questions.
          </p>
        </div>
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
        </AccordionContent>
      </AccordionItem> : null}

      {activeSection === "AI Identity" ? <AccordionItem value="sms" className={frontDeskWorkspaceCardClass("default") + " px-5"}>
        <AccordionTrigger className="py-5 text-base no-underline hover:no-underline">
          SMS follow-up
        </AccordionTrigger>
        <AccordionContent className="pb-5">
      <section className="rounded-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">SMS follow-up behavior</p>
        <h2 className="text-lg font-semibold">SMS Follow-Up</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize the core post-call texts your customers receive. `Reply STOP to unsubscribe.` is added automatically.
        </p>
        <Label className="mt-3">SMS First Message (sent on first inbound text)</Label>
        <Textarea
          placeholder="Thanks for texting {{businessName}}. Our team will ask a few quick questions to help you faster."
          value={state.smsWelcomeMessage}
          onChange={(e) => setState((p) => ({ ...p, smsWelcomeMessage: e.target.value }))}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Use <code>{"{{businessName}}"}</code> to insert your business name.
        </p>
        <div className="mt-4 grid gap-4">
          <div>
            <Label>Missed-call recovery template</Label>
            <Textarea
              placeholder="Sorry we missed your call. Tell us what you need and we'll get back shortly."
              value={state.smsMissedCallRecoveryTemplate}
              onChange={(e) => setState((p) => ({ ...p, smsMissedCallRecoveryTemplate: e.target.value }))}
            />
          </div>
          <div>
            <Label>New lead acknowledgement template</Label>
            <Textarea
              placeholder="Thanks {{customerName}} — {{businessName}} received your service request. A technician will follow up shortly."
              value={state.smsNewLeadAcknowledgementTemplate}
              onChange={(e) => setState((p) => ({ ...p, smsNewLeadAcknowledgementTemplate: e.target.value }))}
            />
          </div>
          <div>
            <Label>Appointment confirmation template</Label>
            <Textarea
              placeholder="Hi {{customerName}} — your service appointment is scheduled for {{appointmentTime}} with {{businessName}}."
              value={state.smsAppointmentConfirmationTemplate}
              onChange={(e) => setState((p) => ({ ...p, smsAppointmentConfirmationTemplate: e.target.value }))}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Available placeholders: <code>{"{{businessName}}"}</code>, <code>{"{{customerName}}"}</code>, <code>{"{{serviceAddress}}"}</code>, <code>{"{{appointmentTime}}"}</code>.
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
        </AccordionContent>
      </AccordionItem> : null}
      </Accordion>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save assistant settings"}
        </Button>
      </div>
          </div>
        </div>
      </section>
    </div>
  );
}

