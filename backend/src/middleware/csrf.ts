import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";

const CSRF_COOKIE = "kas_csrf_token";
const CSRF_HEADER = "x-csrf-token";

function shouldProtect(req: Request) {
  const path = req.originalUrl || req.path || "";
  if (
    path.includes("/api/twilio/") ||
    path.includes("/api/vapi/") ||
    path.includes("/api/tools/") ||
    path.includes("/api/stripe/webhook") ||
    path.includes("/api/billing/webhook") ||
    path.includes("/api/public/")
  ) {
    return false;
  }
  return ["POST", "PATCH", "PUT", "DELETE"].includes(req.method.toUpperCase());
}

function cookieOptions() {
  const isProd = env.SECURITY_MODE === "production";
  return {
    httpOnly: false,
    secure: isProd,
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    path: "/"
  };
}

export function issueCsrfCookie(req: Request, res: Response) {
  const existing = String(req.cookies?.[CSRF_COOKIE] || "").trim();
  const token = existing || crypto.randomUUID();
  res.cookie(CSRF_COOKIE, token, cookieOptions());
  return token;
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (env.SECURITY_MODE !== "production") return next();
  if (!shouldProtect(req)) return next();

  const cookieToken = String(req.cookies?.[CSRF_COOKIE] || "").trim();
  const headerToken = String(req.header(CSRF_HEADER) || "").trim();
  if (cookieToken && headerToken && cookieToken === headerToken) return next();

  void prisma.auditLog.create({
    data: {
      actorUserId: (req as Request & { auth?: { userId?: string } }).auth?.userId || "anonymous",
      actorRole: (req as Request & { auth?: { role?: string } }).auth?.role || "UNKNOWN",
      orgId: (req as Request & { auth?: { orgId?: string } }).auth?.orgId || null,
      action: "SECURITY_CSRF_BLOCKED",
      metadataJson: JSON.stringify({ path: req.originalUrl, method: req.method, requestId: req.requestId || null })
    }
  }).catch(() => null);

  return res.status(403).json({ ok: false, message: "CSRF check failed." });
}
