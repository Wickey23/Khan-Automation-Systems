import { Prisma, UserRole } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma";
import type { AuthenticatedRequest } from "../../middleware/require-auth";
import {
  outreachBulkImportSchema,
  outreachBulkDeleteSchema,
  outreachCallerConfigCreateSchema,
  outreachCallerConfigUpdateSchema,
  outreachEnrollmentCreateSchema,
  outreachPhoneEnrollmentCreateSchema,
  outreachPhoneCallStartSchema,
  outreachLeadCreateSchema,
  outreachLeadSuppressSchema,
  outreachLeadUpdateSchema,
  outreachListQuerySchema,
  outreachMarkRepliedSchema,
  outreachSequenceCreateSchema,
  outreachSequenceReplaceStepsSchema,
  outreachSequenceUpdateSchema,
  validateOrderedSteps
} from "./outreach.schema";
import {
  buildBulkImportPreview,
  buildPhoneOnlyOutreachEmail,
  isSyntheticOutreachEmail,
  normalizePhoneE164,
  resolveOutreachOrgContext,
  runOutreachTick,
  sendEnrollmentStepNow
} from "./outreach.service";
import { computeNextPhoneEnrollmentStart, runOutreachPhoneTick, startOutreachAiCall } from "./outreach-phone.service";
import { markLeadReplied, normalizeEmail } from "./outreach-stop.service";
import { unsubscribeOutreachRecipient } from "./outreach-unsubscribe.service";

export const outreachAdminRouter = Router();
export const outreachPublicRouter = Router();
const db = prisma as any;

function sendOutreachRouteError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected outreach error.";
  const missingTable =
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021";
  return res.status(missingTable ? 503 : 500).json({
    ok: false,
    message: missingTable
      ? "Outreach phone tables are not available yet. Apply the latest Prisma migration and retry."
      : message
  });
}

function safeOutreachRoute(handler: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response) => {
    void Promise.resolve(handler(req, res)).catch((error) => {
      sendOutreachRouteError(res, error);
    });
  };
}

outreachAdminRouter.use((req: Request, res: Response, next) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth || auth.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ ok: false, message: "Super admin access required." });
  }
  return next();
});

function pagination(query: { page?: number; limit?: number }) {
  const page = Math.max(query.page || 1, 1);
  const limit = Math.max(1, Math.min(query.limit || 50, 200));
  return { page, limit, skip: (page - 1) * limit };
}

function decorateOutreachEvent<T extends Record<string, unknown>, C extends "EMAIL" | "PHONE">(channel: C, event: T) {
  return { channel, ...event };
}

function hasRealOutreachEmail(email: string | null | undefined) {
  const normalized = normalizeEmail(String(email || ""));
  return Boolean(normalized && !isSyntheticOutreachEmail(normalized));
}

outreachAdminRouter.get("/overview", safeOutreachRoute(async (req: Request, res: Response) => {
  const parsed = outreachListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid filters." });

  const orgId = parsed.data.orgId;
  const whereOrg = orgId ? { orgId } : {};
  const [
    totalLeads,
    activeEnrollments,
    activePhoneEnrollments,
    emailsSent,
    phoneCallsStarted,
    failedEmails,
    failedCalls,
    replies,
    unsubscribes,
    recentEmailEvents,
    recentPhoneEvents,
    activeEmailLeadIds,
    activePhoneLeadIds
  ] = await Promise.all([
    db.outreachLead.count({ where: whereOrg }),
    db.outreachEnrollment.count({ where: { ...whereOrg, status: "ACTIVE" } }),
    db.outreachPhoneEnrollment.count({ where: { ...whereOrg, status: "ACTIVE" } }),
    db.outreachEmailEvent.count({ where: { ...whereOrg, eventType: "SENT" } }),
    db.outreachPhoneEvent.count({ where: { ...whereOrg, eventType: "STARTED" } }),
    db.outreachEmailEvent.count({ where: { ...whereOrg, eventType: "FAILED" } }),
    db.outreachPhoneEvent.count({ where: { ...whereOrg, eventType: "FAILED" } }),
    db.outreachLead.count({ where: { ...whereOrg, status: "REPLIED" } }),
    db.outreachSuppression.count({ where: whereOrg }),
    db.outreachEmailEvent.findMany({
      where: whereOrg,
      include: {
        organization: { select: { id: true, name: true } },
        lead: { select: { id: true, email: true, companyName: true, contactName: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    db.outreachPhoneEvent.findMany({
      where: whereOrg,
      include: {
        organization: { select: { id: true, name: true } },
        lead: { select: { id: true, email: true, companyName: true, contactName: true } },
        callerConfig: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    db.outreachEnrollment.findMany({
      where: { ...whereOrg, status: "ACTIVE" },
      select: { leadId: true },
      distinct: ["leadId"]
    }),
    db.outreachPhoneEnrollment.findMany({
      where: { ...whereOrg, status: "ACTIVE" },
      select: { leadId: true },
      distinct: ["leadId"]
    })
  ]);

  const activePhoneLeadIdSet = new Set(activePhoneLeadIds.map((item: { leadId: string }) => item.leadId));
  const activeMultiChannelLeads = activeEmailLeadIds.reduce((count: number, item: { leadId: string }) => {
    return count + (activePhoneLeadIdSet.has(item.leadId) ? 1 : 0);
  }, 0);

  const recentEvents = [
    ...recentEmailEvents.map((event: any) => decorateOutreachEvent("EMAIL", event)),
    ...recentPhoneEvents.map((event: any) => decorateOutreachEvent("PHONE", event))
  ]
    .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())
    .slice(0, 20);

  return res.json({
    ok: true,
    data: {
      totalLeads,
      activeEnrollments,
      activePhoneEnrollments,
      emailsSent,
      phoneCallsStarted,
      failedEmails,
      failedCalls,
      replies,
      unsubscribes,
      activeMultiChannelLeads,
      recentEvents
    }
  });
}));

outreachAdminRouter.get("/leads", safeOutreachRoute(async (req: Request, res: Response) => {
  const parsed = outreachListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid filters." });
  const { skip, limit, page } = pagination(parsed.data);
  const where: any = {};
  if (parsed.data.orgId) where.orgId = parsed.data.orgId;
  if (parsed.data.status) where.status = parsed.data.status as any;
  if (parsed.data.search) {
    where.OR = [
      { email: { contains: parsed.data.search, mode: "insensitive" } },
      { phone: { contains: parsed.data.search, mode: "insensitive" } },
      { companyName: { contains: parsed.data.search, mode: "insensitive" } },
      { contactName: { contains: parsed.data.search, mode: "insensitive" } },
      { sourceList: { contains: parsed.data.search, mode: "insensitive" } }
    ];
  }
  const [leads, total] = await Promise.all([
    db.outreachLead.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        enrollments: {
          orderBy: { createdAt: "desc" },
          take: 3,
          include: {
            sequence: { select: { id: true, name: true } }
          }
        },
        phoneEnrollments: {
          orderBy: { createdAt: "desc" },
          take: 3,
          include: {
            callerConfig: { select: { id: true, name: true } }
          }
        },
        emailEvents: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            eventType: true,
            subject: true,
            toEmail: true,
            createdAt: true,
            errorMessage: true
          }
        },
        phoneEvents: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            eventType: true,
            status: true,
            toPhone: true,
            createdAt: true,
            errorMessage: true,
            summary: true,
            providerCallId: true,
            metadata: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    }),
    db.outreachLead.count({ where })
  ]);
  return res.json({ ok: true, data: { leads, total, page, limit } });
}));

outreachAdminRouter.post("/leads", async (req: Request, res: Response) => {
  const parsed = outreachLeadCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid lead payload.", errors: parsed.error.flatten() });

  const org = await resolveOutreachOrgContext(prisma, parsed.data.orgId);
  const email = normalizeEmail(parsed.data.email || "");
  const phone = parsed.data.phone ? normalizePhoneE164(parsed.data.phone) : "";
  if (parsed.data.phone && !phone) {
    return res.status(400).json({ ok: false, message: "Phone must be a valid US or E.164 number." });
  }
  if (!email && !phone) {
    return res.status(400).json({ ok: false, message: "Add at least a valid email or a valid phone number." });
  }
  const persistedEmail = email || buildPhoneOnlyOutreachEmail({ phone, orgId: org.id });
  const duplicate = await db.outreachLead.findFirst({
    where: phone
      ? {
          orgId: org.id,
          OR: [{ email: persistedEmail }, { phone }]
        }
      : { orgId: org.id, email: persistedEmail },
    select: { id: true }
  });
  if (duplicate) return res.status(409).json({ ok: false, message: "Lead already exists for this org." });

  const lead = await db.outreachLead.create({
    data: {
      ...parsed.data,
      orgId: org.id,
      email: persistedEmail,
      phone: phone || undefined,
      status: parsed.data.status || "NEW"
    },
    include: {
      organization: { select: { id: true, name: true } }
    }
  });
  return res.status(201).json({ ok: true, data: { lead } });
});

outreachAdminRouter.patch("/leads/:id", async (req: Request, res: Response) => {
  const parsed = outreachLeadUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid lead payload.", errors: parsed.error.flatten() });
  const normalizedPhone =
    typeof parsed.data.phone === "string"
      ? parsed.data.phone
        ? normalizePhoneE164(parsed.data.phone)
        : null
      : undefined;
  if (typeof parsed.data.phone === "string" && parsed.data.phone && !normalizedPhone) {
    return res.status(400).json({ ok: false, message: "Phone must be a valid US or E.164 number." });
  }
  try {
    const existing = await db.outreachLead.findUnique({
      where: { id: req.params.id },
      select: { id: true, orgId: true, email: true, phone: true }
    });
    if (!existing) {
      return res.status(404).json({ ok: false, message: "Lead not found." });
    }
    const nextPhone = normalizedPhone === undefined ? existing.phone : normalizedPhone;
    const emailInputProvided = typeof parsed.data.email === "string";
    const normalizedEmailInput = emailInputProvided ? normalizeEmail(parsed.data.email || "") : undefined;
    const nextEmail = emailInputProvided
      ? normalizedEmailInput || (nextPhone ? buildPhoneOnlyOutreachEmail({ phone: nextPhone, orgId: existing.orgId }) : "")
      : existing.email;
    if (!nextEmail && !nextPhone) {
      return res.status(400).json({ ok: false, message: "Lead must keep either a valid email or a valid phone number." });
    }
    const lead = await db.outreachLead.update({
      where: { id: req.params.id },
      data: {
        ...parsed.data,
        email: nextEmail,
        phone: normalizedPhone
      }
    });
    return res.json({ ok: true, data: { lead } });
  } catch {
    return res.status(404).json({ ok: false, message: "Lead not found." });
  }
});

outreachAdminRouter.delete("/leads/:id", async (req: Request, res: Response) => {
  const lead = await db.outreachLead.findUnique({
    where: { id: req.params.id },
    select: { id: true, orgId: true, email: true }
  });
  if (!lead) {
    return res.status(404).json({ ok: false, message: "Lead not found." });
  }

  const email = normalizeEmail(lead.email);

  await prisma.$transaction(async (tx) => {
    const txDb = tx as any;
    await txDb.outreachEmailEvent.deleteMany({
      where: {
        orgId: lead.orgId,
        leadId: lead.id
      }
    });
    await txDb.outreachSuppression.deleteMany({
      where: {
        orgId: lead.orgId,
        email
      }
    });
    await txDb.outreachLead.delete({
      where: { id: lead.id }
    });
  });

  return res.json({ ok: true, data: { deleted: true, id: lead.id } });
});

outreachAdminRouter.post("/leads/bulk-import", async (req: Request, res: Response) => {
  const parsed = outreachBulkImportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid import payload.", errors: parsed.error.flatten() });
  const org = await resolveOutreachOrgContext(prisma, parsed.data.orgId);
  const mode = parsed.data.mode === "PHONE" ? "PHONE" : "EMAIL";
  if (mode === "EMAIL" && parsed.data.sequenceId) {
    const sequence = await db.outreachSequence.findFirst({
      where: {
        id: parsed.data.sequenceId,
        orgId: org.id,
        isActive: true
      },
      select: { id: true }
    });
    if (!sequence) {
      return res.status(400).json({ ok: false, message: "Selected sequence was not found or is inactive." });
    }
  }
  if (mode === "PHONE" && parsed.data.callerConfigId) {
    const callerConfig = await db.outreachCallerConfig.findFirst({
      where: {
        id: parsed.data.callerConfigId,
        orgId: org.id,
        isActive: true
      },
      select: { id: true }
    });
    if (!callerConfig) {
      return res.status(400).json({ ok: false, message: "Selected caller AI configuration was not found or is inactive." });
    }
  }
  if (!parsed.data.dryRun && ((mode === "EMAIL" && parsed.data.sequenceId) || (mode === "PHONE" && parsed.data.callerConfigId)) && !parsed.data.confirmed) {
    return res.status(400).json({ ok: false, message: "CSV import must be explicitly confirmed before auto-enrollment starts." });
  }
  const rows = await buildBulkImportPreview({
    prisma,
    orgId: org.id,
    sequenceId: mode === "EMAIL" ? parsed.data.sequenceId : undefined,
    callerConfigId: mode === "PHONE" ? parsed.data.callerConfigId : undefined,
    mode,
    text: parsed.data.text,
    dryRun: parsed.data.dryRun
  });
  return res.json({ ok: true, data: { rows } });
});

outreachAdminRouter.delete("/leads", async (req: Request, res: Response) => {
  const parsed = outreachBulkDeleteSchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.confirmed) {
    return res.status(400).json({ ok: false, message: "Bulk delete must be explicitly confirmed." });
  }

  await prisma.$transaction(async (tx) => {
    const txDb = tx as any;
    await txDb.outreachEmailEvent.deleteMany({});
    await txDb.outreachPhoneEvent.deleteMany({});
    await txDb.outreachEnrollment.deleteMany({});
    await txDb.outreachPhoneEnrollment.deleteMany({});
    await txDb.outreachSuppression.deleteMany({});
    await txDb.outreachSequenceStep.deleteMany({});
    await txDb.outreachSequence.deleteMany({});
    await txDb.outreachCallerConfig.deleteMany({});
    await txDb.outreachLead.deleteMany({});
  });

  return res.json({ ok: true, data: { deleted: true } });
});

outreachAdminRouter.post("/leads/:id/suppress", async (req: Request, res: Response) => {
  const parsed = outreachLeadSuppressSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid suppression payload.", errors: parsed.error.flatten() });

  const lead = await db.outreachLead.findUnique({ where: { id: req.params.id } });
  const orgId = parsed.data.orgId || lead?.orgId;
  if (!lead || !orgId || lead.orgId !== orgId) return res.status(404).json({ ok: false, message: "Lead not found." });

  const email = normalizeEmail(lead.email);
  await prisma.$transaction(async (tx) => {
    const txDb = tx as any;
    await txDb.outreachSuppression.upsert({
      where: { orgId_email: { orgId, email } },
      update: { reason: parsed.data.reason, source: parsed.data.source },
      create: { orgId, email, reason: parsed.data.reason, source: parsed.data.source }
    });
    await txDb.outreachLead.update({
      where: { id: lead.id },
      data: { status: "PAUSED" }
    });
    await txDb.outreachEnrollment.updateMany({
      where: { orgId, leadId: lead.id, status: { in: ["ACTIVE", "PAUSED"] } },
      data: { status: "STOPPED", stopReason: "SUPPRESSED", nextSendAt: null, processingStartedAt: null }
    });
  });

  return res.json({ ok: true, data: { suppressed: true } });
});

outreachAdminRouter.delete("/leads/:id/suppress", async (req: Request, res: Response) => {
  const lead = await db.outreachLead.findUnique({ where: { id: req.params.id } });
  if (!lead) return res.status(404).json({ ok: false, message: "Lead not found." });

  await db.outreachSuppression.deleteMany({
    where: {
      orgId: lead.orgId,
      email: normalizeEmail(lead.email)
    }
  });
  await db.outreachLead.update({
    where: { id: lead.id },
    data: { status: "ACTIVE" }
  });
  return res.json({ ok: true, data: { suppressed: false } });
});

outreachAdminRouter.post("/leads/:id/mark-replied", async (req: Request, res: Response) => {
  const parsed = outreachMarkRepliedSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid replied payload.", errors: parsed.error.flatten() });
  const lead = await db.outreachLead.findUnique({ where: { id: req.params.id } });
  const orgId = parsed.data.orgId || lead?.orgId;
  if (!lead || !orgId || lead.orgId !== orgId) return res.status(404).json({ ok: false, message: "Lead not found." });

  const updated = await markLeadReplied({
    prisma,
    orgId,
    leadId: req.params.id,
    note: parsed.data.note
  });
  return res.json({ ok: true, data: { lead: updated } });
});

outreachAdminRouter.post("/leads/:id/call", async (req: Request, res: Response) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }
    const parsed = outreachPhoneCallStartSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, message: "Invalid phone call payload.", errors: parsed.error.flatten() });
    }

    const result = await startOutreachAiCall({
      prisma,
      leadId: req.params.id,
      actorUserId: auth.userId,
      actorRole: auth.role,
      callerConfigId: parsed.data.callerConfigId,
      force: parsed.data.force
    });
    return res.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start AI outreach call.";
    const statusCode =
      /not found/i.test(message) ? 404 :
      /already been called/i.test(message) ? 409 :
      /valid phone|configured/i.test(message) ? 400 :
      502;
    return res.status(statusCode).json({ ok: false, message });
  }
});

outreachAdminRouter.get("/caller-configs", safeOutreachRoute(async (req: Request, res: Response) => {
  const parsed = outreachListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid filters." });
  const where: any = {};
  if (parsed.data.orgId) where.orgId = parsed.data.orgId;
  const callerConfigs = await db.outreachCallerConfig.findMany({
    where,
    orderBy: { createdAt: "desc" }
  });
  return res.json({ ok: true, data: { callerConfigs } });
}));

outreachAdminRouter.post("/caller-configs", safeOutreachRoute(async (req: Request, res: Response) => {
  const parsed = outreachCallerConfigCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid caller config payload.", errors: parsed.error.flatten() });
  const org = await resolveOutreachOrgContext(prisma, parsed.data.orgId);
  const callerConfig = await db.outreachCallerConfig.create({
    data: {
      orgId: org.id,
      name: parsed.data.name,
      description: parsed.data.description,
      isActive: parsed.data.isActive ?? true,
      vapiAssistantId: parsed.data.vapiAssistantId,
      vapiPhoneNumberId: parsed.data.vapiPhoneNumberId,
      twilioFromNumber: parsed.data.twilioFromNumber,
      timezone: parsed.data.timezone || "America/New_York",
      windowStartHour: parsed.data.windowStartHour ?? 9,
      windowEndHour: parsed.data.windowEndHour ?? 17,
      maxCallsPerDay: parsed.data.maxCallsPerDay ?? 20,
      prompt: parsed.data.prompt
    }
  });
  return res.status(201).json({ ok: true, data: { callerConfig } });
}));

outreachAdminRouter.patch("/caller-configs/:id", safeOutreachRoute(async (req: Request, res: Response) => {
  const parsed = outreachCallerConfigUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid caller config payload.", errors: parsed.error.flatten() });
  const callerConfig = await db.outreachCallerConfig.update({
    where: { id: req.params.id },
    data: parsed.data
  });
  return res.json({ ok: true, data: { callerConfig } });
}));

outreachAdminRouter.get("/sequences", async (req: Request, res: Response) => {
  const parsed = outreachListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid filters." });
  const where = parsed.data.orgId ? { orgId: parsed.data.orgId } : {};
  const sequences = await db.outreachSequence.findMany({
    where,
    include: {
      organization: { select: { id: true, name: true } },
      steps: { orderBy: { stepNumber: "asc" } },
      _count: { select: { enrollments: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ ok: true, data: { sequences } });
});

outreachAdminRouter.get("/sequences/:id", async (req: Request, res: Response) => {
  const sequence = await db.outreachSequence.findUnique({
    where: { id: req.params.id },
    include: {
      organization: { select: { id: true, name: true } },
      steps: { orderBy: { stepNumber: "asc" } }
    }
  });
  if (!sequence) return res.status(404).json({ ok: false, message: "Sequence not found." });
  return res.json({ ok: true, data: { sequence } });
});

outreachAdminRouter.post("/sequences", async (req: Request, res: Response) => {
  const parsed = outreachSequenceCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid sequence payload.", errors: parsed.error.flatten() });
  const steps = validateOrderedSteps(parsed.data.steps);
  const org = await resolveOutreachOrgContext(prisma, parsed.data.orgId);
  try {
    const sequence = await db.outreachSequence.create({
      data: {
        orgId: org.id,
        name: parsed.data.name,
        description: parsed.data.description,
        isActive: parsed.data.isActive ?? true,
        steps: {
          create: steps.map((step) => ({
            stepNumber: step.stepNumber,
            delayHours: step.delayHours,
            subject: step.subject,
            bodyHtml: step.bodyHtml || null,
            bodyText: step.bodyText || null
          }))
        }
      },
      include: { steps: { orderBy: { stepNumber: "asc" } } }
    });
    return res.status(201).json({ ok: true, data: { sequence } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        ok: false,
        message: "A sequence with this name already exists."
      });
    }
    throw error;
  }
});

outreachAdminRouter.patch("/sequences/:id", async (req: Request, res: Response) => {
  const parsed = outreachSequenceUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid sequence payload.", errors: parsed.error.flatten() });
  const sequence = await db.outreachSequence.update({
    where: { id: req.params.id },
    data: parsed.data
  });
  return res.json({ ok: true, data: { sequence } });
});

outreachAdminRouter.put("/sequences/:id/steps", async (req: Request, res: Response) => {
  const parsed = outreachSequenceReplaceStepsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid steps payload.", errors: parsed.error.flatten() });
  const steps = validateOrderedSteps(parsed.data.steps);
  await prisma.$transaction(async (tx) => {
    const txDb = tx as any;
    await txDb.outreachSequenceStep.deleteMany({ where: { sequenceId: req.params.id } });
    await txDb.outreachSequenceStep.createMany({
      data: steps.map((step) => ({
        sequenceId: req.params.id,
        stepNumber: step.stepNumber,
        delayHours: step.delayHours,
        subject: step.subject,
        bodyHtml: step.bodyHtml || null,
        bodyText: step.bodyText || null
      }))
    });
  });

  const sequence = await db.outreachSequence.findUnique({
    where: { id: req.params.id },
    include: { steps: { orderBy: { stepNumber: "asc" } } }
  });
  return res.json({ ok: true, data: { sequence } });
});

outreachAdminRouter.delete("/sequences/:id", async (req: Request, res: Response) => {
  await db.outreachSequence.delete({ where: { id: req.params.id } });
  return res.json({ ok: true, data: { deleted: true } });
});

outreachAdminRouter.get("/enrollments", async (req: Request, res: Response) => {
  const parsed = outreachListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid filters." });
  const where: any = {};
  if (parsed.data.orgId) where.orgId = parsed.data.orgId;
  if (parsed.data.status) where.status = parsed.data.status as any;
  const enrollments = await db.outreachEnrollment.findMany({
    where,
    include: {
      organization: { select: { id: true, name: true } },
      lead: true,
      sequence: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ ok: true, data: { enrollments } });
});

outreachAdminRouter.post("/enrollments", async (req: Request, res: Response) => {
  const parsed = outreachEnrollmentCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid enrollment payload.", errors: parsed.error.flatten() });

  const [lead, sequence, suppression] = await Promise.all([
    db.outreachLead.findUnique({ where: { id: parsed.data.leadId } }),
    db.outreachSequence.findUnique({ where: { id: parsed.data.sequenceId } }),
    db.outreachLead.findUnique({ where: { id: parsed.data.leadId } }).then((item: any) =>
      item
        ? db.outreachSuppression.findUnique({
            where: { orgId_email: { orgId: item.orgId, email: normalizeEmail(item.email) } }
          })
        : null
    )
  ]);

  if (!lead || !sequence) return res.status(404).json({ ok: false, message: "Lead or sequence not found." });
  const orgId = parsed.data.orgId || lead.orgId;
  if (lead.orgId !== sequence.orgId || lead.orgId !== orgId) {
    return res.status(400).json({ ok: false, message: "Lead and sequence must belong to the same org." });
  }
  if (!hasRealOutreachEmail(lead.email)) {
    return res.status(400).json({ ok: false, message: "A real email is required to start email outreach for this lead." });
  }
  if (suppression || ["UNSUBSCRIBED", "REPLIED", "BOUNCED", "COMPLETED"].includes(lead.status)) {
    return res.status(400).json({ ok: false, message: "Lead is not eligible for outreach." });
  }

  const existing = await db.outreachEnrollment.findFirst({
    where: {
      orgId,
      leadId: parsed.data.leadId,
      sequenceId: parsed.data.sequenceId,
      status: { in: ["ACTIVE", "PAUSED"] }
    }
  });
  if (existing) return res.status(409).json({ ok: false, message: "Lead is already enrolled in this sequence." });

  const enrollment = await db.outreachEnrollment.create({
    data: {
      orgId,
      leadId: parsed.data.leadId,
      sequenceId: parsed.data.sequenceId,
      status: "ACTIVE",
      currentStepNumber: 1,
      nextSendAt: parsed.data.startAt ? new Date(parsed.data.startAt) : new Date()
    },
    include: {
      lead: true,
      sequence: { select: { id: true, name: true } }
    }
  });
  await db.outreachLead.update({
    where: { id: lead.id },
    data: { status: "ACTIVE" }
  });
  return res.status(201).json({ ok: true, data: { enrollment } });
});

outreachAdminRouter.get("/phone-enrollments", safeOutreachRoute(async (req: Request, res: Response) => {
  const parsed = outreachListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid filters." });
  const where: any = {};
  if (parsed.data.orgId) where.orgId = parsed.data.orgId;
  if (parsed.data.status) where.status = parsed.data.status as any;
  const enrollments = await db.outreachPhoneEnrollment.findMany({
    where,
    include: {
      organization: { select: { id: true, name: true } },
      lead: true,
      callerConfig: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ ok: true, data: { enrollments } });
}));

outreachAdminRouter.post("/phone-enrollments", safeOutreachRoute(async (req: Request, res: Response) => {
  const parsed = outreachPhoneEnrollmentCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid phone enrollment payload.", errors: parsed.error.flatten() });

  const [lead, callerConfig] = await Promise.all([
    db.outreachLead.findUnique({ where: { id: parsed.data.leadId } }),
    db.outreachCallerConfig.findUnique({ where: { id: parsed.data.callerConfigId } })
  ]);
  if (!lead || !callerConfig) return res.status(404).json({ ok: false, message: "Lead or caller AI config not found." });
  const orgId = parsed.data.orgId || lead.orgId;
  if (lead.orgId !== callerConfig.orgId || lead.orgId !== orgId) {
    return res.status(400).json({ ok: false, message: "Lead and caller AI config must belong to the same org." });
  }
  if (["UNSUBSCRIBED", "REPLIED", "BOUNCED", "COMPLETED"].includes(lead.status)) {
    return res.status(400).json({ ok: false, message: "Lead is not eligible for phone outreach." });
  }
  if (!lead.phone) {
    return res.status(400).json({ ok: false, message: "Lead must have a phone number for caller AI outreach." });
  }
  const priorCall = await db.outreachPhoneEvent.findFirst({
    where: {
      leadId: lead.id,
      eventType: { in: ["STARTED", "COMPLETED"] }
    },
    select: { id: true }
  });
  if (priorCall && !parsed.data.force) {
    return res.status(409).json({ ok: false, message: "This lead has already been called by Caller AI." });
  }

  const existing = await db.outreachPhoneEnrollment.findFirst({
    where: {
      orgId,
      leadId: parsed.data.leadId,
      callerConfigId: parsed.data.callerConfigId,
      status: { in: ["ACTIVE", "PAUSED"] }
    }
  });
  if (existing) return res.status(409).json({ ok: false, message: "Lead is already enrolled in this caller AI configuration." });

  const nextCallAt = await computeNextPhoneEnrollmentStart({
    prisma,
    orgId,
    callerConfigId: parsed.data.callerConfigId,
    requestedStartAt: parsed.data.startAt ? new Date(parsed.data.startAt) : null
  });

  const enrollment = await db.outreachPhoneEnrollment.create({
    data: {
      orgId,
      leadId: parsed.data.leadId,
      callerConfigId: parsed.data.callerConfigId,
      status: "ACTIVE",
      nextCallAt
    },
    include: {
      lead: true,
      callerConfig: { select: { id: true, name: true } }
    }
  });
  await db.outreachLead.update({
    where: { id: lead.id },
    data: { status: "ACTIVE" }
  });
  return res.status(201).json({ ok: true, data: { enrollment } });
}));

outreachAdminRouter.post("/enrollments/:id/pause", async (req: Request, res: Response) => {
  const enrollment = await db.outreachEnrollment.update({
    where: { id: req.params.id },
    data: { status: "PAUSED", processingStartedAt: null }
  });
  return res.json({ ok: true, data: { enrollment } });
});

outreachAdminRouter.post("/phone-enrollments/:id/pause", safeOutreachRoute(async (req: Request, res: Response) => {
  const enrollment = await db.outreachPhoneEnrollment.update({
    where: { id: req.params.id },
    data: { status: "PAUSED", processingStartedAt: null }
  });
  return res.json({ ok: true, data: { enrollment } });
}));

outreachAdminRouter.post("/enrollments/:id/resume", async (req: Request, res: Response) => {
  const enrollment = await db.outreachEnrollment.update({
    where: { id: req.params.id },
    data: { status: "ACTIVE", nextSendAt: new Date(), processingStartedAt: null }
  });
  return res.json({ ok: true, data: { enrollment } });
});

outreachAdminRouter.post("/phone-enrollments/:id/resume", safeOutreachRoute(async (req: Request, res: Response) => {
  const current = await db.outreachPhoneEnrollment.findUnique({
    where: { id: req.params.id },
    select: { id: true, orgId: true, callerConfigId: true }
  });
  if (!current) {
    return res.status(404).json({ ok: false, message: "Phone enrollment not found." });
  }
  const nextCallAt = await computeNextPhoneEnrollmentStart({
    prisma,
    orgId: current.orgId,
    callerConfigId: current.callerConfigId,
    excludeEnrollmentId: current.id
  });
  const enrollment = await db.outreachPhoneEnrollment.update({
    where: { id: req.params.id },
    data: { status: "ACTIVE", nextCallAt, processingStartedAt: null }
  });
  return res.json({ ok: true, data: { enrollment } });
}));

outreachAdminRouter.post("/phone-enrollments/:id/send-now", safeOutreachRoute(async (req: Request, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth!;
  const parsed = outreachPhoneCallStartSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: "Invalid phone send payload.", errors: parsed.error.flatten() });
  }
  const enrollment = await db.outreachPhoneEnrollment.findUnique({
    where: { id: req.params.id },
    include: { callerConfig: true, lead: true }
  });
  if (!enrollment) return res.status(404).json({ ok: false, message: "Phone enrollment not found." });
  try {
    const result = await startOutreachAiCall({
      prisma,
      leadId: enrollment.leadId,
      actorUserId: auth.userId,
      actorRole: auth.role,
      callerConfigId: enrollment.callerConfigId,
      enrollmentId: enrollment.id,
      force: parsed.data.force
    });
    await db.outreachPhoneEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "COMPLETED", nextCallAt: null, processingStartedAt: null }
    });
    return res.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start caller AI outreach.";
    await db.outreachPhoneEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "FAILED", stopReason: message, processingStartedAt: null }
    });
    return res.status(400).json({ ok: false, message });
  }
}));

outreachAdminRouter.post("/enrollments/:id/send-now", async (req: Request, res: Response) => {
  const result = await sendEnrollmentStepNow({
    prisma,
    enrollmentId: req.params.id,
    processingTimeoutMs: Number.parseInt(process.env.OUTREACH_PROCESSING_TIMEOUT_MS || "900000", 10),
    sendJitterMinutes: Number.parseInt(process.env.OUTREACH_SEND_JITTER_MINUTES || "20", 10)
  });
  if (!result.ok) return res.status(400).json({ ok: false, message: result.reason });
  return res.json({ ok: true, data: result });
});

outreachAdminRouter.post("/runner/tick", safeOutreachRoute(async (_req: Request, res: Response) => {
  const emailResult = await runOutreachTick({
    prisma,
    processingTimeoutMs: Number.parseInt(process.env.OUTREACH_PROCESSING_TIMEOUT_MS || "900000", 10),
    dailySendCap: Number.parseInt(process.env.OUTREACH_DAILY_SEND_CAP || "40", 10),
    sendWindowStartHour: Number.parseInt(process.env.OUTREACH_SEND_WINDOW_START_HOUR || "9", 10),
    sendWindowEndHour: Number.parseInt(process.env.OUTREACH_SEND_WINDOW_END_HOUR || "17", 10),
    sendJitterMinutes: Number.parseInt(process.env.OUTREACH_SEND_JITTER_MINUTES || "20", 10)
  });
  const phoneResult = await runOutreachPhoneTick({
    prisma,
    processingTimeoutMs: Number.parseInt(process.env.OUTREACH_PROCESSING_TIMEOUT_MS || "900000", 10)
  });
  return res.json({
    ok: true,
    data: {
      processed: emailResult.processed + phoneResult.processed,
      sent: emailResult.sent,
      failed: emailResult.failed + phoneResult.failed,
      phoneStarted: phoneResult.started
    }
  });
}));

outreachAdminRouter.get("/events", async (req: Request, res: Response) => {
  const parsed = outreachListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid filters." });
  const { skip, limit, page } = pagination(parsed.data);
  const channel = parsed.data.channel || "ALL";
  const emailWhere: any = {};
  const phoneWhere: any = {};
  if (parsed.data.orgId) {
    emailWhere.orgId = parsed.data.orgId;
    phoneWhere.orgId = parsed.data.orgId;
  }
  if (parsed.data.eventType && ["QUEUED", "SENT", "DELIVERED", "OPENED", "CLICKED", "BOUNCED", "COMPLAINED", "FAILED", "REPLIED", "UNSUBSCRIBED"].includes(parsed.data.eventType)) {
    emailWhere.eventType = parsed.data.eventType as any;
  }
  if (parsed.data.eventType && ["QUEUED", "STARTED", "COMPLETED", "FAILED"].includes(parsed.data.eventType)) {
    phoneWhere.eventType = parsed.data.eventType as any;
  }
  if (parsed.data.search) {
    emailWhere.OR = [
      { toEmail: { contains: parsed.data.search, mode: "insensitive" } },
      { subject: { contains: parsed.data.search, mode: "insensitive" } },
      { lead: { companyName: { contains: parsed.data.search, mode: "insensitive" } } },
      { lead: { contactName: { contains: parsed.data.search, mode: "insensitive" } } }
    ];
    phoneWhere.OR = [
      { toPhone: { contains: parsed.data.search, mode: "insensitive" } },
      { summary: { contains: parsed.data.search, mode: "insensitive" } },
      { errorMessage: { contains: parsed.data.search, mode: "insensitive" } },
      { lead: { companyName: { contains: parsed.data.search, mode: "insensitive" } } },
      { lead: { contactName: { contains: parsed.data.search, mode: "insensitive" } } }
    ];
  }
  const [emailEvents, phoneEvents] = await Promise.all([
    channel === "PHONE"
      ? Promise.resolve([])
      : db.outreachEmailEvent.findMany({
          where: emailWhere,
          include: {
            organization: { select: { id: true, name: true } },
            lead: { select: { id: true, email: true, companyName: true, contactName: true } },
            sequence: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: "desc" },
          take: Math.max(limit * page, 100)
        }),
    channel === "EMAIL"
      ? Promise.resolve([])
      : db.outreachPhoneEvent.findMany({
          where: phoneWhere,
          include: {
            organization: { select: { id: true, name: true } },
            lead: { select: { id: true, email: true, companyName: true, contactName: true } },
            callerConfig: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: "desc" },
          take: Math.max(limit * page, 100)
        })
  ]);
  const merged = [
    ...emailEvents.map((event: any) => decorateOutreachEvent("EMAIL", event)),
    ...phoneEvents.map((event: any) => decorateOutreachEvent("PHONE", event))
  ].sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());
  const total = merged.length;
  const events = merged.slice(skip, skip + limit);
  return res.json({ ok: true, data: { events, total, page, limit } });
});

outreachAdminRouter.get("/phone-events/:id", safeOutreachRoute(async (req: Request, res: Response) => {
  const include = {
    organization: { select: { id: true, name: true } },
    lead: {
      select: {
        id: true,
        companyName: true,
        contactName: true,
        email: true,
        phone: true,
        city: true,
        state: true,
        industry: true,
        angle: true,
        painPoint: true,
        offer: true,
        sourceList: true,
        notes: true
      }
    },
    callerConfig: { select: { id: true, name: true, vapiAssistantId: true, vapiPhoneNumberId: true, timezone: true } },
    enrollment: {
      select: {
        id: true,
        status: true,
        stopReason: true,
        lastCalledAt: true,
        nextCallAt: true,
        attemptCount: true
      }
    }
  } as const;

  const event = await db.outreachPhoneEvent.findUnique({
    where: { id: req.params.id },
    include
  });
  if (!event) {
    return res.status(404).json({ ok: false, message: "Outreach phone event not found." });
  }

  let resolvedEvent = event;
  if (event.providerCallId) {
    const richerTerminal = await db.outreachPhoneEvent.findFirst({
      where: {
        providerCallId: event.providerCallId,
        eventType: { in: ["COMPLETED", "FAILED"] }
      },
      include,
      orderBy: { createdAt: "desc" }
    });
    if (richerTerminal) {
      resolvedEvent = richerTerminal;
    }
  }

  const callLogSelect = {
    aiSummary: true,
    transcript: true,
    recordingUrl: true,
    outcome: true,
    fromNumber: true,
    toNumber: true
  } as const;

  let callLog =
    resolvedEvent.providerCallId
      ? await db.callLog.findFirst({
          where: {
            orgId: resolvedEvent.orgId,
            providerCallId: resolvedEvent.providerCallId
          },
          select: callLogSelect
        })
      : null;

  if (!callLog) {
    const eventCreatedAt = new Date(resolvedEvent.createdAt);
    const windowStart = new Date(eventCreatedAt.getTime() - 60 * 60 * 1000);
    const windowEnd = new Date(eventCreatedAt.getTime() + 6 * 60 * 60 * 1000);
    callLog = await db.callLog.findFirst({
      where: {
        orgId: resolvedEvent.orgId,
        aiProvider: "VAPI",
        toNumber: resolvedEvent.toPhone,
        ...(resolvedEvent.fromPhone ? { fromNumber: resolvedEvent.fromPhone } : {}),
        startedAt: {
          gte: windowStart,
          lte: windowEnd
        }
      },
      orderBy: { startedAt: "desc" },
      select: callLogSelect
    });
  }

  if (callLog) {
    const mergedMetadata = {
      ...(resolvedEvent.metadata || {}),
      ...(callLog.transcript ? { transcript: callLog.transcript } : {}),
      ...(callLog.recordingUrl ? { recordingUrl: callLog.recordingUrl } : {}),
      ...(callLog.outcome ? { outcome: callLog.outcome } : {}),
      ...(resolvedEvent.status ? {} : { callStatus: null })
    };

    resolvedEvent = {
      ...resolvedEvent,
      summary: resolvedEvent.summary || callLog.aiSummary || null,
      fromPhone: resolvedEvent.fromPhone || callLog.fromNumber || null,
      toPhone: resolvedEvent.toPhone || callLog.toNumber || resolvedEvent.toPhone,
      metadata: mergedMetadata
    };
  }

  return res.json({ ok: true, data: { event: resolvedEvent } });
}));

outreachPublicRouter.get("/unsubscribe/:token", async (req: Request, res: Response) => {
  try {
    await unsubscribeOutreachRecipient({
      prisma,
      token: req.params.token
    });
    return res.json({ ok: true, data: { unsubscribed: true } });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : "Unable to unsubscribe."
    });
  }
});
