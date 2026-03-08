import test from "node:test";
import assert from "node:assert/strict";
import {
  assertOrgSmsQuota,
  assertRequestClarificationAllowed,
  assertRequestSlotOfferAllowed
} from "../sms-governance.service";

function createPrismaStub(input?: {
  hourlyCount?: number;
  dailyCount?: number;
  offerCount?: number;
  clarificationCount?: number;
}) {
  let messageCountCall = 0;
  const auditLogs: Array<Record<string, unknown>> = [];
  return {
    prisma: {
      message: {
        count: async (args?: { where?: Record<string, unknown> }) => {
          const where = args?.where || {};
          if (Object.prototype.hasOwnProperty.call(where, "OR")) {
            return input?.clarificationCount ?? 0;
          }
          messageCountCall += 1;
          if (messageCountCall === 1) return input?.hourlyCount ?? 0;
          if (messageCountCall === 2) return input?.dailyCount ?? 0;
          return input?.clarificationCount ?? 0;
        }
      },
      appointmentRequestEvent: {
        count: async () => input?.offerCount ?? 0
      },
      auditLog: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          auditLogs.push(data);
          return data;
        }
      }
    },
    auditLogs
  };
}

test("assertOrgSmsQuota blocks when hourly cap is reached", async () => {
  const { prisma, auditLogs } = createPrismaStub({ hourlyCount: 60, dailyCount: 60 });
  const result = await assertOrgSmsQuota({
    prisma: prisma as never,
    orgId: "org_1",
    actorUserId: "system",
    actorRole: "SYSTEM",
    source: "test_source"
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "ORG_SMS_HOURLY_CAP");
  assert.equal(auditLogs.length, 1);
});

test("assertRequestSlotOfferAllowed blocks repeated slot offers for a request", async () => {
  const { prisma, auditLogs } = createPrismaStub({ offerCount: 4 });
  const result = await assertRequestSlotOfferAllowed({
    prisma: prisma as never,
    orgId: "org_1",
    requestId: "req_1",
    actorUserId: "user_1",
    actorRole: "USER",
    source: "manual_offer"
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "REQUEST_SLOT_OFFER_CAP");
  assert.equal(auditLogs.length, 1);
});

test("assertRequestClarificationAllowed blocks repeated clarifications for a request", async () => {
  const { prisma, auditLogs } = createPrismaStub({ clarificationCount: 3 });
  const result = await assertRequestClarificationAllowed({
    prisma: prisma as never,
    orgId: "org_1",
    requestId: "req_1",
    actorUserId: "system",
    actorRole: "SYSTEM",
    source: "appointment_request_reply_invalid"
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "REQUEST_CLARIFICATION_CAP");
  assert.equal(auditLogs.length, 1);
});
