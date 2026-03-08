import crypto from "crypto";
import type { NextFunction, Response } from "express";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { verifyStepUpToken } from "../lib/auth";
import type { AuthenticatedRequest } from "./require-auth";

const STEP_UP_COOKIE = "kas_step_up";

function fingerprintUserAgent(value: unknown) {
  return crypto.createHash("sha256").update(String(value || "unknown_ua")).digest("hex");
}

function deny(req: AuthenticatedRequest, res: Response, reason: string) {
  void prisma.auditLog
    .create({
      data: {
        orgId: req.auth?.orgId || null,
        actorUserId: req.auth?.userId || "anonymous",
        actorRole: req.auth?.role || "UNKNOWN",
        action: "STEP_UP_FORBIDDEN",
        metadataJson: JSON.stringify({
          path: req.originalUrl,
          method: req.method,
          reason,
          requestId: req.requestId || null
        })
      }
    })
    .catch(() => null);
  return res.status(403).json({ ok: false, message: "Recent step-up authentication required." });
}

export function requireStepUp(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.auth?.userId) return res.status(401).json({ ok: false, message: "Unauthorized" });
  const raw = String(req.cookies?.[STEP_UP_COOKIE] || "").trim();
  if (!raw) return deny(req, res, "missing_cookie");

  try {
    const payload = verifyStepUpToken(raw);
    if (payload.userId !== req.auth.userId) return deny(req, res, "user_mismatch");
    if (payload.uaHash !== fingerprintUserAgent(req.headers["user-agent"])) return deny(req, res, "ua_mismatch");
    const windowMinutes = Number.parseInt(env.AUTH_STEP_UP_WINDOW_MINUTES, 10);
    const maxAgeMs = (Number.isFinite(windowMinutes) && windowMinutes > 0 ? windowMinutes : 15) * 60 * 1000;
    if (payload.verifiedAt + maxAgeMs <= Date.now()) return deny(req, res, "expired");
    return next();
  } catch {
    return deny(req, res, "invalid_token");
  }
}
