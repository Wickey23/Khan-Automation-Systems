import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "@prisma/client";
import {
  canManageCalendar,
  canManageOrgAdminFeature,
  canReadAppointments,
  canViewNotificationForRole,
  canWriteAppointments,
  canWriteOrgFeature
} from "../org-rbac.service";

test("viewer role can read appointments but cannot write org features", () => {
  assert.equal(canReadAppointments(UserRole.CLIENT), true);
  assert.equal(canWriteAppointments(UserRole.CLIENT), false);
  assert.equal(canWriteOrgFeature(UserRole.CLIENT), false);
  assert.equal(canManageOrgAdminFeature(UserRole.CLIENT), false);
  assert.equal(canManageCalendar(UserRole.CLIENT), false);
});

test("manager role can write appointments and settings but cannot manage billing/admin calendar", () => {
  assert.equal(canReadAppointments(UserRole.CLIENT_STAFF), true);
  assert.equal(canWriteAppointments(UserRole.CLIENT_STAFF), true);
  assert.equal(canWriteOrgFeature(UserRole.CLIENT_STAFF), true);
  assert.equal(canManageOrgAdminFeature(UserRole.CLIENT_STAFF), false);
  assert.equal(canManageCalendar(UserRole.CLIENT_STAFF), false);
});

test("admin role can manage org admin features and calendar", () => {
  assert.equal(canReadAppointments(UserRole.CLIENT_ADMIN), true);
  assert.equal(canWriteAppointments(UserRole.CLIENT_ADMIN), true);
  assert.equal(canWriteOrgFeature(UserRole.CLIENT_ADMIN), true);
  assert.equal(canManageOrgAdminFeature(UserRole.CLIENT_ADMIN), true);
  assert.equal(canManageCalendar(UserRole.CLIENT_ADMIN), true);
});

test("notification visibility respects target role minimums", () => {
  assert.equal(canViewNotificationForRole(UserRole.CLIENT, "VIEWER"), true);
  assert.equal(canViewNotificationForRole(UserRole.CLIENT, "MANAGER"), false);
  assert.equal(canViewNotificationForRole(UserRole.CLIENT_STAFF, "MANAGER"), true);
  assert.equal(canViewNotificationForRole(UserRole.CLIENT_STAFF, "ADMIN"), false);
  assert.equal(canViewNotificationForRole(UserRole.CLIENT_ADMIN, "ADMIN"), true);
});
