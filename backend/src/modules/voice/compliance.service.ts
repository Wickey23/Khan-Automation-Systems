import type { BusinessSettings, Organization, PhoneNumber } from "@prisma/client";

type ComplianceContext = {
  org: Organization;
  phone?: Pick<PhoneNumber, "provider" | "e164Number" | "status"> | null;
  aiAssistantId?: string | null;
  requiresProFeature?: boolean;
  hasProEntitlement?: boolean;
  outboundSms?: {
    stopOptedOut?: boolean;
    dnc?: boolean;
  };
};

export type ComplianceDecision = {
  blocked: boolean;
  route: "ROUTE_TO_SANDBOX" | "ROUTE_TO_VOICEMAIL" | "ROUTE_TO_FALLBACK_SMS" | null;
  tier: 0;
  ruleId: string;
  reasonCode: string;
  details?: Record<string, unknown>;
};

export function evaluateComplianceTier0(input: ComplianceContext): ComplianceDecision | null {
  const status = String(input.org.status || "").toUpperCase();
  if (status === "PAUSED" || status === "DISABLED") {
    return {
      blocked: true,
      route: "ROUTE_TO_VOICEMAIL",
      tier: 0,
      ruleId: "compliance-org-status-block",
      reasonCode: "ORG_NOT_ACTIVE",
      details: { status }
    };
  }

  if (input.requiresProFeature && !input.hasProEntitlement) {
    return {
      blocked: true,
      route: "ROUTE_TO_FALLBACK_SMS",
      tier: 0,
      ruleId: "compliance-pro-feature-block",
      reasonCode: "PRO_FEATURE_BILLING_INACTIVE"
    };
  }

  if (input.outboundSms?.stopOptedOut || input.outboundSms?.dnc) {
    return {
      blocked: true,
      route: null,
      tier: 0,
      ruleId: "compliance-outbound-sms-block",
      reasonCode: "SMS_OPT_OUT_OR_DNC"
    };
  }

  if (!input.phone?.e164Number || input.phone?.status === "RELEASED") {
    return {
      blocked: true,
      route: "ROUTE_TO_VOICEMAIL",
      tier: 0,
      ruleId: "compliance-provider-line-misconfigured",
      reasonCode: "PROVIDER_LINE_MISSING"
    };
  }

  if (!input.aiAssistantId) {
    return {
      blocked: true,
      route: "ROUTE_TO_SANDBOX",
      tier: 0,
      ruleId: "compliance-vapi-assistant-missing",
      reasonCode: "AI_ASSISTANT_NOT_CONFIGURED"
    };
  }

  return null;
}

export function parseBusinessHours(settings?: BusinessSettings | null) {
  if (!settings?.hoursJson) return { timezone: settings?.timezone || "America/New_York", schedule: {} };
  try {
    const parsed = JSON.parse(settings.hoursJson) as Record<string, unknown>;
    return {
      timezone: String(parsed.timezone || settings.timezone || "America/New_York"),
      schedule: (parsed.schedule && typeof parsed.schedule === "object" ? parsed.schedule : {}) as Record<string, unknown>
    };
  } catch {
    return { timezone: settings.timezone || "America/New_York", schedule: {} };
  }
}

