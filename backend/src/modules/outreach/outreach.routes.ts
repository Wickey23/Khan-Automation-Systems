import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma";
import {
  outreachBulkImportSchema,
  outreachEnrollmentCreateSchema,
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
import { buildBulkImportPreview, runOutreachTick, sendEnrollmentStepNow } from "./outreach.service";
import { markLeadReplied, normalizeEmail } from "./outreach-stop.service";
import { unsubscribeOutreachRecipient } from "./outreach-unsubscribe.service";

export const outreachAdminRouter = Router();
export const outreachPublicRouter = Router();
const db = prisma as any;

function pagination(query: { page?: number; limit?: number }) {
  const page = Math.max(query.page || 1, 1);
  const limit = Math.max(1, Math.min(query.limit || 50, 200));
  return { page, limit, skip: (page - 1) * limit };
}

outreachAdminRouter.get("/overview", async (req: Request, res: Response) => {
  const parsed = outreachListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid filters." });

  const orgId = parsed.data.orgId;
  const whereOrg = orgId ? { orgId } : {};
  const [totalLeads, activeEnrollments, emailsSent, replies, unsubscribes, recentEvents] = await Promise.all([
    db.outreachLead.count({ where: whereOrg }),
    db.outreachEnrollment.count({ where: { ...whereOrg, status: "ACTIVE" } }),
    db.outreachEmailEvent.count({ where: { ...whereOrg, eventType: "SENT" } }),
    db.outreachLead.count({ where: { ...whereOrg, status: "REPLIED" } }),
    db.outreachSuppression.count({ where: whereOrg }),
    db.outreachEmailEvent.findMany({
      where: whereOrg,
      include: {
        organization: { select: { id: true, name: true } },
        lead: { select: { id: true, email: true, companyName: true, contactName: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 12
    })
  ]);

  return res.json({
    ok: true,
    data: {
      totalLeads,
      activeEnrollments,
      emailsSent,
      replies,
      unsubscribes,
      recentEvents
    }
  });
});

outreachAdminRouter.get("/leads", async (req: Request, res: Response) => {
  const parsed = outreachListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid filters." });
  const { skip, limit, page } = pagination(parsed.data);
  const where: any = {};
  if (parsed.data.orgId) where.orgId = parsed.data.orgId;
  if (parsed.data.status) where.status = parsed.data.status as any;
  if (parsed.data.search) {
    where.OR = [
      { email: { contains: parsed.data.search, mode: "insensitive" } },
      { companyName: { contains: parsed.data.search, mode: "insensitive" } },
      { contactName: { contains: parsed.data.search, mode: "insensitive" } }
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
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    }),
    db.outreachLead.count({ where })
  ]);
  return res.json({ ok: true, data: { leads, total, page, limit } });
});

outreachAdminRouter.post("/leads", async (req: Request, res: Response) => {
  const parsed = outreachLeadCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid lead payload.", errors: parsed.error.flatten() });

  const email = normalizeEmail(parsed.data.email);
  const duplicate = await db.outreachLead.findFirst({
    where: { orgId: parsed.data.orgId, email },
    select: { id: true }
  });
  if (duplicate) return res.status(409).json({ ok: false, message: "Lead already exists for this org." });

  const lead = await db.outreachLead.create({
    data: {
      ...parsed.data,
      email,
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
  try {
    const lead = await db.outreachLead.update({
      where: { id: req.params.id },
      data: {
        ...parsed.data,
        email: parsed.data.email ? normalizeEmail(parsed.data.email) : undefined
      }
    });
    return res.json({ ok: true, data: { lead } });
  } catch {
    return res.status(404).json({ ok: false, message: "Lead not found." });
  }
});

outreachAdminRouter.post("/leads/bulk-import", async (req: Request, res: Response) => {
  const parsed = outreachBulkImportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid import payload.", errors: parsed.error.flatten() });
  const rows = await buildBulkImportPreview({
    prisma,
    orgId: parsed.data.orgId,
    text: parsed.data.text
  });
  return res.json({ ok: true, data: { rows } });
});

outreachAdminRouter.post("/leads/:id/suppress", async (req: Request, res: Response) => {
  const parsed = outreachLeadSuppressSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid suppression payload.", errors: parsed.error.flatten() });

  const lead = await db.outreachLead.findUnique({ where: { id: req.params.id } });
  if (!lead || lead.orgId !== parsed.data.orgId) return res.status(404).json({ ok: false, message: "Lead not found." });

  const email = normalizeEmail(lead.email);
  await prisma.$transaction(async (tx) => {
    const txDb = tx as any;
    await txDb.outreachSuppression.upsert({
      where: { orgId_email: { orgId: parsed.data.orgId, email } },
      update: { reason: parsed.data.reason, source: parsed.data.source },
      create: { orgId: parsed.data.orgId, email, reason: parsed.data.reason, source: parsed.data.source }
    });
    await txDb.outreachLead.update({
      where: { id: lead.id },
      data: { status: "PAUSED" }
    });
    await txDb.outreachEnrollment.updateMany({
      where: { orgId: parsed.data.orgId, leadId: lead.id, status: { in: ["ACTIVE", "PAUSED"] } },
      data: { status: "STOPPED", stopReason: "SUPPRESSED", nextSendAt: null, processingStartedAt: null }
    });
  });

  return res.json({ ok: true, data: { suppressed: true } });
});

outreachAdminRouter.delete("/leads/:id/suppress", async (req: Request, res: Response) => {
  const orgId = String(req.query.orgId || "").trim();
  if (!orgId) return res.status(400).json({ ok: false, message: "orgId is required." });
  const lead = await db.outreachLead.findUnique({ where: { id: req.params.id } });
  if (!lead || lead.orgId !== orgId) return res.status(404).json({ ok: false, message: "Lead not found." });

  await db.outreachSuppression.deleteMany({
    where: {
      orgId,
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
  if (!lead || lead.orgId !== parsed.data.orgId) return res.status(404).json({ ok: false, message: "Lead not found." });

  const updated = await markLeadReplied({
    prisma,
    orgId: parsed.data.orgId,
    leadId: req.params.id,
    note: parsed.data.note
  });
  return res.json({ ok: true, data: { lead: updated } });
});

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
  const sequence = await db.outreachSequence.create({
    data: {
      orgId: parsed.data.orgId,
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
  if (lead.orgId !== parsed.data.orgId || sequence.orgId !== parsed.data.orgId) {
    return res.status(400).json({ ok: false, message: "Lead and sequence must belong to the same org." });
  }
  if (suppression || ["UNSUBSCRIBED", "REPLIED", "BOUNCED", "COMPLETED"].includes(lead.status)) {
    return res.status(400).json({ ok: false, message: "Lead is not eligible for outreach." });
  }

  const existing = await db.outreachEnrollment.findFirst({
    where: {
      orgId: parsed.data.orgId,
      leadId: parsed.data.leadId,
      sequenceId: parsed.data.sequenceId,
      status: { in: ["ACTIVE", "PAUSED"] }
    }
  });
  if (existing) return res.status(409).json({ ok: false, message: "Lead is already enrolled in this sequence." });

  const enrollment = await db.outreachEnrollment.create({
    data: {
      orgId: parsed.data.orgId,
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

outreachAdminRouter.post("/enrollments/:id/pause", async (req: Request, res: Response) => {
  const enrollment = await db.outreachEnrollment.update({
    where: { id: req.params.id },
    data: { status: "PAUSED", processingStartedAt: null }
  });
  return res.json({ ok: true, data: { enrollment } });
});

outreachAdminRouter.post("/enrollments/:id/resume", async (req: Request, res: Response) => {
  const enrollment = await db.outreachEnrollment.update({
    where: { id: req.params.id },
    data: { status: "ACTIVE", nextSendAt: new Date(), processingStartedAt: null }
  });
  return res.json({ ok: true, data: { enrollment } });
});

outreachAdminRouter.post("/enrollments/:id/send-now", async (req: Request, res: Response) => {
  const result = await sendEnrollmentStepNow({
    prisma,
    enrollmentId: req.params.id,
    processingTimeoutMs: Number.parseInt(process.env.OUTREACH_PROCESSING_TIMEOUT_MS || "900000", 10)
  });
  if (!result.ok) return res.status(400).json({ ok: false, message: result.reason });
  return res.json({ ok: true, data: result });
});

outreachAdminRouter.post("/runner/tick", async (_req: Request, res: Response) => {
  const result = await runOutreachTick({
    prisma,
    processingTimeoutMs: Number.parseInt(process.env.OUTREACH_PROCESSING_TIMEOUT_MS || "900000", 10)
  });
  return res.json({ ok: true, data: result });
});

outreachAdminRouter.get("/events", async (req: Request, res: Response) => {
  const parsed = outreachListQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid filters." });
  const { skip, limit, page } = pagination(parsed.data);
  const where: any = {};
  if (parsed.data.orgId) where.orgId = parsed.data.orgId;
  if (parsed.data.eventType) where.eventType = parsed.data.eventType as any;
  if (parsed.data.search) {
    where.OR = [
      { toEmail: { contains: parsed.data.search, mode: "insensitive" } },
      { subject: { contains: parsed.data.search, mode: "insensitive" } }
    ];
  }
  const [events, total] = await Promise.all([
    db.outreachEmailEvent.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        lead: { select: { id: true, email: true, companyName: true, contactName: true } },
        sequence: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    }),
    db.outreachEmailEvent.count({ where })
  ]);
  return res.json({ ok: true, data: { events, total, page, limit } });
});

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
