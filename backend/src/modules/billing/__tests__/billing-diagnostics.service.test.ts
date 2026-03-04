import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "@prisma/client";
import { env } from "../../../config/env";
import {
  computeBillingDiagnostics,
  computeOverallStatus,
  isPlaceholder,
  mapStripeErrorToDiagnostic,
  type BillingDiagnosticCheck
} from "../billing-diagnostics.service";

function testSequential(name: string, fn: () => void | Promise<void>) {
  return test(name, { concurrency: false }, fn);
}

type EnvSnapshot = Record<string, string | undefined>;

function snapshotEnv(keys: string[]): EnvSnapshot {
  return keys.reduce<EnvSnapshot>((acc, key) => {
    acc[key] = (env as Record<string, string | undefined>)[key];
    return acc;
  }, {});
}

function restoreEnv(snapshot: EnvSnapshot) {
  Object.entries(snapshot).forEach(([key, value]) => {
    (env as Record<string, string | undefined>)[key] = value;
  });
}

function makePrismaMock(input?: {
  orgId?: string | null;
  stripeCustomerId?: string | null;
  subscription?: { status: string; stripeCustomerId: string; stripeSubscriptionId: string } | null;
}) {
  const orgId = input?.orgId ?? "org_1";
  return {
    user: {
      findUnique: async () => ({ orgId })
    },
    organization: {
      findUnique: async () =>
        orgId
          ? {
              id: orgId,
              stripeCustomerId: input && "stripeCustomerId" in input ? input.stripeCustomerId || null : "cus_123",
              subscriptionStatus: input?.subscription?.status ?? "active"
            }
          : null
    },
    subscription: {
      findFirst: async () =>
        input && "subscription" in input
          ? input.subscription
          : { status: "active", stripeCustomerId: "cus_123", stripeSubscriptionId: "sub_123" }
    }
  } as any;
}

function makeStripeMock(handler: (priceId: string) => Promise<any>) {
  return {
    prices: {
      retrieve: handler
    }
  } as any;
}

testSequential("isPlaceholder detects placeholder patterns", () => {
  assert.equal(isPlaceholder(""), true);
  assert.equal(isPlaceholder("REPLACE_ME"), true);
  assert.equal(isPlaceholder("test_secret"), true);
  assert.equal(isPlaceholder("sk_live_real_value"), false);
});

testSequential("mapStripeErrorToDiagnostic classifies timeout", () => {
  const mapped = mapStripeErrorToDiagnostic({ reasonCode: "STRIPE_PING_TIMEOUT" });
  assert.equal(mapped.reasonCode, "STRIPE_PING_TIMEOUT");
  assert.equal(mapped.failureClass, "AUTH_OR_NETWORK");
});

testSequential("computeOverallStatus follows deterministic policy", () => {
  const base: { config: BillingDiagnosticCheck[]; stripe: BillingDiagnosticCheck[]; orgLinkage: BillingDiagnosticCheck[] } = {
    config: [{ key: "c", status: "PASS", message: "ok" }],
    stripe: [{ key: "stripeApiReachable", status: "PASS", message: "ok" }],
    orgLinkage: [{ key: "s", status: "PASS", message: "ok" }]
  };
  assert.equal(computeOverallStatus(base), "HEALTHY");
  assert.equal(
    computeOverallStatus({
      ...base,
      orgLinkage: [{ key: "s", status: "WARN", message: "warn" }]
    }),
    "NEEDS_ACTION"
  );
  assert.equal(
    computeOverallStatus({
      ...base,
      config: [{ key: "c", status: "FAIL", message: "fail" }]
    }),
    "BLOCKED"
  );
});

testSequential("computeBillingDiagnostics flags malformed checkout URLs as config fail", async () => {
  const keys = ["STRIPE_SECRET_KEY", "STRIPE_STARTER_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_SUCCESS_URL", "STRIPE_CANCEL_URL"];
  const snap = snapshotEnv(keys);
  (env as any).STRIPE_SECRET_KEY = "sk_live_valid_key";
  (env as any).STRIPE_STARTER_PRICE_ID = "price_starter_real";
  (env as any).STRIPE_PRO_PRICE_ID = "price_pro_real";
  (env as any).STRIPE_SUCCESS_URL = "not-a-url";
  (env as any).STRIPE_CANCEL_URL = "https://example.com/cancel";

  const diagnostics = await computeBillingDiagnostics({
    prisma: makePrismaMock(),
    stripe: makeStripeMock(async () => ({ id: "price_starter_real", active: true })),
    auth: { userId: "u1", orgId: "org_1", role: UserRole.CLIENT_ADMIN },
    detailed: true,
    stripeTimeoutMs: 50,
    now: new Date("2026-03-03T00:00:00.000Z")
  });

  restoreEnv(snap);
  assert.equal(diagnostics.summary.overall, "BLOCKED");
  assert.equal(diagnostics.detailed, true);
});

testSequential("computeBillingDiagnostics summary mode omits checks payload", async () => {
  const keys = ["STRIPE_SECRET_KEY", "STRIPE_STARTER_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_SUCCESS_URL", "STRIPE_CANCEL_URL"];
  const snap = snapshotEnv(keys);
  (env as any).STRIPE_SECRET_KEY = "sk_live_valid_key";
  (env as any).STRIPE_STARTER_PRICE_ID = "price_starter_real";
  (env as any).STRIPE_PRO_PRICE_ID = "price_pro_real";
  (env as any).STRIPE_SUCCESS_URL = "https://example.com/success";
  (env as any).STRIPE_CANCEL_URL = "https://example.com/cancel";

  const diagnostics = await computeBillingDiagnostics({
    prisma: makePrismaMock(),
    stripe: makeStripeMock(async () => ({ id: "price_starter_real", active: true })),
    auth: { userId: "u2", orgId: "org_2", role: UserRole.CLIENT_STAFF },
    detailed: false,
    stripeTimeoutMs: 50,
    now: new Date("2026-03-03T00:00:00.000Z")
  });

  restoreEnv(snap);
  assert.equal(diagnostics.detailed, false);
  assert.equal("checks" in diagnostics, false);
});

testSequential("computeBillingDiagnostics detailed mode includes checks payload", async () => {
  const keys = ["STRIPE_SECRET_KEY", "STRIPE_STARTER_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_SUCCESS_URL", "STRIPE_CANCEL_URL"];
  const snap = snapshotEnv(keys);
  (env as any).STRIPE_SECRET_KEY = "sk_live_valid_key";
  (env as any).STRIPE_STARTER_PRICE_ID = "price_starter_real";
  (env as any).STRIPE_PRO_PRICE_ID = "price_pro_real";
  (env as any).STRIPE_SUCCESS_URL = "https://example.com/success";
  (env as any).STRIPE_CANCEL_URL = "https://example.com/cancel";

  const diagnostics = await computeBillingDiagnostics({
    prisma: makePrismaMock(),
    stripe: makeStripeMock(async () => ({ id: "price_starter_real", active: true })),
    auth: { userId: "u3", orgId: "org_3", role: UserRole.CLIENT_ADMIN },
    detailed: true,
    stripeTimeoutMs: 50,
    now: new Date("2026-03-03T00:00:00.000Z")
  });

  restoreEnv(snap);
  assert.equal(diagnostics.detailed, true);
  assert.equal("checks" in diagnostics, true);
});

testSequential("stripe reachability stays PASS when both price checks are resource-missing", async () => {
  const keys = ["STRIPE_SECRET_KEY", "STRIPE_STARTER_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_SUCCESS_URL", "STRIPE_CANCEL_URL"];
  const snap = snapshotEnv(keys);
  (env as any).STRIPE_SECRET_KEY = "sk_live_valid_key";
  (env as any).STRIPE_STARTER_PRICE_ID = "price_missing_1";
  (env as any).STRIPE_PRO_PRICE_ID = "price_missing_2";
  (env as any).STRIPE_SUCCESS_URL = "https://example.com/success";
  (env as any).STRIPE_CANCEL_URL = "https://example.com/cancel";

  const diagnostics = await computeBillingDiagnostics({
    prisma: makePrismaMock(),
    stripe: makeStripeMock(async () => {
      throw {
        message: "No such price: 'price_missing_1'",
        code: "resource_missing",
        type: "invalid_request_error",
        statusCode: 404
      };
    }),
    auth: { userId: "u4", orgId: "org_4", role: UserRole.CLIENT_ADMIN },
    detailed: true,
    stripeTimeoutMs: 50,
    now: new Date("2026-03-03T00:00:00.000Z")
  });

  restoreEnv(snap);
  assert.equal(diagnostics.detailed, true);
  if ("checks" in diagnostics) {
    const reach = diagnostics.checks.stripe.find((check) => check.key === "stripeApiReachable");
    assert.equal(reach?.status, "PASS");
  } else {
    assert.fail("expected detailed checks payload");
  }
});

testSequential("stripe timeout is classified and remains non-blocking endpoint result", async () => {
  const keys = ["STRIPE_SECRET_KEY", "STRIPE_STARTER_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_SUCCESS_URL", "STRIPE_CANCEL_URL"];
  const snap = snapshotEnv(keys);
  (env as any).STRIPE_SECRET_KEY = "sk_live_valid_key";
  (env as any).STRIPE_STARTER_PRICE_ID = "price_timeout_1";
  (env as any).STRIPE_PRO_PRICE_ID = "price_timeout_2";
  (env as any).STRIPE_SUCCESS_URL = "https://example.com/success";
  (env as any).STRIPE_CANCEL_URL = "https://example.com/cancel";

  const diagnostics = await computeBillingDiagnostics({
    prisma: makePrismaMock(),
    stripe: makeStripeMock(async () => new Promise(() => undefined)),
    auth: { userId: "u5", orgId: "org_5", role: UserRole.CLIENT_ADMIN },
    detailed: true,
    stripeTimeoutMs: 20,
    now: new Date("2026-03-03T00:00:00.000Z")
  });

  restoreEnv(snap);
  assert.equal(diagnostics.detailed, true);
  if ("checks" in diagnostics) {
    const firstFail = diagnostics.checks.stripe.find((check) => check.reasonCode === "STRIPE_PING_TIMEOUT");
    assert.equal(Boolean(firstFail), true);
  }
});

testSequential("missing subscription leads to NEEDS_ACTION when no blocking failures exist", async () => {
  const keys = ["STRIPE_SECRET_KEY", "STRIPE_STARTER_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_SUCCESS_URL", "STRIPE_CANCEL_URL"];
  const snap = snapshotEnv(keys);
  (env as any).STRIPE_SECRET_KEY = "sk_live_valid_key";
  (env as any).STRIPE_STARTER_PRICE_ID = "price_starter_real";
  (env as any).STRIPE_PRO_PRICE_ID = "price_pro_real";
  (env as any).STRIPE_SUCCESS_URL = "https://example.com/success";
  (env as any).STRIPE_CANCEL_URL = "https://example.com/cancel";

  const diagnostics = await computeBillingDiagnostics({
    prisma: makePrismaMock({
      subscription: null,
      stripeCustomerId: null
    }),
    stripe: makeStripeMock(async () => ({ id: "price_starter_real", active: true })),
    auth: { userId: "u6", orgId: "org_6", role: UserRole.CLIENT_ADMIN },
    detailed: true,
    stripeTimeoutMs: 50,
    now: new Date("2026-03-03T00:00:00.000Z")
  });

  restoreEnv(snap);
  assert.equal(diagnostics.summary.overall, "NEEDS_ACTION");
});
