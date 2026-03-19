import type { Organization, PrismaClient } from "@prisma/client";
import { env } from "../../config/env";
import { hasProMessaging, isActiveSubscriptionStatus } from "../billing/plan-features";
import { isFeatureEnabledForOrg } from "./feature-gates";

export type AccessFeatureKey = "calls" | "sms" | "appointments" | "outreach";
export type AccessStatus = "ready" | "setup_required" | "gated" | "blocked";

export interface AccessFeatureState {
  key: AccessFeatureKey;
  label: string;
  status: AccessStatus;
  reason: string;
  allowedByPlan: boolean;
  enabledByOrg: boolean;
}

export interface AccessReadinessCheck {
  key: string;
  label: string;
  description: string;
  detail?: string;
  status: AccessStatus;
}

export interface OrgAccessSummary {
  plan: {
    name: "NONE" | "STARTER" | "PRO";
    active: boolean;
  };
  features: Record<AccessFeatureKey, AccessFeatureState>;
  readinessChecklist: AccessReadinessCheck[];
}

const PLAN_NAME_NORMALIZER = (value?: string | null): "NONE" | "STARTER" | "PRO" => {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "PRO") return "PRO";
  if (normalized === "STARTER") return "STARTER";
  return "NONE";
};

export async function buildOrgAccessSummary(input: {
  prisma: PrismaClient;
  orgId: string;
  organization: Organization;
  activePhone?: { e164Number?: string | null } | null;
}): Promise<OrgAccessSummary> {
  const { prisma, orgId, organization } = input;
  const [settings, subscription, onboarding] = await Promise.all([
    prisma.businessSettings.findUnique({ where: { orgId } }),
    prisma.subscription.findFirst({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: { plan: true, status: true }
    }),
    prisma.onboardingSubmission.findFirst({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: { status: true }
    })
  ]);
  const activePhone = input.activePhone ?? (await prisma.phoneNumber.findFirst({
    where: { orgId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { e164Number: true }
  }));

  const planName = PLAN_NAME_NORMALIZER(subscription?.plan);
  const planActive = isActiveSubscriptionStatus(subscription?.status);
  const messagingReady = await hasProMessaging(prisma, orgId);
  const phoneReady = Boolean(activePhone?.e164Number);
  const phoneRoutingConfigured =
    phoneReady && Boolean(settings?.voiceForwardingNumber?.trim()) && Boolean(settings?.voiceRoutingMode);
  const smsConfigReady = phoneRoutingConfigured && Boolean(settings?.smsConsentText?.trim());
  const bookingMethod = (settings as { bookingMethod?: string | null })?.bookingMethod || null;
  const bookingConfigured = Boolean(bookingMethod) && settings?.bookingLeadTimeHours != null;
  const transferConfigured = Boolean(settings?.transferNumbersJson);
  let transferCount = 0;
  if (settings?.transferNumbersJson) {
    try {
      const parsed = JSON.parse(settings.transferNumbersJson);
      transferCount = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      transferCount = 0;
    }
  }
  const onboardingStatus = onboarding?.status || null;
  const onboardingComplete = onboardingStatus === "SUBMITTED" || onboardingStatus === "REVIEWED" || onboardingStatus === "APPROVED";
  const opsReady = organization.status === "LIVE" || organization.status === "TESTING";
  const opsApproved = opsReady && onboardingComplete;

  const readinessChecklist: AccessReadinessCheck[] = [
    {
      key: "phoneRouting",
      label: "Phone routing",
      description: phoneRoutingConfigured
        ? "Calls route through your forwarding number."
        : "Assign a phone number and configure how calls route to your office.",
      detail: phoneRoutingConfigured ? `Mode: ${settings?.voiceRoutingMode || "unknown"}` : undefined,
      status: phoneRoutingConfigured ? "ready" : "setup_required"
    },
    {
      key: "smsProvisioning",
      label: "SMS provisioning",
      description: smsConfigReady
        ? "Consent text and routing are configured."
        : "Add SMS consent copy and ensure phone routing is live before sending texts.",
      detail: settings?.smsConsentText ? "Consent text saved" : "Consent text missing",
      status: smsConfigReady ? "ready" : "setup_required"
    },
    {
      key: "bookingSetup",
      label: "Booking readiness",
      description: bookingConfigured
        ? "Lead capture, buffer, and duration rules are set."
        : "Complete the booking settings (method and lead time) to unlock appointments.",
      detail: bookingMethod ? `Method: ${bookingMethod}` : "Method undefined",
      status: bookingConfigured ? "ready" : "setup_required"
    },
    {
      key: "transferRouting",
      label: "Transfer routing",
      description: transferConfigured
        ? "Transfer lists and notifications exist."
        : "Add transfer numbers or notification contacts to complete handoff behavior.",
      detail: transferConfigured ? `${transferCount} transfer entries` : undefined,
      status: transferConfigured ? "ready" : "setup_required"
    },
    {
      key: "opsApproval",
      label: "Ops readiness",
      description: opsApproved
        ? "Workspace approved for live automation."
        : "Complete onboarding and update the workspace status for live access.",
      detail: onboardingStatus ? `Onboarding: ${onboardingStatus}` : "Onboarding not started",
      status: opsApproved ? "ready" : "setup_required"
    }
  ];

  const appointmentFeatureGate = isFeatureEnabledForOrg(env.FEATURE_APPOINTMENTS_ENABLED, orgId);
  const notificationsFeatureGate = isFeatureEnabledForOrg(env.FEATURE_NOTIFICATIONS_V1_ENABLED, orgId);
  const outreachGate = isFeatureEnabledForOrg(env.FEATURE_OUTREACH_ENABLED, orgId, env.FEATURE_PHASE1_ORG_ALLOWLIST);

  const featureState = (key: AccessFeatureKey, config: { allowedByPlan: boolean; enabledByOrg: boolean; reason: string; status: AccessStatus }): AccessFeatureState => ({
    key,
    label:
      key === "calls"
        ? "Call handling"
        : key === "sms"
          ? "SMS automation"
          : key === "appointments"
            ? "Appointments"
            : "Outreach",
    status: config.status,
    reason: config.reason,
    allowedByPlan: config.allowedByPlan,
    enabledByOrg: config.enabledByOrg
  });

  const callsStatus: AccessStatus = !planActive ? "blocked" : !phoneRoutingConfigured ? "setup_required" : "ready";
  const smsStatus: AccessStatus = !planActive
    ? "blocked"
    : !notificationsFeatureGate
      ? "gated"
      : !messagingReady
        ? "blocked"
        : !smsConfigReady
          ? "setup_required"
          : "ready";
  const appointmentsStatus: AccessStatus = !planActive
    ? "blocked"
    : !appointmentFeatureGate
      ? "gated"
      : !bookingConfigured
        ? "setup_required"
        : "ready";
  const outreachStatus: AccessStatus = !planActive
    ? "blocked"
    : !outreachGate
      ? "gated"
      : !phoneRoutingConfigured
        ? "setup_required"
        : !opsApproved
          ? "gated"
          : "ready";

  const access: OrgAccessSummary = {
    plan: {
      name: planName,
      active: planActive
    },
    features: {
      calls: featureState("calls", {
        allowedByPlan: planActive,
        enabledByOrg: phoneRoutingConfigured,
        reason:
          callsStatus === "ready"
            ? "Call handling is operational."
            : callsStatus === "setup_required"
              ? "Routing configuration missing."
              : "Activate billing to unlock call handling.",
        status: callsStatus
      }),
      sms: featureState("sms", {
        allowedByPlan: messagingReady,
        enabledByOrg: smsConfigReady,
        reason:
          smsStatus === "ready"
            ? "SMS automation is live."
            : smsStatus === "gated"
              ? "Messaging automation gates require notifications feature."
              : smsStatus === "blocked"
                ? "Upgrade to Pro with active billing."
                : "Configure SMS consent copy.",
        status: smsStatus
      }),
      appointments: featureState("appointments", {
        allowedByPlan: appointmentFeatureGate && planActive,
        enabledByOrg: bookingConfigured,
        reason:
          appointmentsStatus === "ready"
            ? "Appointments is ready."
            : appointmentsStatus === "gated"
              ? "Appointments feature is gated for this org."
              : appointmentsStatus === "blocked"
                ? "Activate billing to unlock appointments."
                : "Complete booking rules.",
        status: appointmentsStatus
      }),
      outreach: featureState("outreach", {
        allowedByPlan: planActive,
        enabledByOrg: phoneRoutingConfigured && opsApproved,
        reason:
          outreachStatus === "ready"
            ? "Outreach is part of your monitored release."
            : outreachStatus === "gated"
              ? "Outreach is under ops-monitored rollout."
              : outreachStatus === "blocked"
                ? "Activate billing to unlock Outreach."
                : "Configure routing before Outreach.",
        status: outreachStatus
      })
    },
    readinessChecklist
  };

  return access;
}
