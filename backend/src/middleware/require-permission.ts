import { UserRole } from "@prisma/client";
import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./require-auth";
import { prisma } from "../lib/prisma";

export type AppPermission =
  | "ADMIN_SYSTEM_VIEW"
  | "ADMIN_SYSTEM_MUTATE"
  | "ORG_OVERRIDE_MUTATE"
  | "GO_LIVE_OVERRIDE_CRITICAL"
  | "DATA_REPAIR_EXECUTE";

const PERMISSIONS_BY_ROLE: Record<UserRole, Set<AppPermission>> = {
  SUPER_ADMIN: new Set([
    "ADMIN_SYSTEM_VIEW",
    "ADMIN_SYSTEM_MUTATE",
    "ORG_OVERRIDE_MUTATE",
    "GO_LIVE_OVERRIDE_CRITICAL",
    "DATA_REPAIR_EXECUTE"
  ]),
  ADMIN: new Set(["ADMIN_SYSTEM_VIEW", "ADMIN_SYSTEM_MUTATE", "ORG_OVERRIDE_MUTATE", "DATA_REPAIR_EXECUTE"]),
  CLIENT_ADMIN: new Set([]),
  CLIENT_STAFF: new Set([]),
  CLIENT: new Set([])
};

function deny(req: AuthenticatedRequest, res: Response, reason: string) {
  void prisma.auditLog
    .create({
      data: {
        orgId: req.auth?.orgId || null,
        actorUserId: req.auth?.userId || "anonymous",
        actorRole: req.auth?.role || "UNKNOWN",
        action: "RBAC_FORBIDDEN",
        metadataJson: JSON.stringify({
          path: req.originalUrl,
          method: req.method,
          reason,
          requestId: req.requestId || null
        })
      }
    })
    .catch(() => null);
  return res.status(403).json({ ok: false, message: "Forbidden" });
}

export function requireRole(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ ok: false, message: "Unauthorized" });
    if (!roles.includes(req.auth.role)) return deny(req, res, "role_missing");
    return next();
  };
}

export function requirePermission(permission: AppPermission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ ok: false, message: "Unauthorized" });
    const permissions = PERMISSIONS_BY_ROLE[req.auth.role];
    if (!permissions?.has(permission)) return deny(req, res, `permission_missing:${permission}`);
    return next();
  };
}

