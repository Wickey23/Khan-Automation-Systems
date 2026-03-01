import type { UserRole } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../lib/auth";

export type AuthenticatedRequest = Request & {
  auth?: {
    userId: string;
    email: string;
    role: UserRole;
    clientId?: string | null;
    orgId?: string | null;
  };
};

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const bearerToken = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.replace("Bearer ", "")
    : "";
  const cookieToken = req.cookies?.kas_auth_token as string | undefined;
  const token = bearerToken || cookieToken;

  if (!token) return res.status(401).json({ ok: false, message: "Unauthorized" });

  try {
    req.auth = verifyAuthToken(token);
    return next();
  } catch {
    return res.status(401).json({ ok: false, message: "Invalid session" });
  }
}

export function requireRole(role: UserRole) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ ok: false, message: "Unauthorized" });
    if (req.auth.role !== role) return res.status(403).json({ ok: false, message: "Forbidden" });
    return next();
  };
}

export function requireAnyRole(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ ok: false, message: "Unauthorized" });
    if (!roles.includes(req.auth.role)) return res.status(403).json({ ok: false, message: "Forbidden" });
    return next();
  };
}
