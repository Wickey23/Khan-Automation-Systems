import assert from "node:assert/strict";
import test from "node:test";
import { requirePermission } from "../require-permission";

function createRes() {
  const state: { status?: number; payload?: unknown } = {};
  return {
    status(code: number) {
      state.status = code;
      return this;
    },
    json(payload: unknown) {
      state.payload = payload;
      return this;
    },
    state
  };
}

test("requirePermission allows SUPER_ADMIN", async () => {
  const middleware = requirePermission("ADMIN_SYSTEM_MUTATE");
  const req = { auth: { role: "SUPER_ADMIN", userId: "u1", orgId: "o1" }, method: "POST", originalUrl: "/x" } as any;
  const res = createRes() as any;
  let called = false;
  await middleware(req, res, () => {
    called = true;
  });
  assert.equal(called, true);
});

test("requirePermission blocks client role", async () => {
  const middleware = requirePermission("ADMIN_SYSTEM_MUTATE");
  const req = { auth: { role: "CLIENT", userId: "u1", orgId: "o1" }, method: "POST", originalUrl: "/x" } as any;
  const res = createRes() as any;
  await middleware(req, res, () => undefined);
  assert.equal(res.state.status, 403);
});

