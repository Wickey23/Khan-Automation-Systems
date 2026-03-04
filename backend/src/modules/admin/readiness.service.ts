import type { Organization, PrismaClient } from "@prisma/client";
import { getTestPassSummary } from "./testing.service";

export type ReadinessCheck = {
  ok: boolean;
  reason: string;
  fixHint: string;
};

export type ReadinessReport = {
  checks: {
    billingActive: ReadinessCheck;
    onboardingSubmitted: ReadinessCheck;
    onboardingApproved: ReadinessCheck;
    businessSettingsValid: ReadinessCheck;
    providerLineAssigned: ReadinessCheck;
    toolSecretConfigured: ReadinessCheck;
    webhooksVerified: ReadinessCheck;
    notificationsVerified: ReadinessCheck;
    testCallsPassed: ReadinessCheck;
  };
  canGoLive: boolean;
};

type ChecklistMap = Map<string, string>;

function parseChecklist(stepsJson: string | null | undefined): ChecklistMap {
  const map = new Map<string, string>();
  if (!stepsJson) return map;
  try {
    const parsed = JSON.parse(stepsJson) as Array<{ key?: string; status?: string }>;
    for (const step of parsed) {
      if (!step?.key) continue;
      map.set(step.key, String(step.status || "TODO"));
    }
  } catch {
    return map;
  }
  return map;
}

function checkFromChecklist(map: ChecklistMap, key: string, label: string, fixHint: string): ReadinessCheck {
  const status = map.get(key) || "TODO";
  if (status === "DONE") {
    return { ok: true, reason: `${label} completed`, fixHint };
  }
  return { ok: false, reason: `${label} not completed`, fixHint };
}

function normalizeArrayString(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeObjectString(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function computeReadinessReport(input: {
  prisma: PrismaClient;
  org: Organization;
  env: { VAPI_TOOL_SECRET?: string };
}): Promise<ReadinessReport> {
  let safeSettings:
    | Awaited<ReturnType<PrismaClient["businessSettings"]["findUnique"]>>
    | null = null;
  try {
    safeSettings = await input.prisma.businessSettings.findUnique({ where: { orgId: input.org.id } });
  } catch {
    // Graceful degradation for transient schema drift during rollout.
    safeSettings = null;
  }

  const [subscription, onboarding, settings, phone, ai, checklistRow] = await Promise.all([
    input.prisma.subscription.findFirst({
      where: { orgId: input.org.id },
      orderBy: { createdAt: "desc" }
    }),
    input.prisma.onboardingSubmission.findUnique({ where: { orgId: input.org.id } }),
    Promise.resolve(safeSettings),
    input.prisma.phoneNumber.findFirst({
      where: { orgId: input.org.id, status: "ACTIVE" }
    }),
    input.prisma.aiAgentConfig.findFirst({
      where: { orgId: input.org.id, status: "ACTIVE" }
    }),
    input.prisma.provisioningChecklist.findUnique({ where: { orgId: input.org.id } })
  ]);

  const checklist = parseChecklist(checklistRow?.stepsJson);
  const testSummary = await getTestPassSummary(input.prisma, input.org.id);

  const billingActive = ["active", "trialing"].includes(String(subscription?.status || "").toLowerCase());

  const transferNumbers = normalizeArrayString(settings?.transferNumbersJson);
  const notificationEmails = normalizeArrayString(settings?.notificationEmailsJson);
  const notificationPhones = normalizeArrayString(settings?.notificationPhonesJson);
  const hours = normalizeObjectString(settings?.hoursJson);
  const schedule =
    hours && typeof hours.schedule === "object" && hours.schedule !== null && !Array.isArray(hours.schedule)
      ? (hours.schedule as Record<string, unknown>)
      : {};
  const hasHoursConfigured = Object.keys(schedule).length > 0;
  const businessSettingsValidCheck =
    Boolean(settings) &&
    String(settings?.timezone || "").trim().length > 0 &&
    hasHoursConfigured &&
    transferNumbers.length > 0 &&
    (notificationEmails.length > 0 || notificationPhones.length > 0);

  const providerLineAssigned = Boolean(phone?.e164Number && ai);
  const toolSecretConfigured = Boolean(input.env.VAPI_TOOL_SECRET && input.env.VAPI_TOOL_SECRET.trim().length >= 4);

  const checks: ReadinessReport["checks"] = {
    billingActive: billingActive
      ? { ok: true, reason: "Billing status allows service", fixHint: "/app/billing" }
      : { ok: false, reason: `Subscription status is ${subscription?.status || "missing"}`, fixHint: "/app/billing" },
    onboardingSubmitted:
      onboarding?.status === "SUBMITTED" || onboarding?.status === "REVIEWED" || onboarding?.status === "APPROVED"
        ? { ok: true, reason: `Onboarding is ${onboarding.status}`, fixHint: "/app/onboarding" }
        : { ok: false, reason: "Onboarding is not submitted", fixHint: "/app/onboarding" },
    onboardingApproved:
      input.org.status === "APPROVED" || input.org.status === "PROVISIONING" || input.org.status === "TESTING" || input.org.status === "LIVE"
        ? { ok: true, reason: `Organization status is ${input.org.status}`, fixHint: "/admin/orgs" }
        : { ok: false, reason: "Onboarding approval is pending", fixHint: "Use Approve onboarding in Provisioning" },
    businessSettingsValid: businessSettingsValidCheck
      ? {
          ok: true,
          reason: "Business settings include timezone, hours, transfer numbers, and notification routing",
          fixHint: "/app/settings"
        }
      : {
          ok: false,
          reason: "Business settings are incomplete (need hours, transfer number, and notification email/phone)",
          fixHint: "/app/settings"
        },
    providerLineAssigned: providerLineAssigned
      ? { ok: true, reason: "Active line and AI config are assigned", fixHint: "Provisioning > Number + AI Config" }
      : { ok: false, reason: "Phone line or active AI config missing", fixHint: "Assign number and set AI config ACTIVE" },
    toolSecretConfigured: toolSecretConfigured
      ? { ok: true, reason: "VAPI_TOOL_SECRET configured", fixHint: "Render env vars" }
      : { ok: false, reason: "VAPI_TOOL_SECRET missing", fixHint: "Set VAPI_TOOL_SECRET in backend env" },
    webhooksVerified: checkFromChecklist(checklist, "webhooks_verified", "Webhooks", "Provisioning > Mark webhooks verified"),
    notificationsVerified:
      (notificationEmails.length > 0 || notificationPhones.length > 0) && (checklist.get("notifications_verified") || "TODO") !== "BLOCKED"
        ? {
            ok: true,
            reason: "Notification routing contacts are configured",
            fixHint: "Provisioning > Mark notifications verified"
          }
        : checkFromChecklist(checklist, "notifications_verified", "Notifications", "Provisioning > Mark notifications verified"),
    testCallsPassed:
      testSummary.totalPassed >= 5 && testSummary.hasAfterHoursPass && testSummary.hasTransferPass
        ? {
            ok: true,
            reason: `Passed ${testSummary.totalPassed} scenarios including after-hours and transfer`,
            fixHint: `/admin/orgs/${input.org.id}/testing`
          }
        : {
            ok: false,
            reason: `Need >=5 PASS with after-hours and transfer coverage (current PASS=${testSummary.totalPassed})`,
            fixHint: `/admin/orgs/${input.org.id}/testing`
          }
  };

  const canGoLive = Object.values(checks).every((check) => check.ok);
  return { checks, canGoLive };
}
