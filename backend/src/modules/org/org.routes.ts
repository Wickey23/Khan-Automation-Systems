import { OnboardingStatus, OrganizationStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireAnyRole, type AuthenticatedRequest } from "../../middleware/require-auth";
import { saveOnboardingSchema, submitOnboardingSchema, updateOrgProfileSchema } from "./org.schema";

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

  const submission = await prisma.onboardingSubmission.upsert({
    where: { orgId: req.auth.orgId },
    update: {
      answersJson: JSON.stringify(parsed.data.answers),
      status: OnboardingStatus.DRAFT
    },
    create: {
      orgId: req.auth.orgId,
      answersJson: JSON.stringify(parsed.data.answers),
      status: OnboardingStatus.DRAFT
    }
  });

  await prisma.organization.update({
    where: { id: req.auth.orgId },
    data: { status: OrganizationStatus.ONBOARDING }
  });

  return res.json({ ok: true, data: { submission } });
});

orgRouter.post("/onboarding/submit", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = submitOnboardingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid onboarding submit payload.", errors: parsed.error.flatten() });

  const current = await prisma.onboardingSubmission.findFirst({ where: { orgId: req.auth.orgId } });
  const answersJson = parsed.data.answers ? JSON.stringify(parsed.data.answers) : current?.answersJson || "{}";

  const submission = await prisma.onboardingSubmission.upsert({
    where: { orgId: req.auth.orgId },
    update: {
      answersJson,
      status: OnboardingStatus.SUBMITTED,
      submittedAt: new Date()
    },
    create: {
      orgId: req.auth.orgId,
      answersJson,
      status: OnboardingStatus.SUBMITTED,
      submittedAt: new Date()
    }
  });

  await prisma.organization.update({
    where: { id: req.auth.orgId },
    data: { status: OrganizationStatus.READY_FOR_REVIEW }
  });

  return res.json({ ok: true, data: { submission } });
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
    summary:
      call.transcript?.trim()
        ? call.transcript.trim().slice(0, 240)
        : `Outcome: ${call.outcome.replace(/_/g, " ").toLowerCase()}`
  }));
  return res.json({ ok: true, data: { calls: enrichedCalls } });
});
