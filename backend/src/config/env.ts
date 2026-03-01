import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("4000"),
  DATABASE_URL: z.string().min(1),
  ALLOWED_ORIGIN: z.string().default("http://localhost:3000"),
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
  STRIPE_SECRET_KEY: z.string().default("sk_test_placeholder"),
  STRIPE_WEBHOOK_SECRET: z.string().default("whsec_placeholder"),
  STRIPE_STARTER_PRICE_ID: z.string().default("price_starter_placeholder"),
  STRIPE_PRO_PRICE_ID: z.string().default("price_pro_placeholder"),
  STRIPE_SUCCESS_URL: z.string().default("http://localhost:3000/checkout/success"),
  STRIPE_CANCEL_URL: z.string().default("http://localhost:3000/checkout/cancel"),
  FRONTEND_APP_URL: z.string().default("http://localhost:3000"),
  API_BASE_URL: z.string().default("http://localhost:4000"),
  AUTO_LIVE_ON_SETUP: z.string().default("false"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_SID: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration.");
}

export const env = parsed.data;
