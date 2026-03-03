import assert from "node:assert/strict";
import test from "node:test";
import { env } from "../../config/env";
import { requireCsrf } from "../csrf";

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

test("requireCsrf allows mutating request with matching cookie/header in production", async () => {
  const originalMode = env.SECURITY_MODE;
  (env as any).SECURITY_MODE = "production";
  const req = {
    method: "POST",
    originalUrl: "/api/auth/refresh",
    cookies: { kas_csrf_token: "abc" },
    header(name: string) {
      return name.toLowerCase() === "x-csrf-token" ? "abc" : "";
    }
  } as any;
  const res = createRes() as any;
  let called = false;
  requireCsrf(req, res, () => {
    called = true;
  });
  assert.equal(called, true);
  (env as any).SECURITY_MODE = originalMode;
});

test("requireCsrf blocks mutating request with missing/mismatched token in production", async () => {
  const originalMode = env.SECURITY_MODE;
  (env as any).SECURITY_MODE = "production";
  const req = {
    method: "POST",
    originalUrl: "/api/auth/refresh",
    cookies: { kas_csrf_token: "abc" },
    header() {
      return "mismatch";
    }
  } as any;
  const res = createRes() as any;
  requireCsrf(req, res, () => undefined);
  assert.equal(res.state.status, 403);
  (env as any).SECURITY_MODE = originalMode;
});
