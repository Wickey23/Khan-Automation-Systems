import test from "node:test";
import assert from "node:assert/strict";
import {
  authForgotPasswordRateLimit,
  authLoginRateLimit,
  authOtpResendRateLimit,
  authRefreshRateLimit,
  authStepUpRateLimit,
  toolMutationRateLimit,
  toolReadRateLimit
} from "../rate-limit";

function configOf(limiter: unknown) {
  return (limiter as { wave2Config?: { windowMs: number; max: number; message: string } }).wave2Config;
}

test("auth rate limiters are route-specific in Wave 2", () => {
  const login = configOf(authLoginRateLimit);
  const resend = configOf(authOtpResendRateLimit);
  const forgot = configOf(authForgotPasswordRateLimit);
  const refresh = configOf(authRefreshRateLimit);
  const stepUp = configOf(authStepUpRateLimit);

  assert.ok(login && resend && forgot && refresh && stepUp);
  assert.notEqual(login?.max, resend?.max);
  assert.notEqual(refresh?.max, resend?.max);
  assert.notEqual(stepUp?.max, refresh?.max);
});

test("tool mutation limit is stricter than tool read limit", () => {
  const mutation = configOf(toolMutationRateLimit);
  const read = configOf(toolReadRateLimit);
  assert.ok(mutation && read);
  assert.ok((mutation?.max || 0) < (read?.max || 0));
});
