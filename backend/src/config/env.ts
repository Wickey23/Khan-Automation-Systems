import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("4000"),
  DATABASE_URL: z.string().min(1),
  ALLOWED_ORIGIN: z.string().default("https://khan-automation-systems-frontend.vercel.app"),
  ALLOWED_ORIGIN_REGEX: z.string().optional(),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("7d"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default("587"),
  SMTP_SECURE: z.string().default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("Khan Automation Systems <no-reply@example.com>"),
  LEAD_NOTIFICATION_EMAIL: z.string().email(),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  ADMIN_ACTION_PASSWORD: z.string().min(8),
  STRIPE_SECRET_KEY: z.string().default("sk_test_placeholder"),
  STRIPE_WEBHOOK_SECRET: z.string().default("whsec_placeholder"),
  STRIPE_STARTER_PRICE_ID: z.string().default("price_starter_placeholder"),
  STRIPE_PRO_PRICE_ID: z.string().default("price_pro_placeholder"),
  STRIPE_SUCCESS_URL: z.string().default("https://khan-automation-systems-frontend.vercel.app/checkout/success"),
  STRIPE_CANCEL_URL: z.string().default("https://khan-automation-systems-frontend.vercel.app/checkout/cancel"),
  STRIPE_PORTAL_RETURN_URL: z.string().optional(),
  FRONTEND_APP_URL: z.string().default("https://khan-automation-systems-frontend.vercel.app"),
  API_BASE_URL: z.string().default("https://ai-auto-apply.onrender.com"),
  AUTO_LIVE_ON_SETUP: z.string().default("false"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_SID: z.string().optional(),
  VAPI_API_KEY: z.string().optional(),
  VAPI_PRIVATE_KEY: z.string().optional(),
  VAPI_TOOL_SECRET: z.string().optional(),
  VAPI_BACKFILL_ENABLED: z.string().default("true"),
  VAPI_BACKFILL_INTERVAL_MS: z.string().default("60000"),
  ROUTING_ENGINE_ENABLED: z.string().default("false"),
  AUTO_RECOVERY_ENABLED: z.string().default("false"),
  SLA_MONITOR_ENABLED: z.string().default("false"),
  DATA_INTEGRITY_GUARD_ENABLED: z.string().default("true"),
  AUTO_RECOVERY_DEDUPE_WINDOW_HOURS: z.string().default("2"),
  AUTO_RECOVERY_DAILY_CAP: z.string().default("50"),
  CALL_QUALITY_MIN_SCORE: z.string().default("75"),
  SLA_MONITOR_INTERVAL_MS: z.string().default("60000"),
  DATA_INTEGRITY_GUARD_INTERVAL_MS: z.string().default("3600000"),
  SLA_WARN_WEBHOOK_FAILURES: z.string().default("5"),
  SLA_CRITICAL_WEBHOOK_FAILURES: z.string().default("10"),
  SLA_WARN_PROVIDER_ERRORS: z.string().default("5"),
  SLA_CRITICAL_PROVIDER_ERRORS: z.string().default("10"),
  SLA_CRITICAL_CONSECUTIVE_BREACHES: z.string().default("2"),
  SLA_RECOVERY_WINDOWS_REQUIRED: z.string().default("2"),
  OPS_ORG_EXPOSURE_THRESHOLD: z.string().default("0.5"),
  OPS_TRAFFIC_EXPOSURE_THRESHOLD: z.string().default("0.5")
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration.");
}

export const env = {
  ...parsed.data,
  // Accept either name so existing deployments using VAPI_PRIVATE_KEY keep working.
  VAPI_API_KEY: parsed.data.VAPI_API_KEY || parsed.data.VAPI_PRIVATE_KEY
};
