import assert from "node:assert/strict";
import test from "node:test";
import { getDemoState, reserveDemoAttemptOrReject } from "../demo-access.service";

function createPrismaMock() {
  let demoState: { demoStartedAt: Date | null; demoEndsAt: Date | null } | null = null;
  const attempts = new Map<string, Date>();
  let upsertCount = 0;

  const prisma = {
    organizationDemoState: {
      findUnique: async () => (demoState ? { ...demoState } : null),
      upsert: async ({ update, create }: any) => {
        upsertCount += 1;
        const next = demoState ? update : create;
        demoState = {
          demoStartedAt: next.demoStartedAt || null,
          demoEndsAt: next.demoEndsAt || null
        };
        return demoState;
      }
    },
    demoAiAttempt: {
      count: async ({ where }: any) => {
        let count = 0;
        for (const at of attempts.values()) {
          if (at >= where.attemptedAt.gte && at <= where.attemptedAt.lte) count += 1;
        }
        return count;
      },
      create: async ({ data }: any) => {
        if (attempts.has(data.providerCallId)) {
          const error: any = new Error("duplicate");
          error.code = "P2002";
          error.constructor = { name: "PrismaClientKnownRequestError" };
          throw error;
        }
        attempts.set(data.providerCallId, data.attemptedAt);
        return data;
      }
    },
    $transaction: async (fn: any) => fn(prisma)
  } as any;

  return {
    prisma,
    setDemoState(start: Date, end: Date) {
      demoState = { demoStartedAt: start, demoEndsAt: end };
    },
    addAttempt(providerCallId: string, attemptedAt: Date) {
      attempts.set(providerCallId, attemptedAt);
    },
    getUpsertCount() {
      return upsertCount;
    }
  };
}

test("getDemoState allowStart=false never starts demo window", async () => {
  const mock = createPrismaMock();
  const now = new Date("2026-03-03T12:00:00.000Z");
  const state = await getDemoState({
    prisma: mock.prisma,
    orgId: "org_1",
    subscriptionStatus: "inactive",
    now,
    allowStart: false,
    providerCallId: "CA_1"
  });
  assert.equal(state.mode, "GUIDED_DEMO");
  assert.equal(state.state, "ACTIVE");
  assert.equal(state.windowEndsAt, null);
  assert.equal(mock.getUpsertCount(), 0);
});

test("reserveDemoAttemptOrReject rejects when post-insert count exceeds cap", async () => {
  const mock = createPrismaMock();
  const start = new Date("2026-03-03T00:00:00.000Z");
  const end = new Date("2026-03-10T00:00:00.000Z");
  mock.setDemoState(start, end);
  for (let i = 0; i < 15; i += 1) {
    mock.addAttempt(`CA_${i}`, new Date(start.getTime() + i * 1000));
  }
  const result = await reserveDemoAttemptOrReject({
    prisma: mock.prisma,
    orgId: "org_1",
    providerCallId: "CA_16",
    callerPhone: "+15163067876",
    now: new Date("2026-03-03T12:01:00.000Z")
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "OVER_CAP");
});

test("reserveDemoAttemptOrReject is idempotent for duplicate providerCallId", async () => {
  const mock = createPrismaMock();
  const now = new Date("2026-03-03T12:00:00.000Z");
  const first = await reserveDemoAttemptOrReject({
    prisma: mock.prisma,
    orgId: "org_1",
    providerCallId: "CA_DUP",
    callerPhone: "+15163067876",
    now
  });
  assert.equal(first.allowed, true);

  const second = await reserveDemoAttemptOrReject({
    prisma: mock.prisma,
    orgId: "org_1",
    providerCallId: "CA_DUP",
    callerPhone: "+15163067876",
    now: new Date("2026-03-03T12:00:05.000Z")
  });
  assert.equal(second.allowed, true);
  assert.equal(second.demo.callsUsed, 1);
});

