import cookieParser from "cookie-parser";
import cors from "cors";
import bcrypt from "bcryptjs";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { UserRole } from "@prisma/client";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { leadRateLimit, webhookRateLimit } from "./middleware/rate-limit";
import { requestContext } from "./middleware/request-context";
import { adminRouter } from "./modules/admin/admin.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { billingRouter } from "./modules/billing/billing.routes";
import { clientRouter } from "./modules/client/client.routes";
import { eventsRouter } from "./modules/events/events.routes";
import { healthRouter } from "./modules/health/health.routes";
import { leadRouter } from "./modules/leads/lead.routes";
import { smsRouter } from "./modules/sms/sms.routes";
import { stripeRouter } from "./modules/stripe/stripe.routes";
import { orgRouter } from "./modules/org/org.routes";
import { publicRouter } from "./modules/public/public.routes";
import { toolsRouter } from "./modules/tools/tools.routes";
import { vapiRouter } from "./modules/voice/vapi/vapi.routes";
import { voiceRouter } from "./modules/voice/voice.routes";
import { backfillMissedVapiCalls } from "./modules/admin/backfill.service";
import { runSlaMonitorTick } from "./modules/ops/sla-monitor.service";
import { runDataIntegrityGuardTick } from "./modules/ops/data-integrity-guard.service";

const app = express();
app.set("trust proxy", 1);
const allowedOrigins = new Set([env.ALLOWED_ORIGIN, env.FRONTEND_APP_URL].filter(Boolean) as string[]);
const originRegex = env.ALLOWED_ORIGIN_REGEX ? new RegExp(env.ALLOWED_ORIGIN_REGEX) : null;
const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    if (originRegex && originRegex.test(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

app.use(helmet());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(requestContext);
morgan.token("request-id", (req) => (req as Request).requestId || "-");
morgan.token("org-id", (req) => ((req as Request & { auth?: { orgId?: string } }).auth?.orgId || "-"));
morgan.token("user-id", (req) => ((req as Request & { auth?: { userId?: string } }).auth?.userId || "-"));
app.use(
  morgan(
    ':method :url :status :res[content-length] - :response-time ms reqId=:request-id orgId=:org-id userId=:user-id'
  )
);
app.use(cookieParser());
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/health", healthRouter);
app.get("/api/status", async (_req, res) => {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [recentWebhookFailures, recentBillingFailures] = await Promise.all([
    prisma.webhookEventLog.count({
      where: { createdAt: { gte: since }, statusCode: { gte: 400 } }
    }),
    prisma.billingWebhookEvent.count({
      where: { createdAt: { gte: since }, processed: false }
    })
  ]);

  const voiceOperational = Boolean(env.TWILIO_AUTH_TOKEN);
  const smsOperational = Boolean(env.TWILIO_AUTH_TOKEN);
  const billingOperational = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
  const webhooksOperational = recentWebhookFailures === 0 && recentBillingFailures === 0;
  const components = {
    voice: (voiceOperational ? "OPERATIONAL" : "DEGRADED") as "OPERATIONAL" | "DEGRADED",
    sms: (smsOperational ? "OPERATIONAL" : "DEGRADED") as "OPERATIONAL" | "DEGRADED",
    billing: (billingOperational ? "OPERATIONAL" : "DEGRADED") as "OPERATIONAL" | "DEGRADED",
    webhooks: (webhooksOperational ? "OPERATIONAL" : "DEGRADED") as "OPERATIONAL" | "DEGRADED"
  };
  const overallStatus: "OPERATIONAL" | "DEGRADED" = Object.values(components).every((value) => value === "OPERATIONAL")
    ? "OPERATIONAL"
    : "DEGRADED";

  res.json({
    ok: true,
    data: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components
    }
  });
});
app.use("/api/public", publicRouter);
app.use("/api/events", eventsRouter);
app.use("/api/auth", authRouter);
app.use("/api/leads", leadRateLimit, leadRouter);
app.use("/api/client", clientRouter);
app.use("/api/org", orgRouter);
app.use("/api/admin", adminRouter);
app.use("/api/stripe", stripeRouter);
app.use("/api/billing", billingRouter);
app.use("/api/twilio/voice", webhookRateLimit, voiceRouter);
app.use("/api/twilio/sms", webhookRateLimit, smsRouter);
app.use("/api/vapi", webhookRateLimit, vapiRouter);
app.use("/api/tools", webhookRateLimit, toolsRouter);

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(error);
  res.status(500).json({ ok: false, message: error.message || "Unexpected server error." });
});

const PORT = process.env.PORT || "3001";
let backfillTimer: NodeJS.Timeout | null = null;
let slaMonitorTimer: NodeJS.Timeout | null = null;
let dataIntegrityGuardTimer: NodeJS.Timeout | null = null;
async function ensureAdminUser() {
  try {
    const email = env.ADMIN_EMAIL.toLowerCase();
    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash, role: UserRole.SUPER_ADMIN },
      create: { email, passwordHash, role: UserRole.SUPER_ADMIN }
    });
    // eslint-disable-next-line no-console
    console.log(`Admin ensured for ${email}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to ensure admin user", error);
  }
}

function startVapiBackfillWorker() {
  const enabled = env.VAPI_BACKFILL_ENABLED === "true";
  const interval = Number.parseInt(env.VAPI_BACKFILL_INTERVAL_MS, 10);
  if (!enabled || !Number.isFinite(interval) || interval < 5000) return;

  backfillTimer = setInterval(() => {
    void backfillMissedVapiCalls(prisma, "system-backfill")
      .then((result) => {
        if (result.resolved > 0 || result.skipped > 0) {
          // eslint-disable-next-line no-console
          console.log(
            JSON.stringify({
              orgId: "-",
              provider: "VAPI",
              endpoint: "worker:vapi-backfill",
              eventType: "BACKFILL_TICK",
              requestId: "-",
              providerCallId: "-",
              latencyMs: null,
              status: "OK",
              scanned: result.scanned,
              resolved: result.resolved,
              skipped: result.skipped
            })
          );
        }
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error(
          JSON.stringify({
            orgId: "-",
            provider: "VAPI",
            endpoint: "worker:vapi-backfill",
            eventType: "BACKFILL_TICK",
            requestId: "-",
            providerCallId: "-",
            latencyMs: null,
            status: "ERROR",
            message: error instanceof Error ? error.message : "unknown_error"
          })
        );
      });
  }, interval);
}

function startSlaMonitorWorker() {
  if (env.SLA_MONITOR_ENABLED !== "true") return;
  const interval = Number.parseInt(env.SLA_MONITOR_INTERVAL_MS, 10);
  if (!Number.isFinite(interval) || interval < 10000) return;

  slaMonitorTimer = setInterval(() => {
    void runSlaMonitorTick(prisma).catch((error) => {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          orgId: "-",
          provider: "SYSTEM",
          endpoint: "worker:sla-monitor",
          eventType: "SLA_MONITOR_TICK",
          requestId: "-",
          providerCallId: "-",
          latencyMs: null,
          status: "ERROR",
          message: error instanceof Error ? error.message : "unknown_error"
        })
      );
    });
  }, interval);
}

function startDataIntegrityGuardWorker() {
  if (env.DATA_INTEGRITY_GUARD_ENABLED !== "true") return;
  const interval = Number.parseInt(env.DATA_INTEGRITY_GUARD_INTERVAL_MS, 10);
  if (!Number.isFinite(interval) || interval < 60_000) return;

  dataIntegrityGuardTimer = setInterval(() => {
    void runDataIntegrityGuardTick(prisma)
      .then((result) => {
        if (result.anomaliesLogged > 0 || result.repairedLeadLinks > 0) {
          // eslint-disable-next-line no-console
          console.log(
            JSON.stringify({
              orgId: "-",
              provider: "SYSTEM",
              endpoint: "worker:data-integrity-guard",
              eventType: "DATA_INTEGRITY_TICK",
              requestId: "-",
              providerCallId: "-",
              latencyMs: null,
              status: "OK",
              anomaliesLogged: result.anomaliesLogged,
              repairedLeadLinks: result.repairedLeadLinks
            })
          );
        }
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error(
          JSON.stringify({
            orgId: "-",
            provider: "SYSTEM",
            endpoint: "worker:data-integrity-guard",
            eventType: "DATA_INTEGRITY_TICK",
            requestId: "-",
            providerCallId: "-",
            latencyMs: null,
            status: "ERROR",
            message: error instanceof Error ? error.message : "unknown_error"
          })
        );
      });
  }, interval);
}

void (async () => {
  await ensureAdminUser();
  startVapiBackfillWorker();
  startSlaMonitorWorker();
  startDataIntegrityGuardWorker();
  app.listen(Number(PORT), "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on ${PORT}`);
  });
})();

const shutdown = async () => {
  if (backfillTimer) clearInterval(backfillTimer);
  if (slaMonitorTimer) clearInterval(slaMonitorTimer);
  if (dataIntegrityGuardTimer) clearInterval(dataIntegrityGuardTimer);
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
