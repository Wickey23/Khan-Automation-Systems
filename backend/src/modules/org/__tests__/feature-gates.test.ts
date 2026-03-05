import assert from "node:assert/strict";
import test from "node:test";
import { isFeatureEnabledForOrg } from "../feature-gates";

test("feature disabled when base flag is false", () => {
  assert.equal(isFeatureEnabledForOrg("false", "org_1", ""), false);
  assert.equal(isFeatureEnabledForOrg(undefined, "org_1", ""), false);
});

test("feature enabled for all orgs when base flag true and allowlist empty", () => {
  assert.equal(isFeatureEnabledForOrg("true", "org_1", ""), true);
  assert.equal(isFeatureEnabledForOrg("true", "org_2", undefined), true);
});

test("feature enabled only for allowlisted org when allowlist configured", () => {
  assert.equal(isFeatureEnabledForOrg("true", "org_1", "org_1,org_2"), true);
  assert.equal(isFeatureEnabledForOrg("true", "org_3", "org_1,org_2"), false);
  assert.equal(isFeatureEnabledForOrg("true", null, "org_1,org_2"), false);
});

test("feature supports wildcard allowlist", () => {
  assert.equal(isFeatureEnabledForOrg("true", "org_1", "*"), true);
  assert.equal(isFeatureEnabledForOrg("true", "org_1", "all"), true);
});
