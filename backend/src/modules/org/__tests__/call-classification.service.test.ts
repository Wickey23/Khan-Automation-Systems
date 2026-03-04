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
  const classificationLogs: Array<{ id: string; method: string; classification: string; confidence: number }> = [];
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
          confidence: data.confidence
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
  (env as any).FEATURE_CLASSIFICATION_V1_ENABLED = "true";
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
});

test("classification uses cap fallback when LLM daily cap exceeded", async () => {
  (env as any).FEATURE_CLASSIFICATION_V1_ENABLED = "true";
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
});

test("classification mutates lead only when shadow mode disabled", async () => {
  (env as any).FEATURE_CLASSIFICATION_V1_ENABLED = "true";
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
});

