import type { IncomingMessage } from "http";
import crypto from "node:crypto";
import Twilio from "twilio";
import { env } from "../../../config/env";

type MediaTokenPayload = {
  orgId: string;
  callLogId: string;
  providerCallId: string;
  exp: number;
};

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signTokenBody(body: string) {
  return crypto.createHmac("sha256", env.TWILIO_MEDIA_STREAM_TOKEN_SECRET || "").update(body).digest("base64url");
}

export function createVoiceMediaStreamToken(input: {
  orgId: string;
  callLogId: string;
  providerCallId: string;
  ttlSeconds?: number;
}) {
  const exp = Math.floor(Date.now() / 1000) + Math.max(60, input.ttlSeconds || 900);
  const payload: MediaTokenPayload = {
    orgId: input.orgId,
    callLogId: input.callLogId,
    providerCallId: input.providerCallId,
    exp
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  return `${encoded}.${signTokenBody(encoded)}`;
}

export function verifyVoiceMediaStreamToken(token: string | null | undefined) {
  if (!token || !env.TWILIO_MEDIA_STREAM_TOKEN_SECRET) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = signTokenBody(encoded);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(fromBase64Url(encoded)) as MediaTokenPayload;
    if (!payload?.orgId || !payload?.callLogId || !payload?.providerCallId) return null;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function buildRequestCandidates(req: IncomingMessage, pathName: string) {
  const host = String(req.headers.host || "").trim();
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0]?.trim();
  const runtimeProtocol = forwardedProto || "https";
  const candidates = new Set<string>();
  if (host) {
    candidates.add(`${runtimeProtocol}://${host}${pathName}`);
    candidates.add(`https://${host}${pathName}`);
    candidates.add(`wss://${host}${pathName}`);
  }
  const configuredBase = (env.TWILIO_MEDIA_STREAM_BASE_URL || env.TWILIO_WEBHOOK_BASE_URL || env.API_BASE_URL || "").replace(/\/$/, "");
  if (configuredBase) {
    candidates.add(`${configuredBase}${pathName}`);
    if (configuredBase.startsWith("wss://")) {
      candidates.add(`https://${configuredBase.slice("wss://".length)}${pathName}`);
    } else if (configuredBase.startsWith("https://")) {
      candidates.add(`wss://${configuredBase.slice("https://".length)}${pathName}`);
    }
  }
  return [...candidates];
}

export function validateTwilioMediaStreamUpgradeSignature(req: IncomingMessage) {
  const strict =
    (env.WEBHOOK_STRICT_MODE === "true" || env.SECURITY_MODE === "production") &&
    env.TWILIO_VALIDATE_SIGNATURES !== "false";
  if (!strict && !env.TWILIO_AUTH_TOKEN) return true;
  if (!env.TWILIO_AUTH_TOKEN) return false;
  const signature = String(req.headers["x-twilio-signature"] || "").trim();
  if (!signature) return false;
  const pathName = String(req.url || "").split("?")[0] || env.TWILIO_MEDIA_STREAM_PATH || "/ws/twilio/voice-media";
  const candidates = buildRequestCandidates(req, pathName);
  return candidates.some((candidate) => Twilio.validateRequest(env.TWILIO_AUTH_TOKEN as string, signature, candidate, {}));
}
