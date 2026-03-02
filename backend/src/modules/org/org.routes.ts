import { OnboardingStatus, OrganizationStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAnyRole, requireAuth, type AuthenticatedRequest } from "../../middleware/require-auth";
import { hasProMessaging } from "../billing/plan-features";
import { sendSmsMessage } from "../twilio/twilio.service";
import { backfillMissedVapiCalls } from "../admin/backfill.service";
import { buildConfigPackage, generateConfigPackage } from "./config-package";
import {
  saveOnboardingSchema,
  sendOrgMessageSchema,
  submitOnboardingSchema,
  updateBusinessSettingsSchema,
  updateOrgProfileSchema
} from "./org.schema";

export const orgRouter = Router();

orgRouter.use(requireAuth, requireAnyRole([UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF, UserRole.CLIENT, UserRole.SUPER_ADMIN]));

function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (!digits) return input.trim();
  if (digits.length === 10) return `+1${digits}`;
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  if (input.trim().startsWith("+")) return input.trim();
  return `+${digits}`;
}

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

orgRouter.get("/config-package", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const configPackage = await prisma.configPackage.findUnique({ where: { orgId: req.auth.orgId } });
  return res.json({ ok: true, data: { configPackage } });
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

  await generateConfigPackage({
    prisma,
    orgId: req.auth.orgId,
    generatedByUserId: req.auth.userId
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

orgRouter.get("/messages", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });

  const threads = await prisma.messageThread.findMany({
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
  });

  return res.json({ ok: true, data: { threads } });
});

orgRouter.post("/messages/send", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const parsed = sendOrgMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: "Invalid message payload.", errors: parsed.error.flatten() });
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
  let status: "SENT" | "FAILED" = "SENT";
  let errorText: string | null = null;

  try {
    const sent = await sendSmsMessage({
      from: fromPhone.e164Number,
      to: toNumber,
      body: parsed.data.body
    });
    providerMessageId = sent.sid;
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
