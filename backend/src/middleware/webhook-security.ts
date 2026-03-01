import type { NextFunction, Request, Response } from "express";
import Twilio from "twilio";
import { env } from "../config/env";

export function verifyVapiToolSecret(req: Request, res: Response, next: NextFunction) {
  if (!env.VAPI_TOOL_SECRET) return next();
  const provided = req.header("x-vapi-tool-secret") || req.header("x-vapi-secret");
  if (!provided || provided !== env.VAPI_TOOL_SECRET) {
    return res.status(401).json({ ok: false, message: "Unauthorized Vapi tool call." });
  }
  return next();
}

export function verifyTwilioRequest(req: Request, res: Response, next: NextFunction) {
  if (!env.TWILIO_AUTH_TOKEN) return next();
  const signature = req.header("x-twilio-signature");
  if (!signature) return res.status(401).json({ ok: false, message: "Missing Twilio signature." });
  const fullUrl = `${env.API_BASE_URL}${req.originalUrl}`;
  const valid = Twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, fullUrl, req.body as Record<string, unknown>);
  if (!valid) return res.status(401).json({ ok: false, message: "Invalid Twilio signature." });
  return next();
}
