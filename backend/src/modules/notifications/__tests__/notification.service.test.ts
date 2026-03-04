import assert from "node:assert/strict";
import test from "node:test";
import { emitOrgNotification, resolveNotificationTargetRoleMin } from "../notification.service";

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

test("emitOrgNotification tolerates business-settings schema drift when resolving email recipients", async () => {
  const mockPrisma = {
    orgNotification: {
      create: async ({ data }: any) => ({ id: "notif_1", ...data })
    },
    businessSettings: {
      findUnique: async () => {
        throw new Error("P2022: The column BusinessSettings.notificationEmailRecipientsJson does not exist");
      }
    },
    user: {
      findMany: async () => []
    }
  } as any;

  const notification = await emitOrgNotification({
    prisma: mockPrisma,
    orgId: "org_1",
    type: "NEW_LEAD_CAPTURED",
    severity: "INFO",
    title: "Lead captured",
    body: "A new lead was captured."
  });

  assert.equal(notification.orgId, "org_1");
  assert.equal(notification.type, "NEW_LEAD_CAPTURED");
});
