import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "@prisma/client";
import {
  canManageOrgAdminFeature,
  canReadOrgFeature,
  canWriteOrgFeature
} from "../org-rbac.service";

test("org RBAC read matrix", () => {
  assert.equal(canReadOrgFeature(UserRole.CLIENT), true);
  assert.equal(canReadOrgFeature(UserRole.CLIENT_STAFF), true);
  assert.equal(canReadOrgFeature(UserRole.CLIENT_ADMIN), true);
  assert.equal(canReadOrgFeature(UserRole.ADMIN), true);
  assert.equal(canReadOrgFeature(UserRole.SUPER_ADMIN), true);
});

test("org RBAC write matrix", () => {
  assert.equal(canWriteOrgFeature(UserRole.CLIENT), false);
  assert.equal(canWriteOrgFeature(UserRole.CLIENT_STAFF), true);
  assert.equal(canWriteOrgFeature(UserRole.CLIENT_ADMIN), true);
  assert.equal(canWriteOrgFeature(UserRole.ADMIN), true);
  assert.equal(canWriteOrgFeature(UserRole.SUPER_ADMIN), true);
});

test("org RBAC admin-only matrix", () => {
  assert.equal(canManageOrgAdminFeature(UserRole.CLIENT), false);
  assert.equal(canManageOrgAdminFeature(UserRole.CLIENT_STAFF), false);
  assert.equal(canManageOrgAdminFeature(UserRole.CLIENT_ADMIN), true);
  assert.equal(canManageOrgAdminFeature(UserRole.ADMIN), true);
  assert.equal(canManageOrgAdminFeature(UserRole.SUPER_ADMIN), true);
});

