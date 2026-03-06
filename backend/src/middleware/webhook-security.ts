import type { NextFunction, Request, Response } from "express";
import Twilio from "twilio";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { redactObject } from "../lib/log-redaction";

function logRejectedWebhook(req: Request, statusCode: number, reason: string) {
  const safeHeaders =
    env.LOG_REDACTION_ENABLED === "true"
      ? redactObject((req.headers || {}) as Record<string, unknown>)
      : (req.headers as Record<string, unknown>);
  void prisma.webhookEventLog
    .create({
      data: {
        provider: req.originalUrl.includes("/api/twilio") ? "TWILIO" : "VAPI",
        endpoint: req.originalUrl,
        requestId: req.requestId || null,
        statusCode,
        reason,
        headersJson: JSON.stringify(safeHeaders || {}),
        payloadSnippet: (() => {
          try {
            return JSON.stringify(req.body || {}).slice(0, 4000);
          } catch {
            return "{\"parseError\":true}";
          }
        })()
      }
    })
    .catch(() => null);
}

export function verifyVapiToolSecret(req: Request, res: Response, next: NextFunction) {
  const strict = env.SECURITY_MODE === "production" || env.WEBHOOK_STRICT_MODE === "true";
  const isDemoRoute = req.originalUrl.includes("/demo");
  const expected = isDemoRoute ? env.DEMO_VAPI_TOOL_SECRET || env.VAPI_TOOL_SECRET : env.VAPI_TOOL_SECRET;
  if (!strict && !expected) return next();
  const authorization = req.header("authorization") || "";
  const bearerToken =
    authorization.startsWith("Bearer ") || authorization.startsWith("bearer ")
      ? authorization.slice(7).trim()
      : null;
  const provided = req.header("x-vapi-tool-secret") || req.header("x-vapi-secret") || bearerToken;
  if (!provided || !expected || provided !== expected) {
    logRejectedWebhook(req, 401, "invalid_vapi_tool_secret");
    return res.status(401).json({ ok: false, message: "Unauthorized Vapi tool call." });
  }
  return next();
}

export function verifyTwilioRequest(req: Request, res: Response, next: NextFunction) {
  const strict = env.WEBHOOK_STRICT_MODE === "true" || env.SECURITY_MODE === "production";
  if (!strict && !env.TWILIO_AUTH_TOKEN) return next();
  if (!env.TWILIO_AUTH_TOKEN) {
    logRejectedWebhook(req, 401, "missing_twilio_auth_token");
    return res.status(401).json({ ok: false, message: "Missing Twilio auth token." });
  }
  const authToken = env.TWILIO_AUTH_TOKEN as string;
  const signature = req.header("x-twilio-signature");
  if (!signature) {
    logRejectedWebhook(req, 401, "missing_twilio_signature");
    return res.status(401).json({ ok: false, message: "Missing Twilio signature." });
  }
  const sig = signature as string;
  const requestHost = req.get("host");
  const requestProtocol = req.protocol || "https";
  const runtimeUrl = requestHost ? `${requestProtocol}://${requestHost}${req.originalUrl}` : null;
  const envUrl = `${env.API_BASE_URL}${req.originalUrl}`;
  const candidates = [runtimeUrl, envUrl].filter((v): v is string => Boolean(v));

  const valid = candidates.some((url) =>
    Twilio.validateRequest(authToken, sig, url, req.body as Record<string, unknown>)
  );
  if (!valid) {
    logRejectedWebhook(req, 401, "invalid_twilio_signature");
    return res.status(401).json({ ok: false, message: "Invalid Twilio signature." });
  }
  return next();
}
