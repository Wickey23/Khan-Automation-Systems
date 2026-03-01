import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env";

export type AuthPayload = {
  userId: string;
  email: string;
  role: UserRole;
  clientId?: string | null;
  orgId?: string | null;
};

export function signAuthToken(payload: AuthPayload) {
  return jwt.sign(payload, env.JWT_SECRET as Secret, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  });
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
}
