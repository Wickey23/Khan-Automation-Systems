import assert from "node:assert/strict";
import test from "node:test";
import type { Router } from "express";
import { prisma } from "../../../../lib/prisma";
import { vapiRouter } from "../vapi.routes";
import * as finalizer from "../vapi-booking-finalizer.service";

function getRouteHandler(router: Router, path: string, method: "post") {
  const layer = (router as any).stack.find((entry: any) => entry?.route?.path === path && entry.route.methods?.[method]);
  if (!layer) throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  const stack = layer.route.stack || [];
  const handler = stack[stack.length - 1]?.handle;
  if (typeof handler !== "function") throw new Error(`Handler missing for ${method.toUpperCase()} ${path}`);
  return handler as (req: any, res: any) => Promise<unknown>;
}

function createMockResponse() {
  const state: { statusCode: number; body: unknown } = { statusCode: 200, body: null };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      state.body = payload;
      return res;
    }
  };
  return { res, state };
}

test("Vapi webhook returns 200 when downstream failure happens after durable persistence", async () => {
  const handler = getRouteHandler(vapiRouter, "/webhook", "post");
  const originalPersist = finalizer.persistVapiWebhookEvent;
  const originalEnqueue = finalizer.enqueueFinalizeBookingJob;
  const originalCallLogUpsert = prisma.callLog.upsert;
  const originalWebhookLogCreate = prisma.webhookEventLog.create;
  const originalAuditCreate = prisma.auditLog.create;

  (finalizer as any).persistVapiWebhookEvent = async () => null;
  (finalizer as any).enqueueFinalizeBookingJob = async () => null;
  (prisma.callLog as any).upsert = async () => {
    throw new Error("downstream_failure");
  };
  (prisma.webhookEventLog as any).create = async () => ({ id: "log_1" });
  (prisma.auditLog as any).create = async () => ({ id: "audit_1" });

  try {
    const { res, state } = createMockResponse();
    await handler(
      {
        body: {
          messageType: "end-of-call-report",
          callSid: "call_retry_1",
          orgId: "org_1"
        },
        headers: {},
        header() {
          return "";
        },
        requestId: "req_vapi_1"
      },
      res
    );
    assert.equal(state.statusCode, 200);
    assert.equal((state.body as any)?.ok, true);
  } finally {
    (finalizer as any).persistVapiWebhookEvent = originalPersist;
    (finalizer as any).enqueueFinalizeBookingJob = originalEnqueue;
    (prisma.callLog as any).upsert = originalCallLogUpsert;
    (prisma.webhookEventLog as any).create = originalWebhookLogCreate;
    (prisma.auditLog as any).create = originalAuditCreate;
  }
});

test("Vapi webhook safe-ignores schema-invalid payloads with 200", async () => {
  const handler = getRouteHandler(vapiRouter, "/webhook", "post");
  const originalWebhookLogCreate = prisma.webhookEventLog.create;
  const originalAuditCreate = prisma.auditLog.create;
  (prisma.webhookEventLog as any).create = async () => ({ id: "log_2" });
  (prisma.auditLog as any).create = async () => ({ id: "audit_2" });

  try {
    const { res, state } = createMockResponse();
    await handler(
      {
        body: [],
        headers: {},
        header() {
          return "";
        },
        requestId: "req_vapi_2"
      },
      res
    );
    assert.equal(state.statusCode, 200);
    assert.equal((state.body as any)?.data?.ignored, true);
  } finally {
    (prisma.webhookEventLog as any).create = originalWebhookLogCreate;
    (prisma.auditLog as any).create = originalAuditCreate;
  }
});

test("Vapi webhook returns retry-worthy 500 when actionable event fails before durable persistence", async () => {
  const handler = getRouteHandler(vapiRouter, "/webhook", "post");
  const originalPersist = finalizer.persistVapiWebhookEvent;
  const originalAuditCreate = prisma.auditLog.create;
  const originalWebhookLogCreate = prisma.webhookEventLog.create;

  (finalizer as any).persistVapiWebhookEvent = async () => {
    throw new Error("persist_failed");
  };
  (prisma.auditLog as any).create = async () => ({ id: "audit_3" });
  (prisma.webhookEventLog as any).create = async () => ({ id: "log_3" });

  try {
    const { res, state } = createMockResponse();
    await handler(
      {
        body: {
          messageType: "end-of-call-report",
          callSid: "call_retry_2"
        },
        headers: {},
        header() {
          return "";
        },
        requestId: "req_vapi_3"
      },
      res
    );

    assert.equal(state.statusCode, 500);
    assert.equal((state.body as any)?.retry, true);
  } finally {
    (finalizer as any).persistVapiWebhookEvent = originalPersist;
    (prisma.auditLog as any).create = originalAuditCreate;
    (prisma.webhookEventLog as any).create = originalWebhookLogCreate;
  }
});
