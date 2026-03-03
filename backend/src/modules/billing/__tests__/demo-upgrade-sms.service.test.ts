import assert from "node:assert/strict";
import test from "node:test";
import { sendThrottledUpgradeSms } from "../demo-upgrade-sms.service";

function createPrismaMock() {
  let throttle: { orgId: string; callerPhone: string; lastSentAt: Date } | null = null;
  const actions: string[] = [];

  const prisma = {
    demoUpgradeSmsThrottle: {
      findUnique: async ({ where }: any) => {
        if (
          throttle &&
          throttle.orgId === where.orgId_callerPhone.orgId &&
          throttle.callerPhone === where.orgId_callerPhone.callerPhone
        ) {
          return { ...throttle };
        }
        return null;
      },
      upsert: async ({ where, update, create }: any) => {
        if (
          throttle &&
          throttle.orgId === where.orgId_callerPhone.orgId &&
          throttle.callerPhone === where.orgId_callerPhone.callerPhone
        ) {
          throttle = { ...throttle, lastSentAt: update.lastSentAt };
          return throttle;
        }
        throttle = { orgId: create.orgId, callerPhone: create.callerPhone, lastSentAt: create.lastSentAt };
        return throttle;
      }
    },
    phoneNumber: {
      findFirst: async () => null
    },
    auditLog: {
      create: async ({ data }: any) => {
        actions.push(data.action);
        return data;
      }
    },
    $transaction: async (fn: any) => fn(prisma)
  } as any;

  return { prisma, actions };
}

test("sendThrottledUpgradeSms throttles repeated attempts in cooldown window", async () => {
  const mock = createPrismaMock();
  const now = new Date("2026-03-03T12:00:00.000Z");

  const first = await sendThrottledUpgradeSms({
    prismaClient: mock.prisma,
    orgId: "org_1",
    callerPhone: "+15163067876",
    businessName: "Precision Home Services",
    now
  });
  assert.equal(first.sent, false);
  assert.equal(first.reason, "twilio_sender_missing");

  const second = await sendThrottledUpgradeSms({
    prismaClient: mock.prisma,
    orgId: "org_1",
    callerPhone: "+15163067876",
    businessName: "Precision Home Services",
    now: new Date("2026-03-03T12:10:00.000Z")
  });
  assert.equal(second.sent, false);
  assert.equal(second.reason, "throttled");
  assert.ok(mock.actions.includes("DEMO_UPGRADE_SMS_FAILED"));
  assert.ok(mock.actions.includes("DEMO_UPGRADE_SMS_THROTTLED"));
});

