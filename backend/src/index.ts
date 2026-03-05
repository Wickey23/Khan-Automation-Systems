import cookieParser from "cookie-parser";
import cors from "cors";
import bcrypt from "bcryptjs";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { UserRole } from "@prisma/client";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { requireCsrf } from "./middleware/csrf";
import { leadRateLimit, toolRateLimit, webhookRateLimit } from "./middleware/rate-limit";
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

const app = express();
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
app.use("/api/twilio/voice", webhookRateLimit, voiceRouter);
app.use("/api/twilio/sms", webhookRateLimit, smsRouter);
app.use("/api/vapi", webhookRateLimit, vapiRouter);
app.use("/api/tools", toolRateLimit, toolsRouter);

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(error);
  res.status(500).json({ ok: false, message: error.message || "Unexpected server error." });
});

const PORT = process.env.PORT || "3001";
let backfillTimer: NodeJS.Timeout | null = null;
let slaMonitorTimer: NodeJS.Timeout | null = null;
let dataIntegrityGuardTimer: NodeJS.Timeout | null = null;
let webhookRetentionTimer: NodeJS.Timeout | null = null;
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

function startWebhookReplayCleanupWorker() {
  const interval = 24 * 60 * 60 * 1000;
  setInterval(() => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    void prisma.webhookReplayGuard
      .deleteMany({ where: { receivedAt: { lt: cutoff } } })
      .then((result) => {
        if (result.count > 0) {
          return prisma.auditLog.create({
            data: {
              actorUserId: "system-security",
              actorRole: "SYSTEM",
              action: "WEBHOOK_REPLAY_GUARD_CLEANUP",
              metadataJson: JSON.stringify({ deleted: result.count, cutoff: cutoff.toISOString() })
            }
          });
        }
        return null;
      })
      .catch(() => null);
  }, interval);
}

function startWebhookPayloadRetentionWorker() {
  const interval = 24 * 60 * 60 * 1000;
  webhookRetentionTimer = setInterval(() => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    void prisma.webhookEventLog
      .updateMany({
        where: {
          createdAt: { lt: cutoff },
          payloadSnippet: { not: "{}" }
        },
        data: { payloadSnippet: "{}" }
      })
      .then((result) => {
        if (result.count > 0) {
          return prisma.auditLog.create({
            data: {
              actorUserId: "system-security",
              actorRole: "SYSTEM",
              action: "WEBHOOK_PAYLOAD_RETENTION_COMPACTED",
              metadataJson: JSON.stringify({ compacted: result.count, cutoff: cutoff.toISOString() })
            }
          });
        }
        return null;
      })
      .catch(() => null);
  }, interval);
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
  startVapiBackfillWorker();
  startSlaMonitorWorker();
  startDataIntegrityGuardWorker();
  startWebhookReplayCleanupWorker();
  startWebhookPayloadRetentionWorker();
  app.listen(Number(PORT), "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on ${PORT}`);
  });
})();

const shutdown = async () => {
  if (backfillTimer) clearInterval(backfillTimer);
  if (slaMonitorTimer) clearInterval(slaMonitorTimer);
  if (dataIntegrityGuardTimer) clearInterval(dataIntegrityGuardTimer);
  if (webhookRetentionTimer) clearInterval(webhookRetentionTimer);
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
