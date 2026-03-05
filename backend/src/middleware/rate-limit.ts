import rateLimit from "express-rate-limit";
import { env } from "../config/env";

function toPositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const leadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Too many lead requests. Try again shortly." }
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Too many login attempts. Try again shortly." }
});

export const webhookRateLimit = rateLimit({
  windowMs: toPositiveInt(env.WEBHOOK_RATE_LIMIT_WINDOW_MS, 60_000),
  max: toPositiveInt(env.WEBHOOK_RATE_LIMIT_MAX, 600),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Webhook rate limit exceeded." }
});

export const toolRateLimit = rateLimit({
  windowMs: toPositiveInt(env.TOOL_RATE_LIMIT_WINDOW_MS, 60_000),
  max: toPositiveInt(env.TOOL_RATE_LIMIT_MAX, 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Tool rate limit exceeded." }
});
