import { ClassificationMethod, LeadClassification, type PrismaClient } from "@prisma/client";
import { env } from "../../config/env";
import { isFeatureEnabledForOrg } from "./feature-gates";

type RuleResult = {
  classification: LeadClassification;
  confidence: number;
  qualified: boolean;
  qualificationReason?: string;
  signals: string[];
};

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function containsAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function classifyByRules(input: {
  outcome: string;
  appointmentRequested: boolean;
  summary: string;
  transcript: string;
  durationSec: number;
}) {
  const signals: string[] = [];
  const normalizedText = `${input.summary} ${input.transcript}`.toLowerCase();

  if (input.outcome === "MISSED") {
    signals.push("missed_outcome");
    return {
      classification: LeadClassification.MISSED_CALL_RECOVERY,
      confidence: 0.92,
      qualified: true,
      signals
    } satisfies RuleResult;
  }

  if (input.outcome === "SPAM" || containsAny(normalizedText, ["spam", "telemarketer", "wrong number", "robot"])) {
    signals.push("spam_keyword_or_outcome");
    return {
      classification: LeadClassification.SPAM,
      confidence: 0.98,
      qualified: false,
      qualificationReason: "Spam or invalid caller intent",
      signals
    } satisfies RuleResult;
  }

  if (
    containsAny(normalizedText, [
      "outside service area",
      "out of service area",
      "not in your area",
      "wrong service",
      "do not service",
      "don't service",
      "dont service"
    ])
  ) {
    signals.push("disqualified_service_or_area");
    return {
      classification: LeadClassification.GENERAL_INQUIRY,
      confidence: 0.88,
      qualified: false,
      qualificationReason: "Outside service area or unsupported service request",
      signals
    } satisfies RuleResult;
  }

  if (
    input.appointmentRequested ||
    input.outcome === "APPOINTMENT_REQUEST" ||
    containsAny(normalizedText, ["book", "schedule", "appointment", "availability"])
  ) {
    signals.push("booking_signal");
    return {
      classification: LeadClassification.BOOKED_JOB,
      confidence: 0.9,
      qualified: true,
      signals
    } satisfies RuleResult;
  }

  if (containsAny(normalizedText, ["urgent", "emergency", "asap", "immediately"])) {
    signals.push("emergency_keyword");
    return {
      classification: LeadClassification.EMERGENCY,
      confidence: 0.86,
      qualified: true,
      signals
    } satisfies RuleResult;
  }

  if (containsAny(normalizedText, ["quote", "estimate", "pricing", "price"])) {
    signals.push("quote_keyword");
    return {
      classification: LeadClassification.QUOTE_REQUEST,
      confidence: 0.8,
      qualified: true,
      signals
    } satisfies RuleResult;
  }

  if (containsAny(normalizedText, ["support", "help", "warranty", "billing issue"])) {
    signals.push("support_keyword");
    return {
      classification: LeadClassification.CUSTOMER_SUPPORT,
      confidence: 0.78,
      qualified: true,
      signals
    } satisfies RuleResult;
  }

  if (input.durationSec > 0 && input.durationSec < 10) {
    signals.push("short_call_duration");
  }
  signals.push("fallback_general");
  return {
    classification: LeadClassification.GENERAL_INQUIRY,
    confidence: 0.62,
    qualified: true,
    signals
  } satisfies RuleResult;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

async function classifyWithLlmFallback(input: {
  summary: string;
  transcript: string;
  defaultClassification: LeadClassification;
  defaultConfidence: number;
}) {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return {
      classification: input.defaultClassification,
      confidence: input.defaultConfidence,
      method: ClassificationMethod.RULES,
      signals: ["llm_unavailable_no_api_key"]
    };
  }
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Classify service-business calls. Return JSON with keys: classification, confidence. Classification must be one of BOOKED_JOB,QUOTE_REQUEST,EMERGENCY,CUSTOMER_SUPPORT,SPAM,MISSED_CALL_RECOVERY,GENERAL_INQUIRY. confidence between 0 and 1."
          },
          {
            role: "user",
            content: `Summary:\n${input.summary}\n\nTranscript:\n${input.transcript}`
          }
        ]
      })
    });
    if (!response.ok) {
      return {
        classification: input.defaultClassification,
        confidence: input.defaultConfidence,
        method: ClassificationMethod.RULES,
        signals: ["llm_http_error"]
      };
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = String(payload?.choices?.[0]?.message?.content || "").trim();
    const parsed = content ? (JSON.parse(content) as { classification?: string; confidence?: number }) : {};
    const classificationRaw = String(parsed.classification || "");
    const mapped = Object.values(LeadClassification).includes(classificationRaw as LeadClassification)
      ? (classificationRaw as LeadClassification)
      : input.defaultClassification;
    return {
      classification: mapped,
      confidence: clampConfidence(Number(parsed.confidence ?? input.defaultConfidence)),
      method: ClassificationMethod.LLM_FALLBACK,
      signals: ["llm_response_used"]
    };
  } catch {
    return {
      classification: input.defaultClassification,
      confidence: input.defaultConfidence,
      method: ClassificationMethod.RULES,
      signals: ["llm_parse_or_network_error"]
    };
  }
}

export async function classifyCallAndMaybeUpdateLead(input: {
  prisma: PrismaClient;
  orgId: string;
  callLogId: string;
  leadId?: string | null;
  now?: Date;
}) {
  if (!isFeatureEnabledForOrg(env.FEATURE_CLASSIFICATION_V1_ENABLED, input.orgId)) {
    return { skipped: true as const, reason: "feature_disabled" };
  }
  const now = input.now || new Date();
  const call = await input.prisma.callLog.findFirst({
    where: { id: input.callLogId, orgId: input.orgId },
    select: {
      id: true,
      leadId: true,
      outcome: true,
      appointmentRequested: true,
      aiSummary: true,
      transcript: true,
      durationSec: true
    }
  });
  if (!call) return { skipped: true as const, reason: "call_not_found" };

  const existingLog = await input.prisma.callClassificationLog.findFirst({
    where: { orgId: input.orgId, callLogId: call.id },
    select: { id: true }
  });
  if (existingLog) return { skipped: true as const, reason: "already_classified" };

  const settings = await input.prisma.businessSettings.findUnique({
    where: { orgId: input.orgId },
    select: { classificationShadowMode: true, classificationLlmDailyCap: true }
  });
  const shadowMode = settings?.classificationShadowMode ?? true;
  const llmDailyCap = Math.max(0, settings?.classificationLlmDailyCap ?? 100);

  const rules = classifyByRules({
    outcome: String(call.outcome || ""),
    appointmentRequested: Boolean(call.appointmentRequested),
    summary: String(call.aiSummary || ""),
    transcript: String(call.transcript || ""),
    durationSec: Number(call.durationSec || 0)
  });

  let method: ClassificationMethod = ClassificationMethod.RULES;
  let classification: LeadClassification = rules.classification;
  let confidence = clampConfidence(rules.confidence);
  let signals = [...rules.signals];
  let qualified = rules.qualified;
  let qualificationReason = rules.qualificationReason || null;
  if (confidence < 0.75) {
    const dayStart = startOfUtcDay(now);
    const llmFallbackUsedToday = await input.prisma.callClassificationLog.count({
      where: {
        orgId: input.orgId,
        method: ClassificationMethod.LLM_FALLBACK,
        createdAt: { gte: dayStart }
      }
    });
    if (llmFallbackUsedToday < llmDailyCap) {
      const fallback = await classifyWithLlmFallback({
        summary: String(call.aiSummary || ""),
        transcript: String(call.transcript || ""),
        defaultClassification: classification,
        defaultConfidence: confidence
      });
      method = fallback.method;
      classification = fallback.classification;
      confidence = clampConfidence(fallback.confidence);
      signals = [...signals, ...fallback.signals];
      qualified = classification !== LeadClassification.SPAM;
      qualificationReason = qualified ? null : "Spam or disqualified call intent";
    } else {
      method = ClassificationMethod.RULES;
      classification = LeadClassification.GENERAL_INQUIRY;
      confidence = 0.55;
      signals.push("llm_daily_cap_exceeded");
      qualified = true;
      qualificationReason = null;
    }
  }

  await input.prisma.callClassificationLog.create({
    data: {
      orgId: input.orgId,
      callLogId: call.id,
      method,
      classification,
      confidence,
      signalsJson: {
        signals,
        outcome: call.outcome,
        appointmentRequested: call.appointmentRequested
      }
    }
  });

  const leadId = input.leadId || call.leadId;
  if (!shadowMode && leadId) {
    await input.prisma.lead.updateMany({
      where: { id: leadId, orgId: input.orgId },
      data: {
        classification,
        classificationConfidence: confidence,
        qualified,
        qualificationReason
      }
    });
  }

  return {
    skipped: false as const,
    method,
    classification,
    confidence,
    shadowMode
  };
}
