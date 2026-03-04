import { UserRole } from "@prisma/client";

export function canReadOrgFeature(role: UserRole | string | null | undefined) {
  return (
    role === UserRole.CLIENT ||
    role === UserRole.CLIENT_STAFF ||
    role === UserRole.CLIENT_ADMIN ||
    role === UserRole.ADMIN ||
    role === UserRole.SUPER_ADMIN
  );
}

export function canWriteOrgFeature(role: UserRole | string | null | undefined) {
  return (
    role === UserRole.CLIENT_STAFF ||
    role === UserRole.CLIENT_ADMIN ||
    role === UserRole.ADMIN ||
    role === UserRole.SUPER_ADMIN
  );
}

export function canManageOrgAdminFeature(role: UserRole | string | null | undefined) {
  return role === UserRole.CLIENT_ADMIN || role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

type NotificationRoleMin = "VIEWER" | "MANAGER" | "ADMIN";

function roleTier(role: UserRole | string | null | undefined) {
  if (role === UserRole.CLIENT_ADMIN || role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) return 3;
  if (role === UserRole.CLIENT_STAFF) return 2;
  if (role === UserRole.CLIENT) return 1;
  return 0;
}

function minTier(targetRoleMin: NotificationRoleMin | string | null | undefined) {
  if (String(targetRoleMin || "").toUpperCase() === "ADMIN") return 3;
  if (String(targetRoleMin || "").toUpperCase() === "MANAGER") return 2;
  return 1;
}

export function canViewNotificationForRole(
  role: UserRole | string | null | undefined,
  targetRoleMin: NotificationRoleMin | string | null | undefined
) {
  return roleTier(role) >= minTier(targetRoleMin);
}
