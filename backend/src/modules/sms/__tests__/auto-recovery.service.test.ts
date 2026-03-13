import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAndSendAutoRecovery } from "../auto-recovery.service";

test("auto recovery returns CALL_NOT_FOUND when call is missing", async () => {
  const prisma = {
    callLog: {
      findUnique: async () => null
    }
  } as any;
  const result = await evaluateAndSendAutoRecovery({ prisma, callLogId: "missing" });
  assert.equal(result.sent, false);
  assert.equal((result as any).skipped, "CALL_NOT_FOUND");
});

test("auto recovery ignores calls that do not meet trigger rules", async () => {
  const prisma = {
    callLog: {
      findUnique: async () => ({
        id: "call_1",
        orgId: "org_1",
        durationSec: 30,
        aiStartedAt: new Date(),
        transferredAt: null,
        outcome: "MESSAGE_TAKEN",
        fromNumber: "+15555550123",
        organization: { subscriptionStatus: "active" }
      })
    }
  } as any;
  const result = await evaluateAndSendAutoRecovery({ prisma, callLogId: "call_1" });
  assert.equal(result.sent, false);
  assert.equal((result as any).skipped, "TRIGGER_NOT_MET");
});

test("auto recovery skips when a recovery SMS was already sent", async () => {
  const prisma = {
    callLog: {
      findUnique: async () => ({
        id: "call_2",
        orgId: "org_1",
        durationSec: 0,
        aiStartedAt: null,
        transferredAt: null,
        answeredAt: null,
        callStatus: "no-answer",
        dialCallStatus: null,
        outcome: "MISSED",
        fromNumber: "+15555550123",
        recoverySmsSentAt: new Date(),
        organization: { subscriptionStatus: "active" }
      })
    },
    auditLog: {
      create: async () => null
    }
  } as any;

  const result = await evaluateAndSendAutoRecovery({ prisma, callLogId: "call_2" });
  assert.equal(result.sent, false);
  assert.equal((result as any).skipped, "ALREADY_SENT");
});

test("auto recovery treats short unanswered failed calls as abandoned-style recovery candidates", async () => {
  let dedupeCreated = false;
  const prisma = {
    callLog: {
      findUnique: async () => ({
        id: "call_3",
        orgId: "org_1",
        durationSec: 8,
        aiStartedAt: null,
        transferredAt: null,
        answeredAt: null,
        callStatus: "no-answer",
        dialCallStatus: null,
        outcome: "MESSAGE_TAKEN",
        fromNumber: "+15555550123",
        recoverySmsSentAt: null,
        organization: { subscriptionStatus: "active" }
      }),
      update: async () => null
    },
    auditLog: {
      create: async () => null
    },
    businessSettings: {
      findUnique: async () => ({
        policiesJson: JSON.stringify({ autoRecoveryEnabled: true })
      })
    },
    phoneNumber: {
      findFirst: async () => ({
        provider: "TWILIO",
        e164Number: "+15555559999"
      })
    },
    lead: {
      findFirst: async () => null
    },
    autoRecoveryDedupe: {
      create: async () => {
        dedupeCreated = true;
        return null;
      }
    },
    message: {
      count: async () => 0,
      create: async () => null
    },
    messageThread: {
      upsert: async () => ({
        id: "thread_1"
      })
    }
  } as any;

  process.env.AUTO_RECOVERY_ENABLED = "true";
  process.env.AUTO_RECOVERY_DEDUPE_WINDOW_HOURS = "2";
  process.env.AUTO_RECOVERY_DAILY_CAP = "50";

  const result = await evaluateAndSendAutoRecovery({ prisma, callLogId: "call_3" });
  assert.equal(dedupeCreated, true);
  assert.equal(typeof result.sent, "boolean");
});
