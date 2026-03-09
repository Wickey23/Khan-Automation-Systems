import assert from "node:assert/strict";
import test from "node:test";

type SecurityAlertModule = typeof import("../security-alert.service");

function loadSecurityAlertModule(): SecurityAlertModule {
  process.env.FEATURE_NOTIFICATIONS_V1_ENABLED = "true";
  process.env.FEATURE_PHASE1_ORG_ALLOWLIST = "*";

  const envPath = require.resolve("../../../config/env");
  const featureGatesPath = require.resolve("../../org/feature-gates");
  const notificationServicePath = require.resolve("../notification.service");
  const securityAlertPath = require.resolve("../security-alert.service");

  delete require.cache[envPath];
  delete require.cache[featureGatesPath];
  delete require.cache[notificationServicePath];
  delete require.cache[securityAlertPath];

  return require("../security-alert.service") as SecurityAlertModule;
}

test("webhook retry alert emits one org notification after threshold and dedupes within window", async () => {
  const { maybeEmitWebhookRetryAlert } = loadSecurityAlertModule();
  const createdNotifications: Array<Record<string, unknown>> = [];
  const createdAudits: Array<Record<string, unknown>> = [];
  const mockPrisma = {
    auditLog: {
      count: async () => 3,
      findFirst: async ({ where }: any) => {
        if (where.action === "SECURITY_ALERT_WEBHOOK_RETRY_FAILURE_SPIKE") return null;
        return null;
      },
      create: async ({ data }: any) => {
        createdAudits.push(data);
        return { id: `audit_${createdAudits.length}`, ...data };
      }
    },
    orgNotification: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        createdNotifications.push(data);
        return { id: `notif_${createdNotifications.length}`, ...data };
      }
    },
    businessSettings: {
      findUnique: async () => null
    },
    user: {
      findMany: async () => []
    }
  } as any;

  await maybeEmitWebhookRetryAlert({
    prisma: mockPrisma,
    orgId: "org_1",
    provider: "TWILIO",
    endpoint: "/api/twilio/sms"
  });

  assert.equal(createdAudits.length, 1);
  assert.equal(createdNotifications.length, 1);

  mockPrisma.orgNotification.findFirst = async () => ({ id: "existing" });
  await maybeEmitWebhookRetryAlert({
    prisma: mockPrisma,
    orgId: "org_1",
    provider: "TWILIO",
    endpoint: "/api/twilio/sms"
  });

  assert.equal(createdNotifications.length, 1);
});

test("sms suppression alert emits org notification and system alert", async () => {
  const { maybeEmitSmsSuppressionAlert } = loadSecurityAlertModule();
  const createdAudits: Array<Record<string, unknown>> = [];
  const createdNotifications: Array<Record<string, unknown>> = [];
  const mockPrisma = {
    auditLog: {
      count: async () => 1,
      findFirst: async () => null,
      create: async ({ data }: any) => {
        createdAudits.push(data);
        return { id: "audit_1", ...data };
      }
    },
    orgNotification: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        createdNotifications.push(data);
        return { id: "notif_1", ...data };
      }
    },
    businessSettings: {
      findUnique: async () => null
    },
    user: {
      findMany: async () => []
    }
  } as any;

  await maybeEmitSmsSuppressionAlert({
    prisma: mockPrisma,
    orgId: "org_1",
    reason: "ORG_SMS_HOURLY_CAP",
    source: "request-offer",
    requestId: "req_1"
  });

  assert.equal(createdAudits.length, 1);
  assert.equal(createdNotifications.length, 1);
});

test("tool context rejected alert only emits after threshold", async () => {
  const { maybeEmitToolContextRejectedAlert } = loadSecurityAlertModule();
  const createdAudits: Array<Record<string, unknown>> = [];
  const mockPrisma = {
    auditLog: {
      count: async () => 5,
      findFirst: async () => null,
      create: async ({ data }: any) => {
        createdAudits.push(data);
        return { id: "audit_1", ...data };
      }
    }
  } as any;

  await maybeEmitToolContextRejectedAlert({
    prisma: mockPrisma,
    route: "/book-appointment"
  });

  assert.equal(createdAudits.length, 1);
  assert.equal(createdAudits[0]?.action, "SECURITY_ALERT_TOOL_CONTEXT_REJECTED_SPIKE");
});

test("webhook signature invalid alert emits system audit entry after threshold", async () => {
  const { maybeEmitWebhookSignatureInvalidAlert } = loadSecurityAlertModule();
  const createdAudits: Array<Record<string, unknown>> = [];
  const mockPrisma = {
    webhookEventLog: {
      count: async () => 5
    },
    auditLog: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        createdAudits.push(data);
        return { id: "audit_1", ...data };
      }
    }
  } as any;

  await maybeEmitWebhookSignatureInvalidAlert({
    prisma: mockPrisma,
    provider: "TWILIO",
    endpoint: "/api/twilio/sms",
    reason: "invalid_twilio_signature"
  });

  assert.equal(createdAudits.length, 1);
  assert.equal(createdAudits[0]?.action, "SECURITY_ALERT_WEBHOOK_SIGNATURE_INVALID_SPIKE");
});
