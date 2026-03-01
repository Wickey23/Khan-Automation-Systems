import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { leadRateLimit } from "./middleware/rate-limit";
import { adminRouter } from "./modules/admin/admin.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { clientRouter } from "./modules/client/client.routes";
import { eventsRouter } from "./modules/events/events.routes";
import { healthRouter } from "./modules/health/health.routes";
import { leadRouter } from "./modules/leads/lead.routes";
import { smsRouter } from "./modules/sms/sms.routes";
import { stripeRouter } from "./modules/stripe/stripe.routes";
import { voiceRouter } from "./modules/voice/voice.routes";

const app = express();
const allowedOrigins = ["http://localhost:3000", env.ALLOWED_ORIGIN].filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(morgan("combined"));
app.use(cookieParser());
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/health", healthRouter);
app.use("/api/events", eventsRouter);
app.use("/api/auth", authRouter);
app.use("/api/leads", leadRateLimit, leadRouter);
app.use("/api/client", clientRouter);
app.use("/api/admin", adminRouter);
app.use("/api/stripe", stripeRouter);
app.use("/api/twilio/voice", voiceRouter);
app.use("/api/twilio/sms", smsRouter);

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(error);
  res.status(500).json({ ok: false, message: error.message || "Unexpected server error." });
});

const port = Number(env.PORT);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on ${port}`);
});

const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
