import { OnboardingStatus, OrganizationStatus, UserRole } from "@prisma/client";
import { Router, type NextFunction, type Response } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { decryptField, encryptField } from "../../lib/crypto-fields";
import { prisma } from "../../lib/prisma";
import { isPrismaMissingColumnError } from "../../lib/prisma-errors";
import { requireAnyRole, requireAuth, type AuthenticatedRequest } from "../../middleware/require-auth";
import { hasProMessaging } from "../billing/plan-features";
import { sendSmsMessage } from "../twilio/twilio.service";
import { backfillMissedVapiCalls } from "../admin/backfill.service";
import { hasActiveBilling } from "./runtime-access.service";
import { buildConfigPackage, generateConfigPackage } from "./config-package";
import { computeOrgAnalytics, shapeOrgAnalyticsForRole } from "./analytics.service";
import { computeOrgHealth } from "./health.service";
import { dedupeOrgCallRows } from "./call-log-dedupe.service";
import {
  computeAvailabilityWindow,
  generateAvailabilitySlots,
  validateSlotWithinBusinessHours
} from "../appointments/slotting.service";
import { bookAppointmentWithHold } from "../appointments/booking.service";
import {
  consumeCalendarOauthState,
  createCalendarConnectUrl,
  createCalendarEventFromConnection,
  exchangeCalendarCode,
  listCalendarEventsFromConnection,
  upsertCalendarConnection
} from "../appointments/calendar-oauth.service";
import { CalendarUnavailableError, getBusyBlocks } from "../appointments/calendar-busy.service";
import { emitOrgNotification } from "../notifications/notification.service";
import { classifyCallAndMaybeUpdateLead } from "./call-classification.service";
import { isFeatureEnabledForOrg } from "./feature-gates";
import {
  canManageCalendar,
  canManageOrgAdminFeature,
  canReadAppointments,
  canViewNotificationForRole,
  canWriteAppointments,
  canWriteOrgFeature
} from "./org-rbac.service";
import {
  saveOnboardingSchema,
  sendOrgMessageSchema,
  submitOnboardingSchema,
  updateBusinessSettingsSchema,
  updateOrgProfileSchema
} from "./org.schema";

export const orgRouter = Router();

orgRouter.use(requireAuth, requireAnyRole([UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF, UserRole.CLIENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]));

function requireOrgWriteAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const role = req.auth?.role;
  if (canWriteOrgFeature(role)) {
    return next();
  }
  return res.status(403).json({ ok: false, message: "Forbidden" });
}
function requireOrgAdminAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const role = req.auth?.role;
  if (canManageOrgAdminFeature(role)) {
    return next();
  }
  return res.status(403).json({ ok: false, message: "Forbidden" });
}
function requireAppointmentsReadAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const role = req.auth?.role;
  if (canReadAppointments(role)) {
    return next();
  }
  return res.status(403).json({ ok: false, message: "Forbidden" });
}
function requireAppointmentsWriteAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const role = req.auth?.role;
  if (canWriteAppointments(role)) {
    return next();
  }
  return res.status(403).json({ ok: false, message: "Forbidden" });
}
function requireCalendarManageAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const role = req.auth?.role;
  if (canManageCalendar(role)) {
    return next();
  }
  return res.status(403).json({ ok: false, message: "Forbidden" });
}
const KNOWLEDGE_FILE_MAX_BYTES = 200_000;
const KNOWLEDGE_TOTAL_MAX_CHARS = 40_000;
const ALLOWED_KNOWLEDGE_MIME = new Set(["text/plain", "text/markdown", "application/json", "text/csv"]);
const appointmentsAvailabilitySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});
const listAppointmentsSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELED", "NO_SHOW"]).optional()
});
const createAppointmentSchema = z.object({
  leadId: z.string().optional(),
  callLogId: z.string().optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().min(5),
  issueSummary: z.string().min(1),
  assignedTechnician: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: z.string().min(1),
  calendarProvider: z.enum(["GOOGLE", "OUTLOOK", "INTERNAL"]).optional(),
  externalCalendarEventId: z.string().optional(),
  idempotencyKey: z.string().optional()
});
const patchAppointmentSchema = z.object({
  assignedTechnician: z.string().nullable().optional(),
  issueSummary: z.string().min(1).optional(),
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELED", "NO_SHOW"]).optional()
});
const updateLeadPipelineSchema = z.object({
  pipelineStage: z.enum(["NEW_LEAD", "QUOTED", "NEEDS_SCHEDULING", "SCHEDULED", "COMPLETED"])
});
const createCalendarTestEventSchema = z.object({
  provider: z.enum(["GOOGLE", "OUTLOOK"]).optional()
});
const disconnectCalendarSchema = z.object({
  connectionId: z.string().optional(),
  provider: z.enum(["GOOGLE", "OUTLOOK"]).optional(),
  accountEmail: z.string().email().optional()
});
const selectPrimaryCalendarSchema = z.object({
  connectionId: z.string().min(1),
  selectedCalendarId: z.string().optional()
});
const listCalendarEventsSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  provider: z.enum(["GOOGLE", "OUTLOOK"]).optional()
});

function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (!digits) return input.trim();
  if (digits.length === 10) return `+1${digits}`;
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  if (input.trim().startsWith("+")) return input.trim();
  return `+${digits}`;
}

function normalizePhoneE164(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function parseOptionalDate(input: unknown) {
  if (!input) return null;
  const text = String(input).trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseBooleanLike(input: unknown) {
  if (typeof input === "boolean") return input;
  const text = String(input || "").trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(text)) return true;
  if (["false", "0", "no", "n"].includes(text)) return false;
  return null;
}

function normalizeOutcome(input: unknown) {
  const raw = String(input || "").trim().toUpperCase().replace(/\s+/g, "_");
  if (["APPOINTMENT_REQUEST", "MESSAGE_TAKEN", "TRANSFERRED", "MISSED", "SPAM"].includes(raw)) {
    return raw as "APPOINTMENT_REQUEST" | "MESSAGE_TAKEN" | "TRANSFERRED" | "MISSED" | "SPAM";
  }
  return null;
}

function inferNameFromSummary(summary: string) {
  const source = String(summary || "").trim();
  if (!source) return "";
  const stopWords = new Set([
    "sorry",
    "help",
    "issue",
    "problem",
    "phone",
    "number",
    "looking",
    "escalating",
    "customer",
    "caller",
    "unknown",
    "support",
    "service",
    "name",
    "from"
  ]);
  const patterns = [
    /\bmy name is\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,2})\b/i,
    /\bthis is\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,2})\b/i,
    /\bi(?:'m| am)\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,1})\b/i,
    /\b([A-Za-z][A-Za-z'-]+\s+[A-Za-z][A-Za-z'-]+)\s+called\b/i
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    const raw = match?.[1]?.trim() || "";
    if (!raw) continue;
    const cleaned = raw
      .replace(/\b(from|and|but)\b.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) continue;
    const parts = cleaned.split(" ").filter(Boolean);
    if (!parts.length || parts.length > 3) continue;
    if (parts.some((part) => stopWords.has(part.toLowerCase()))) continue;
    if (parts.length === 1 && parts[0].length < 2) continue;
    return parts
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }
  return "";
}

function isPlaceholderName(input: string) {
  const value = String(input || "").trim().toLowerCase();
  if (!value) return true;
  return value === "unknown caller" || value === "unknown contact";
}

function pickRowValue(row: Record<string, unknown>, keys: string[]) {
  const map = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    map.set(String(key).trim().toLowerCase(), value);
  }
  for (const key of keys) {
    const value = map.get(key);
    if (value !== undefined && String(value).trim() !== "") return value;
  }
  return undefined;
}

orgRouter.get("/profile", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const [organization, activePhone] = await Promise.all([
    prisma.organization.findUnique({ where: { id: req.auth.orgId } }),
    prisma.phoneNumber.findFirst({
      where: { orgId: req.auth.orgId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: { e164Number: true, provider: true }
    })
  ]);
  if (!organization) return res.status(404).json({ ok: false, message: "Organization not found." });
  return res.json({
    ok: true,
    data: {
      organization,
      assignedPhoneNumber: activePhone?.e164Number || null,
      assignedNumberProvider: activePhone?.provider || null,
      features: {
        appointmentsEnabled: isFeatureEnabledForOrg(env.FEATURE_APPOINTMENTS_ENABLED, req.auth.orgId),
        calendarOauthEnabled: isFeatureEnabledForOrg(env.FEATURE_CALENDAR_OAUTH_ENABLED, req.auth.orgId),
        notificationsEnabled: isFeatureEnabledForOrg(env.FEATURE_NOTIFICATIONS_V1_ENABLED, req.auth.orgId),
        pipelineStageEnabled: isFeatureEnabledForOrg(env.FEATURE_PIPELINE_STAGE_ENABLED, req.auth.orgId),
        classificationEnabled: isFeatureEnabledForOrg(env.FEATURE_CLASSIFICATION_V1_ENABLED, req.auth.orgId)
      }
    }
  });
});

orgRouter.patch("/profile", requireOrgWriteAccess, async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = updateOrgProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid profile payload.", errors: parsed.error.flatten() });
  const organization = await prisma.organization.update({
    where: { id: req.auth.orgId },
    data: parsed.data
  });
  return res.json({ ok: true, data: { organization } });
});

orgRouter.get("/settings", requireOrgWriteAccess, async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const settings = await prisma.businessSettings.upsert({
    where: { orgId: req.auth.orgId },
    update: {},
    create: { orgId: req.auth.orgId }
  });
  const hydrated = {
    ...settings,
    transferNumbersJson: decryptField(settings.transferNumbersJson),
    notificationEmailsJson: decryptField(settings.notificationEmailsJson),
    notificationPhonesJson: decryptField(settings.notificationPhonesJson)
  };
  return res.json({ ok: true, data: { settings: hydrated } });
});

orgRouter.patch("/settings", requireOrgWriteAccess, async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = updateBusinessSettingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid settings payload.", errors: parsed.error.flatten() });

  const settings = await prisma.businessSettings.upsert({
    where: { orgId: req.auth.orgId },
    update: {
      ...parsed.data,
      ...(parsed.data.transferNumbersJson ? { transferNumbersJson: encryptField(parsed.data.transferNumbersJson) } : {}),
      ...(parsed.data.notificationEmailsJson ? { notificationEmailsJson: encryptField(parsed.data.notificationEmailsJson) } : {}),
      ...(parsed.data.notificationPhonesJson ? { notificationPhonesJson: encryptField(parsed.data.notificationPhonesJson) } : {})
    },
    create: {
      orgId: req.auth.orgId,
      ...parsed.data,
      ...(parsed.data.transferNumbersJson ? { transferNumbersJson: encryptField(parsed.data.transferNumbersJson) } : {}),
      ...(parsed.data.notificationEmailsJson ? { notificationEmailsJson: encryptField(parsed.data.notificationEmailsJson) } : {}),
      ...(parsed.data.notificationPhonesJson ? { notificationPhonesJson: encryptField(parsed.data.notificationPhonesJson) } : {})
    }
  });

  const organization = await prisma.organization.findUnique({ where: { id: req.auth.orgId }, select: { status: true, live: true } });
  if (organization?.live) {
    await prisma.auditLog.create({
      data: {
        orgId: req.auth.orgId,
        actorUserId: req.auth.userId,
        actorRole: req.auth.role,
        action: "BUSINESS_SETTINGS_UPDATED_WHILE_LIVE",
        metadataJson: JSON.stringify({ sensitiveReviewRecommended: true })
      }
    });
  }

  const hydrated = {
    ...settings,
    transferNumbersJson: decryptField(settings.transferNumbersJson),
    notificationEmailsJson: decryptField(settings.notificationEmailsJson),
    notificationPhonesJson: decryptField(settings.notificationPhonesJson)
  };
  return res.json({ ok: true, data: { settings: hydrated } });
});

orgRouter.get("/knowledge-files", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const files = await prisma.organizationKnowledgeFile.findMany({
    where: { orgId: req.auth.orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      updatedAt: true
    }
  });
  return res.json({ ok: true, data: { files } });
});

orgRouter.post("/knowledge-files", requireOrgWriteAccess, async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const fileName = String(req.body?.fileName || "").trim();
  const mimeType = String(req.body?.mimeType || "text/plain").trim().toLowerCase();
  const contentText = String(req.body?.contentText || "");
  const sizeBytes = Number(req.body?.sizeBytes || Buffer.byteLength(contentText, "utf8"));

  if (!fileName) return res.status(400).json({ ok: false, message: "fileName is required." });
  if (!contentText.trim()) return res.status(400).json({ ok: false, message: "File content is empty." });
  if (!ALLOWED_KNOWLEDGE_MIME.has(mimeType)) {
    return res.status(400).json({ ok: false, message: "Only .txt, .md, .json, and .csv files are supported." });
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > KNOWLEDGE_FILE_MAX_BYTES) {
    return res.status(400).json({ ok: false, message: `File too large. Max ${KNOWLEDGE_FILE_MAX_BYTES} bytes.` });
  }

  const current = await prisma.organizationKnowledgeFile.findMany({
    where: { orgId: req.auth.orgId },
    select: { id: true, contentText: true }
  });
  const usedChars = current.reduce((sum: number, row: { contentText: string }) => sum + row.contentText.length, 0);
  if (usedChars + contentText.length > KNOWLEDGE_TOTAL_MAX_CHARS) {
    return res.status(400).json({
      ok: false,
      message: `Knowledge storage limit reached. Max ${KNOWLEDGE_TOTAL_MAX_CHARS} text characters per organization.`
    });
  }

  const file = await prisma.organizationKnowledgeFile.create({
    data: {
      orgId: req.auth.orgId,
      fileName: fileName.slice(0, 180),
      mimeType,
      sizeBytes,
      contentText: contentText.trim(),
      uploadedByUserId: req.auth.userId
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      updatedAt: true
    }
  });

  await prisma.auditLog.create({
    data: {
      orgId: req.auth.orgId,
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "KNOWLEDGE_FILE_UPLOADED",
      metadataJson: JSON.stringify({ fileId: file.id, fileName: file.fileName, sizeBytes: file.sizeBytes })
    }
  });

  return res.json({ ok: true, data: { file } });
});

orgRouter.delete("/knowledge-files/:fileId", requireOrgWriteAccess, async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const existing = await prisma.organizationKnowledgeFile.findFirst({
    where: { id: req.params.fileId, orgId: req.auth.orgId }
  });
  if (!existing) return res.status(404).json({ ok: false, message: "Knowledge file not found." });

  await prisma.organizationKnowledgeFile.delete({ where: { id: existing.id } });
  await prisma.auditLog.create({
    data: {
      orgId: req.auth.orgId,
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "KNOWLEDGE_FILE_DELETED",
      metadataJson: JSON.stringify({ fileId: existing.id, fileName: existing.fileName })
    }
  });

  return res.json({ ok: true, data: { id: existing.id } });
});

orgRouter.get("/onboarding", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const submission = await prisma.onboardingSubmission.findFirst({
    where: { orgId: req.auth.orgId },
    orderBy: { updatedAt: "desc" }
  });
  return res.json({ ok: true, data: { submission } });
});

orgRouter.get("/config-package", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const configPackage = await prisma.configPackage.findUnique({ where: { orgId: req.auth.orgId } });
  return res.json({ ok: true, data: { configPackage } });
});

orgRouter.put("/onboarding", requireOrgWriteAccess, async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = saveOnboardingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid onboarding payload.", errors: parsed.error.flatten() });

  const configPackage = buildConfigPackage(parsed.data.answers as Record<string, unknown>);
  const submission = await prisma.onboardingSubmission.upsert({
    where: { orgId: req.auth.orgId },
    update: {
      answersJson: JSON.stringify(parsed.data.answers),
      configPackageJson: JSON.stringify(configPackage),
      status: OnboardingStatus.DRAFT
    },
    create: {
      orgId: req.auth.orgId,
      answersJson: JSON.stringify(parsed.data.answers),
      configPackageJson: JSON.stringify(configPackage),
      status: OnboardingStatus.DRAFT
    }
  });

  await prisma.organization.update({
    where: { id: req.auth.orgId },
    data: { status: OrganizationStatus.ONBOARDING }
  });

  await generateConfigPackage({
    prisma,
    orgId: req.auth.orgId,
    generatedByUserId: req.auth.userId
  });

  return res.json({ ok: true, data: { submission } });
});

orgRouter.post("/onboarding/preview", requireOrgWriteAccess, async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = saveOnboardingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid onboarding payload.", errors: parsed.error.flatten() });
  const configPackage = buildConfigPackage(parsed.data.answers as Record<string, unknown>);
  return res.json({ ok: true, data: { configPackage } });
});

orgRouter.post("/onboarding/submit", requireOrgWriteAccess, async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = submitOnboardingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid onboarding submit payload.", errors: parsed.error.flatten() });

  const current = await prisma.onboardingSubmission.findFirst({ where: { orgId: req.auth.orgId } });
  const answersObj = parsed.data.answers || (current?.answersJson ? (JSON.parse(current.answersJson) as Record<string, unknown>) : {});
  const configPackage = buildConfigPackage(answersObj as Record<string, unknown>);

  const submission = await prisma.onboardingSubmission.upsert({
    where: { orgId: req.auth.orgId },
    update: {
      answersJson: JSON.stringify(answersObj),
      configPackageJson: JSON.stringify(configPackage),
      status: OnboardingStatus.SUBMITTED,
      submittedAt: new Date()
    },
    create: {
      orgId: req.auth.orgId,
      answersJson: JSON.stringify(answersObj),
      configPackageJson: JSON.stringify(configPackage),
      status: OnboardingStatus.SUBMITTED,
      submittedAt: new Date()
    }
  });

  await prisma.organization.update({
    where: { id: req.auth.orgId },
    data: { status: OrganizationStatus.SUBMITTED }
  });

  const hours = (configPackage.hours as Record<string, unknown>) || {};
  const weekly = (hours.weekly as Record<string, unknown>) || {};
  const schedule =
    weekly.schedule && typeof weekly.schedule === "object" && !Array.isArray(weekly.schedule)
      ? (weekly.schedule as Record<string, unknown>)
      : {};
  const timezoneValue = String(weekly.timezone || "America/New_York");
  const afterHoursModeValue = String(hours.afterHoursMode || "TAKE_MESSAGE").toUpperCase();
  const transfer = (configPackage.transfer as Record<string, unknown>) || {};
  const transferRules = Array.isArray(transfer.rules) ? (transfer.rules as Array<Record<string, unknown>>) : [];
  const transferNumbers = transferRules
    .map((rule) => String(rule.toNumber || "").trim())
    .filter((value) => Boolean(value));
  const fallback = transfer.fallback && typeof transfer.fallback === "object" ? (transfer.fallback as Record<string, unknown>) : {};
  const fallbackTo = String(fallback.toNumber || "").trim();
  const transferNumbersWithFallback = Array.from(
    new Set([...(transferNumbers || []), ...(fallbackTo ? [fallbackTo] : [])])
  );

  await prisma.businessSettings.upsert({
    where: { orgId: req.auth.orgId },
    update: {
      timezone: timezoneValue,
      hoursJson: JSON.stringify({ timezone: timezoneValue, schedule }),
      afterHoursMode: afterHoursModeValue,
      transferNumbersJson: JSON.stringify(transferNumbersWithFallback),
      servicesJson: JSON.stringify(
        ((configPackage.services as Record<string, unknown>)?.offered as unknown[]) || []
      ),
      policiesJson: JSON.stringify(configPackage.policies || {}),
      notificationEmailsJson: JSON.stringify(
        ((configPackage.notifications as Record<string, unknown>)?.emails as unknown[]) || []
      ),
      notificationPhonesJson: JSON.stringify(
        ((configPackage.notifications as Record<string, unknown>)?.phones as unknown[]) || []
      )
    },
    create: {
      orgId: req.auth.orgId,
      timezone: timezoneValue,
      hoursJson: JSON.stringify({ timezone: timezoneValue, schedule }),
      afterHoursMode: afterHoursModeValue,
      transferNumbersJson: JSON.stringify(transferNumbersWithFallback),
      servicesJson: JSON.stringify(
        ((configPackage.services as Record<string, unknown>)?.offered as unknown[]) || []
      ),
      policiesJson: JSON.stringify(configPackage.policies || {}),
      notificationEmailsJson: JSON.stringify(
        ((configPackage.notifications as Record<string, unknown>)?.emails as unknown[]) || []
      ),
      notificationPhonesJson: JSON.stringify(
        ((configPackage.notifications as Record<string, unknown>)?.phones as unknown[]) || []
      )
    }
  });

  await generateConfigPackage({
    prisma,
    orgId: req.auth.orgId,
    generatedByUserId: req.auth.userId
  });

  return res.json({ ok: true, data: { submission, configPackage } });
});

orgRouter.get("/subscription", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const subscription = await prisma.subscription.findFirst({
    where: { orgId: req.auth.orgId },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ ok: true, data: { subscription } });
});

orgRouter.get("/leads", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const leads = await prisma.lead.findMany({
    where: { orgId: req.auth.orgId },
    orderBy: { createdAt: "desc" }
  });
  return res.json({
    ok: true,
    data: {
      leads,
      pipelineFeatureEnabled: isFeatureEnabledForOrg(env.FEATURE_PIPELINE_STAGE_ENABLED, req.auth.orgId)
    }
  });
});

orgRouter.patch("/leads/:id/pipeline", requireOrgWriteAccess, async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  if (!isFeatureEnabledForOrg(env.FEATURE_PIPELINE_STAGE_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Lead pipeline feature is disabled." });
  }
  const parsed = updateLeadPipelineSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid pipeline payload." });
  const lead = await prisma.lead.findFirst({
    where: { id: req.params.id, orgId: req.auth.orgId },
    select: { id: true }
  });
  if (!lead) return res.status(404).json({ ok: false, message: "Lead not found." });
  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: { pipelineStage: parsed.data.pipelineStage }
  });
  return res.json({ ok: true, data: { lead: updated } });
});

orgRouter.get("/calls", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const orgId = req.auth.orgId;
  const [calls, activePhone] = await Promise.all([
    prisma.callLog.findMany({
      where: { orgId },
      orderBy: { startedAt: "desc" }
    }),
    prisma.phoneNumber.findFirst({
      where: { orgId: req.auth.orgId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: { e164Number: true, provider: true }
    })
  ]);
  const dedupedCalls = dedupeOrgCallRows(
    calls.map((call) => ({
      id: call.id,
      startedAt: call.startedAt,
      fromNumber: call.fromNumber,
      outcome: call.outcome,
      durationSec: call.durationSec,
      recordingUrl: call.recordingUrl,
      transcript: call.transcript,
      aiSummary: call.aiSummary,
      endedAt: call.endedAt,
      completedAt: call.completedAt,
      leadId: call.leadId
    }))
  );
  const dedupedCallIds = new Set(dedupedCalls.map((call) => call.id));
  const enrichedCalls = calls
    .filter((call) => dedupedCallIds.has(call.id))
    .map((call) => ({
    ...call,
    summary: call.aiSummary || (call.transcript?.trim() ? call.transcript.trim().slice(0, 240) : `Outcome: ${call.outcome.replace(/_/g, " ").toLowerCase()}`)
  }));
  if (isFeatureEnabledForOrg(env.FEATURE_CLASSIFICATION_V1_ENABLED, req.auth?.orgId)) {
    const topForClassification = enrichedCalls.slice(0, 50);
    await Promise.all(
      topForClassification.map((call) =>
        classifyCallAndMaybeUpdateLead({
          prisma,
          orgId,
          callLogId: call.id,
          leadId: call.leadId || null
        }).catch(() => null)
      )
    );
  }
  return res.json({
    ok: true,
    data: {
      calls: enrichedCalls,
      assignedPhoneNumber: activePhone?.e164Number || null,
      assignedNumberProvider: activePhone?.provider || null
    }
  });
});

orgRouter.get("/customer-base", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });

  const profiles = await prisma.callerProfile.findMany({
    where: { orgId: req.auth.orgId },
    orderBy: { lastCallAt: "desc" },
    take: 400
  });
  const phones = profiles.map((p) => p.phoneNumber);

  const [leads, calls, threads] = await Promise.all([
    prisma.lead.findMany({
      where: { orgId: req.auth.orgId },
      select: {
        id: true,
        name: true,
        business: true,
        email: true,
        phone: true,
        urgency: true,
        notes: true,
        createdAt: true
      },
      take: 1000
    }),
    prisma.callLog.findMany({
      where: { orgId: req.auth.orgId, fromNumber: { in: phones.length ? phones : ["__none__"] } },
      orderBy: { startedAt: "desc" },
      select: {
        fromNumber: true,
        startedAt: true,
        outcome: true,
        aiSummary: true,
        appointmentRequested: true
      },
      take: 2000
    }),
    prisma.messageThread.findMany({
      where: { orgId: req.auth.orgId, channel: "SMS", contactPhone: { in: phones.length ? phones : ["__none__"] } },
      select: { contactPhone: true, lastMessageAt: true },
      take: 1000
    })
  ]);

  const leadByPhone = new Map<string, (typeof leads)[number]>();
  for (const lead of leads) {
    const key = normalizePhoneE164(lead.phone);
    if (!key) continue;
    if (!leadByPhone.has(key)) {
      leadByPhone.set(key, lead);
      continue;
    }
    const existing = leadByPhone.get(key)!;
    if (new Date(lead.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
      leadByPhone.set(key, lead);
    }
  }

  const callsByPhone = new Map<string, Array<(typeof calls)[number]>>();
  for (const call of calls) {
    const key = normalizePhoneE164(call.fromNumber);
    if (!key) continue;
    const list = callsByPhone.get(key) || [];
    if (list.length < 5) list.push(call);
    callsByPhone.set(key, list);
  }

  const threadByPhone = new Map<string, (typeof threads)[number]>();
  for (const thread of threads) {
    const key = normalizePhoneE164(thread.contactPhone);
    if (!key) continue;
    if (!threadByPhone.has(key)) {
      threadByPhone.set(key, thread);
      continue;
    }
    const existing = threadByPhone.get(key)!;
    if (new Date(thread.lastMessageAt).getTime() > new Date(existing.lastMessageAt).getTime()) {
      threadByPhone.set(key, thread);
    }
  }

  const customers = profiles.map((profile) => {
    const key = normalizePhoneE164(profile.phoneNumber);
    const lead = leadByPhone.get(key) || null;
    const recentCalls = callsByPhone.get(key) || [];
    const lastThread = threadByPhone.get(key) || null;
    const leadName = String(lead?.name || "").trim();
    const summaryName = recentCalls
      .map((call) => inferNameFromSummary(String(call.aiSummary || "")))
      .find((name) => Boolean(name));
    const displayName = !isPlaceholderName(leadName)
      ? leadName
      : summaryName || (leadName || "Unknown contact");
    const nameConfidence: "HIGH" | "MEDIUM" | "LOW" = !isPlaceholderName(leadName)
      ? "HIGH"
      : summaryName
        ? "MEDIUM"
        : "LOW";
    return {
      phoneNumber: profile.phoneNumber,
      displayName,
      nameConfidence,
      totalCalls: profile.totalCalls,
      firstCallAt: profile.firstCallAt,
      lastCallAt: profile.lastCallAt,
      lastOutcome: profile.lastOutcome,
      flaggedVIP: profile.flaggedVIP,
      lead: lead
        ? {
            id: lead.id,
            name: lead.name,
            business: lead.business,
            email: lead.email,
            urgency: lead.urgency,
            notes: lead.notes
          }
        : null,
      recentCalls: recentCalls.map((call) => ({
        startedAt: call.startedAt,
        outcome: call.outcome,
        aiSummary: call.aiSummary,
        appointmentRequested: call.appointmentRequested
      })),
      lastSmsAt: lastThread?.lastMessageAt || null
    };
  });

  return res.json({
    ok: true,
    data: {
      customers,
      summary: {
        total: customers.length,
        vip: customers.filter((c) => c.flaggedVIP).length,
        withLead: customers.filter((c) => Boolean(c.lead)).length,
        repeatCallers: customers.filter((c) => c.totalCalls > 1).length
      }
    }
  });
});

orgRouter.get("/data-quality", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [leads, completedCalls, allLeadPhones] = await Promise.all([
    prisma.lead.findMany({
      where: { orgId: req.auth.orgId, createdAt: { gte: since30d } },
      select: { id: true, name: true, phone: true }
    }),
    prisma.callLog.findMany({
      where: {
        orgId: req.auth.orgId,
        startedAt: { gte: since30d },
        OR: [{ completedAt: { not: null } }, { endedAt: { not: null } }, { state: "COMPLETED" }]
      },
      select: { id: true, leadId: true }
    }),
    prisma.lead.findMany({
      where: { orgId: req.auth.orgId, phone: { not: "" } },
      select: { phone: true }
    })
  ]);

  const unknownLeadNames = leads.filter((lead) => isPlaceholderName(lead.name)).length;
  const missingLeadCount = completedCalls.filter((call) => !call.leadId).length;
  const phoneCounts = new Map<string, number>();
  for (const lead of allLeadPhones) {
    const key = normalizePhoneE164(lead.phone);
    if (!key) continue;
    phoneCounts.set(key, (phoneCounts.get(key) || 0) + 1);
  }
  const duplicateLeadCandidates = [...phoneCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([phone, count]) => ({ phone, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);

  return res.json({
    ok: true,
    data: {
      window: "30d",
      unknownNameRate: leads.length ? unknownLeadNames / leads.length : 0,
      unknownNameCount: unknownLeadNames,
      leadCount: leads.length,
      missingLeadLinkageCount: missingLeadCount,
      completedCallCount: completedCalls.length,
      duplicateLeadCandidates
    }
  });
});

orgRouter.get("/messaging-readiness", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [subscription, activePhone, recentFailures, recentSuccessCount] = await Promise.all([
    prisma.subscription.findFirst({
      where: { orgId: req.auth.orgId },
      orderBy: { createdAt: "desc" },
      select: { plan: true, status: true }
    }),
    prisma.phoneNumber.findFirst({
      where: { orgId: req.auth.orgId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: { provider: true, e164Number: true }
    }),
    prisma.message.findMany({
      where: { orgId: req.auth.orgId, provider: "TWILIO", status: "FAILED", createdAt: { gte: since7d } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { errorText: true }
    }),
    prisma.message.count({
      where: {
        orgId: req.auth.orgId,
        provider: "TWILIO",
        direction: "OUTBOUND",
        status: { in: ["SENT", "DELIVERED"] },
        createdAt: { gte: since30d }
      }
    })
  ]);

  const billingActive = Boolean(
    subscription && ["active", "trialing"].includes(String(subscription.status || "").toLowerCase())
  );
  const proPlan = subscription?.plan === "PRO";
  const reasons: string[] = [];
  if (!activePhone) reasons.push("No active phone number is assigned.");
  if (!proPlan) reasons.push("Messaging automation is Pro-only.");
  if (!billingActive) reasons.push("Billing is not active.");
  if (activePhone?.provider !== "TWILIO") reasons.push("SMS readiness currently requires a Twilio number.");

  const a2pBlockedFailure = recentFailures.find((message) => {
    const text = String(message.errorText || "").toLowerCase();
    return text.includes("a2p") || text.includes("10dlc") || text.includes("30034") || text.includes("30007");
  });
  if (a2pBlockedFailure) reasons.push("Recent outbound failures indicate A2P registration or filtering issues.");

  const state =
    reasons.length > 0
      ? "A2P_BLOCKED"
      : recentSuccessCount > 0
        ? "A2P_REGISTERED"
        : "A2P_PENDING";

  return res.json({
    ok: true,
    data: {
      state,
      provider: activePhone?.provider || null,
      assignedNumber: activePhone?.e164Number || null,
      plan: subscription?.plan || null,
      subscriptionStatus: subscription?.status || null,
      billingActive,
      canSendOperationalSms: state !== "A2P_BLOCKED" && proPlan && billingActive && activePhone?.provider === "TWILIO",
      reasons
    }
  });
});

orgRouter.post("/appointments/availability", requireAppointmentsReadAccess, async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_APPOINTMENTS_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Appointments feature is disabled." });
  }
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = appointmentsAvailabilitySchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: "Invalid availability payload.", errors: parsed.error.flatten() });
  }
  if (parsed.data.from && parsed.data.to && new Date(parsed.data.from).getTime() > new Date(parsed.data.to).getTime()) {
    return res.status(400).json({ ok: false, message: "Invalid range: from must be before or equal to to." });
  }

  let settings: {
    hoursJson: string | null;
    timezone: string | null;
    appointmentDurationMinutes: number | null;
    appointmentBufferMinutes: number | null;
    bookingLeadTimeHours: number | null;
    bookingMaxDaysAhead: number | null;
  } | null = null;
  try {
    settings = await prisma.businessSettings.findUnique({
      where: { orgId: req.auth.orgId },
      select: {
        hoursJson: true,
        timezone: true,
        appointmentDurationMinutes: true,
        appointmentBufferMinutes: true,
        bookingLeadTimeHours: true,
        bookingMaxDaysAhead: true
      }
    });
  } catch (error) {
    if (!isPrismaMissingColumnError(error)) throw error;
    settings = null;
  }
  const window = computeAvailabilityWindow({
    from: parsed.data.from ? new Date(parsed.data.from) : undefined,
    to: parsed.data.to ? new Date(parsed.data.to) : undefined,
    bookingLeadTimeHours: settings?.bookingLeadTimeHours ?? 2,
    bookingMaxDaysAhead: settings?.bookingMaxDaysAhead ?? 14
  });
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      orgId: req.auth.orgId,
      status: { not: "CANCELED" },
      startAt: { lte: window.to },
      endAt: { gte: window.from }
    },
    select: { startAt: true, endAt: true, status: true },
    orderBy: { startAt: "asc" },
    take: 500
  });

  let externalBusyBlocks: Array<{ startAt: Date; endAt: Date }> = [];
  if (isFeatureEnabledForOrg(env.FEATURE_CALENDAR_OAUTH_ENABLED, req.auth?.orgId)) {
    try {
      const busy = await getBusyBlocks({
        prisma,
        orgId: req.auth.orgId,
        fromUtc: window.from,
        toUtc: window.to
      });
      externalBusyBlocks = busy.map((row) => ({
        startAt: row.startUtc,
        endAt: row.endUtc
      }));
    } catch (error) {
      if (!(error instanceof CalendarUnavailableError)) throw error;
      externalBusyBlocks = [];
    }
  }

  const slots = generateAvailabilitySlots({
    hoursJson: settings?.hoursJson || null,
    timezone: settings?.timezone || "America/New_York",
    appointmentDurationMinutes: settings?.appointmentDurationMinutes ?? 60,
    appointmentBufferMinutes: settings?.appointmentBufferMinutes ?? 15,
    bookingLeadTimeHours: settings?.bookingLeadTimeHours ?? 2,
    bookingMaxDaysAhead: settings?.bookingMaxDaysAhead ?? 14,
    from: window.from,
    to: window.to,
    existingAppointments,
    externalBusyBlocks
  });

  const fromMs = parsed.data.from ? new Date(parsed.data.from).getTime() : null;
  const toMs = parsed.data.to ? new Date(parsed.data.to).getTime() : null;
  const filtered = slots.filter((slot) => {
    const startMs = slot.startAt.getTime();
    if (fromMs !== null && startMs < fromMs) return false;
    if (toMs !== null && startMs > toMs) return false;
    return true;
  });

  return res.status(200).json({
    slots: filtered.slice(0, 10).map((slot) => ({
      startAt: slot.startAt.toISOString(),
      endAt: slot.endAt.toISOString()
    }))
  });
});

orgRouter.get("/appointments", requireAppointmentsReadAccess, async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_APPOINTMENTS_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Appointments feature is disabled." });
  }
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = listAppointmentsSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid appointment filters." });
  const appointments = await prisma.appointment.findMany({
    where: {
      orgId: req.auth.orgId,
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.from || parsed.data.to
        ? {
            startAt: {
              ...(parsed.data.from ? { gte: new Date(parsed.data.from) } : {}),
              ...(parsed.data.to ? { lte: new Date(parsed.data.to) } : {})
            }
          }
        : {})
    },
    include: {
      lead: {
        select: { id: true, name: true, phone: true }
      },
      callLog: {
        select: { id: true, providerCallId: true, startedAt: true }
      }
    },
    orderBy: { startAt: "asc" }
  });
  return res.json({ ok: true, data: { appointments } });
});

orgRouter.post("/appointments", requireAppointmentsWriteAccess, async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_APPOINTMENTS_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Appointments feature is disabled." });
  }
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = createAppointmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid appointment payload.", errors: parsed.error.flatten() });

  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(parsed.data.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    return res.status(400).json({ ok: false, message: "Invalid appointment time window." });
  }
  let settings: { hoursJson: string | null; timezone: string | null; appointmentBufferMinutes: number | null } | null = null;
  try {
    settings = await prisma.businessSettings.findUnique({
      where: { orgId: req.auth.orgId },
      select: { hoursJson: true, timezone: true, appointmentBufferMinutes: true }
    });
  } catch (error) {
    if (!isPrismaMissingColumnError(error)) throw error;
    settings = null;
  }
  const durationMinutes = Math.max(1, Math.round((endAt.getTime() - startAt.getTime()) / (60 * 1000)));
  const inHours = validateSlotWithinBusinessHours({
    hoursJson: settings?.hoursJson || null,
    timezone: settings?.timezone || parsed.data.timezone || "America/New_York",
    slotStartAt: startAt,
    appointmentDurationMinutes: durationMinutes
  });
  if (!inHours.ok) {
    return res.status(400).json({ ok: false, message: "Appointment time is outside business-hour constraints." });
  }

  const shouldTryExternalCalendar =
    (parsed.data.calendarProvider || "INTERNAL") !== "INTERNAL" &&
    isFeatureEnabledForOrg(env.FEATURE_CALENDAR_OAUTH_ENABLED, req.auth?.orgId);
  const orgId = req.auth.orgId;
  const userId = req.auth.userId;
  const requestedProvider = parsed.data.calendarProvider || "INTERNAL";
  if (requestedProvider !== "INTERNAL" && !isFeatureEnabledForOrg(env.FEATURE_CALENDAR_OAUTH_ENABLED, req.auth?.orgId)) {
    return res.status(400).json({
      ok: false,
      message: "Calendar OAuth feature is disabled for this workspace."
    });
  }
  if (requestedProvider !== "INTERNAL" && !canManageCalendar(req.auth?.role)) {
    return res.status(403).json({
      ok: false,
      message: "Only admins can create external calendar events."
    });
  }
  const externalProvider = requestedProvider === "GOOGLE" || requestedProvider === "OUTLOOK" ? requestedProvider : null;

  const booking = await bookAppointmentWithHold({
    prisma,
    orgId,
    userId,
    leadId: parsed.data.leadId || null,
    callLogId: parsed.data.callLogId || null,
    customerName: parsed.data.customerName,
    customerPhone: normalizePhone(parsed.data.customerPhone),
    issueSummary: parsed.data.issueSummary,
    assignedTechnician: parsed.data.assignedTechnician || null,
    startAt,
    endAt,
    timezone: parsed.data.timezone,
    appointmentBufferMinutes: settings?.appointmentBufferMinutes ?? 15,
    requestedProvider,
    idempotencyKey: parsed.data.idempotencyKey || null,
    businessHoursValidation: {
      hoursJson: settings?.hoursJson || null,
      timezone: settings?.timezone || parsed.data.timezone || "America/New_York"
    },
    pipelineFeatureEnabled: isFeatureEnabledForOrg(env.FEATURE_PIPELINE_STAGE_ENABLED, orgId),
    createExternalEvent: shouldTryExternalCalendar && externalProvider
      ? async () => {
          const connection = await prisma.calendarConnection.findFirst({
            where: { orgId, provider: externalProvider, isActive: true },
            orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
            select: { id: true }
          });
          if (!connection) {
            return { provider: "INTERNAL", externalEventId: "" };
          }
          const event = await createCalendarEventFromConnection({
            prisma,
            connectionId: connection.id,
            orgId,
            title: `${parsed.data.customerName} - Service Appointment`,
            description: parsed.data.issueSummary,
            startAt,
            endAt,
            timezone: parsed.data.timezone
          });
          return { provider: event.provider, externalEventId: event.externalEventId || "" };
        }
      : undefined,
    fetchExternalBusyBlocks:
      shouldTryExternalCalendar
        ? async ({ fromUtc, toUtc }) => {
            const busy = await getBusyBlocks({ prisma, orgId, fromUtc, toUtc, provider: externalProvider || undefined });
            return busy.map((row) => ({ startAt: row.startUtc, endAt: row.endUtc }));
          }
        : undefined,
    computeNextSlots: async () => {
      const settingsLatest = await prisma.businessSettings.findUnique({
        where: { orgId },
        select: {
          hoursJson: true,
          timezone: true,
          appointmentDurationMinutes: true,
          appointmentBufferMinutes: true,
          bookingLeadTimeHours: true,
          bookingMaxDaysAhead: true
        }
      });
      const availabilityWindow = computeAvailabilityWindow({
        bookingLeadTimeHours: settingsLatest?.bookingLeadTimeHours ?? 2,
        bookingMaxDaysAhead: settingsLatest?.bookingMaxDaysAhead ?? 14
      });
      const internalBusy = await prisma.appointment.findMany({
        where: {
          orgId,
          status: { not: "CANCELED" },
          startAt: { lte: availabilityWindow.to },
          endAt: { gte: availabilityWindow.from }
        },
        select: { startAt: true, endAt: true, status: true },
        orderBy: { startAt: "asc" },
        take: 500
      });
      let externalBusyBlocks: Array<{ startAt: Date; endAt: Date }> = [];
      if (shouldTryExternalCalendar) {
        try {
          const busy = await getBusyBlocks({
            prisma,
            orgId,
            fromUtc: availabilityWindow.from,
            toUtc: availabilityWindow.to,
            provider: externalProvider || undefined
          });
          externalBusyBlocks = busy.map((row) => ({ startAt: row.startUtc, endAt: row.endUtc }));
        } catch {
          externalBusyBlocks = [];
        }
      }
      const slots = generateAvailabilitySlots({
        hoursJson: settingsLatest?.hoursJson || null,
        timezone: settingsLatest?.timezone || parsed.data.timezone || "America/New_York",
        appointmentDurationMinutes: settingsLatest?.appointmentDurationMinutes ?? 60,
        appointmentBufferMinutes: settingsLatest?.appointmentBufferMinutes ?? 15,
        bookingLeadTimeHours: settingsLatest?.bookingLeadTimeHours ?? 2,
        bookingMaxDaysAhead: settingsLatest?.bookingMaxDaysAhead ?? 14,
        from: availabilityWindow.from,
        to: availabilityWindow.to,
        existingAppointments: internalBusy,
        externalBusyBlocks
      });
      return slots.slice(0, 3).map((slot) => ({
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString()
      }));
    }
  });

  if (!booking.ok && booking.reason === "OVERLAP") {
    return res.status(409).json({ ok: false, message: "Appointment overlaps with an existing slot." });
  }
  if (!booking.ok && booking.reason === "OUTSIDE_BUSINESS_HOURS") {
    return res.status(400).json({ ok: false, message: "Appointment time is outside business-hour constraints." });
  }
  if (!booking.ok && booking.reason === "CALENDAR_UNAVAILABLE" && booking.appointment) {
    return res.status(201).json({ ok: true, data: { appointment: booking.appointment, nextSlots: booking.nextSlots || [] } });
  }
  if (!booking.ok) return res.status(400).json({ ok: false, message: "Appointment booking failed." });
  return res.status(201).json({ ok: true, data: { appointment: booking.appointment } });
});

orgRouter.patch("/appointments/:id", requireAppointmentsWriteAccess, async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_APPOINTMENTS_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Appointments feature is disabled." });
  }
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  if ("startAt" in (req.body || {}) || "endAt" in (req.body || {})) {
    return res.status(400).json({ ok: false, message: "Rescheduling is not supported in Phase 1." });
  }
  const parsed = patchAppointmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid appointment patch payload." });
  const appointment = await prisma.appointment.findFirst({
    where: { id: req.params.id, orgId: req.auth.orgId }
  });
  if (!appointment) return res.status(404).json({ ok: false, message: "Appointment not found." });
  if (parsed.data.status === "COMPLETED" || parsed.data.status === "CANCELED") {
    return res.status(400).json({
      ok: false,
      message: `Set status ${parsed.data.status} via dedicated complete/cancel endpoint.`
    });
  }
  if (parsed.data.status === "CONFIRMED" && appointment.status !== "PENDING") {
    return res.status(409).json({ ok: false, message: "Only pending appointments can be confirmed." });
  }
  if (parsed.data.status === "NO_SHOW" && appointment.status === "CANCELED") {
    return res.status(409).json({ ok: false, message: "Canceled appointments cannot be marked as no-show." });
  }
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      ...(parsed.data.assignedTechnician !== undefined ? { assignedTechnician: parsed.data.assignedTechnician } : {}),
      ...(parsed.data.issueSummary !== undefined ? { issueSummary: parsed.data.issueSummary } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {})
    }
  });
  return res.json({ ok: true, data: { appointment: updated } });
});

orgRouter.post("/appointments/:id/cancel", requireAppointmentsWriteAccess, async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_APPOINTMENTS_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Appointments feature is disabled." });
  }
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const appointment = await prisma.appointment.findFirst({
    where: { id: req.params.id, orgId: req.auth.orgId }
  });
  if (!appointment) return res.status(404).json({ ok: false, message: "Appointment not found." });
  if (appointment.status === "COMPLETED") {
    return res.status(409).json({ ok: false, message: "Completed appointments cannot be canceled." });
  }
  if (appointment.status === "CANCELED") {
    return res.json({ ok: true, data: { appointment } });
  }
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "CANCELED" }
  });
  return res.json({ ok: true, data: { appointment: updated } });
});

orgRouter.post("/appointments/:id/complete", requireAppointmentsWriteAccess, async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_APPOINTMENTS_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Appointments feature is disabled." });
  }
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const appointment = await prisma.appointment.findFirst({
    where: { id: req.params.id, orgId: req.auth.orgId }
  });
  if (!appointment) return res.status(404).json({ ok: false, message: "Appointment not found." });
  if (appointment.status === "CANCELED") {
    return res.status(409).json({ ok: false, message: "Canceled appointments cannot be completed." });
  }
  if (appointment.status === "COMPLETED") {
    return res.json({ ok: true, data: { appointment } });
  }
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "COMPLETED" }
  });
  return res.json({ ok: true, data: { appointment: updated } });
});

orgRouter.get("/calendar/providers", requireCalendarManageAccess, async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_CALENDAR_OAUTH_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Calendar integration feature is disabled." });
  }
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const providers = await prisma.calendarConnection.findMany({
    where: { orgId: req.auth.orgId },
    select: {
      id: true,
      provider: true,
      accountEmail: true,
      isActive: true,
      isPrimary: true,
      selectedCalendarId: true,
      expiresAt: true,
      createdAt: true
    }
  });
  return res.json({ ok: true, data: { providers } });
});

orgRouter.get("/calendar/events", requireAppointmentsReadAccess, async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_CALENDAR_OAUTH_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Calendar integration feature is disabled." });
  }
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = listCalendarEventsSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid calendar events query." });
  const fromUtc = new Date(parsed.data.from);
  const toUtc = new Date(parsed.data.to);
  if (Number.isNaN(fromUtc.getTime()) || Number.isNaN(toUtc.getTime()) || fromUtc > toUtc) {
    return res.status(400).json({ ok: false, message: "Invalid calendar range." });
  }

  const connection = await prisma.calendarConnection.findFirst({
    where: {
      orgId: req.auth.orgId,
      isActive: true,
      ...(parsed.data.provider ? { provider: parsed.data.provider } : {})
    },
    orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
    select: { id: true }
  });
  if (!connection) {
    return res.json({ ok: true, data: { events: [] } });
  }

  try {
    const events = await listCalendarEventsFromConnection({
      prisma,
      connectionId: connection.id,
      orgId: req.auth.orgId,
      fromUtc,
      toUtc
    });
    return res.json({
      ok: true,
      data: {
        events: events.map((event) => ({
          id: event.id,
          provider: event.provider,
          title: event.title,
          startAt: event.startAt.toISOString(),
          endAt: event.endAt.toISOString()
        }))
      }
    });
  } catch {
    return res.json({ ok: true, data: { events: [] } });
  }
});

orgRouter.post("/calendar/select-primary", requireCalendarManageAccess, async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_CALENDAR_OAUTH_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Calendar integration feature is disabled." });
  }
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = selectPrimaryCalendarSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid calendar primary payload." });

  const target = await prisma.calendarConnection.findFirst({
    where: { id: parsed.data.connectionId, orgId: req.auth.orgId }
  });
  if (!target) return res.status(404).json({ ok: false, message: "Calendar connection not found." });

  const selectedCalendarIdRaw = parsed.data.selectedCalendarId;
  const selectedCalendarIdTrimmed = selectedCalendarIdRaw === undefined ? "" : String(selectedCalendarIdRaw).trim();
  if (selectedCalendarIdRaw !== undefined && !selectedCalendarIdTrimmed) {
    return res.status(400).json({ ok: false, message: "selectedCalendarId must be a non-empty string when provided." });
  }
  const selectedCalendarId =
    target.provider === "GOOGLE"
      ? selectedCalendarIdTrimmed || "primary"
      : selectedCalendarIdTrimmed || null;

  const orgId = req.auth.orgId as string;
  await prisma.$transaction(async (tx) => {
    await tx.calendarConnection.updateMany({
      where: { orgId },
      data: { isPrimary: false }
    });
    await tx.calendarConnection.update({
      where: { id: target.id },
      data: {
        isPrimary: true,
        selectedCalendarId
      }
    });
  });

  const provider = await prisma.calendarConnection.findUnique({
    where: { id: target.id }
  });
  return res.json({ ok: true, data: { provider } });
});

orgRouter.post("/calendar/google/connect", requireCalendarManageAccess, async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_CALENDAR_OAUTH_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Calendar integration feature is disabled." });
  }
  if (!req.auth?.orgId || !req.auth.userId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  try {
    const url = createCalendarConnectUrl({
      provider: "GOOGLE",
      orgId: req.auth.orgId,
      userId: req.auth.userId
    });
    return res.json({ ok: true, data: { url } });
  } catch (error) {
    return res.status(503).json({ ok: false, message: error instanceof Error ? error.message : "Calendar OAuth unavailable." });
  }
});

orgRouter.get("/calendar/google/callback", requireCalendarManageAccess, async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_CALENDAR_OAUTH_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Calendar integration feature is disabled." });
  }
  if (!req.auth?.orgId || !req.auth.userId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const state = String(req.query.state || "");
  const code = String(req.query.code || "");
  if (!state || !code) return res.status(400).json({ ok: false, message: "Missing OAuth callback parameters." });
  const accepted = consumeCalendarOauthState({
    provider: "GOOGLE",
    state,
    orgId: req.auth.orgId,
    userId: req.auth.userId
  });
  if (!accepted) return res.status(400).json({ ok: false, message: "OAuth state is invalid or expired." });
  try {
    const token = await exchangeCalendarCode({ provider: "GOOGLE", code });
    await upsertCalendarConnection({
      prisma,
      orgId: req.auth.orgId,
      provider: "GOOGLE",
      accountEmail: token.accountEmail,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      scopes: token.scopes
    });
    return res.redirect(`${env.FRONTEND_APP_URL}/app/settings?calendar=google_connected`);
  } catch (error) {
    return res.status(503).json({ ok: false, message: error instanceof Error ? error.message : "Google calendar connect failed." });
  }
});

orgRouter.post("/calendar/outlook/connect", requireCalendarManageAccess, async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_CALENDAR_OAUTH_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Calendar integration feature is disabled." });
  }
  if (!req.auth?.orgId || !req.auth.userId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  try {
    const url = createCalendarConnectUrl({
      provider: "OUTLOOK",
      orgId: req.auth.orgId,
      userId: req.auth.userId
    });
    return res.json({ ok: true, data: { url } });
  } catch (error) {
    return res.status(503).json({ ok: false, message: error instanceof Error ? error.message : "Calendar OAuth unavailable." });
  }
});

orgRouter.get("/calendar/outlook/callback", requireCalendarManageAccess, async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_CALENDAR_OAUTH_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Calendar integration feature is disabled." });
  }
  if (!req.auth?.orgId || !req.auth.userId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const state = String(req.query.state || "");
  const code = String(req.query.code || "");
  if (!state || !code) return res.status(400).json({ ok: false, message: "Missing OAuth callback parameters." });
  const accepted = consumeCalendarOauthState({
    provider: "OUTLOOK",
    state,
    orgId: req.auth.orgId,
    userId: req.auth.userId
  });
  if (!accepted) return res.status(400).json({ ok: false, message: "OAuth state is invalid or expired." });
  try {
    const token = await exchangeCalendarCode({ provider: "OUTLOOK", code });
    await upsertCalendarConnection({
      prisma,
      orgId: req.auth.orgId,
      provider: "OUTLOOK",
      accountEmail: token.accountEmail,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      scopes: token.scopes
    });
    return res.redirect(`${env.FRONTEND_APP_URL}/app/settings?calendar=outlook_connected`);
  } catch (error) {
    return res.status(503).json({ ok: false, message: error instanceof Error ? error.message : "Outlook calendar connect failed." });
  }
});

orgRouter.post("/calendar/disconnect", requireCalendarManageAccess, async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_CALENDAR_OAUTH_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Calendar integration feature is disabled." });
  }
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = disconnectCalendarSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid calendar disconnect payload." });
  if (!parsed.data.connectionId && !parsed.data.provider && !parsed.data.accountEmail) {
    return res.status(400).json({ ok: false, message: "Provide connectionId or provider/accountEmail." });
  }
  const result = await prisma.calendarConnection.updateMany({
    where: {
      orgId: req.auth.orgId,
      ...(parsed.data.connectionId ? { id: parsed.data.connectionId } : {}),
      ...(parsed.data.provider ? { provider: parsed.data.provider } : {}),
      ...(parsed.data.accountEmail ? { accountEmail: parsed.data.accountEmail } : {})
    },
    data: { isActive: false }
  });
  return res.json({ ok: true, data: { disconnected: result.count } });
});

orgRouter.post("/calendar/sync-test", requireCalendarManageAccess, async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_CALENDAR_OAUTH_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Calendar integration feature is disabled." });
  }
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = createCalendarTestEventSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid sync test payload." });
  const active = await prisma.calendarConnection.findFirst({
    where: {
      orgId: req.auth.orgId,
      isActive: true,
      ...(parsed.data.provider ? { provider: parsed.data.provider } : {})
    },
    orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }]
  });
  if (!active) {
    return res.status(409).json({ ok: false, message: "No active calendar connection found." });
  }
  let success = false;
  let message = "Calendar sync test failed.";
  try {
    const startAt = new Date(Date.now() + 10 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 15 * 60 * 1000);
    await createCalendarEventFromConnection({
      prisma,
      connectionId: active.id,
      orgId: req.auth.orgId,
      title: "Khan Systems sync test",
      description: "Connectivity check from KHAN Systems.",
      startAt,
      endAt,
      timezone: "America/New_York"
    });
    success = true;
    message = "Calendar sync test event created successfully.";
  } catch {
    success = false;
    message = "Could not create test event. Connection may be revoked or missing scopes.";
  }
  await prisma.auditLog.create({
    data: {
      orgId: req.auth.orgId,
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "CALENDAR_SYNC_TEST_REQUESTED",
      metadataJson: JSON.stringify({ provider: active.provider, accountEmail: active.accountEmail, success })
    }
  });
  await emitOrgNotification({
    prisma,
    orgId: req.auth.orgId,
    type: "APPOINTMENT_BOOKED",
    severity: success ? "INFO" : "ACTION_REQUIRED",
    title: success ? "Calendar sync test succeeded" : "Calendar sync test failed",
    body: message,
    targetRoleMin: "ADMIN",
    metadata: { provider: active.provider, accountEmail: active.accountEmail, success },
    sendEmail: !success
  });
  return res.json({ ok: true, data: { success, message } });
});

orgRouter.get("/notifications", async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_NOTIFICATIONS_V1_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Notifications feature is disabled." });
  }
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const notifications = await prisma.orgNotification.findMany({
    where: { orgId: req.auth.orgId },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const filtered = notifications.filter((row) => canViewNotificationForRole(req.auth?.role, row.targetRoleMin));
  return res.json({ ok: true, data: { notifications: filtered } });
});

orgRouter.post("/notifications/:id/read", async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_NOTIFICATIONS_V1_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Notifications feature is disabled." });
  }
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const notification = await prisma.orgNotification.findFirst({
    where: { id: req.params.id, orgId: req.auth.orgId }
  });
  if (!notification) return res.status(404).json({ ok: false, message: "Notification not found." });
  if (!canViewNotificationForRole(req.auth?.role, notification.targetRoleMin)) {
    return res.status(404).json({ ok: false, message: "Notification not found." });
  }
  const updated = await prisma.orgNotification.update({
    where: { id: notification.id },
    data: { readAt: new Date() }
  });
  return res.json({ ok: true, data: { notification: updated } });
});

orgRouter.post("/notifications/read-all", async (req: AuthenticatedRequest, res) => {
  if (!isFeatureEnabledForOrg(env.FEATURE_NOTIFICATIONS_V1_ENABLED, req.auth?.orgId)) {
    return res.status(404).json({ ok: false, message: "Notifications feature is disabled." });
  }
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const visibleIds = await prisma.orgNotification.findMany({
    where: { orgId: req.auth.orgId, readAt: null },
    select: { id: true, targetRoleMin: true }
  });
  const ids = visibleIds
    .filter((row) => canViewNotificationForRole(req.auth?.role, row.targetRoleMin))
    .map((row) => row.id);
  if (!ids.length) {
    return res.json({ ok: true, data: { updated: 0 } });
  }
  const result = await prisma.orgNotification.updateMany({
    where: { id: { in: ids } },
    data: { readAt: new Date() }
  });
  return res.json({ ok: true, data: { updated: result.count } });
});

const customerBaseImportSchema = z.object({
  sourceFileName: z.string().max(260).optional(),
  rows: z
    .array(z.record(z.unknown()))
    .min(1)
    .max(5000)
});

orgRouter.post("/customer-base/import", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = customerBaseImportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: "Invalid import payload.", errors: parsed.error.flatten() });
  }

  const rows = parsed.data.rows;
  let imported = 0;
  let skipped = 0;
  let updatedProfiles = 0;
  let updatedLeads = 0;

  for (const row of rows) {
    const phoneValue = pickRowValue(row, ["phone", "phone number", "customer phone", "mobile", "caller phone"]);
    const phone = normalizePhoneE164(String(phoneValue || ""));
    if (!phone) {
      skipped += 1;
      continue;
    }

    const name = String(pickRowValue(row, ["name", "full name", "customer name"]) || "Unknown Caller").trim();
    const business = String(pickRowValue(row, ["business", "company", "business name"]) || "Imported Customer").trim();
    const emailRaw = String(pickRowValue(row, ["email", "email address"]) || "").trim();
    const email = emailRaw || `${phone.replace(/\D/g, "") || "unknown"}@import.local`;
    const urgency = String(pickRowValue(row, ["urgency", "priority"]) || "").trim() || null;
    const notes = String(pickRowValue(row, ["notes", "note", "summary"]) || "").trim() || null;
    const totalCallsRaw = Number(pickRowValue(row, ["total calls", "total_calls", "calls"]) || 1);
    const totalCalls = Number.isFinite(totalCallsRaw) && totalCallsRaw > 0 ? Math.floor(totalCallsRaw) : 1;
    const lastCallAt = parseOptionalDate(pickRowValue(row, ["last call at", "last_call_at", "last call", "last contact"]));
    const firstCallAt = parseOptionalDate(pickRowValue(row, ["first call at", "first_call_at", "first call"]));
    const lastOutcome = normalizeOutcome(pickRowValue(row, ["last outcome", "outcome", "status"]));
    const flaggedVIP = parseBooleanLike(pickRowValue(row, ["vip", "flagged vip", "is vip"])) === true;

    const profile = await prisma.callerProfile.findUnique({
      where: { orgId_phoneNumber: { orgId: req.auth.orgId, phoneNumber: phone } }
    });

    if (profile) {
      await prisma.callerProfile.update({
        where: { orgId_phoneNumber: { orgId: req.auth.orgId, phoneNumber: phone } },
        data: {
          totalCalls: Math.max(profile.totalCalls, totalCalls),
          firstCallAt: firstCallAt || profile.firstCallAt,
          lastCallAt: lastCallAt || profile.lastCallAt,
          lastOutcome: lastOutcome || profile.lastOutcome,
          flaggedVIP: flaggedVIP || profile.flaggedVIP
        }
      });
      updatedProfiles += 1;
    } else {
      await prisma.callerProfile.create({
        data: {
          orgId: req.auth.orgId,
          phoneNumber: phone,
          totalCalls,
          firstCallAt: firstCallAt || lastCallAt || new Date(),
          lastCallAt: lastCallAt || new Date(),
          lastOutcome,
          flaggedVIP
        }
      });
      updatedProfiles += 1;
    }

    const existingLead = await prisma.lead.findFirst({
      where: { orgId: req.auth.orgId, phone },
      orderBy: { createdAt: "desc" }
    });
    if (existingLead) {
      await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          name: name || existingLead.name,
          business: business || existingLead.business,
          email: email || existingLead.email,
          urgency: urgency || existingLead.urgency,
          notes: notes || existingLead.notes
        }
      });
      updatedLeads += 1;
    } else {
      await prisma.lead.create({
        data: {
          orgId: req.auth.orgId,
          name: name || "Unknown Caller",
          business: business || "Imported Customer",
          email,
          phone,
          urgency,
          notes,
          source: "PHONE_CALL",
          sourcePage: "customer-base-import"
        }
      });
      updatedLeads += 1;
    }

    imported += 1;
  }

  await prisma.auditLog.create({
    data: {
      orgId: req.auth.orgId,
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "CUSTOMER_BASE_IMPORTED",
      metadataJson: JSON.stringify({
        sourceFileName: parsed.data.sourceFileName || null,
        rowCount: rows.length,
        imported,
        skipped,
        updatedProfiles,
        updatedLeads
      })
    }
  });

  return res.json({
    ok: true,
    data: { imported, skipped, updatedProfiles, updatedLeads }
  });
});

orgRouter.get("/analytics", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const data = await computeOrgAnalytics(prisma, req.auth.orgId, {
    range: typeof req.query.range === "string" ? req.query.range : undefined,
    start: typeof req.query.start === "string" ? req.query.start : undefined,
    end: typeof req.query.end === "string" ? req.query.end : undefined
  });
  return res.json({ ok: true, data: shapeOrgAnalyticsForRole(data, req.auth.role) });
});

orgRouter.get("/health", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const org = await prisma.organization.findUnique({ where: { id: req.auth.orgId } });
  if (!org) return res.status(404).json({ ok: false, message: "Organization not found." });
  try {
    const health = await computeOrgHealth({
      prisma,
      org,
      env: { VAPI_TOOL_SECRET: env.VAPI_TOOL_SECRET }
    });
    return res.json({ ok: true, data: health });
  } catch {
    return res.json({
      ok: true,
      data: {
        level: "RED",
        score: 0,
        checks: {},
        summary: "Health checks are temporarily unavailable. Retry shortly.",
        metrics: {
          avgSuccessScore: 0,
          avgCallQuality: 0,
          slaSeverity: "UNKNOWN",
          recentActivityAt: null
        },
        missingChecks: [
          {
            key: "health_unavailable",
            reason: "Health computation temporarily failed",
            fixHint: "/app/settings"
          }
        ]
      }
    });
  }
});

orgRouter.post("/calls/repopulate", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const result = await backfillMissedVapiCalls(prisma, req.auth.userId, req.auth.orgId);
  return res.json({ ok: true, data: result });
});

orgRouter.get("/messages", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });

  const [threads, activePhone] = await Promise.all([
    prisma.messageThread.findMany({
      where: { orgId: req.auth.orgId, channel: "SMS" },
      include: {
        lead: {
          select: { id: true, name: true, business: true, phone: true }
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 40
        }
      },
      orderBy: { lastMessageAt: "desc" },
      take: 150
    }),
    prisma.phoneNumber.findFirst({
      where: { orgId: req.auth.orgId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: { e164Number: true, provider: true }
    })
  ]);

  return res.json({
    ok: true,
    data: {
      threads,
      assignedPhoneNumber: activePhone?.e164Number || null,
      assignedNumberProvider: activePhone?.provider || null
    }
  });
});

orgRouter.post("/messages/send", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = sendOrgMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: "Invalid message payload.", errors: parsed.error.flatten() });
  }

  const billingActive = await hasActiveBilling(prisma, req.auth.orgId);
  if (!billingActive) {
    return res.status(403).json({
      ok: false,
      message: "No active plan. Activate Standard or Growth/Pro in Billing before sending operational SMS."
    });
  }

  const isPro = await hasProMessaging(prisma, req.auth.orgId);
  if (!isPro) {
    return res.status(403).json({
      ok: false,
      message: "Messaging automation is a Pro feature. Upgrade to Pro to send operational SMS from the portal."
    });
  }

  const toNumber = normalizePhone(parsed.data.to);
  const fromPhone = await prisma.phoneNumber.findFirst({
    where: { orgId: req.auth.orgId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" }
  });
  if (!fromPhone?.e164Number) {
    return res.status(400).json({ ok: false, message: "No active phone number configured for this organization." });
  }

  const lead =
    parsed.data.leadId
      ? await prisma.lead.findFirst({
          where: { id: parsed.data.leadId, orgId: req.auth.orgId },
          select: { id: true, name: true, dnc: true }
        })
      : null;

  const matchedByNumber = await prisma.lead.findFirst({
    where: { orgId: req.auth.orgId, phone: toNumber },
    select: { id: true, dnc: true }
  });

  if (lead?.dnc || matchedByNumber?.dnc) {
    return res.status(403).json({
      ok: false,
      message: "This contact has opted out of SMS (STOP). Ask them to text START to re-enable messaging."
    });
  }

  const thread = await prisma.messageThread.upsert({
    where: {
      orgId_channel_contactPhone: {
        orgId: req.auth.orgId,
        channel: "SMS",
        contactPhone: toNumber
      }
    },
    update: {
      contactName: lead?.name || undefined,
      leadId: lead?.id || undefined,
      lastMessageAt: new Date()
    },
    create: {
      orgId: req.auth.orgId,
      channel: "SMS",
      contactPhone: toNumber,
      contactName: lead?.name || null,
      leadId: lead?.id || null,
      lastMessageAt: new Date()
    }
  });

  let providerMessageId: string | null = null;
  let status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED" = "QUEUED";
  let errorText: string | null = null;

  try {
    const statusCallbackUrl = `${env.API_BASE_URL}/api/twilio/sms/status?orgId=${encodeURIComponent(req.auth.orgId)}`;
    const sent = await sendSmsMessage({
      from: fromPhone.e164Number,
      to: toNumber,
      body: parsed.data.body,
      statusCallbackUrl
    });
    providerMessageId = sent.sid;
    const twStatus = String(sent.status || "").toLowerCase();
    if (twStatus === "delivered") status = "DELIVERED";
    else if (twStatus === "sent") status = "SENT";
    else if (["failed", "undelivered", "canceled"].includes(twStatus)) status = "FAILED";
    else status = "QUEUED";
    if (sent.errorCode || sent.errorMessage) {
      errorText = `Twilio ${sent.errorCode || ""} ${sent.errorMessage || ""}`.trim();
    }
  } catch (error) {
    status = "FAILED";
    errorText = error instanceof Error ? error.message : "sms_send_failed";
  }

  const message = await prisma.message.create({
    data: {
      threadId: thread.id,
      orgId: req.auth.orgId,
      leadId: lead?.id || null,
      direction: "OUTBOUND",
      status,
      body: parsed.data.body,
      provider: "TWILIO",
      providerMessageId,
      fromNumber: fromPhone.e164Number,
      toNumber,
      sentAt: new Date(),
      errorText,
      metadataJson: JSON.stringify({ actorUserId: req.auth.userId })
    }
  });

  await prisma.auditLog.create({
    data: {
      orgId: req.auth.orgId,
      actorUserId: req.auth.userId,
      actorRole: req.auth.role,
      action: "ORG_SMS_SENT",
      metadataJson: JSON.stringify({
        threadId: thread.id,
        messageId: message.id,
        to: toNumber,
        status
      })
    }
  });

  return res.json({ ok: true, data: { threadId: thread.id, message } });
});
