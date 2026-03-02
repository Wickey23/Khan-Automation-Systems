import { OnboardingStatus, OrganizationStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAnyRole, requireAuth, type AuthenticatedRequest } from "../../middleware/require-auth";
import { backfillMissedVapiCalls } from "../admin/backfill.service";
import { buildConfigPackage } from "./config-package";
import { saveOnboardingSchema, submitOnboardingSchema, updateBusinessSettingsSchema, updateOrgProfileSchema } from "./org.schema";

export const orgRouter = Router();

orgRouter.use(requireAuth, requireAnyRole([UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF, UserRole.CLIENT, UserRole.SUPER_ADMIN]));

orgRouter.get("/profile", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const organization = await prisma.organization.findUnique({ where: { id: req.auth.orgId } });
  if (!organization) return res.status(404).json({ ok: false, message: "Organization not found." });
  return res.json({ ok: true, data: { organization } });
});

orgRouter.patch("/profile", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = updateOrgProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid profile payload.", errors: parsed.error.flatten() });
  const organization = await prisma.organization.update({
    where: { id: req.auth.orgId },
    data: parsed.data
  });
  return res.json({ ok: true, data: { organization } });
});

orgRouter.get("/settings", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const settings = await prisma.businessSettings.upsert({
    where: { orgId: req.auth.orgId },
    update: {},
    create: { orgId: req.auth.orgId }
  });
  return res.json({ ok: true, data: { settings } });
});

orgRouter.patch("/settings", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = updateBusinessSettingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid settings payload.", errors: parsed.error.flatten() });

  const settings = await prisma.businessSettings.upsert({
    where: { orgId: req.auth.orgId },
    update: parsed.data,
    create: {
      orgId: req.auth.orgId,
      ...parsed.data
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

  return res.json({ ok: true, data: { settings } });
});

orgRouter.get("/onboarding", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const submission = await prisma.onboardingSubmission.findFirst({
    where: { orgId: req.auth.orgId },
    orderBy: { updatedAt: "desc" }
  });
  return res.json({ ok: true, data: { submission } });
});

orgRouter.put("/onboarding", async (req: AuthenticatedRequest, res) => {
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

  return res.json({ ok: true, data: { submission } });
});

orgRouter.post("/onboarding/preview", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = saveOnboardingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid onboarding payload.", errors: parsed.error.flatten() });
  const configPackage = buildConfigPackage(parsed.data.answers as Record<string, unknown>);
  return res.json({ ok: true, data: { configPackage } });
});

orgRouter.post("/onboarding/submit", async (req: AuthenticatedRequest, res) => {
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

  await prisma.businessSettings.upsert({
    where: { orgId: req.auth.orgId },
    update: {
      timezone: String((configPackage.hours as Record<string, unknown>)?.timezone || "America/New_York"),
      servicesJson: JSON.stringify(configPackage.services || []),
      policiesJson: JSON.stringify(configPackage.policies || {}),
      notificationEmailsJson: JSON.stringify((configPackage.notifications as Record<string, unknown>)?.managerEmails || []),
      notificationPhonesJson: JSON.stringify((configPackage.notifications as Record<string, unknown>)?.managerPhones || [])
    },
    create: {
      orgId: req.auth.orgId,
      servicesJson: JSON.stringify(configPackage.services || []),
      policiesJson: JSON.stringify(configPackage.policies || {}),
      notificationEmailsJson: JSON.stringify((configPackage.notifications as Record<string, unknown>)?.managerEmails || []),
      notificationPhonesJson: JSON.stringify((configPackage.notifications as Record<string, unknown>)?.managerPhones || [])
    }
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
  return res.json({ ok: true, data: { leads } });
});

orgRouter.get("/calls", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const calls = await prisma.callLog.findMany({
    where: { orgId: req.auth.orgId },
    orderBy: { startedAt: "desc" }
  });
  const enrichedCalls = calls.map((call) => ({
    ...call,
    summary: call.aiSummary || (call.transcript?.trim() ? call.transcript.trim().slice(0, 240) : `Outcome: ${call.outcome.replace(/_/g, " ").toLowerCase()}`)
  }));
  return res.json({ ok: true, data: { calls: enrichedCalls } });
});

orgRouter.post("/calls/repopulate", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const result = await backfillMissedVapiCalls(prisma, req.auth.userId, req.auth.orgId);
  return res.json({ ok: true, data: result });
});
