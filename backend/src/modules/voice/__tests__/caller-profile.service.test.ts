import assert from "node:assert/strict";
import test from "node:test";
import { normalizePhoneE164 } from "../caller-profile.service";

test("normalizePhoneE164 normalizes 10-digit US numbers", () => {
  assert.equal(normalizePhoneE164("5163505753"), "+15163505753");
});

test("normalizePhoneE164 preserves + format", () => {
  assert.equal(normalizePhoneE164("+1 (516) 350-5753"), "+15163505753");
});

