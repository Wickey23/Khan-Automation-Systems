import assert from "node:assert/strict";
import crypto from "crypto";
import test from "node:test";
import { prisma } from "../../lib/prisma";
import { signStepUpToken } from "../../lib/auth";
import { requireStepUp } from "../require-step-up";

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    }
  };
}

test("requireStepUp allows requests with a valid step-up cookie", async () => {
  const originalCreate = prisma.auditLog.create;
  (prisma.auditLog as any).create = async () => ({ id: "audit_1" });
  try {
    const req: any = {
      auth: { userId: "user_1", orgId: "org_1", role: "ADMIN" },
      cookies: {},
      headers: { "user-agent": "unit-test-agent" },
      method: "POST",
      originalUrl: "/api/admin/orgs/org_1/go-live",
      requestId: "req_1"
    };
    req.cookies.kas_step_up = signStepUpToken({
      userId: "user_1",
      uaHash: crypto.createHash("sha256").update("unit-test-agent").digest("hex"),
      verifiedAt: Date.now(),
      method: "password+2fa"
    });
    const res = createResponseRecorder();
    let nextCalled = false;
    requireStepUp(req, res as any, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  } finally {
    (prisma.auditLog as any).create = originalCreate;
  }
});

test("requireStepUp denies expired step-up cookies", async () => {
  const originalCreate = prisma.auditLog.create;
  (prisma.auditLog as any).create = async () => ({ id: "audit_2" });
  try {
    const req: any = {
      auth: { userId: "user_2", orgId: "org_1", role: "ADMIN" },
      cookies: {},
      headers: { "user-agent": "unit-test-agent" },
      method: "POST",
      originalUrl: "/api/admin/orgs/org_1/go-live",
      requestId: "req_2"
    };
    req.cookies.kas_step_up = signStepUpToken({
      userId: "user_2",
      uaHash: crypto.createHash("sha256").update("unit-test-agent").digest("hex"),
      verifiedAt: 0,
      method: "password+2fa"
    });
    const res = createResponseRecorder();
    let nextCalled = false;
    requireStepUp(req, res as any, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  } finally {
    (prisma.auditLog as any).create = originalCreate;
  }
});
