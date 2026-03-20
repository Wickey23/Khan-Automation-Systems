import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { env } from "../config/env";
import { redis } from "../lib/redis";

function toPositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function buildLimiter(windowMs: number, max: number, message: string, prefix: string) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, message },
    store: new RedisStore({
      // @ts-expect-error - ioredis compatibility
      sendCommand: (...args: string[]) => redis.call(...args),
      prefix: `rl:${prefix}:`,
    }),
  });
}

export const leadRateLimit = buildLimiter(15 * 60 * 1000, 40, "Too many lead requests. Try again shortly.", "leads");

export const authSignupRateLimit = buildLimiter(15 * 60 * 1000, 10, "Too many signup attempts. Try again shortly.", "signup");
export const authLoginRateLimit = buildLimiter(15 * 60 * 1000, 10, "Too many login attempts. Try again shortly.", "login");
export const authOtpVerifyRateLimit = buildLimiter(
  15 * 60 * 1000,
  12,
  "Too many verification attempts. Try again shortly.",
  "otp-verify"
);
export const authOtpResendRateLimit = buildLimiter(
  15 * 60 * 1000,
  5,
  "Too many code resend attempts. Try again shortly.",
  "otp-resend"
);
export const authForgotPasswordRateLimit = buildLimiter(
  15 * 60 * 1000,
  5,
  "Too many password reset requests. Try again shortly.",
  "forgot-password"
);
export const authResetPasswordRateLimit = buildLimiter(
  15 * 60 * 1000,
  8,
  "Too many password reset attempts. Try again shortly.",
  "reset-password"
);
export const authRefreshRateLimit = buildLimiter(15 * 60 * 1000, 40, "Too many refresh attempts. Try again shortly.", "refresh");
export const authStepUpRateLimit = buildLimiter(15 * 60 * 1000, 8, "Too many step-up attempts. Try again shortly.", "step-up");
export const authSecurityOtpRateLimit = buildLimiter(
  15 * 60 * 1000,
  5,
  "Too many security OTP sends. Try again shortly.",
  "security-otp"
);

export const twilioVoiceWebhookRateLimit = buildLimiter(
  toPositiveInt(env.WEBHOOK_RATE_LIMIT_WINDOW_MS, 60_000),
  Math.max(100, toPositiveInt(env.WEBHOOK_RATE_LIMIT_MAX, 600)),
  "Voice webhook rate limit exceeded.",
  "twilio-voice"
);
export const twilioSmsWebhookRateLimit = buildLimiter(
  toPositiveInt(env.WEBHOOK_RATE_LIMIT_WINDOW_MS, 60_000),
  Math.max(80, Math.floor(toPositiveInt(env.WEBHOOK_RATE_LIMIT_MAX, 600) * 0.75)),
  "SMS webhook rate limit exceeded.",
  "twilio-sms"
);
export const vapiWebhookRateLimit = buildLimiter(
  toPositiveInt(env.WEBHOOK_RATE_LIMIT_WINDOW_MS, 60_000),
  toPositiveInt(env.WEBHOOK_RATE_LIMIT_MAX, 600),
  "Vapi webhook rate limit exceeded.",
  "vapi-webhook"
);
export const stripeWebhookRateLimit = buildLimiter(60_000, 180, "Stripe webhook rate limit exceeded.", "stripe-webhook");

export const toolRateLimit = buildLimiter(
  toPositiveInt(env.TOOL_RATE_LIMIT_WINDOW_MS, 60_000),
  toPositiveInt(env.TOOL_RATE_LIMIT_MAX, 300),
  "Tool rate limit exceeded.",
  "tool"
);
export const toolMutationRateLimit = buildLimiter(
  toPositiveInt(env.TOOL_RATE_LIMIT_WINDOW_MS, 60_000),
  Math.max(30, Math.floor(toPositiveInt(env.TOOL_RATE_LIMIT_MAX, 300) * 0.4)),
  "Tool mutation rate limit exceeded.",
  "tool-mutation"
);
export const toolReadRateLimit = buildLimiter(
  toPositiveInt(env.TOOL_RATE_LIMIT_WINDOW_MS, 60_000),
  Math.max(60, Math.floor(toPositiveInt(env.TOOL_RATE_LIMIT_MAX, 300) * 0.75)),
  "Tool read rate limit exceeded.",
  "tool-read"
);

export const bulkImportRateLimit = buildLimiter(
  60 * 60 * 1000, // 1 hour
  5, 
  "Too many import requests. Try again later.",
  "bulk-import"
);

export const bulkDeleteRateLimit = buildLimiter(
  24 * 60 * 60 * 1000, // 1 day
  2, 
  "Bulk delete is limited to twice per day for safety.",
  "bulk-delete"
);
