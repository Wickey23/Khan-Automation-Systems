import assert from "node:assert/strict";
import test from "node:test";
import { SubscriptionPlan } from "@prisma/client";
import { isTeamFeatureAvailableForSubscription } from "../team-plan.service";

test("team feature is available only for active/trialing pro subscriptions", () => {
  assert.equal(
    isTeamFeatureAvailableForSubscription({
      plan: SubscriptionPlan.PRO,
      status: "active"
    }),
    true
  );
  assert.equal(
    isTeamFeatureAvailableForSubscription({
      plan: SubscriptionPlan.PRO,
      status: "trialing"
    }),
    true
  );
});

test("team feature is unavailable for starter or non-active statuses", () => {
  assert.equal(
    isTeamFeatureAvailableForSubscription({
      plan: SubscriptionPlan.STARTER,
      status: "active"
    }),
    false
  );
  assert.equal(
    isTeamFeatureAvailableForSubscription({
      plan: SubscriptionPlan.PRO,
      status: "past_due"
    }),
    false
  );
  assert.equal(
    isTeamFeatureAvailableForSubscription({
      plan: SubscriptionPlan.PRO,
      status: null
    }),
    false
  );
});

