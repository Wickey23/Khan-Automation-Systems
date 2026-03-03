import assert from "node:assert/strict";
import test from "node:test";
import { redactObject } from "../log-redaction";

test("redactObject redacts sensitive keys", () => {
  const out = redactObject({
    authorization: "Bearer abc",
    cookie: "kas_auth_token=123",
    "x-vapi-tool-secret": "1234",
    other: "ok"
  });
  assert.equal(out.authorization, "[REDACTED]");
  assert.equal(out.cookie, "[REDACTED]");
  assert.equal(out["x-vapi-tool-secret"], "[REDACTED]");
  assert.equal(out.other, "[REDACTED]");
});

