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

