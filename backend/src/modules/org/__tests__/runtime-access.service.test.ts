import assert from "node:assert/strict";
import test from "node:test";
import { hasActiveBilling } from "../runtime-access.service";

test("hasActiveBilling returns false when no subscription exists", async () => {
  const prisma = {
    subscription: {
      findFirst: async () => null
    }
  } as any;
  const result = await hasActiveBilling(prisma, "org_1");
  assert.equal(result, false);
});

test("hasActiveBilling returns true for active subscription status", async () => {
  const prisma = {
    subscription: {
      findFirst: async () => ({ status: "active" })
    }
  } as any;
  const result = await hasActiveBilling(prisma, "org_1");
  assert.equal(result, true);
});
