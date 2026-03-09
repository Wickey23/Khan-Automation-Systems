import assert from "node:assert/strict";
import test from "node:test";
import type { Router } from "express";
import { toolsRouter } from "../tools.routes";

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

test("protected tool routes reject explicit orgId without trusted call context", async () => {
  const cases = [
    {
      path: "/send-sms",
      body: { orgId: "org_foreign", to: "+15165550000", message: "test" }
    },
    {
      path: "/notify-manager",
      body: { orgId: "org_foreign", priority: "high", summary: "Escalate this call" }
    },
    {
      path: "/book-appointment",
      body: { orgId: "org_foreign", customerName: "Alex", customerPhone: "+15165550000" }
    },
    {
      path: "/request-appointment",
      body: { orgId: "org_foreign", requestedStartAt: "2026-03-10T10:00:00.000Z" }
    },
    {
      path: "/get-caller-context",
      body: { orgId: "org_foreign", callerPhone: "+15165550000" }
    },
    {
      path: "/get-customer-context",
      body: { orgId: "org_foreign", customerPhone: "+15165550000" }
    },
    {
      path: "/get-available-times",
      body: { orgId: "org_foreign", preferredDate: "2026-03-10" }
    },
    {
      path: "/create-lead-from-call",
      body: { orgId: "org_foreign", name: "Alex", phone: "+15165550000", message: "help" }
    }
  ] as const;

  for (const testCase of cases) {
    const handler = getRouteHandler(toolsRouter, testCase.path, "post");
    const { res, state } = createMockResponse();
    await handler({ body: testCase.body }, res);
    assert.equal(state.statusCode, 400, `Expected ${testCase.path} to reject without trusted context`);
    assert.equal((state.body as any)?.ok, false);
    assert.equal((state.body as any)?.error?.code, "MISSING_CALL_CONTEXT");
  }
});

test("transfer-call remains non-tenant-affecting even though it accepts orgId for validation", async () => {
  const handler = getRouteHandler(toolsRouter, "/transfer-call", "post");
  const { res, state } = createMockResponse();

  await handler(
    {
      body: {
        orgId: "org_foreign",
        transferTo: "+15165550000"
      }
    },
    res
  );

  assert.equal(state.statusCode, 200);
  assert.equal((state.body as any)?.ok, true);
  assert.equal((state.body as any)?.data?.transferTo, "+15165550000");
});
