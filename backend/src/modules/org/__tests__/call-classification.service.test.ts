import assert from "node:assert/strict";
import test from "node:test";
import { env } from "../../../config/env";
import { classifyCallAndMaybeUpdateLead } from "../call-classification.service";

function createPrismaMock(options?: {
  outcome?: string;
  appointmentRequested?: boolean;
  summary?: string;
  transcript?: string;
  shadowMode?: boolean;
  llmDailyCap?: number;
  llmCountToday?: number;
}) {
  const callLogRows = [
    {
      id: "call_1",
      leadId: "lead_1",
      outcome: options?.outcome || "MESSAGE_TAKEN",
      appointmentRequested: Boolean(options?.appointmentRequested),
      aiSummary: options?.summary || "",
      transcript: options?.transcript || "",
      durationSec: 120
    }
  ];
  const classificationLogs: Array<{
    id: string;
    method: string;
    classification: string;
    confidence: number;
    signalsJson?: Record<string, unknown>;
  }> = [];
  const leadUpdates: Array<Record<string, unknown>> = [];

  const prisma = {
    callLog: {
      findFirst: async ({ where }: any) => callLogRows.find((row) => row.id === where.id && where.orgId) || null
    },
    callClassificationLog: {
      findFirst: async () => null,
      count: async ({ where }: any) => {
        if (where?.method === "LLM_FALLBACK") return options?.llmCountToday ?? 0;
        return 0;
      },
      create: async ({ data }: any) => {
        classificationLogs.push({
          id: `log_${classificationLogs.length + 1}`,
          method: data.method,
          classification: data.classification,
          confidence: data.confidence,
          signalsJson: data.signalsJson
        });
        return data;
      }
    },
    businessSettings: {
      findUnique: async () => ({
        classificationShadowMode: options?.shadowMode ?? true,
        classificationLlmDailyCap: options?.llmDailyCap ?? 100
      })
    },
    lead: {
      updateMany: async ({ data }: any) => {
        leadUpdates.push(data);
        return { count: 1 };
      }
    }
  } as any;

  return { prisma, classificationLogs, leadUpdates };
}

test("classification rules mark missed calls as MISSED_CALL_RECOVERY", async () => {
  const previous = (env as any).FEATURE_CLASSIFICATION_V1_ENABLED;
  (env as any).FEATURE_CLASSIFICATION_V1_ENABLED = "true";
  try {
    const mock = createPrismaMock({ outcome: "MISSED" });
    const result = await classifyCallAndMaybeUpdateLead({
      prisma: mock.prisma,
      orgId: "org_1",
      callLogId: "call_1"
    });
    assert.equal(result.skipped, false);
    if (result.skipped) return;
    assert.equal(result.classification, "MISSED_CALL_RECOVERY");
    assert.equal(mock.classificationLogs.length, 1);
  } finally {
    (env as any).FEATURE_CLASSIFICATION_V1_ENABLED = previous;
  }
});

test("classification uses cap fallback when LLM daily cap exceeded", async () => {
  const previous = (env as any).FEATURE_CLASSIFICATION_V1_ENABLED;
  (env as any).FEATURE_CLASSIFICATION_V1_ENABLED = "true";
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  (globalThis as any).fetch = async () => {
    fetchCalls += 1;
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: "{\"classification\":\"GENERAL_INQUIRY\",\"confidence\":0.51}" } }] })
    };
  };
  try {
    const mock = createPrismaMock({
      outcome: "MESSAGE_TAKEN",
      summary: "caller asked random question",
      transcript: "just general inquiry",
      llmDailyCap: 0,
      llmCountToday: 0
    });
    const result = await classifyCallAndMaybeUpdateLead({
      prisma: mock.prisma,
      orgId: "org_1",
      callLogId: "call_1"
    });
    assert.equal(result.skipped, false);
    if (result.skipped) return;
    assert.equal(result.classification, "GENERAL_INQUIRY");
    assert.equal(result.method, "RULES");
    assert.equal(Array.isArray(mock.classificationLogs[0]?.signalsJson?.signals), true);
    assert.equal(
      (mock.classificationLogs[0]?.signalsJson?.signals as string[]).includes("llm_daily_cap_exceeded"),
      true
    );
    assert.equal(fetchCalls, 0);
  } finally {
    (globalThis as any).fetch = originalFetch;
    (env as any).FEATURE_CLASSIFICATION_V1_ENABLED = previous;
  }
});

test("classification mutates lead only when shadow mode disabled", async () => {
  const previous = (env as any).FEATURE_CLASSIFICATION_V1_ENABLED;
  (env as any).FEATURE_CLASSIFICATION_V1_ENABLED = "true";
  try {
    const shadowOn = createPrismaMock({ outcome: "SPAM", shadowMode: true });
    await classifyCallAndMaybeUpdateLead({
      prisma: shadowOn.prisma,
      orgId: "org_1",
      callLogId: "call_1",
      leadId: "lead_1"
    });
    assert.equal(shadowOn.leadUpdates.length, 0);

    const shadowOff = createPrismaMock({ outcome: "SPAM", shadowMode: false });
    await classifyCallAndMaybeUpdateLead({
      prisma: shadowOff.prisma,
      orgId: "org_1",
      callLogId: "call_1",
      leadId: "lead_1"
    });
    assert.equal(shadowOff.leadUpdates.length, 1);
  } finally {
    (env as any).FEATURE_CLASSIFICATION_V1_ENABLED = previous;
  }
});

test("classification disqualifies unsupported service-area calls in rules path", async () => {
  const previous = (env as any).FEATURE_CLASSIFICATION_V1_ENABLED;
  (env as any).FEATURE_CLASSIFICATION_V1_ENABLED = "true";
  try {
    const mock = createPrismaMock({
      outcome: "MESSAGE_TAKEN",
      shadowMode: false,
      summary: "Caller is outside service area and requesting wrong service",
      transcript: "You do not service this request in our area"
    });
    const result = await classifyCallAndMaybeUpdateLead({
      prisma: mock.prisma,
      orgId: "org_1",
      callLogId: "call_1",
      leadId: "lead_1"
    });
    assert.equal(result.skipped, false);
    if (result.skipped) return;
    assert.equal(result.classification, "GENERAL_INQUIRY");
    assert.equal(mock.leadUpdates.length, 1);
    assert.equal(mock.leadUpdates[0]?.qualified, false);
    assert.equal(
      mock.leadUpdates[0]?.qualificationReason,
      "Outside service area or unsupported service request"
    );
  } finally {
    (env as any).FEATURE_CLASSIFICATION_V1_ENABLED = previous;
  }
});

test("classification short-circuits cleanly when feature flag disabled", async () => {
  const previous = (env as any).FEATURE_CLASSIFICATION_V1_ENABLED;
  (env as any).FEATURE_CLASSIFICATION_V1_ENABLED = "false";
  try {
    const mock = createPrismaMock({ outcome: "SPAM", shadowMode: false });
    const result = await classifyCallAndMaybeUpdateLead({
      prisma: mock.prisma,
      orgId: "org_1",
      callLogId: "call_1",
      leadId: "lead_1"
    });
    assert.equal(result.skipped, true);
    assert.equal(mock.classificationLogs.length, 0);
    assert.equal(mock.leadUpdates.length, 0);
  } finally {
    (env as any).FEATURE_CLASSIFICATION_V1_ENABLED = previous;
  }
});

test("llm-unavailable fallback stays RULES method for cap accounting integrity", async () => {
  const previous = (env as any).FEATURE_CLASSIFICATION_V1_ENABLED;
  const previousApiKey = process.env.OPENAI_API_KEY;
  (env as any).FEATURE_CLASSIFICATION_V1_ENABLED = "true";
  process.env.OPENAI_API_KEY = "";
  try {
    const mock = createPrismaMock({
      outcome: "MESSAGE_TAKEN",
      summary: "ambiguous short call",
      transcript: "hello",
      llmDailyCap: 100,
      llmCountToday: 0
    });
    const result = await classifyCallAndMaybeUpdateLead({
      prisma: mock.prisma,
      orgId: "org_1",
      callLogId: "call_1",
      leadId: "lead_1"
    });
    assert.equal(result.skipped, false);
    if (result.skipped) return;
    assert.equal(result.method, "RULES");
    assert.equal(mock.classificationLogs[0]?.method, "RULES");
  } finally {
    (env as any).FEATURE_CLASSIFICATION_V1_ENABLED = previous;
    process.env.OPENAI_API_KEY = previousApiKey;
  }
});

test("classification falls back to default settings when business-settings columns are missing", async () => {
  const previous = (env as any).FEATURE_CLASSIFICATION_V1_ENABLED;
  (env as any).FEATURE_CLASSIFICATION_V1_ENABLED = "true";
  try {
    const mock = createPrismaMock({
      outcome: "MESSAGE_TAKEN",
      summary: "general question",
      transcript: "hello"
    });
    mock.prisma.businessSettings.findUnique = async () => {
      throw new Error("P2022: The column BusinessSettings.classificationShadowMode does not exist");
    };
    const result = await classifyCallAndMaybeUpdateLead({
      prisma: mock.prisma,
      orgId: "org_1",
      callLogId: "call_1",
      leadId: "lead_1"
    });
    assert.equal(result.skipped, false);
    if (result.skipped) return;
    assert.equal(result.shadowMode, true);
    assert.equal(mock.classificationLogs.length, 1);
    assert.equal(mock.leadUpdates.length, 0);
  } finally {
    (env as any).FEATURE_CLASSIFICATION_V1_ENABLED = previous;
  }
});
