import assert from "node:assert/strict";
import test from "node:test";
import { OrganizationStatus } from "@prisma/client";
import { deriveOrgLifecycleFromBilling } from "../billing-lifecycle.service";

test("active billing moves non-live org to ONBOARDING", () => {
  const next = deriveOrgLifecycleFromBilling({
    currentStatus: OrganizationStatus.NEW,
    currentLive: false,
    billingActive: true
  });
  assert.equal(next.status, OrganizationStatus.ONBOARDING);
  assert.equal(next.live, false);
});

test("inactive billing pauses org and disables live", () => {
  const next = deriveOrgLifecycleFromBilling({
    currentStatus: OrganizationStatus.LIVE,
    currentLive: true,
    billingActive: false
  });
  assert.equal(next.status, OrganizationStatus.PAUSED);
  assert.equal(next.live, false);
});

test("active billing preserves LIVE status when org is already live", () => {
  const next = deriveOrgLifecycleFromBilling({
    currentStatus: OrganizationStatus.LIVE,
    currentLive: true,
    billingActive: true
  });
  assert.equal(next.status, OrganizationStatus.LIVE);
  assert.equal(next.live, true);
});
