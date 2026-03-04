import type { NotificationSeverity, NotificationType, Prisma, PrismaClient, UserRole } from "@prisma/client";
import { env } from "../../config/env";
import { isFeatureEnabledForOrg } from "../org/feature-gates";
import { sendOrgOperationalNotificationEmail } from "../../services/email";

type EmitNotificationInput = {
  prisma: PrismaClient;
  orgId: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  targetRoleMin?: "VIEWER" | "MANAGER" | "ADMIN";
  metadata?: Record<string, unknown> | null;
  sendEmail?: boolean;
};

export function resolveNotificationTargetRoleMin(input: {
  type: NotificationType;
  severity: NotificationSeverity;
  targetRoleMin?: "VIEWER" | "MANAGER" | "ADMIN";
}) {
  if (input.targetRoleMin) return input.targetRoleMin;

  if (input.type === "EMERGENCY_CALL_FLAGGED") return "MANAGER";
  if (input.type === "MISSED_CALL_RECOVERY_NEEDED") return "MANAGER";
  if (input.severity === "URGENT") return "MANAGER";
  if (input.severity === "ACTION_REQUIRED") return "MANAGER";
  return "VIEWER";
}

function parseJsonStringArray(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => String(item || "").trim().toLowerCase())
      .filter((item) => Boolean(item) && item.includes("@"));
  } catch {
    return [];
  }
}

function parseJsonObject(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function resolveEmailRecipients(input: { prisma: PrismaClient; orgId: string; type: NotificationType }) {
  let settings: { notificationEmailRecipientsJson: string | null; notificationTogglesJson: string | null } | null = null;
  try {
    settings = await input.prisma.businessSettings.findUnique({
      where: { orgId: input.orgId },
      select: { notificationEmailRecipientsJson: true, notificationTogglesJson: true }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const schemaDrift = message.includes("p2022") || message.includes("column");
    if (!schemaDrift) throw error;
    settings = null;
  }
  const toggles = parseJsonObject(settings?.notificationTogglesJson);
  const toggleKey = `${input.type}_EMAIL_ENABLED`;
  const defaultEnabled = true;
  const enabled = toggles[toggleKey] === undefined ? defaultEnabled : Boolean(toggles[toggleKey]);
  if (!enabled) return [];

  const explicitRecipients = parseJsonStringArray(settings?.notificationEmailRecipientsJson);
  if (explicitRecipients.length > 0) return explicitRecipients;

  const admins = await input.prisma.user.findMany({
    where: {
      orgId: input.orgId,
      role: { in: ["CLIENT_ADMIN", "ADMIN", "SUPER_ADMIN"] as UserRole[] }
    },
    select: { email: true }
  });
  return admins.map((row) => String(row.email || "").trim().toLowerCase()).filter((email) => Boolean(email));
}

export async function emitOrgNotification(input: EmitNotificationInput) {
  if (!isFeatureEnabledForOrg(env.FEATURE_NOTIFICATIONS_V1_ENABLED, input.orgId)) {
    return null;
  }

  const notification = await input.prisma.orgNotification.create({
    data: {
      orgId: input.orgId,
      type: input.type,
      severity: input.severity,
      title: input.title,
      body: input.body,
      targetRoleMin: resolveNotificationTargetRoleMin(input),
      metadataJson: (input.metadata || undefined) as Prisma.InputJsonValue | undefined
    }
  });

  if (input.sendEmail === false) return notification;
  const recipients = await resolveEmailRecipients({
    prisma: input.prisma,
    orgId: input.orgId,
    type: input.type
  });
  if (!recipients.length) return notification;

  await Promise.all(
    recipients.map(async (email) => {
      try {
        await sendOrgOperationalNotificationEmail({
          to: email,
          title: input.title,
          body: input.body,
          severity: input.severity
        });
      } catch {
        // Best-effort notification email; DB notification remains authoritative.
      }
    })
  );
  return notification;
}
