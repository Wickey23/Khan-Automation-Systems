import { OnboardingStatus, OrganizationStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { requireAnyRole, requireAuth, type AuthenticatedRequest } from "../../middleware/require-auth";
import { hasProMessaging } from "../billing/plan-features";
import { sendSmsMessage } from "../twilio/twilio.service";
import { backfillMissedVapiCalls } from "../admin/backfill.service";
import { buildConfigPackage, generateConfigPackage } from "./config-package";
import { computeOrgAnalytics } from "./analytics.service";
import { computeOrgHealth } from "./health.service";
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
      assignedNumberProvider: activePhone?.provider || null
    }
  });
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
  return res.json({ ok: true, data: { leads } });
});

orgRouter.get("/calls", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const [calls, activePhone] = await Promise.all([
    prisma.callLog.findMany({
      where: { orgId: req.auth.orgId },
      orderBy: { startedAt: "desc" }
    }),
    prisma.phoneNumber.findFirst({
      where: { orgId: req.auth.orgId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: { e164Number: true, provider: true }
    })
  ]);
  const enrichedCalls = calls.map((call) => ({
    ...call,
    summary: call.aiSummary || (call.transcript?.trim() ? call.transcript.trim().slice(0, 240) : `Outcome: ${call.outcome.replace(/_/g, " ").toLowerCase()}`)
  }));
  return res.json({
    ok: true,
    data: {
      calls: enrichedCalls,
      assignedPhoneNumber: activePhone?.e164Number || null,
      assignedNumberProvider: activePhone?.provider || null
    }
  });
});

orgRouter.get("/analytics", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const data = await computeOrgAnalytics(prisma, req.auth.orgId, {
    range: typeof req.query.range === "string" ? req.query.range : undefined,
    start: typeof req.query.start === "string" ? req.query.start : undefined,
    end: typeof req.query.end === "string" ? req.query.end : undefined
  });
  return res.json({ ok: true, data });
});

orgRouter.get("/health", async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const org = await prisma.organization.findUnique({ where: { id: req.auth.orgId } });
  if (!org) return res.status(404).json({ ok: false, message: "Organization not found." });
  const health = await computeOrgHealth({
    prisma,
    org,
    env: { VAPI_TOOL_SECRET: env.VAPI_TOOL_SECRET }
  });
  return res.json({ ok: true, data: health });
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
