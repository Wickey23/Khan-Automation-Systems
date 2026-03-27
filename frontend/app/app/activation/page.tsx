"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, PhoneCall, MessageSquare, Calendar, Activity, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CommandHeader } from "@/components/ops";
import { PageShell, SectionHeading, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/site/toast-provider";
import {
  fetchOrgOnboarding,
  fetchOrgCalls,
  fetchOrgMessages,
  fetchOrgProfile,
  fetchOrgSettings,
  updateOrgProfile,
  updateOrgSettings
} from "@/lib/api";
import type {
  AccessFeatureKey,
  AccessFeatureState,
  AccessReadinessCheck,
  AccessStatus,
  BusinessSettings,
  OnboardingSubmission,
  OrgCallRecord,
  OrgMessageThread,
  Organization,
  OrgAccessSummary
} from "@/lib/types";

type ActivationStep = {
  id: string;
  label: string;
  summary: string;
  description: string;
  status: AccessStatus;
  completionLabel: string;
  lockedReason?: string | null;
  ctaLabel: string;
  ctaHref: string;
};

type FeatureCard = {
  key: AccessFeatureKey;
  state: AccessFeatureState;
  readyDefinition: string;
  ctaLabel: string;
  ctaHref: string;
};

const STEP_ORDER = [
  { id: "businessProfile", label: "Business profile basics", readinessKey: null, ctaLabel: "Complete onboarding package", ctaHref: "/app/onboarding" },
  { id: "phoneRouting", label: "Telephony and phone routing", readinessKey: "phoneRouting", ctaLabel: "Configure telephony", ctaHref: "/app/settings#settings-telephony" },
  { id: "smsProvisioning", label: "SMS readiness", readinessKey: "smsProvisioning", ctaLabel: "Configure SMS settings", ctaHref: "/app/settings#settings-ai-identity" },
  { id: "transferRouting", label: "Transfer and contact routing", readinessKey: "transferRouting", ctaLabel: "Update transfer routing", ctaHref: "/app/settings#settings-telephony" },
  { id: "bookingSetup", label: "Booking and calendar readiness", readinessKey: "bookingSetup", ctaLabel: "Complete booking setup", ctaHref: "/app/settings#settings-calendar" },
  { id: "opsApproval", label: "Rollout and ops approval", readinessKey: "opsApproval", ctaLabel: "Review activation package", ctaHref: "/app/onboarding/preview" }
] as const;

const FEATURE_FLOW: Array<{
  key: AccessFeatureKey;
  readyDefinition: string;
  ctaLabel: string;
  ctaHref: string;
}> = [
  {
    key: "calls",
    readyDefinition: "Ready means call routing is active and the workspace can safely process inbound calls.",
    ctaLabel: "Open telephony settings",
    ctaHref: "/app/settings#settings-telephony"
  },
  {
    key: "sms",
    readyDefinition: "Ready means SMS consent, routing, and messaging controls are configured for live follow-up.",
    ctaLabel: "Open SMS setup",
    ctaHref: "/app/settings#settings-ai-identity"
  },
  {
    key: "appointments",
    readyDefinition: "Ready means booking method, lead-time, and calendar configuration are complete.",
    ctaLabel: "Open calendar setup",
    ctaHref: "/app/settings#settings-calendar"
  },
  {
    key: "outreach",
    readyDefinition: "Ready means outreach is enabled for the org and approved for monitored rollout.",
    ctaLabel: "Open outreach settings",
    ctaHref: "/app/settings#settings-handoff"
  }
];

const STATUS_PRIORITY: Record<AccessStatus, number> = {
  ready: 0,
  setup_required: 1,
  gated: 2,
  blocked: 3
};

const STEP_FEATURE_STATUS: Partial<Record<(typeof STEP_ORDER)[number]["id"], AccessFeatureKey>> = {
  phoneRouting: "calls",
  smsProvisioning: "sms",
  bookingSetup: "appointments",
  opsApproval: "outreach"
};

function pickHigherStatus(a: AccessStatus, b: AccessStatus) {
  return STATUS_PRIORITY[a] >= STATUS_PRIORITY[b] ? a : b;
}

function formatStatus(status: AccessStatus) {
  return status.replace(/_/g, " ");
}

function completionLabel(status: AccessStatus) {
  if (status === "ready") return "Completed";
  if (status === "blocked") return "Blocked";
  if (status === "gated") return "Gated";
  return "Incomplete";
}

function statusToCardVariant(status: AccessStatus): "empty" | "setup" | "locked" {
  if (status === "ready") return "empty";
  if (status === "setup_required") return "setup";
  return "locked";
}

function onboardingStatusToAccessStatus(status: OnboardingSubmission["status"] | "NONE"): AccessStatus {
  if (status === "APPROVED" || status === "REVIEWED" || status === "SUBMITTED") return "ready";
  return "setup_required";
}

function getReadinessMap(access: OrgAccessSummary | null) {
  const map = new Map<string, AccessReadinessCheck>();
  for (const check of access?.readinessChecklist || []) {
    map.set(check.key, check);
  }
  return map;
}

function fromJsonArray(value: string | null | undefined) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function toJsonLines(value: string) {
  return JSON.stringify(
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

function isStepLocked(status: AccessStatus) {
  return status === "blocked" || status === "gated";
}

function isCoreFeatureReady(access: OrgAccessSummary | null) {
  if (!access) return false;
  return ["calls", "sms", "appointments"].every((key) => access.features[key as AccessFeatureKey]?.status === "ready");
}

function firstSuccessLabel(type: Organization["firstSuccessType"]) {
  if (type === "call") return "First call handled";
  if (type === "sms") return "First message handled";
  if (type === "booking") return "First booking request detected";
  return "First real interaction";
}

export default function AppActivationPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [access, setAccess] = useState<OrgAccessSummary | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingSubmission["status"] | "NONE">("NONE");
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [profileName, setProfileName] = useState("");
  const [routingMode, setRoutingMode] = useState<BusinessSettings["voiceRoutingMode"]>("AI_FIRST");
  const [forwardingNumber, setForwardingNumber] = useState("");
  const [smsConsentText, setSmsConsentText] = useState("");
  const [transferNumbersText, setTransferNumbersText] = useState("");
  const [savingStepId, setSavingStepId] = useState<string | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [recentCalls, setRecentCalls] = useState<OrgCallRecord[]>([]);
  const [recentThreads, setRecentThreads] = useState<OrgMessageThread[]>([]);
  const [firstUseChecks, setFirstUseChecks] = useState({
    call: false,
    message: false,
    booking: false
  });

  const loadActivationData = useCallback(async () => {
    const [profile, onboarding, orgSettings] = await Promise.all([
      fetchOrgProfile(),
      fetchOrgOnboarding(),
      fetchOrgSettings()
    ]);
    setAccess(profile.access || null);
    setOrganization(profile.organization || null);
    setOnboardingStatus(onboarding.submission?.status || "NONE");
    setProfileName(profile.organization?.name || "");
    setRoutingMode((orgSettings.settings.voiceRoutingMode as BusinessSettings["voiceRoutingMode"]) || "AI_FIRST");
    setForwardingNumber(orgSettings.settings.voiceForwardingNumber || "");
    setSmsConsentText(orgSettings.settings.smsConsentText || "");
    setTransferNumbersText(fromJsonArray(orgSettings.settings.transferNumbersJson).join("\n"));
  }, []);

  useEffect(() => {
    let active = true;
    void loadActivationData()
      .then(() => {
        if (!active) return;
        setError(null);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to load activation data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadActivationData]);

  const featureCards = useMemo<FeatureCard[]>(() => {
    if (!access) return [];
    return FEATURE_FLOW.map((feature) => ({
      key: feature.key,
      state: access.features[feature.key],
      readyDefinition: feature.readyDefinition,
      ctaLabel: feature.ctaLabel,
      ctaHref: feature.ctaHref
    }));
  }, [access]);

  const steps = useMemo<ActivationStep[]>(() => {
    const readinessMap = getReadinessMap(access);
    const onboardingAccessStatus = onboardingStatusToAccessStatus(onboardingStatus);
    return STEP_ORDER.map((step) => {
      if (!step.readinessKey) {
        const status = onboardingAccessStatus;
        return {
          id: step.id,
          label: step.label,
          summary:
            onboardingStatus === "APPROVED" || onboardingStatus === "REVIEWED" || onboardingStatus === "SUBMITTED"
              ? "Setup package is submitted."
              : onboardingStatus === "NEEDS_CHANGES"
                ? "Setup package needs updates before approval."
                : "Setup package still needs to be completed.",
          description:
            onboardingStatus === "APPROVED"
              ? "Your organization package is approved and supports go-live review."
              : "Business profile and operating preferences must be documented before live activation.",
          status,
          completionLabel: completionLabel(status),
          lockedReason: status !== "ready" ? "Complete onboarding package before workspace activation." : null,
          ctaLabel: step.ctaLabel,
          ctaHref: step.ctaHref
        };
      }
      const check = readinessMap.get(step.readinessKey);
      const baseStatus = check?.status || "setup_required";
      const relatedFeature = STEP_FEATURE_STATUS[step.id];
      const featureStatus = relatedFeature ? access?.features[relatedFeature]?.status : undefined;
      const status = featureStatus ? pickHigherStatus(baseStatus, featureStatus) : baseStatus;
      return {
        id: step.id,
        label: step.label,
        summary: check?.description || "Configuration step needs review.",
        description: check?.detail || "Open the linked settings section and complete the required fields.",
        status,
        completionLabel: completionLabel(status),
        lockedReason:
          status === "blocked" || status === "gated"
            ? (relatedFeature ? access?.features[relatedFeature]?.reason : null) || check?.description || "This step is currently unavailable."
            : null,
        ctaLabel: step.ctaLabel,
        ctaHref: step.ctaHref
      };
    });
  }, [access, onboardingStatus]);

  const flowStatus = useMemo(() => {
    if (!access) return "setup_required" as AccessStatus;
    return steps.reduce<AccessStatus>((current, step) => pickHigherStatus(current, step.status), "ready");
  }, [access, steps]);

  const completedCount = useMemo(
    () => steps.filter((step) => step.status === "ready").length,
    [steps]
  );

  const remainingCount = useMemo(
    () => steps.length - completedCount,
    [steps.length, completedCount]
  );

  const progressPercent = useMemo(() => {
    if (!steps.length) return 0;
    return Math.round((completedCount / steps.length) * 100);
  }, [completedCount, steps.length]);

  const blockedCount = useMemo(
    () => steps.filter((step) => step.status === "blocked").length,
    [steps]
  );

  const gatedCount = useMemo(
    () => steps.filter((step) => step.status === "gated").length,
    [steps]
  );

  const setupRequiredCount = useMemo(
    () => steps.filter((step) => step.status === "setup_required").length,
    [steps]
  );
  const nextSetupSteps = useMemo(
    () =>
      steps
        .filter((step) => step.status !== "ready")
        .sort((a, b) => STATUS_PRIORITY[b.status] - STATUS_PRIORITY[a.status])
        .slice(0, 3),
    [steps]
  );
  const primaryNextStep = useMemo(() => nextSetupSteps[0] || null, [nextSetupSteps]);

  const isWorkspaceReady = flowStatus === "ready" && remainingCount === 0;
  const workspaceLive = isWorkspaceReady && isCoreFeatureReady(access);
  const confidenceSignals = useMemo(() => {
    if (!access) return [];
    const checks = new Map(access.readinessChecklist.map((check) => [check.key, check]));
    return [
      {
        label: "System listening",
        detail: checks.get("phoneRouting")?.status === "ready" ? "Inbound calls will be handled." : "Phone routing setup is still required.",
        status: checks.get("phoneRouting")?.status || "setup_required"
      },
      {
        label: "SMS automation",
        detail: access.features.sms.status === "ready" ? "SMS follow-up is active." : access.features.sms.reason,
        status: access.features.sms.status
      },
      {
        label: "Booking pipeline",
        detail: access.features.appointments.status === "ready" ? "Booking workflow is operational." : access.features.appointments.reason,
        status: access.features.appointments.status
      }
    ];
  }, [access]);

  const loadFirstUseSignals = useCallback(async () => {
    setActivityLoading(true);
    try {
      const [callsPayload, messagesPayload, profile] = await Promise.all([
        fetchOrgCalls({ page: 1, pageSize: 15 }),
        fetchOrgMessages(),
        fetchOrgProfile()
      ]);
      setRecentCalls(callsPayload.calls || []);
      setRecentThreads(messagesPayload.threads || []);
      setOrganization(profile.organization || null);
      setAccess(profile.access || null);
    } catch {
      setRecentCalls([]);
      setRecentThreads([]);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!workspaceLive) return;
    void loadFirstUseSignals();
  }, [workspaceLive, loadFirstUseSignals]);

  const firstUseSignals = useMemo(() => {
    const now = Date.now();
    const activityWindowMs = 24 * 60 * 60 * 1000;
    const hasRecentCall = recentCalls.some((call) => {
      const ts = new Date(call.startedAt).getTime();
      return Number.isFinite(ts) && now - ts <= activityWindowMs;
    });
    const hasRecentMessage = recentThreads.some((thread) => {
      const ts = new Date(thread.lastMessageAt).getTime();
      return Number.isFinite(ts) && now - ts <= activityWindowMs;
    });
    const hasBookingSignal = recentCalls.some((call) => Boolean(call.appointmentRequestId || call.appointmentRequested));

    return {
      call: hasRecentCall,
      message: hasRecentMessage,
      booking: hasBookingSignal
    };
  }, [recentCalls, recentThreads]);

  const firstUseDone = useMemo(() => {
    return {
      call: firstUseChecks.call || firstUseSignals.call,
      message: firstUseChecks.message || firstUseSignals.message,
      booking: firstUseChecks.booking || firstUseSignals.booking
    };
  }, [firstUseChecks, firstUseSignals]);

  const firstUseCompletedCount = useMemo(
    () => Object.values(firstUseDone).filter(Boolean).length,
    [firstUseDone]
  );

  const firstInteractionDetected = firstUseSignals.call || firstUseSignals.message || firstUseSignals.booking;
  const firstSuccessAt = useMemo(() => {
    if (!organization?.firstSuccessAt) return null;
    const parsed = new Date(organization.firstSuccessAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [organization?.firstSuccessAt]);
  const hasFirstSuccessMilestone = Boolean(firstSuccessAt && organization?.firstSuccessType);
  const firstSuccessTimestampLabel = useMemo(
    () => (firstSuccessAt ? firstSuccessAt.toLocaleString() : null),
    [firstSuccessAt]
  );

  async function handleInlineAction(stepId: string) {
    if (savingStepId) return;
    setSavingStepId(stepId);
    try {
      if (stepId === "businessProfile") {
        const nextName = profileName.trim();
        if (!nextName) {
          showToast({
            title: "Business name required",
            description: "Enter your workspace business name before confirming.",
            variant: "error"
          });
          return;
        }
        await updateOrgProfile({ name: nextName });
      } else if (stepId === "phoneRouting") {
        if (!forwardingNumber.trim()) {
          showToast({
            title: "Forwarding number required",
            description: "Add a forwarding number to confirm phone routing readiness.",
            variant: "error"
          });
          return;
        }
        await updateOrgSettings({
          voiceRoutingMode: routingMode || "AI_FIRST",
          voiceForwardingEnabled: true,
          voiceForwardingNumber: forwardingNumber.trim()
        });
      } else if (stepId === "smsProvisioning") {
        if (!smsConsentText.trim()) {
          showToast({
            title: "SMS consent text required",
            description: "Provide SMS consent copy before enabling messaging readiness.",
            variant: "error"
          });
          return;
        }
        await updateOrgSettings({
          smsConsentText: smsConsentText.trim()
        });
      } else if (stepId === "transferRouting") {
        const transferRows = transferNumbersText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        if (!transferRows.length) {
          showToast({
            title: "Transfer routing required",
            description: "Add at least one transfer number to complete routing defaults.",
            variant: "error"
          });
          return;
        }
        await updateOrgSettings({
          transferNumbersJson: toJsonLines(transferNumbersText)
        });
      }
      await loadActivationData();
      showToast({ title: "Activation step updated" });
    } catch (actionError) {
      showToast({
        title: "Unable to update step",
        description: actionError instanceof Error ? actionError.message : "Request failed.",
        variant: "error"
      });
    } finally {
      setSavingStepId(null);
    }
  }

  function renderInlineAction(step: ActivationStep) {
    if (isStepLocked(step.status)) {
      return (
        <StateCard
          variant="locked"
          title={`${step.completionLabel}: ${step.label}`}
          description={step.lockedReason || "This step is not editable until gating requirements are resolved."}
        />
      );
    }
    if (step.id === "businessProfile") {
      return (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Inline confirm</p>
          <Input
            value={profileName}
            onChange={(event) => setProfileName(event.target.value)}
            placeholder="Business name"
          />
          <Button size="sm" variant="outline" onClick={() => void handleInlineAction(step.id)} disabled={savingStepId === step.id}>
            {savingStepId === step.id ? "Saving..." : "Confirm business info"}
          </Button>
        </div>
      );
    }
    if (step.id === "phoneRouting") {
      return (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Inline routing setup</p>
          <select
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            value={routingMode || "AI_FIRST"}
            onChange={(event) => setRoutingMode(event.target.value as BusinessSettings["voiceRoutingMode"])}
          >
            <option value="AI_FIRST">AI first</option>
            <option value="PASSIVE_FORWARDING">Passive forwarding</option>
            <option value="HUMAN_FIRST_AI_FALLBACK">Human first, AI fallback</option>
          </select>
          <Input
            value={forwardingNumber}
            onChange={(event) => setForwardingNumber(event.target.value)}
            placeholder="+1..."
          />
          <Button size="sm" variant="outline" onClick={() => void handleInlineAction(step.id)} disabled={savingStepId === step.id}>
            {savingStepId === step.id ? "Saving..." : "Confirm phone routing"}
          </Button>
        </div>
      );
    }
    if (step.id === "smsProvisioning") {
      return (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Inline SMS setup</p>
          <Textarea
            value={smsConsentText}
            onChange={(event) => setSmsConsentText(event.target.value)}
            placeholder="By texting us, you agree to receive service-related SMS messages..."
          />
          <Button size="sm" variant="outline" onClick={() => void handleInlineAction(step.id)} disabled={savingStepId === step.id}>
            {savingStepId === step.id ? "Saving..." : "Save SMS consent"}
          </Button>
        </div>
      );
    }
    if (step.id === "transferRouting") {
      return (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Inline transfer defaults</p>
          <Textarea
            value={transferNumbersText}
            onChange={(event) => setTransferNumbersText(event.target.value)}
            placeholder="+1... one number per line"
          />
          <Button size="sm" variant="outline" onClick={() => void handleInlineAction(step.id)} disabled={savingStepId === step.id}>
            {savingStepId === step.id ? "Saving..." : "Save transfer routing"}
          </Button>
        </div>
      );
    }
    return null;
  }

  if (loading) {
    return (
      <PageShell className="space-y-5">
        <SectionShell className="surface-panel">
          <StateCard
            variant="loading"
            title="Loading activation flow"
            description="Checking readiness, plan status, and onboarding progress."
          />
        </SectionShell>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell className="space-y-5">
        <SectionShell className="surface-panel">
          <StateCard
            variant="error"
            title="Unable to load activation flow"
            description={error}
            action={
              <Link href="/app/settings">
                <Button variant="outline">Open settings</Button>
              </Link>
            }
          />
        </SectionShell>
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-4">
      <CommandHeader
        eyebrow="Guided activation"
        title={organization?.name ? `${organization.name} activation` : "Activation board"}
        description="Complete remaining readiness steps in order and unblock live operations."
        actions={
          primaryNextStep ? (
            <Link href={primaryNextStep.ctaHref}>
              <Button>{primaryNextStep.ctaLabel}</Button>
            </Link>
          ) : (
            <Link href="/app/onboarding">
              <Button variant="outline">Edit onboarding package</Button>
            </Link>
          )
        }
      />

      <SectionShell className="surface-panel space-y-4 border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Activation progress</p>
            <p className="mt-1 text-sm text-slate-600">
              {completedCount} of {steps.length} steps complete. {remainingCount} remaining.
            </p>
          </div>
          <StatusBadge kind="feature" state={flowStatus} label={formatStatus(flowStatus)} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{progressPercent}% complete</span>
            <span>{completedCount}/{steps.length} steps</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Incomplete</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{setupRequiredCount} step(s)</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Blocked</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{blockedCount} step(s)</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Gated</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{gatedCount} step(s)</p>
          </div>
        </div>
        <StateCard
          variant={statusToCardVariant(flowStatus)}
          title={workspaceLive ? "Your system is live" : "Activation still in progress"}
          description={
            workspaceLive
              ? "Calls, messaging, and booking are now operational."
              : blockedCount > 0
                ? "Resolve billing/plan blockers first, then continue setup."
                : gatedCount > 0
                  ? "Core setup is progressing. Ops-gated steps remain before full rollout."
                  : `Finish ${remainingCount} remaining step${remainingCount === 1 ? "" : "s"} to go live safely.`
          }
        />
        {!workspaceLive ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Next steps</p>
            <div className="mt-2 space-y-2">
              {nextSetupSteps.length ? (
                nextSetupSteps.map((step) => (
                  <Link key={step.id} href={step.ctaHref} className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition hover:bg-slate-100">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                      <StatusBadge kind="feature" state={step.status} size="xs" label={step.completionLabel} />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{step.summary}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-700">{step.ctaLabel}</p>
                  </Link>
                ))
              ) : (
                <p className="text-xs text-slate-600">No setup actions required.</p>
              )}
            </div>
          </div>
        ) : null}
      </SectionShell>

      <SectionShell className="surface-panel space-y-3 border border-slate-200 bg-white">
        <SectionHeading
          title={workspaceLive ? "Go-live confidence" : "Go-live readiness"}
          description={
            workspaceLive
              ? "Your workspace is in live mode with core receptionist workflows enabled."
              : "These signals show what is working now and what still needs attention before live mode."
          }
        />
        <div className="grid gap-3 lg:grid-cols-3">
          {confidenceSignals.map((signal) => (
            <div key={signal.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{signal.label}</p>
                <StatusBadge kind="feature" state={signal.status} size="xs" />
              </div>
              <p className="mt-2 text-sm text-slate-700">{signal.detail}</p>
            </div>
          ))}
        </div>
        {workspaceLive ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
              <p className="text-sm font-semibold">Workspace live</p>
            </div>
            <p className="mt-1 text-sm text-emerald-700">
              Calls, messaging, and booking are operational. Use the actions below to transition from setup into daily operations.
            </p>
            {hasFirstSuccessMilestone ? (
              <div className="mt-3 rounded-xl border border-emerald-300 bg-white/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-emerald-800">Your system handled its first real interaction</p>
                  <StatusBadge kind="feature" state="ready" size="xs" label="Proven live" />
                </div>
                <p className="mt-1 text-sm text-emerald-700">
                  {firstSuccessLabel(organization?.firstSuccessType)}
                  {firstSuccessTimestampLabel ? ` - ${firstSuccessTimestampLabel}` : ""}
                </p>
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/app/calls">
                <Button size="sm"><PhoneCall className="mr-1.5 h-4 w-4" />View live calls</Button>
              </Link>
              <Link href="/app/messages">
                <Button size="sm" variant="outline"><MessageSquare className="mr-1.5 h-4 w-4" />Open messages</Button>
              </Link>
              <Link href="/app/appointments">
                <Button size="sm" variant="outline"><Calendar className="mr-1.5 h-4 w-4" />Open appointments</Button>
              </Link>
              <Link href="/app">
                <Button size="sm" variant="outline"><Activity className="mr-1.5 h-4 w-4" />Monitor activity</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">
              {remainingCount > 0 ? `${remainingCount} step${remainingCount === 1 ? "" : "s"} remaining.` : "Final checks pending."} Complete activation to mark the workspace as live.
            </p>
          </div>
        )}
      </SectionShell>

      {workspaceLive ? (
        <SectionShell className="surface-panel space-y-3 border border-slate-200 bg-white">
          <SectionHeading
            title="Test your system"
            description="Run these first-use checks to confirm live calls, messaging, and booking behavior in production."
            actions={
              <Button size="sm" variant="outline" onClick={() => void loadFirstUseSignals()} disabled={activityLoading}>
                <RefreshCw className={`mr-1.5 h-4 w-4 ${activityLoading ? "animate-spin" : ""}`} />
                {activityLoading ? "Checking..." : "Refresh activity"}
              </Button>
            }
          />
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Step 1: Call your number</p>
                <StatusBadge kind="feature" state={firstUseDone.call ? "ready" : "setup_required"} size="xs" />
              </div>
              <p className="text-sm text-slate-600">Place a real call to your business number and confirm it appears in the Calls queue.</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/app/calls">
                  <Button size="sm"><PhoneCall className="mr-1.5 h-4 w-4" />Open calls</Button>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFirstUseChecks((current) => ({ ...current, call: !current.call }))}
                >
                  {firstUseChecks.call ? "Unmark tested" : "Mark tested"}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Step 2: Send a test message</p>
                <StatusBadge kind="feature" state={firstUseDone.message ? "ready" : "setup_required"} size="xs" />
              </div>
              <p className="text-sm text-slate-600">Send an SMS to your assigned number and verify the thread appears in Messages.</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/app/messages">
                  <Button size="sm"><MessageSquare className="mr-1.5 h-4 w-4" />Open messages</Button>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFirstUseChecks((current) => ({ ...current, message: !current.message }))}
                >
                  {firstUseChecks.message ? "Unmark tested" : "Mark tested"}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Step 3: Ask for an appointment</p>
                <StatusBadge kind="feature" state={firstUseDone.booking ? "ready" : "setup_required"} size="xs" />
              </div>
              <p className="text-sm text-slate-600">During a test call, request an appointment and confirm booking flow appears in Appointments.</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/app/appointments">
                  <Button size="sm"><Calendar className="mr-1.5 h-4 w-4" />Open appointments</Button>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFirstUseChecks((current) => ({ ...current, booking: !current.booking }))}
                >
                  {firstUseChecks.booking ? "Unmark tested" : "Mark tested"}
                </Button>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm text-slate-700">
              {firstUseCompletedCount}/3 first-use checks complete.
              {" "}
              {hasFirstSuccessMilestone
                ? "First success milestone captured from a real interaction."
                : firstInteractionDetected
                  ? "Recent activity detected. Your system has already handled a real interaction."
                  : "No recent interaction detected yet. Run one test call or SMS to validate live behavior."}
            </p>
            {hasFirstSuccessMilestone ? (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                <Sparkles className="h-3 w-3" />
                {firstSuccessLabel(organization?.firstSuccessType)}
              </div>
            ) : null}
            {firstUseCompletedCount >= 1 ? (
              <p className="mt-1 text-sm text-emerald-700">You are fully operational. Continue monitoring from Calls and Messages.</p>
            ) : null}
          </div>
        </SectionShell>
      ) : null}

      <SectionShell className="surface-panel space-y-3 border border-slate-200 bg-white">
        <SectionHeading
          title="Ordered activation path"
          description="Each step maps directly to your readiness model and points to the correct configuration surface."
        />
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={step.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Step {index + 1}
                  </p>
                  <h3 className="text-base font-semibold text-slate-900">{step.label}</h3>
                  <p className="text-sm text-slate-600">{step.summary}</p>
                  <p className="text-xs text-slate-500">{step.description}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge kind="feature" state={step.status} label={formatStatus(step.status)} size="xs" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{step.completionLabel}</p>
                  <Link href={step.ctaHref}>
                    <Button size="sm" variant={step.status === "ready" ? "outline" : "default"}>
                      {step.ctaLabel}
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
              {renderInlineAction(step)}
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell className="surface-panel space-y-3 border border-slate-200 bg-white">
        <SectionHeading
          title="Feature readiness definitions"
          description="Availability here reflects real plan, org enablement, and setup readiness checks."
        />
        <div className="grid gap-3 lg:grid-cols-2">
          {featureCards.map((item) => (
            <div key={item.key} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{item.state.label}</p>
                  <p className="text-sm text-slate-700">{item.state.reason}</p>
                </div>
                <StatusBadge kind="feature" state={item.state.status} label={formatStatus(item.state.status)} size="xs" />
              </div>
              <p className="text-xs text-slate-500">{item.readyDefinition}</p>
              {item.state.status !== "ready" ? (
                <Link href={item.ctaHref}>
                  <Button size="sm" variant="outline">{item.ctaLabel}</Button>
                </Link>
              ) : (
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Active and usable
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell className="surface-panel border border-slate-200 bg-slate-50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Rollout checkpoint</p>
            <p className="text-sm text-slate-600">
              When all steps are ready, ops approval and live activation can proceed without hidden blockers.
            </p>
          </div>
          <Link href="/app/onboarding/preview">
            <Button>
              <Clock3 className="mr-2 h-4 w-4" />
              Review activation package
            </Button>
          </Link>
        </div>
      </SectionShell>
    </PageShell>
  );
}



