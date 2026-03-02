import type { Prisma, PrismaClient } from "@prisma/client";

type JsonMap = Record<string, unknown>;

function asObject(value: unknown): JsonMap {
  return value && typeof value === "object" ? (value as JsonMap) : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function parseJsonString(value: string | null | undefined, fallback: JsonMap | unknown[] = {}) {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as JsonMap;
  } catch {
    return fallback;
  }
}

function parseJsonArrayString(value: string | null | undefined, fallback: unknown[] = []) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function buildConfigPackage(answers: JsonMap, businessSettings?: JsonMap) {
  const businessProfile = asObject(answers.businessProfile);
  const hoursAvailability = asObject(answers.hoursAvailability);
  const servicesPricing = asObject(answers.servicesPricing);
  const bookingScheduling = asObject(answers.bookingScheduling);
  const callHandling = asObject(answers.callHandlingPreferences);
  const intakeQuestions = asObject(answers.intakeQuestions);
  const policies = asObject(answers.policies);
  const notifications = asObject(answers.notifications);
  const bs = businessSettings || {};

  const transferNumbers = asStringArray(callHandling.transferNumbers);
  const managerEmails = asStringArray(notifications.managerEmails);
  const managerPhones = asStringArray(notifications.managerPhones);
  const customQuestions = asStringArray(intakeQuestions.customQuestions);
  const services = asStringArray(servicesPricing.serviceCategories).filter(
    (item) => item.toLowerCase() !== "services (one per line)"
  );
  const timezone = String(
    (asObject(parseJsonString(String(bs.hoursJson || ""))).timezone as string) ||
      bs.timezone ||
      "America/New_York"
  );

  const requiredFields = [
    { key: "caller_name", label: "Caller name", type: "string", required: true, validation: "min:2" },
    { key: "callback_phone", label: "Callback phone", type: "phone", required: true, validation: "e164_or_national" },
    {
      key: "service_type_or_equipment",
      label: "Service type or equipment",
      type: "string",
      required: true,
      validation: "min:2"
    },
    { key: "issue_summary", label: "Issue summary", type: "string", required: true, validation: "min:8" },
    { key: "urgency", label: "Urgency", type: "enum", required: true, validation: "emergency|today|this_week|flexible" },
    { key: "preferred_time", label: "Preferred time", type: "string", required: false, validation: "optional" },
    { key: "location", label: "Location", type: "string", required: false, validation: "required_if_mobile" }
  ];

  const transferRules = transferNumbers.map((toNumber, index) => ({
    condition: index === 0 ? "urgent_or_customer_requests_live_agent" : "fallback_transfer",
    toNumber,
    priority: index + 1
  }));

  return {
    business: {
      name: String(businessProfile.displayName || businessProfile.legalBusinessName || ""),
      address: String(businessProfile.address || ""),
      timezone,
      serviceArea: String(businessProfile.serviceArea || ""),
      languages: Array.from(
        new Set([
          ...asStringArray(parseJsonArrayString(String(bs.languagesJson || "[]"), [])),
          "English"
        ])
      )
    },
    hours: {
      weekly: asObject(parseJsonString(String(bs.hoursJson || ""), { timezone, schedule: {} })),
      closures: [],
      afterHoursMode: String(bs.afterHoursMode || "TAKE_MESSAGE")
    },
    services: {
      offered: services,
      notOffered: [],
      pricingNotes: String(servicesPricing.pricingNotes || "")
    },
    policies: {
      estimates: String(policies.estimatesPolicy || policies.estimates || ""),
      diagnosticsFee: String(policies.diagnosticsPolicy || ""),
      warranty: String(policies.warrantyPolicy || ""),
      cancellation: String(policies.cancellationPolicy || "")
    },
    transfer: {
      rules: transferRules,
      fallback: {
        toNumber: transferNumbers[0] || "",
        behavior: transferNumbers.length ? "transfer" : "take_message"
      },
      afterHours: {
        behavior: String(hoursAvailability.afterHoursInstructions || "TAKE_MESSAGE"),
        toNumber: transferNumbers[0] || null
      }
    },
    intake: {
      requiredFields,
      customQuestions
    },
    outcomes: {
      bookRequest: String(bookingScheduling.bookingMethod || "manager_notify") !== "none",
      takeMessage: true,
      transfer: Boolean(transferNumbers.length),
      urgentEscalation: true
    },
    notifications: {
      emails: managerEmails.length ? managerEmails : asStringArray(parseJsonArrayString(String(bs.notificationEmailsJson || "[]"), [])),
      phones: managerPhones.length ? managerPhones : asStringArray(parseJsonArrayString(String(bs.notificationPhonesJson || "[]"), [])),
      smsConsentText: String(bs.smsConsentText || "By continuing, you consent to SMS follow-up.")
    },
    compliance: {
      recordingConsentEnabled: Boolean(bs.recordingConsentEnabled),
      script:
        "This call may be recorded for quality and training. By continuing, you consent to call recording and follow-up communications."
    }
  };
}

export async function generateConfigPackage(input: {
  prisma: PrismaClient;
  orgId: string;
  generatedByUserId?: string;
}) {
  const [onboarding, settings] = await Promise.all([
    input.prisma.onboardingSubmission.findUnique({ where: { orgId: input.orgId } }),
    input.prisma.businessSettings.findUnique({ where: { orgId: input.orgId } })
  ]);
  const answers = onboarding?.answersJson ? (JSON.parse(onboarding.answersJson) as JsonMap) : {};
  const packageJson = buildConfigPackage(answers, (settings || {}) as unknown as JsonMap);
  const packageJsonInput = packageJson as Prisma.InputJsonValue;

  const existing = await input.prisma.configPackage.findUnique({ where: { orgId: input.orgId } });
  const version = existing ? existing.version + 1 : 1;

  const configPackage = await input.prisma.configPackage.upsert({
    where: { orgId: input.orgId },
    update: {
      version,
      json: packageJsonInput,
      generatedAt: new Date(),
      generatedByUserId: input.generatedByUserId || null
    },
    create: {
      orgId: input.orgId,
      version,
      json: packageJsonInput,
      generatedAt: new Date(),
      generatedByUserId: input.generatedByUserId || null
    }
  });

  await input.prisma.onboardingSubmission.updateMany({
    where: { orgId: input.orgId },
    data: { configPackageJson: JSON.stringify(packageJson) }
  });

  return configPackage;
}
