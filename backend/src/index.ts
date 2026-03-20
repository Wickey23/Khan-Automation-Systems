import cookieParser from "cookie-parser";
import cors from "cors";
import bcrypt from "bcryptjs";
import { createServer } from "http";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { UserRole } from "@prisma/client";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { requireCsrf } from "./middleware/csrf";
import {
  leadRateLimit,
  toolRateLimit,
  twilioSmsWebhookRateLimit,
  twilioVoiceWebhookRateLimit,
  vapiWebhookRateLimit
} from "./middleware/rate-limit";
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
import { teamRouter } from "./modules/team/team.routes";
import { backfillMissedVapiCalls } from "./modules/admin/backfill.service";
import { runSlaMonitorTick } from "./modules/ops/sla-monitor.service";
import { runDataIntegrityGuardTick } from "./modules/ops/data-integrity-guard.service";
import { runFinalizeBookingWorkerTick } from "./modules/voice/vapi/vapi-booking-finalizer.service";
import { attachVoiceMediaStreamServer } from "./modules/voice/media-stream/voice-media-stream-server";
import { runOutreachRunnerTick } from "./modules/outreach/outreach-runner.service";
import { webhookWorker } from "./workers/webhook-worker";
import { importWorker } from "./workers/import-worker";
import { backgroundWorker } from "./workers/background-worker";
import { backgroundTasksQueue } from "./lib/queue";

const app = express();
const server = createServer(app);
app.set("trust proxy", 1);
const allowedOrigins = new Set(
  [
    env.ALLOWED_ORIGIN,
    env.FRONTEND_APP_URL,
    ...String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => Boolean(value) && value !== "*" && !value.includes("*"))
  ].filter(Boolean) as string[]
);
const originRegex =
  env.ALLOWED_ORIGIN_REGEX && env.SECURITY_MODE !== "production"
    ? new RegExp(env.ALLOWED_ORIGIN_REGEX)
    : null;
function isAllowedOrigin(origin: string) {
  if (allowedOrigins.has(origin)) return true;
  if (originRegex && originRegex.test(origin)) return true;
  return false;
}
const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (isAllowedOrigin(origin)) return cb(null, true);
    return cb(null, false);
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-csrf-token"],
  credentials: true
};

app.use(helmet());
app.use((req, res, next) => {
  const origin = String(req.headers.origin || "").trim();
  if (!origin || isAllowedOrigin(origin)) return next();
  return res.status(403).json({ ok: false, message: "Origin not allowed." });
});
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

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "khan-automation-backend",
    health: "/api/health",
    status: "/api/status"
  });
});

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
app.use("/api/client", requireCsrf, clientRouter);
app.use("/api/org", requireCsrf, orgRouter);
app.use("/api/admin", requireCsrf, adminRouter);
app.use("/api/stripe", stripeRouter);
app.use("/api/billing", requireCsrf, billingRouter);
app.use("/api/team", teamRouter);
app.use("/api/twilio/voice", twilioVoiceWebhookRateLimit, voiceRouter);
app.use("/api/twilio/sms", twilioSmsWebhookRateLimit, smsRouter);
app.use("/api/vapi", vapiWebhookRateLimit, vapiRouter);
app.use("/api/tools", toolRateLimit, toolsRouter);

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  // Log the full error server-side but never return internal details to the client.
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({
    event: "UNHANDLED_ERROR",
    name: error?.name,
    message: error?.message,
    // Truncate stack to 800 chars to avoid dumping full Prisma query context in logs
    stack: (error?.stack || "").slice(0, 800)
  }));
  const isProd = process.env.SECURITY_MODE === "production" || process.env.NODE_ENV === "production";
  res.status(500).json({ ok: false, message: isProd ? "An unexpected error occurred." : (error.message || "Unexpected server error.") });
});

const PORT = process.env.PORT || "3001";
const voiceMediaStreamServer = attachVoiceMediaStreamServer({ server, prisma });

async function scheduleRepeatableJobs() {
  // Use stable repeat job IDs so restarts do not create duplicate schedules.
  await backgroundTasksQueue.add("outreach-runner", {}, { jobId: "repeat:outreach-runner", repeat: { every: 60000 } });
  await backgroundTasksQueue.add("booking-finalizer", {}, { jobId: "repeat:booking-finalizer", repeat: { every: 10000 } });
  await backgroundTasksQueue.add("sla-monitor", {}, { jobId: "repeat:sla-monitor", repeat: { every: 60000 } });
  await backgroundTasksQueue.add("data-integrity", {}, { jobId: "repeat:data-integrity", repeat: { every: 300000 } });
  await backgroundTasksQueue.add("admin-reports", {}, { jobId: "repeat:admin-reports", repeat: { pattern: "0 0 * * *" } }); // Midnight daily
  await backgroundTasksQueue.add("job-reconciliation", {}, { jobId: "repeat:job-reconciliation", repeat: { every: 120000 } });
  
  console.log("[Queue] Repeatable jobs scheduled.");
}
async function ensureAdminUser() {
  try {
    const email = env.ADMIN_EMAIL.toLowerCase();
    // Only create the admin user if they don't already exist.
    // Do NOT reset the password on every restart — that would silently overwrite
    // any password changes and couples admin security tightly to deployment.
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!existing) {
      const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
      await prisma.user.create({
        data: { email, passwordHash, role: UserRole.SUPER_ADMIN }
      });
      // eslint-disable-next-line no-console
      console.log("Admin user bootstrapped.");
    } else {
      // Ensure role is always SUPER_ADMIN even if row already exists (safe update).
      await prisma.user.update({
        where: { email },
        data: { role: UserRole.SUPER_ADMIN }
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to ensure admin user", error instanceof Error ? error.message : "unknown");
  }
}


function enforceProductionSecurity() {
  if (env.SECURITY_MODE !== "production") return;
  const required: Array<[string, string | undefined]> = [
    ["JWT_SECRET", env.JWT_SECRET],
    ["REFRESH_TOKEN_SECRET", env.REFRESH_TOKEN_SECRET],
    ["STRIPE_SECRET_KEY", env.STRIPE_SECRET_KEY],
    ["TWILIO_AUTH_TOKEN", env.TWILIO_AUTH_TOKEN]
  ];
  if (env.VAPI_API_KEY || env.VAPI_PRIVATE_KEY) {
    required.push(["VAPI_API_KEY", env.VAPI_API_KEY]);
  }
  const missing = required.filter(([, value]) => !value || value.includes("placeholder") || value.includes("change-this"));
  if (missing.length > 0) {
    throw new Error(`Missing required production secrets: ${missing.map(([key]) => key).join(", ")}`);
  }
}

void (async () => {
  enforceProductionSecurity();
  await ensureAdminUser();

  const runScheduler = String(process.env.RUN_BACKGROUND_SCHEDULER || "true").toLowerCase() !== "false";
  if (runScheduler) {
    await scheduleRepeatableJobs();
  } else {
    console.log("[Queue] Background scheduler disabled via RUN_BACKGROUND_SCHEDULER=false");
  }
  
  const runWorkers = String(process.env.RUN_QUEUE_WORKERS || "true").toLowerCase() !== "false";
  if (runWorkers) {
    // Reference workers to keep initialization explicit.
    void webhookWorker;
    void importWorker;
    void backgroundWorker;
    console.log(`[Worker] Webhook worker initialized.`);
    console.log(`[Worker] Import worker initialized.`);
    console.log(`[Worker] Background worker initialized.`);
  } else {
    console.log("[Worker] Queue workers disabled via RUN_QUEUE_WORKERS=false");
  }

  server.listen(Number(PORT), "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on ${PORT}`);
  });
})();

const shutdown = async () => {
  voiceMediaStreamServer.close();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
