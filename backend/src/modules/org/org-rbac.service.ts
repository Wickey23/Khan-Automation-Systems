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

