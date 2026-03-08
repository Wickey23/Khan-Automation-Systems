import rateLimit from "express-rate-limit";
import { env } from "../config/env";

function toPositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function buildLimiter(windowMs: number, max: number, message: string) {
  const limiter = rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, message }
  });
  (limiter as typeof limiter & { wave2Config?: { windowMs: number; max: number; message: string } }).wave2Config = {
    windowMs,
    max,
    message
  };
  return limiter;
}

export const leadRateLimit = buildLimiter(15 * 60 * 1000, 40, "Too many lead requests. Try again shortly.");

export const authSignupRateLimit = buildLimiter(15 * 60 * 1000, 10, "Too many signup attempts. Try again shortly.");
export const authLoginRateLimit = buildLimiter(15 * 60 * 1000, 10, "Too many login attempts. Try again shortly.");
export const authOtpVerifyRateLimit = buildLimiter(
  15 * 60 * 1000,
  12,
  "Too many verification attempts. Try again shortly."
);
export const authOtpResendRateLimit = buildLimiter(
  15 * 60 * 1000,
  5,
  "Too many code resend attempts. Try again shortly."
);
export const authForgotPasswordRateLimit = buildLimiter(
  15 * 60 * 1000,
  5,
  "Too many password reset requests. Try again shortly."
);
export const authResetPasswordRateLimit = buildLimiter(
  15 * 60 * 1000,
  8,
  "Too many password reset attempts. Try again shortly."
);
export const authRefreshRateLimit = buildLimiter(15 * 60 * 1000, 40, "Too many refresh attempts. Try again shortly.");
export const authStepUpRateLimit = buildLimiter(15 * 60 * 1000, 8, "Too many step-up attempts. Try again shortly.");
export const authSecurityOtpRateLimit = buildLimiter(
  15 * 60 * 1000,
  5,
  "Too many security OTP sends. Try again shortly."
);

export const twilioVoiceWebhookRateLimit = buildLimiter(
  toPositiveInt(env.WEBHOOK_RATE_LIMIT_WINDOW_MS, 60_000),
  Math.max(100, toPositiveInt(env.WEBHOOK_RATE_LIMIT_MAX, 600)),
  "Voice webhook rate limit exceeded."
);
export const twilioSmsWebhookRateLimit = buildLimiter(
  toPositiveInt(env.WEBHOOK_RATE_LIMIT_WINDOW_MS, 60_000),
  Math.max(80, Math.floor(toPositiveInt(env.WEBHOOK_RATE_LIMIT_MAX, 600) * 0.75)),
  "SMS webhook rate limit exceeded."
);
export const vapiWebhookRateLimit = buildLimiter(
  toPositiveInt(env.WEBHOOK_RATE_LIMIT_WINDOW_MS, 60_000),
  toPositiveInt(env.WEBHOOK_RATE_LIMIT_MAX, 600),
  "Vapi webhook rate limit exceeded."
);
export const stripeWebhookRateLimit = buildLimiter(60_000, 180, "Stripe webhook rate limit exceeded.");

export const toolRateLimit = buildLimiter(
  toPositiveInt(env.TOOL_RATE_LIMIT_WINDOW_MS, 60_000),
  toPositiveInt(env.TOOL_RATE_LIMIT_MAX, 300),
  "Tool rate limit exceeded."
);
export const toolMutationRateLimit = buildLimiter(
  toPositiveInt(env.TOOL_RATE_LIMIT_WINDOW_MS, 60_000),
  Math.max(30, Math.floor(toPositiveInt(env.TOOL_RATE_LIMIT_MAX, 300) * 0.4)),
  "Tool mutation rate limit exceeded."
);
export const toolReadRateLimit = buildLimiter(
  toPositiveInt(env.TOOL_RATE_LIMIT_WINDOW_MS, 60_000),
  Math.max(60, Math.floor(toPositiveInt(env.TOOL_RATE_LIMIT_MAX, 300) * 0.75)),
  "Tool read rate limit exceeded."
);
