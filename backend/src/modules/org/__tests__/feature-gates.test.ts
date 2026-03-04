import assert from "node:assert/strict";
import test from "node:test";
import { isFeatureEnabledForOrg } from "../feature-gates";

test("feature gate disabled when feature flag false", () => {
  assert.equal(isFeatureEnabledForOrg("false", "org_1", ""), false);
  assert.equal(isFeatureEnabledForOrg(undefined, "org_1", ""), false);
});

test("feature gate enabled for all orgs when no allowlist configured", () => {
  assert.equal(isFeatureEnabledForOrg("true", "org_1", ""), true);
  assert.equal(isFeatureEnabledForOrg("true", "org_2", undefined), true);
});

test("feature gate enforces explicit allowlist", () => {
  assert.equal(isFeatureEnabledForOrg("true", "org_a", "org_a,org_b"), true);
  assert.equal(isFeatureEnabledForOrg("true", "org_c", "org_a,org_b"), false);
});

test("feature gate supports wildcard and all tokens", () => {
  assert.equal(isFeatureEnabledForOrg("true", "org_any", "*"), true);
  assert.equal(isFeatureEnabledForOrg("true", "org_any", "all"), true);
});

