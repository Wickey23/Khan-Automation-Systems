import assert from "node:assert/strict";
import test from "node:test";
import { resolveNotificationTargetRoleMin } from "../notification.service";

test("explicit target role override is respected", () => {
  const result = resolveNotificationTargetRoleMin({
    type: "NEW_LEAD_CAPTURED",
    severity: "INFO",
    targetRoleMin: "ADMIN"
  });
  assert.equal(result, "ADMIN");
});

test("emergency and action-required notifications default to manager visibility", () => {
  assert.equal(
    resolveNotificationTargetRoleMin({
      type: "EMERGENCY_CALL_FLAGGED",
      severity: "URGENT"
    }),
    "MANAGER"
  );
  assert.equal(
    resolveNotificationTargetRoleMin({
      type: "MISSED_CALL_RECOVERY_NEEDED",
      severity: "ACTION_REQUIRED"
    }),
    "MANAGER"
  );
});

test("informational notifications default to viewer visibility", () => {
  const result = resolveNotificationTargetRoleMin({
    type: "APPOINTMENT_BOOKED",
    severity: "INFO"
  });
  assert.equal(result, "VIEWER");
});
