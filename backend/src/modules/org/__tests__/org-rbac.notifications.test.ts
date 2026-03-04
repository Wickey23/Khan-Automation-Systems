import assert from "node:assert/strict";
import test from "node:test";
import { canViewNotificationForRole } from "../org-rbac.service";

test("viewer can only view VIEWER notifications", () => {
  assert.equal(canViewNotificationForRole("CLIENT", "VIEWER"), true);
  assert.equal(canViewNotificationForRole("CLIENT", "MANAGER"), false);
  assert.equal(canViewNotificationForRole("CLIENT", "ADMIN"), false);
});

test("manager can view VIEWER and MANAGER notifications", () => {
  assert.equal(canViewNotificationForRole("CLIENT_STAFF", "VIEWER"), true);
  assert.equal(canViewNotificationForRole("CLIENT_STAFF", "MANAGER"), true);
  assert.equal(canViewNotificationForRole("CLIENT_STAFF", "ADMIN"), false);
});

test("admin tiers can view all notifications", () => {
  assert.equal(canViewNotificationForRole("CLIENT_ADMIN", "VIEWER"), true);
  assert.equal(canViewNotificationForRole("CLIENT_ADMIN", "MANAGER"), true);
  assert.equal(canViewNotificationForRole("CLIENT_ADMIN", "ADMIN"), true);
  assert.equal(canViewNotificationForRole("SUPER_ADMIN", "ADMIN"), true);
});

