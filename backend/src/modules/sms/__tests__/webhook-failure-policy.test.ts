import assert from "node:assert/strict";
import test from "node:test";
import type { Router } from "express";
import { prisma } from "../../../lib/prisma";
import { smsRouter } from "../sms.routes";

function getRouteHandler(router: Router, path: string, method: "post") {
  const layer = (router as any).stack.find((entry: any) => entry?.route?.path === path && entry.route.methods?.[method]);
  if (!layer) throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  const stack = layer.route.stack || [];
  const handler = stack[stack.length - 1]?.handle;
  if (typeof handler !== "function") throw new Error(`Handler missing for ${method.toUpperCase()} ${path}`);
  return handler as (req: any, res: any) => Promise<unknown>;
}

function createMockResponse() {
  const state: { statusCode: number; body: unknown; contentType: string | null } = {
    statusCode: 200,
    body: null,
    contentType: null
  };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      state.body = payload;
      return res;
    },
    type(contentType: string) {
      state.contentType = contentType;
      return res;
    },
    send(payload: unknown) {
      state.body = payload;
      return res;
    }
  };
  return { res, state };
}

test("Twilio inbound SMS returns retry-worthy 500 on actionable pre-durable failure", async () => {
  const handler = getRouteHandler(smsRouter, "/", "post");
  const messageSid = `SM_retry_${Date.now()}`;
  const originalPhoneFindFirst = prisma.phoneNumber.findFirst;
  const originalAuditCreate = prisma.auditLog.create;

  (prisma.phoneNumber as any).findFirst = async () => {
    throw new Error("db_down");
  };
  (prisma.auditLog as any).create = async () => ({ id: "audit_1" });

  try {
    const { res, state } = createMockResponse();
    await handler(
      {
        body: {
          MessageSid: messageSid,
          From: "+15165550000",
          To: "+15165550001",
          Body: "1"
        },
        requestId: "req_sms_1"
      },
      res
    );
    assert.equal(state.statusCode, 500);
    assert.equal(state.contentType, "text/xml");
  } finally {
    (prisma.phoneNumber as any).findFirst = originalPhoneFindFirst;
    (prisma.auditLog as any).create = originalAuditCreate;
  }
});

test("Twilio status callback returns retry-worthy 500 on pre-durable update failure", async () => {
  const handler = getRouteHandler(smsRouter, "/status", "post");
  const messageSid = `SM_status_${Date.now()}`;
  const originalMessageFindFirst = prisma.message.findFirst;
  const originalMessageUpdateMany = prisma.message.updateMany;
  const originalAuditCreate = prisma.auditLog.create;

  (prisma.message as any).findFirst = async () => ({ orgId: "org_1" });
  (prisma.message as any).updateMany = async () => {
    throw new Error("db_down");
  };
  (prisma.auditLog as any).create = async () => ({ id: "audit_2" });

  try {
    const { res, state } = createMockResponse();
    await handler(
      {
        body: {
          MessageSid: messageSid,
          MessageStatus: "delivered"
        },
        query: {},
        requestId: "req_sms_status_1"
      },
      res
    );
    assert.equal(state.statusCode, 500);
    assert.equal((state.body as any)?.retry, true);
  } finally {
    (prisma.message as any).findFirst = originalMessageFindFirst;
    (prisma.message as any).updateMany = originalMessageUpdateMany;
    (prisma.auditLog as any).create = originalAuditCreate;
  }
});

test("Twilio status callback safe-ignores mismatched query org when stored message belongs to another org", async () => {
  const handler = getRouteHandler(smsRouter, "/status", "post");
  const messageSid = `SM_status_mismatch_${Date.now()}`;
  const originalMessageFindFirst = prisma.message.findFirst;
  const originalMessageUpdateMany = prisma.message.updateMany;
  const originalAuditCreate = prisma.auditLog.create;

  let updateWhere: unknown = null;
  (prisma.message as any).findFirst = async () => ({ orgId: "org_actual" });
  (prisma.message as any).updateMany = async (args: any) => {
    updateWhere = args.where;
    return { count: 1 };
  };
  (prisma.auditLog as any).create = async () => ({ id: "audit_3" });

  try {
    const { res, state } = createMockResponse();
    await handler(
      {
        body: {
          MessageSid: messageSid,
          MessageStatus: "delivered"
        },
        query: { orgId: "org_wrong" },
        requestId: "req_sms_status_2"
      },
      res
    );
    assert.equal(state.statusCode, 200);
    assert.deepEqual(updateWhere, { orgId: "org_actual", providerMessageId: messageSid });
  } finally {
    (prisma.message as any).findFirst = originalMessageFindFirst;
    (prisma.message as any).updateMany = originalMessageUpdateMany;
    (prisma.auditLog as any).create = originalAuditCreate;
  }
});

test("Twilio status callback safe-ignores unknown messages instead of marking durable success", async () => {
  const handler = getRouteHandler(smsRouter, "/status", "post");
  const messageSid = `SM_status_missing_${Date.now()}`;
  const originalMessageFindFirst = prisma.message.findFirst;
  const originalMessageUpdateMany = prisma.message.updateMany;
  const originalAuditCreate = prisma.auditLog.create;

  (prisma.message as any).findFirst = async () => null;
  (prisma.message as any).updateMany = async () => ({ count: 0 });
  (prisma.auditLog as any).create = async () => ({ id: "audit_4" });

  try {
    const { res, state } = createMockResponse();
    await handler(
      {
        body: {
          MessageSid: messageSid,
          MessageStatus: "delivered"
        },
        query: {},
        requestId: "req_sms_status_3"
      },
      res
    );
    assert.equal(state.statusCode, 200);
    assert.equal((state.body as any)?.ignored, true);
  } finally {
    (prisma.message as any).findFirst = originalMessageFindFirst;
    (prisma.message as any).updateMany = originalMessageUpdateMany;
    (prisma.auditLog as any).create = originalAuditCreate;
  }
});
