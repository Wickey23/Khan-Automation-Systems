import assert from "node:assert/strict";
import test from "node:test";
import { transitionCallState } from "../call-state.service";

function makePrismaMock(initialState: string | null = null) {
  const rows: Array<{ fromState: string | null; toState: string }> = [];
  let state = initialState;
  return {
    rows,
    prisma: {
      callLog: {
        findUnique: async () => ({ id: "call_1", orgId: "org_1", state, providerCallId: "sid_1" }),
        update: async ({ data }: any) => {
          state = data.state;
          return {};
        }
      },
      callStateTransition: {
        create: async ({ data }: any) => {
          rows.push({ fromState: data.fromState, toState: data.toState });
          return {};
        }
      },
      auditLog: {
        create: async () => ({})
      },
      $transaction: async (ops: Array<Promise<unknown>>) => Promise.all(ops)
    } as any
  };
}

test("call state transition accepts monotonic progression", async () => {
  const mock = makePrismaMock(null);
  const result = await transitionCallState({
    prisma: mock.prisma,
    callLogId: "call_1",
    toState: "RINGING"
  });
  assert.equal(result.accepted, true);
});

test("call state transition rejects stale transition", async () => {
  const mock = makePrismaMock("AI_ACTIVE");
  const result = await transitionCallState({
    prisma: mock.prisma,
    callLogId: "call_1",
    toState: "CONNECTED"
  });
  assert.equal(result.accepted, false);
  assert.equal((result as any).reason, "STALE_TRANSITION");
});

