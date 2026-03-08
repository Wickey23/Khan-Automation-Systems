import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import type { Router } from "express";
import { env } from "../../../config/env";
import { prisma } from "../../../lib/prisma";
import { stripeRouter } from "../stripe.routes";
import * as replayService from "../../ops/webhook-replay.service";

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
    },
    send(payload: unknown) {
      state.body = payload;
      return res;
    }
  };
  return { res, state };
}

test("duplicate Stripe webhook replay short-circuits before provisioning side effects", async () => {
  const handler = getRouteHandler(stripeRouter, "/webhook", "post");
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  const payload = JSON.stringify({
    id: "evt_duplicate_contract",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_123",
        object: "checkout.session",
        customer_details: { email: "user@example.com" },
        customer: "cus_123",
        subscription: "sub_123",
        metadata: { plan: "starter" }
      }
    }
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: env.STRIPE_WEBHOOK_SECRET
  });

  const originalReplay = replayService.registerWebhookReplay;
  const originalUserFindUnique = prisma.user.findUnique;
  const originalAuditCreate = prisma.auditLog.create;
  let userLookupCalled = false;

  (replayService as any).registerWebhookReplay = async () => ({ duplicate: true, record: null });
  (prisma.user as any).findUnique = async () => {
    userLookupCalled = true;
    return null;
  };
  (prisma.auditLog as any).create = async () => ({ id: "audit_1" });

  try {
    const { res, state } = createMockResponse();
    await handler(
      {
        headers: { "stripe-signature": signature },
        body: payload
      },
      res
    );

    assert.equal(state.statusCode, 200);
    assert.equal((state.body as any)?.duplicate, true);
    assert.equal(userLookupCalled, false);
  } finally {
    (replayService as any).registerWebhookReplay = originalReplay;
    (prisma.user as any).findUnique = originalUserFindUnique;
    (prisma.auditLog as any).create = originalAuditCreate;
  }
});
