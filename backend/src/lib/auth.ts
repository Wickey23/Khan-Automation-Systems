import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import crypto from "crypto";
import { env } from "../config/env";

export type AuthPayload = {
  userId: string;
  email: string;
  role: UserRole;
  clientId?: string | null;
  orgId?: string | null;
};

export type RefreshPayload = {
  userId: string;
  sessionId: string;
  familyId: string;
};

export type Trusted2faPayload = {
  userId: string;
  uaHash: string;
};

export function signAuthToken(payload: AuthPayload) {
  const expiresInMinutes = Number.parseInt(env.ACCESS_TOKEN_TTL_MINUTES, 10);
  return jwt.sign(payload, env.JWT_SECRET as Secret, {
    expiresIn: Number.isFinite(expiresInMinutes) ? `${expiresInMinutes}m` : (env.JWT_EXPIRES_IN as SignOptions["expiresIn"])
  });
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
}

export function signRefreshToken(payload: RefreshPayload) {
  const secret = env.REFRESH_TOKEN_SECRET || env.JWT_SECRET;
  const ttlDays = Number.parseInt(env.REFRESH_TOKEN_TTL_DAYS, 10);
  return jwt.sign(payload, secret as Secret, {
    expiresIn: Number.isFinite(ttlDays) ? `${ttlDays}d` : "14d"
  });
}

export function verifyRefreshToken(token: string) {
  const secret = env.REFRESH_TOKEN_SECRET || env.JWT_SECRET;
  return jwt.verify(token, secret) as RefreshPayload;
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateFamilyId() {
  return crypto.randomUUID();
}

export function signTrusted2faToken(payload: Trusted2faPayload) {
  const trustDays = Number.parseInt(env.AUTH_2FA_TRUST_DAYS, 10);
  const expires = (Number.isFinite(trustDays) && trustDays > 0 ? `${trustDays}d` : "1d") as SignOptions["expiresIn"];
  const secret = env.REFRESH_TOKEN_SECRET || env.JWT_SECRET;
  return jwt.sign(payload, secret as Secret, { expiresIn: expires });
}

export function verifyTrusted2faToken(token: string) {
  const secret = env.REFRESH_TOKEN_SECRET || env.JWT_SECRET;
  return jwt.verify(token, secret) as Trusted2faPayload;
}
