import assert from "node:assert/strict";
import test from "node:test";
import { updateTwilioCallStatus } from "../call-log.service";

test("updateTwilioCallStatus associates child leg callback back to canonical inbound row via ParentCallSid", async () => {
  let updateWhere: Record<string, unknown> | null = null;
  let updateData: Record<string, unknown> | null = null;

  const prisma = {
    callLog: {
      findFirst: async ({ where }: any) => {
        if (where.providerCallId === "CAchild") return null;
        if (where.providerCallId === "CAparent") {
          return {
            id: "call_1",
            providerCallId: "CAparent",
            parentCallSid: null,
            accountSid: null,
            callStatus: "initiated",
            dialCallStatus: null,
            answeredBy: null,
            answeredAt: null,
            endedAt: null,
            completedAt: null,
            durationSec: null,
            missedReason: null,
            forwardedToNumber: "+15165550199",
            transferredAt: new Date(),
            unansweredTransfer: false,
            outcome: "MESSAGE_TAKEN"
          };
        }
        return null;
      },
      update: async ({ where, data }: any) => {
        updateWhere = where;
        updateData = data;
        return { id: "call_1", ...data };
      }
    }
  } as any;

  await updateTwilioCallStatus({
    prisma,
    callSid: "CAchild",
    parentCallSid: "CAparent",
    payload: {
      CallSid: "CAchild",
      ParentCallSid: "CAparent",
      CallStatus: "completed",
      DialCallStatus: "completed",
      CallDuration: "42"
    }
  });

  const saved = updateData as Record<string, unknown> | null;
  assert.deepEqual(updateWhere, { id: "call_1" });
  assert.equal((saved?.dialCallStatus as string) || "", "completed");
  assert.equal(saved?.durationSec, 42);
});
