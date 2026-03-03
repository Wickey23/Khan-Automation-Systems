import type { AiAgentConfig, BusinessSettings, CallerProfile, Organization, PhoneNumber } from "@prisma/client";
import { isWithinBusinessHours } from "../twilio/hours";
import { evaluateComplianceTier0, type ComplianceDecision } from "./compliance.service";

export type RoutingResultType =
  | "ROUTE_TO_VAPI"
  | "ROUTE_TO_VOICEMAIL"
  | "ROUTE_TO_TRANSFER"
  | "ROUTE_TO_FALLBACK_SMS"
  | "ROUTE_TO_SANDBOX";

export type RoutingDecision = {
  route: RoutingResultType;
  tier: number;
  ruleId: string;
  reasonCode: string;
  matchedSignals: Record<string, unknown>;
};

type RoutingInput = {
  org: Organization;
  phone?: Pick<PhoneNumber, "provider" | "e164Number" | "status"> | null;
  aiConfig?: Pick<AiAgentConfig, "vapiAgentId" | "transferRulesJson"> | null;
  settings?: Pick<BusinessSettings, "hoursJson" | "afterHoursMode" | "transferNumbersJson" | "policiesJson"> | null;
  callerProfile?: Pick<CallerProfile, "totalCalls" | "lastCallAt" | "flaggedVIP"> | null;
  callerNumber?: string;
  callVolumeLast5m?: number;
  detectedText?: string;
  highValueServiceDetected?: boolean;
  requiresProFeature?: boolean;
  hasProEntitlement?: boolean;
  outboundSmsOptedOut?: boolean;
  outboundSmsDnc?: boolean;
};

function parseJsonObject(value: string | null | undefined) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // noop
  }
  return {} as Record<string, unknown>;
}

function parseStringArray(value: string | null | undefined) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    // noop
  }
  return [] as string[];
}

function parseTransferRulesJson(value: string | null | undefined) {
  const parsed = parseJsonObject(value);
  const urgentKeywords = Array.isArray(parsed.urgentKeywords)
    ? parsed.urgentKeywords.filter((item): item is string => typeof item === "string")
    : [];
  const urgentTransferTo = typeof parsed.urgentTransferTo === "string" ? parsed.urgentTransferTo : "";
  return { urgentKeywords, urgentTransferTo };
}

function toLowerText(value: string | undefined) {
  return (value || "").toLowerCase();
}

function asComplianceRoute(route: ComplianceDecision["route"]): RoutingResultType {
  if (!route) return "ROUTE_TO_SANDBOX";
  return route;
}

export function buildRoutingDecisionJson(input: RoutingDecision) {
  return {
    tier: input.tier,
    route: input.route,
    ruleId: input.ruleId,
    reasonCode: input.reasonCode,
    matchedSignals: input.matchedSignals,
    decidedAt: new Date().toISOString()
  };
}

export function computeRoutingDecision(input: RoutingInput): RoutingDecision {
  const transferNumbers = parseStringArray(input.settings?.transferNumbersJson);
  const policies = parseJsonObject(input.settings?.policiesJson);
  const transferRules = parseTransferRulesJson(input.aiConfig?.transferRulesJson);
  const detectedText = toLowerText(input.detectedText);
  const overflowThreshold =
    Number(policies.overflowThresholdPer5m) > 0 ? Number(policies.overflowThresholdPer5m) : 20;
  const repeatWindowHours =
    Number(policies.repeatCallerPriorityWindowHours) > 0 ? Number(policies.repeatCallerPriorityWindowHours) : 24;

  const compliance = evaluateComplianceTier0({
    org: input.org,
    phone: input.phone,
    aiAssistantId: input.aiConfig?.vapiAgentId || null,
    requiresProFeature: input.requiresProFeature,
    hasProEntitlement: input.hasProEntitlement,
    outboundSms: { stopOptedOut: input.outboundSmsOptedOut, dnc: input.outboundSmsDnc }
  });
  if (compliance) {
    return {
      route: asComplianceRoute(compliance.route),
      tier: 0,
      ruleId: compliance.ruleId,
      reasonCode: compliance.reasonCode,
      matchedSignals: compliance.details || {}
    };
  }

  const status = String(input.org.status || "").toUpperCase();
  if (status === "TESTING" || !input.org.live) {
    return {
      route: "ROUTE_TO_SANDBOX",
      tier: 1,
      ruleId: "org-status-testing-route",
      reasonCode: "ORG_IN_TEST_MODE",
      matchedSignals: { status, live: input.org.live }
    };
  }

  const withinHours = isWithinBusinessHours(input.settings?.hoursJson);
  if (!withinHours) {
    const afterHoursMode = String(input.settings?.afterHoursMode || "TAKE_MESSAGE").toUpperCase();
    if (afterHoursMode === "TRANSFER" && transferNumbers.length > 0) {
      return {
        route: "ROUTE_TO_TRANSFER",
        tier: 2,
        ruleId: "after-hours-transfer",
        reasonCode: "AFTER_HOURS_TRANSFER_MODE",
        matchedSignals: { afterHoursMode, transferTo: transferNumbers[0] }
      };
    }
    return {
      route: "ROUTE_TO_VOICEMAIL",
      tier: 2,
      ruleId: "after-hours-voicemail",
      reasonCode: "AFTER_HOURS_NON_TRANSFER",
      matchedSignals: { afterHoursMode }
    };
  }

  const urgentKeywords = [...transferRules.urgentKeywords, "emergency", "smoke", "gas", "fire", "burning smell", "no heat", "no cooling"];
  const matchedUrgentKeyword = urgentKeywords.find((keyword) => detectedText.includes(keyword.toLowerCase()));
  if (input.highValueServiceDetected || matchedUrgentKeyword) {
    return {
      route: transferNumbers.length > 0 || transferRules.urgentTransferTo ? "ROUTE_TO_TRANSFER" : "ROUTE_TO_VAPI",
      tier: 3,
      ruleId: "escalation-urgent-or-high-value",
      reasonCode: input.highValueServiceDetected ? "HIGH_VALUE_SERVICE" : "URGENT_KEYWORD",
      matchedSignals: {
        matchedUrgentKeyword: matchedUrgentKeyword || null,
        transferTo: transferRules.urgentTransferTo || transferNumbers[0] || null
      }
    };
  }

  if ((input.callVolumeLast5m || 0) > overflowThreshold) {
    return {
      route: transferNumbers.length > 0 ? "ROUTE_TO_TRANSFER" : "ROUTE_TO_VOICEMAIL",
      tier: 4,
      ruleId: "overflow-threshold",
      reasonCode: "CALL_VOLUME_THRESHOLD_EXCEEDED",
      matchedSignals: {
        callVolumeLast5m: input.callVolumeLast5m || 0,
        overflowThreshold
      }
    };
  }

  const lastCallMs = input.callerProfile?.lastCallAt?.getTime() || 0;
  const repeatWindowMs = repeatWindowHours * 60 * 60 * 1000;
  const repeatWithinWindow =
    Boolean(lastCallMs) && Date.now() - lastCallMs <= repeatWindowMs && (input.callerProfile?.totalCalls || 0) > 1;
  if (input.callerProfile?.flaggedVIP || repeatWithinWindow) {
    return {
      route: "ROUTE_TO_VAPI",
      tier: 5,
      ruleId: "repeat-caller-priority",
      reasonCode: input.callerProfile?.flaggedVIP ? "VIP_CALLER" : "REPEAT_CALLER_RECENT",
      matchedSignals: {
        flaggedVIP: Boolean(input.callerProfile?.flaggedVIP),
        totalCalls: input.callerProfile?.totalCalls || 0,
        repeatWithinWindow
      }
    };
  }

  return {
    route: "ROUTE_TO_VAPI",
    tier: 6,
    ruleId: "default-vapi",
    reasonCode: "DEFAULT_ROUTE",
    matchedSignals: {}
  };
}

