import cookieParser from "cookie-parser";
import cors from "cors";
import bcrypt from "bcryptjs";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { UserRole } from "@prisma/client";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { leadRateLimit } from "./middleware/rate-limit";
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
import { voiceRouter } from "./modules/voice/voice.routes";

const app = express();
const allowedOrigins = new Set(["http://localhost:3000", env.ALLOWED_ORIGIN].filter(Boolean) as string[]);
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
app.use(morgan("combined"));
app.use(cookieParser());
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/health", healthRouter);
app.use("/api/events", eventsRouter);
app.use("/api/auth", authRouter);
app.use("/api/leads", leadRateLimit, leadRouter);
app.use("/api/client", clientRouter);
app.use("/api/org", orgRouter);
app.use("/api/admin", adminRouter);
app.use("/api/stripe", stripeRouter);
app.use("/api/billing", billingRouter);
app.use("/api/twilio/voice", voiceRouter);
app.use("/api/twilio/sms", smsRouter);

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(error);
  res.status(500).json({ ok: false, message: error.message || "Unexpected server error." });
});

const PORT = process.env.PORT || "3001";
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

void (async () => {
  await ensureAdminUser();
  app.listen(Number(PORT), "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on ${PORT}`);
  });
})();

const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
