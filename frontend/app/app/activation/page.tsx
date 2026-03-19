"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, SectionHeading, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { fetchOrgOnboarding, fetchOrgProfile } from "@/lib/api";
import type {
  AccessFeatureKey,
  AccessFeatureState,
  AccessReadinessCheck,
  AccessStatus,
  OnboardingSubmission,
  OrgAccessSummary
} from "@/lib/types";

type ActivationStep = {
  id: string;
  label: string;
  summary: string;
  description: string;
  status: AccessStatus;
  completionLabel: string;
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

export default function AppActivationPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [access, setAccess] = useState<OrgAccessSummary | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingSubmission["status"] | "NONE">("NONE");

  useEffect(() => {
    let active = true;
    void Promise.all([fetchOrgProfile(), fetchOrgOnboarding()])
      .then(([profile, onboarding]) => {
        if (!active) return;
        setAccess(profile.access || null);
        setOnboardingStatus(onboarding.submission?.status || "NONE");
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
  }, []);

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

  const isWorkspaceReady = flowStatus === "ready" && remainingCount === 0;

  if (loading) {
    return (
      <PageShell className="space-y-6">
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
      <PageShell className="space-y-6">
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
    <PageShell className="space-y-6">
      <PageHeader
        eyebrow="Guided activation"
        title="Activation control center"
        description="Follow this sequence to move your workspace from setup to safe production readiness."
        actions={
          <Link href="/app/onboarding">
            <Button variant="outline">Edit onboarding package</Button>
          </Link>
        }
      />

      <SectionShell className="surface-panel space-y-5">
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
        <div className="grid gap-3 sm:grid-cols-3">
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
          title={isWorkspaceReady ? "Workspace is activation-ready" : "Activation still in progress"}
          description={
            isWorkspaceReady
              ? "Core receptionist workflows are configured, gated checks are cleared, and rollout can continue safely."
              : blockedCount > 0
                ? "Resolve billing/plan blockers first, then continue setup."
                : gatedCount > 0
                  ? "Core setup is progressing. Ops-gated steps remain before full rollout."
                  : `Finish ${remainingCount} remaining step${remainingCount === 1 ? "" : "s"} to go live safely.`
          }
        />
      </SectionShell>

      <SectionShell className="surface-panel space-y-4">
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
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell className="surface-panel space-y-4">
        <SectionHeading
          title="Feature readiness definitions"
          description="Availability here reflects real plan, org enablement, and setup readiness checks."
        />
        <div className="grid gap-3 md:grid-cols-2">
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

      <SectionShell className="surface-panel">
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
