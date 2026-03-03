import bcrypt from "bcryptjs";
import { NumberProvider, OrganizationStatus, Prisma, UserRole } from "@prisma/client";
import { Router, type Response } from "express";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { requireAnyRole, requireAuth, type AuthenticatedRequest } from "../../middleware/require-auth";
import { toCsv } from "../../utils/csv";
import { buildVapiSystemPrompt, buildVapiTools, upsertVapiAgentIfConfigured } from "../voice/vapi/vapi.service";
import { provisionNumber } from "../twilio/twilio.service";
import { buildConfigPackage, generateConfigPackage } from "../org/config-package";
import {
  assignNumberSchema,
  callFilterSchema,
  clearAllDataSchema,
  createProspectSchema,
  createTestRunSchema,
  deleteItemSchema,
  discoverProspectsSchema,
  eventsFilterSchema,
  importProspectsSchema,
  leadFilterSchema,
  prospectFilterSchema,
  provisioningStepUpdateSchema,
  resetUserPasswordSchema,
  updateProspectSchema,
  updateAiConfigSchema,
  updateClientStatusSchema,
  updateLeadSchema
} from "./admin.schema";
import { backfillMissedVapiCalls } from "./backfill.service";
import { getDefaultChecklistSteps, upsertChecklistStep, writeAuditLog } from "./provisioning.service";
import { computeReadinessReport } from "./readiness.service";
import { computeOrgHealth } from "../org/health.service";
import { ensureDefaultTestScenarios, getTestPassSummary } from "./testing.service";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAnyRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]));

function verifyDeletePassword(req: AuthenticatedRequest, res: Response) {
  const parsed = deleteItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: "Password is required for delete actions." });
    return false;
  }
  if (parsed.data.password !== env.ADMIN_ACTION_PASSWORD) {
    res.status(401).json({ ok: false, message: "Invalid delete password." });
    return false;
  }
  return true;
}

function normalizeVapiList(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (payload && typeof payload === "object") {
    const maybeData = (payload as Record<string, unknown>).data;
    if (Array.isArray(maybeData)) return maybeData as Array<Record<string, unknown>>;
  }
  return [];
}

function parseCsvRows(input: string) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [] as Array<Record<string, string>>;
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, index) => {
      row[h] = cols[index] || "";
    });
    rows.push(row);
  }
  return rows;
}

function toNullable(value: string | null | undefined) {
  const text = String(value || "").trim();
  return text ? text : null;
}

function normalizePhoneE164(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function parseIsoDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildKnowledgeContextSnippet(files: Array<{ fileName: string; contentText: string }>) {
  if (!files.length) return "";
  const sections = files
    .map((file) => {
      const normalized = String(file.contentText || "").replace(/\r\n/g, "\n").trim();
      if (!normalized) return "";
      return `Source: ${file.fileName}\n${normalized}`;
    })
    .filter(Boolean);
  if (!sections.length) return "";
  return `\n\nBusiness knowledge documents:\nUse these details as business facts when answering callers. If unsure or conflicting, ask a clarification question.\n\n${sections.join(
    "\n\n---\n\n"
  )}`;
}

async function snapshotAiConfigVersion(input: {
  orgId: string;
  aiConfigId: string;
  createdByUserId?: string;
}) {
  const versions = await prisma.aiAgentConfigVersion.count({
    where: { orgId: input.orgId, aiAgentConfigId: input.aiConfigId }
  });
  const ai = await prisma.aiAgentConfig.findUnique({ where: { id: input.aiConfigId } });
  if (!ai) return null;
  return prisma.aiAgentConfigVersion.create({
    data: {
      orgId: input.orgId,
      aiAgentConfigId: input.aiConfigId,
      version: versions + 1,
      configJson: ai as unknown as Prisma.InputJsonValue,
      createdByUserId: input.createdByUserId || null
    }
  });
}

type NominatimItem = {
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  class?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
  };
  extratags?: Record<string, string>;
};

async function discoverViaNominatim(location: string, keyword: string, limit: number): Promise<NominatimItem[]> {
  const query = `${keyword} near ${location}`;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Khan-Automation-Systems/1.0 (lead-discovery)"
    }
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) ? (payload as NominatimItem[]) : [];
}

function deriveIndustry(keyword: string) {
  const lower = keyword.toLowerCase();
  if (lower.includes("truck")) return "Truck Repair";
  if (lower.includes("auto")) return "Auto Repair";
  if (lower.includes("hvac")) return "HVAC";
  if (lower.includes("equipment")) return "Equipment Service";
  if (lower.includes("manufactur")) return "Manufacturing Service";
  return "Service Business";
}

adminRouter.get("/leads", async (req: AuthenticatedRequest, res: Response) => {
  const parsed = leadFilterSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid filters." });
  const limit = Math.min(Number(parsed.data.limit || 50), 200);
  const page = Math.max(Number(parsed.data.page || 1), 1);
  const skip = (page - 1) * limit;
  const where: Prisma.LeadWhereInput = {};
  if (parsed.data.status) where.status = parsed.data.status;
  if (parsed.data.industry) where.industry = { contains: parsed.data.industry, mode: "insensitive" };
  if (parsed.data.search) {
    where.OR = [
      { name: { contains: parsed.data.search, mode: "insensitive" } },
      { business: { contains: parsed.data.search, mode: "insensitive" } },
      { email: { contains: parsed.data.search, mode: "insensitive" } }
    ];
  }
  const sort = parsed.data.sort === "createdAt:asc" ? "asc" : "desc";
  const [leads, total] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: sort }, take: limit, skip }),
    prisma.lead.count({ where })
  ]);
  return res.json({ ok: true, data: { leads, total } });
});

adminRouter.get("/calls", async (req: AuthenticatedRequest, res: Response) => {
  const parsed = callFilterSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid filters." });
  const limit = Math.min(Number(parsed.data.limit || 100), 300);
  const page = Math.max(Number(parsed.data.page || 1), 1);
  const skip = (page - 1) * limit;

  const where: Prisma.CallLogWhereInput = {};
  if (parsed.data.outcome) where.outcome = parsed.data.outcome;
  if (parsed.data.orgId) where.orgId = parsed.data.orgId;
  if (parsed.data.search) {
    where.OR = [
      { providerCallId: { contains: parsed.data.search, mode: "insensitive" } },
      { fromNumber: { contains: parsed.data.search, mode: "insensitive" } },
      { toNumber: { contains: parsed.data.search, mode: "insensitive" } },
      { transcript: { contains: parsed.data.search, mode: "insensitive" } },
      { aiSummary: { contains: parsed.data.search, mode: "insensitive" } },
      { organization: { name: { contains: parsed.data.search, mode: "insensitive" } } }
    ];
  }

  const [calls, total] = await Promise.all([
    prisma.callLog.findMany({
      where,
      include: {
        organization: {
          select: { id: true, name: true }
        }
      },
      orderBy: { startedAt: "desc" },
      take: limit,
      skip
    }),
    prisma.callLog.count({ where })
  ]);

  return res.json({ ok: true, data: { calls, total } });
});

adminRouter.get("/messages", async (req: AuthenticatedRequest, res: Response) => {
  const orgId = typeof req.query.orgId === "string" ? req.query.orgId : undefined;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const where: Prisma.MessageThreadWhereInput = { channel: "SMS" };
  if (orgId) where.orgId = orgId;
  if (search) {
    where.OR = [
      { contactName: { contains: search, mode: "insensitive" } },
      { contactPhone: { contains: search, mode: "insensitive" } },
      { organization: { name: { contains: search, mode: "insensitive" } } }
    ];
  }

  const threads = await prisma.messageThread.findMany({
    where,
    include: {
      organization: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, business: true, phone: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 30 }
    },
    orderBy: { lastMessageAt: "desc" },
    take: 250
  });

  return res.json({ ok: true, data: { threads } });
});

adminRouter.get("/settings/demo", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await prisma.appConfig.findUnique({ where: { id: "singleton" } });
    return res.json({
      ok: true,
      data: {
        demoNumber: config?.demoNumber || "",
        demoVapiAssistantId: config?.demoVapiAssistantId || "",
        demoVapiPhoneNumberId: config?.demoVapiPhoneNumberId || "",
        demoTitle: config?.demoTitle || "",
        demoSubtitle: config?.demoSubtitle || "",
        demoQuestions:
          config?.demoQuestionsJson && config.demoQuestionsJson.trim()
            ? (() => {
                try {
                  const parsed = JSON.parse(config.demoQuestionsJson) as unknown;
                  return Array.isArray(parsed) ? parsed.map((item) => String(item || "")) : [];
                } catch {
                  return [];
                }
              })()
            : []
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // eslint-disable-next-line no-console
    console.error("[admin-demo] load config failed, returning defaults", message);
    return res.json({
      ok: true,
      data: {
        demoNumber: "",
        demoVapiAssistantId: "",
        demoVapiPhoneNumberId: "",
        demoTitle: "",
        demoSubtitle: "",
        demoQuestions: []
      }
    });
  }
});

adminRouter.patch("/settings/demo", async (req: AuthenticatedRequest, res: Response) => {
  const demoNumber = String(req.body?.demoNumber || "").trim();
  const demoVapiAssistantId = String(req.body?.demoVapiAssistantId || "").trim();
  const demoVapiPhoneNumberId = String(req.body?.demoVapiPhoneNumberId || "").trim();
  const demoTitle = String(req.body?.demoTitle || "").trim();
  const demoSubtitle = String(req.body?.demoSubtitle || "").trim();
  const demoQuestionsRaw = Array.isArray(req.body?.demoQuestions) ? req.body.demoQuestions : [];
  const demoQuestions = demoQuestionsRaw
    .map((item: unknown) => String(item || "").trim())
    .filter((item: string) => item.length > 0)
    .slice(0, 12);

  const config = await prisma.appConfig.upsert({
    where: { id: "singleton" },
    update: {
      demoNumber: demoNumber || null,
      demoVapiAssistantId: demoVapiAssistantId || null,
      demoVapiPhoneNumberId: demoVapiPhoneNumberId || null,
      demoTitle: demoTitle || null,
      demoSubtitle: demoSubtitle || null,
      demoQuestionsJson: JSON.stringify(demoQuestions),
      updatedByUserId: req.auth!.userId
    },
    create: {
      id: "singleton",
      demoNumber: demoNumber || null,
      demoVapiAssistantId: demoVapiAssistantId || null,
      demoVapiPhoneNumberId: demoVapiPhoneNumberId || null,
      demoTitle: demoTitle || null,
      demoSubtitle: demoSubtitle || null,
      demoQuestionsJson: JSON.stringify(demoQuestions),
      updatedByUserId: req.auth!.userId
    }
  });

  await writeAuditLog({
    prisma,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "DEMO_CONFIG_UPDATED",
    metadata: {
      hasDemoNumber: Boolean(config.demoNumber),
      hasDemoAssistant: Boolean(config.demoVapiAssistantId),
      hasDemoPhoneNumberId: Boolean(config.demoVapiPhoneNumberId),
      hasTitle: Boolean(config.demoTitle),
      hasSubtitle: Boolean(config.demoSubtitle),
      questionCount: demoQuestions.length
    }
  });

  return res.json({
    ok: true,
    data: {
      demoNumber: config.demoNumber || "",
      demoVapiAssistantId: config.demoVapiAssistantId || "",
      demoVapiPhoneNumberId: config.demoVapiPhoneNumberId || "",
      demoTitle: config.demoTitle || "",
      demoSubtitle: config.demoSubtitle || "",
      demoQuestions
    }
  });
});

adminRouter.get("/settings/demo/calls", async (req: AuthenticatedRequest, res: Response) => {
  const limitRaw = Number.parseInt(String(req.query.limit || "100"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 300)) : 100;
  try {
    const calls = await prisma.demoCallLog.findMany({
      orderBy: { startedAt: "desc" },
      take: limit
    });
    return res.json({ ok: true, data: { calls } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // eslint-disable-next-line no-console
    console.error("[admin-demo] load calls failed, returning empty", message);
    return res.json({ ok: true, data: { calls: [] } });
  }
});

adminRouter.get("/leads/:id", async (req, res) => {
  const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
  if (!lead) return res.status(404).json({ ok: false, message: "Lead not found." });
  return res.json({ ok: true, data: { lead } });
});

adminRouter.patch("/leads/:id", async (req, res) => {
  const parsed = updateLeadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid update payload." });
  try {
    const lead = await prisma.lead.update({ where: { id: req.params.id }, data: parsed.data });
    await writeAuditLog({
      prisma,
      orgId: lead.orgId || undefined,
      actorUserId: (req as AuthenticatedRequest).auth!.userId,
      actorRole: (req as AuthenticatedRequest).auth!.role,
      action: "ADMIN_LEAD_UPDATED",
      metadata: { leadId: lead.id, fields: Object.keys(parsed.data) }
    });
    return res.json({ ok: true, data: { lead } });
  } catch {
    return res.status(404).json({ ok: false, message: "Lead not found." });
  }
});

adminRouter.delete("/leads/:id", async (req, res) => {
  if (!verifyDeletePassword(req, res)) return;
  try {
    const lead = await prisma.lead.delete({ where: { id: req.params.id } });
    await writeAuditLog({
      prisma,
      orgId: lead.orgId || undefined,
      actorUserId: (req as AuthenticatedRequest).auth!.userId,
      actorRole: (req as AuthenticatedRequest).auth!.role,
      action: "ADMIN_LEAD_DELETED",
      metadata: { leadId: lead.id }
    });
    return res.json({ ok: true, data: { id: lead.id } });
  } catch {
    return res.status(404).json({ ok: false, message: "Lead not found." });
  }
});

adminRouter.delete("/calls/:id", async (req, res) => {
  if (!verifyDeletePassword(req, res)) return;
  try {
    const call = await prisma.callLog.delete({ where: { id: req.params.id } });
    await writeAuditLog({
      prisma,
      orgId: call.orgId,
      actorUserId: (req as AuthenticatedRequest).auth!.userId,
      actorRole: (req as AuthenticatedRequest).auth!.role,
      action: "ADMIN_CALL_DELETED",
      metadata: { callId: call.id, providerCallId: call.providerCallId }
    });
    return res.json({ ok: true, data: { id: call.id } });
  } catch {
    return res.status(404).json({ ok: false, message: "Call not found." });
  }
});

adminRouter.get("/export/leads.csv", async (_req, res) => {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });
  const csv = toCsv(
    leads.map((lead) => ({
      id: lead.id,
      orgId: lead.orgId || "",
      name: lead.name,
      business: lead.business,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      source: lead.source,
      createdAt: lead.createdAt.toISOString()
    }))
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=leads.csv");
  return res.send(csv);
});

adminRouter.get("/prospects", async (req: AuthenticatedRequest, res: Response) => {
  const parsed = prospectFilterSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid filters." });
  const limit = Math.min(Number(parsed.data.limit || 100), 300);
  const page = Math.max(Number(parsed.data.page || 1), 1);
  const skip = (page - 1) * limit;
  const where: Prisma.ProspectWhereInput = {};
  if (parsed.data.status) where.status = parsed.data.status;
  if (parsed.data.orgId) where.orgId = parsed.data.orgId;
  if (parsed.data.search) {
    where.OR = [
      { name: { contains: parsed.data.search, mode: "insensitive" } },
      { business: { contains: parsed.data.search, mode: "insensitive" } },
      { email: { contains: parsed.data.search, mode: "insensitive" } },
      { phone: { contains: parsed.data.search, mode: "insensitive" } },
      { website: { contains: parsed.data.search, mode: "insensitive" } }
    ];
  }
  const [prospects, total] = await Promise.all([
    prisma.prospect.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip }),
    prisma.prospect.count({ where })
  ]);
  return res.json({ ok: true, data: { prospects, total } });
});

adminRouter.post("/prospects", async (req: AuthenticatedRequest, res) => {
  const parsed = createProspectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid prospect payload.", errors: parsed.error.flatten() });
  const prospect = await prisma.prospect.create({
    data: {
      orgId: parsed.data.orgId || null,
      name: parsed.data.name.trim(),
      business: parsed.data.business.trim(),
      email: toNullable(parsed.data.email),
      phone: toNullable(parsed.data.phone),
      website: toNullable(parsed.data.website),
      industry: toNullable(parsed.data.industry),
      city: toNullable(parsed.data.city),
      state: toNullable(parsed.data.state),
      status: parsed.data.status || "NEW",
      notes: toNullable(parsed.data.notes),
      tags: parsed.data.tags || "",
      source: "MANUAL"
    }
  });
  await writeAuditLog({
    prisma,
    orgId: prospect.orgId || undefined,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "ADMIN_PROSPECT_CREATED",
    metadata: { prospectId: prospect.id, source: prospect.source }
  });
  return res.status(201).json({ ok: true, data: { prospect } });
});

adminRouter.patch("/prospects/:id", async (req: AuthenticatedRequest, res) => {
  const parsed = updateProspectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid prospect update payload.", errors: parsed.error.flatten() });
  try {
    const prospect = await prisma.prospect.update({
      where: { id: req.params.id },
      data: {
        orgId: parsed.data.orgId === undefined ? undefined : parsed.data.orgId || null,
        name: parsed.data.name?.trim(),
        business: parsed.data.business?.trim(),
        email: parsed.data.email === undefined ? undefined : toNullable(parsed.data.email),
        phone: parsed.data.phone === undefined ? undefined : toNullable(parsed.data.phone),
        website: parsed.data.website === undefined ? undefined : toNullable(parsed.data.website),
        industry: parsed.data.industry === undefined ? undefined : toNullable(parsed.data.industry),
        city: parsed.data.city === undefined ? undefined : toNullable(parsed.data.city),
        state: parsed.data.state === undefined ? undefined : toNullable(parsed.data.state),
        notes: parsed.data.notes === undefined ? undefined : toNullable(parsed.data.notes),
        tags: parsed.data.tags,
        status: parsed.data.status,
        source: parsed.data.source,
        score: parsed.data.score === undefined ? undefined : parsed.data.score,
        scoreReason: parsed.data.scoreReason === undefined ? undefined : toNullable(parsed.data.scoreReason)
      }
    });
    await writeAuditLog({
      prisma,
      orgId: prospect.orgId || undefined,
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "ADMIN_PROSPECT_UPDATED",
      metadata: { prospectId: prospect.id, fields: Object.keys(parsed.data) }
    });
    return res.json({ ok: true, data: { prospect } });
  } catch {
    return res.status(404).json({ ok: false, message: "Prospect not found." });
  }
});

adminRouter.delete("/prospects/:id", async (req: AuthenticatedRequest, res) => {
  if (!verifyDeletePassword(req, res)) return;
  try {
    const prospect = await prisma.prospect.delete({ where: { id: req.params.id } });
    await writeAuditLog({
      prisma,
      orgId: prospect.orgId || undefined,
      actorUserId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "ADMIN_PROSPECT_DELETED",
      metadata: { prospectId: prospect.id }
    });
    return res.json({ ok: true, data: { id: prospect.id } });
  } catch {
    return res.status(404).json({ ok: false, message: "Prospect not found." });
  }
});

adminRouter.post("/prospects/import-csv", async (req: AuthenticatedRequest, res) => {
  const parsed = importProspectsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid import payload.", errors: parsed.error.flatten() });
  const rows = parseCsvRows(parsed.data.csv);
  if (!rows.length) return res.status(400).json({ ok: false, message: "CSV must include header and at least one row." });

  const created = [];
  for (const row of rows) {
    if (!row.name || !row.business) continue;
    const prospect = await prisma.prospect.create({
      data: {
        orgId: parsed.data.orgId || null,
        name: row.name,
        business: row.business,
        email: toNullable(row.email),
        phone: toNullable(row.phone),
        website: toNullable(row.website),
        industry: toNullable(row.industry),
        city: toNullable(row.city),
        state: toNullable(row.state),
        notes: toNullable(row.notes),
        tags: row.tags || "",
        source: "CSV_IMPORT",
        status: "NEW"
      }
    });
    created.push(prospect.id);
  }
  await writeAuditLog({
    prisma,
    orgId: parsed.data.orgId || undefined,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "ADMIN_PROSPECTS_IMPORTED",
    metadata: { createdCount: created.length }
  });
  return res.json({ ok: true, data: { createdCount: created.length } });
});

adminRouter.post("/prospects/discover", async (req: AuthenticatedRequest, res) => {
  const parsed = discoverProspectsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: "Invalid discover payload.", errors: parsed.error.flatten() });
  }

  const fallbackLocation = "United States";
  const location = parsed.data.location.trim() || fallbackLocation;
  const defaultKeywords = [
    "service business",
    "local contractor",
    "home services company",
    "truck repair shop",
    "auto repair shop",
    "hvac contractor",
    "equipment repair service",
    "manufacturing service",
    "plumbing service",
    "electrical contractor",
    "locksmith service",
    "roofing contractor"
  ];
  const keywords = parsed.data.keywords?.filter((k) => k.trim().length > 1).length
    ? parsed.data.keywords.filter((k) => k.trim().length > 1)
    : defaultKeywords;
  const perKeywordLimit = Math.max(3, Math.min(15, Math.ceil(parsed.data.limit / Math.max(1, keywords.length))));
  const seen = new Set<string>();
  let createdCount = 0;
  const imported: Array<{ id: string; business: string }> = [];

  for (const keyword of keywords) {
    const places = await discoverViaNominatim(location, keyword, perKeywordLimit);
    for (const place of places) {
      const business = (place.name || place.display_name || "").split(",")[0]?.trim();
      if (!business) continue;
      const city = place.address?.city || place.address?.town || place.address?.village || "";
      const dedupeKey = `${business.toLowerCase()}|${city.toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const existing = await prisma.prospect.findFirst({
        where: {
          business: { equals: business, mode: "insensitive" },
          ...(city ? { city: { equals: city, mode: "insensitive" } } : {})
        },
        select: { id: true }
      });
      if (existing) continue;

      const website = place.extratags?.website || place.extratags?.["contact:website"] || null;
      const phone = place.extratags?.phone || place.extratags?.["contact:phone"] || null;
      const industry = deriveIndustry(keyword);

      let score = 45;
      const reasons: string[] = [];
      if (phone) {
        score += 20;
        reasons.push("has phone");
      }
      if (website) {
        score += 15;
        reasons.push("has website");
      }
      if (industry) {
        score += 10;
        reasons.push("industry matched");
      }
      score = Math.max(0, Math.min(100, score));

      const prospect = await prisma.prospect.create({
        data: {
          orgId: parsed.data.orgId || null,
          name: business,
          business,
          phone,
          website,
          city: city || null,
          state: place.address?.state || null,
          industry,
          source: "ENRICHED",
          status: score >= 75 ? "QUALIFIED" : "NEW",
          score,
          scoreReason: reasons.join(", "),
          notes: `Discovered from "${keyword}" near ${location}.`
        }
      });
      createdCount += 1;
      imported.push({ id: prospect.id, business: prospect.business });
      if (createdCount >= parsed.data.limit) break;
    }
    if (createdCount >= parsed.data.limit) break;
  }

  await writeAuditLog({
    prisma,
    orgId: parsed.data.orgId || undefined,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "ADMIN_PROSPECTS_DISCOVERED",
    metadata: { createdCount, location, keywordCount: keywords.length }
  });

  return res.json({
    ok: true,
    data: {
      createdCount,
      imported,
      locationUsed: location,
      keywordCount: keywords.length
    }
  });
});

adminRouter.post("/prospects/:id/score", async (req: AuthenticatedRequest, res) => {
  const prospect = await prisma.prospect.findUnique({ where: { id: req.params.id } });
  if (!prospect) return res.status(404).json({ ok: false, message: "Prospect not found." });

  let score = 45;
  const reasons: string[] = [];
  if (prospect.phone) {
    score += 20;
    reasons.push("has phone");
  }
  if (prospect.email) {
    score += 15;
    reasons.push("has email");
  }
  if (prospect.website) {
    score += 10;
    reasons.push("has website");
  }
  if (prospect.industry) {
    score += 10;
    reasons.push("industry known");
  }
  if (prospect.orgId) {
    score += 5;
    reasons.push("mapped to org");
  }
  score = Math.max(0, Math.min(100, score));

  const updated = await prisma.prospect.update({
    where: { id: prospect.id },
    data: {
      score,
      scoreReason: reasons.join(", "),
      status: score >= 75 ? "QUALIFIED" : prospect.status
    }
  });
  await writeAuditLog({
    prisma,
    orgId: updated.orgId || undefined,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "ADMIN_PROSPECT_SCORED",
    metadata: { prospectId: updated.id, score: updated.score }
  });
  return res.json({ ok: true, data: { prospect: updated } });
});

adminRouter.post("/prospects/:id/convert-to-lead", async (req: AuthenticatedRequest, res) => {
  const prospect = await prisma.prospect.findUnique({ where: { id: req.params.id } });
  if (!prospect) return res.status(404).json({ ok: false, message: "Prospect not found." });

  const lead = await prisma.lead.create({
    data: {
      orgId: prospect.orgId || null,
      name: prospect.name,
      business: prospect.business,
      email: prospect.email || "unknown@example.com",
      phone: prospect.phone || "unknown",
      industry: prospect.industry,
      message: prospect.notes,
      sourcePage: "/admin/prospects",
      source: "WEB_FORM",
      status: "NEW",
      tags: prospect.tags || ""
    }
  });

  const updatedProspect = await prisma.prospect.update({
    where: { id: prospect.id },
    data: {
      status: "CONTACTED",
      notes: `${prospect.notes ? `${prospect.notes}\n` : ""}Converted to lead ${lead.id} on ${new Date().toISOString()}`
    }
  });
  await writeAuditLog({
    prisma,
    orgId: updatedProspect.orgId || undefined,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "ADMIN_PROSPECT_CONVERTED",
    metadata: { prospectId: updatedProspect.id, leadId: lead.id }
  });

  return res.json({ ok: true, data: { lead, prospect: updatedProspect } });
});

adminRouter.get("/orgs", async (_req, res) => {
  const orgs = await prisma.organization.findMany({
    include: {
      users: { select: { id: true, email: true, role: true } },
      subscriptions: true,
      onboardingSubmissions: { orderBy: { updatedAt: "desc" }, take: 1 },
      phoneNumbers: true,
      aiAgentConfigs: { orderBy: { updatedAt: "desc" }, take: 1 },
      provisioningChecklist: true
    },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ ok: true, data: { orgs } });
});

adminRouter.get("/events", async (req, res) => {
  const parsed = eventsFilterSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid event filters." });
  const limit = Math.min(Number(parsed.data.limit || 150), 500);
  const from = parseIsoDate(parsed.data.from);
  const to = parseIsoDate(parsed.data.to);
  const where: Prisma.AuditLogWhereInput = {};
  if (parsed.data.orgId) where.orgId = parsed.data.orgId;
  if (parsed.data.action) where.action = parsed.data.action;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }
  const events = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit
  });
  return res.json({ ok: true, data: { events } });
});

adminRouter.get("/vapi/resources", async (_req, res) => {
  if (!env.VAPI_API_KEY) {
    return res.json({
      ok: true,
      data: {
        configured: false,
        assistants: [],
        phoneNumbers: []
      }
    });
  }

  try {
    const headers = { Authorization: `Bearer ${env.VAPI_API_KEY}` };
    const [assistantsRes, phoneNumbersRes] = await Promise.all([
      fetch("https://api.vapi.ai/assistant", { headers }),
      fetch("https://api.vapi.ai/phone-number", { headers })
    ]);

    const assistantsJson = assistantsRes.ok ? await assistantsRes.json() : [];
    const phoneNumbersJson = phoneNumbersRes.ok ? await phoneNumbersRes.json() : [];

    const assistants = normalizeVapiList(assistantsJson)
      .map((item) => ({
        id: String(item.id || ""),
        name: String(item.name || "Untitled Assistant")
      }))
      .filter((item) => item.id);

    const phoneNumbers = normalizeVapiList(phoneNumbersJson)
      .map((item) => ({
        id: String(item.id || ""),
        number: String(item.number || item.phoneNumber || ""),
        provider: String(item.provider || "")
      }))
      .filter((item) => item.id || item.number);

    return res.json({
      ok: true,
      data: {
        configured: true,
        assistants,
        phoneNumbers
      }
    });
  } catch (error) {
    return res.json({
      ok: true,
      data: {
        configured: false,
        assistants: [],
        phoneNumbers: [],
        error: error instanceof Error ? error.message : "Failed to load Vapi resources."
      }
    });
  }
});

adminRouter.post("/system/backfill-vapi-calls", async (req: AuthenticatedRequest, res) => {
  const result = await backfillMissedVapiCalls(prisma, req.auth!.userId);
  return res.json({
    ok: true,
    data: result
  });
});

adminRouter.get("/orgs/:id", async (req, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.params.id },
    include: {
      users: { select: { id: true, email: true, role: true, createdAt: true } },
      subscriptions: true,
      onboardingSubmissions: { orderBy: { updatedAt: "desc" }, take: 1 },
      phoneNumbers: true,
      aiAgentConfigs: { orderBy: { updatedAt: "desc" }, take: 1 },
      leads: { orderBy: { createdAt: "desc" }, take: 25 },
      callLogs: { orderBy: { startedAt: "desc" }, take: 25 },
      messageThreads: {
        where: { channel: "SMS" },
        orderBy: { lastMessageAt: "desc" },
        take: 40,
        include: {
          lead: { select: { id: true, name: true, business: true, phone: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 20 }
        }
      },
      provisioningChecklist: true,
      businessSettings: true
    }
  });
  if (!org) return res.status(404).json({ ok: false, message: "Organization not found." });
  const checklistSteps = org.provisioningChecklist?.stepsJson
    ? JSON.parse(org.provisioningChecklist.stepsJson)
    : getDefaultChecklistSteps();
  return res.json({ ok: true, data: { org: { ...org, checklistSteps } } });
});

adminRouter.get("/orgs/:id/readiness", async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
  if (!org) return res.status(404).json({ ok: false, message: "Organization not found." });
  const report = await computeReadinessReport({
    prisma,
    org,
    env: { VAPI_TOOL_SECRET: env.VAPI_TOOL_SECRET }
  });
  return res.json({ ok: true, data: report });
});

adminRouter.get("/orgs/:id/health", async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
  if (!org) return res.status(404).json({ ok: false, message: "Organization not found." });
  const health = await computeOrgHealth({
    prisma,
    org,
    env: { VAPI_TOOL_SECRET: env.VAPI_TOOL_SECRET }
  });
  return res.json({ ok: true, data: health });
});

adminRouter.get("/orgs/:id/messages", async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!org) return res.status(404).json({ ok: false, message: "Organization not found." });

  const threads = await prisma.messageThread.findMany({
    where: { orgId: req.params.id, channel: "SMS" },
    include: {
      lead: { select: { id: true, name: true, business: true, phone: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 40 }
    },
    orderBy: { lastMessageAt: "desc" },
    take: 200
  });

  return res.json({ ok: true, data: { threads } });
});

adminRouter.post("/orgs/:id/config-package/generate", async (req: AuthenticatedRequest, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
  if (!org) return res.status(404).json({ ok: false, message: "Organization not found." });
  const configPackage = await generateConfigPackage({
    prisma,
    orgId: req.params.id,
    generatedByUserId: req.auth?.userId
  });
  await ensureDefaultTestScenarios(prisma, req.params.id);
  await writeAuditLog({
    prisma,
    orgId: req.params.id,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "CONFIG_PACKAGE_GENERATED",
    metadata: { version: configPackage.version }
  });
  return res.json({ ok: true, data: { configPackage } });
});

adminRouter.get("/orgs/:id/config-package", async (req, res) => {
  const configPackage = await prisma.configPackage.findUnique({ where: { orgId: req.params.id } });
  return res.json({ ok: true, data: { configPackage } });
});

adminRouter.get("/orgs/:id/config-package/versions", async (req, res) => {
  const versions = await prisma.configPackageVersion.findMany({
    where: { orgId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return res.json({ ok: true, data: { versions } });
});

adminRouter.post("/orgs/:id/config-package/versions/:versionId/revert", async (req: AuthenticatedRequest, res) => {
  const target = await prisma.configPackageVersion.findFirst({
    where: { id: req.params.versionId, orgId: req.params.id }
  });
  if (!target) return res.status(404).json({ ok: false, message: "Version not found." });

  const current = await prisma.configPackage.upsert({
    where: { orgId: req.params.id },
    update: {
      json: target.packageJson as Prisma.InputJsonValue,
      version: target.version + 1,
      generatedAt: new Date(),
      generatedByUserId: req.auth?.userId || null
    },
    create: {
      orgId: req.params.id,
      json: target.packageJson as Prisma.InputJsonValue,
      version: target.version + 1,
      generatedAt: new Date(),
      generatedByUserId: req.auth?.userId || null
    }
  });

  await prisma.configPackageVersion.create({
    data: {
      orgId: req.params.id,
      configPackageId: current.id,
      version: current.version,
      packageJson: current.json as Prisma.InputJsonValue,
      createdByUserId: req.auth?.userId || null
    }
  });

  await writeAuditLog({
    prisma,
    orgId: req.params.id,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "CONFIG_PACKAGE_VERSION_RESTORED",
    metadata: { versionId: target.id, restoredToVersion: current.version }
  });

  return res.json({ ok: true, data: { configPackage: current } });
});

adminRouter.get("/orgs/:id/testing", async (req, res) => {
  await ensureDefaultTestScenarios(prisma, req.params.id);
  const scenarios = await prisma.testScenario.findMany({
    where: { orgId: req.params.id },
    include: { testRuns: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "asc" }
  });
  const summary = await getTestPassSummary(prisma, req.params.id);
  return res.json({ ok: true, data: { scenarios, summary } });
});

adminRouter.post("/orgs/:id/testing/run", async (req: AuthenticatedRequest, res) => {
  const parsed = createTestRunSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid test run payload.", errors: parsed.error.flatten() });
  const scenario = await prisma.testScenario.findFirst({
    where: { id: parsed.data.scenarioId, orgId: req.params.id }
  });
  if (!scenario) return res.status(404).json({ ok: false, message: "Scenario not found." });
  const run = await prisma.testRun.create({
    data: {
      orgId: req.params.id,
      scenarioId: parsed.data.scenarioId,
      status: parsed.data.status,
      notes: parsed.data.notes || null,
      providerCallId: parsed.data.providerCallId || null
    }
  });
  await writeAuditLog({
    prisma,
    orgId: req.params.id,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "TEST_RUN_RECORDED",
    metadata: { scenarioId: parsed.data.scenarioId, status: parsed.data.status, runId: run.id }
  });
  return res.json({ ok: true, data: { run } });
});

adminRouter.patch("/orgs/:id/status", async (req: AuthenticatedRequest, res) => {
  const status = String(req.body?.status || "");
  if (!["NEW", "ONBOARDING", "SUBMITTED", "NEEDS_CHANGES", "APPROVED", "PROVISIONING", "TESTING", "LIVE", "PAUSED"].includes(status)) {
    return res.status(400).json({ ok: false, message: "Invalid status value." });
  }
  const org = await prisma.organization.update({
    where: { id: req.params.id },
    data: {
      status: status as OrganizationStatus,
      onboardingApprovedAt: status === "APPROVED" ? new Date() : undefined,
      goLiveAt: status === "LIVE" ? new Date() : undefined,
      live: status === "LIVE" ? true : status === "PAUSED" ? false : undefined
    }
  });
  await writeAuditLog({
    prisma,
    orgId: req.params.id,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "ORG_STATUS_UPDATED",
    metadata: { status }
  });
  return res.json({ ok: true, data: { org } });
});

adminRouter.post("/orgs/:id/provisioning/checklist-step", async (req: AuthenticatedRequest, res) => {
  const parsed = provisioningStepUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid checklist payload.", errors: parsed.error.flatten() });
  const checklist = await upsertChecklistStep({
    prisma,
    orgId: req.params.id,
    key: parsed.data.stepKey,
    status: parsed.data.status,
    userId: req.auth!.userId,
    notes: parsed.data.notes
  });
  await writeAuditLog({
    prisma,
    orgId: req.params.id,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "PROVISIONING_STEP_UPDATED",
    metadata: parsed.data
  });
  return res.json({ ok: true, data: { checklist } });
});

adminRouter.post("/orgs/:id/provisioning/approve-onboarding", async (req: AuthenticatedRequest, res) => {
  await prisma.organization.update({
    where: { id: req.params.id },
    data: { status: "APPROVED", onboardingApprovedAt: new Date() }
  });
  await prisma.onboardingSubmission.updateMany({
    where: { orgId: req.params.id },
    data: { status: "APPROVED", reviewedAt: new Date() }
  });
  await upsertChecklistStep({
    prisma,
    orgId: req.params.id,
    key: "onboarding_approved",
    status: "DONE",
    userId: req.auth!.userId
  });
  await ensureDefaultTestScenarios(prisma, req.params.id);
  await writeAuditLog({
    prisma,
    orgId: req.params.id,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "ORG_APPROVED"
  });
  return res.json({ ok: true });
});

adminRouter.post("/orgs/:id/provisioning/sync-business-settings", async (req: AuthenticatedRequest, res) => {
  const latestSubmission = await prisma.onboardingSubmission.findFirst({
    where: { orgId: req.params.id },
    orderBy: { submittedAt: "desc" }
  });
  if (!latestSubmission?.answersJson) {
    return res.status(404).json({ ok: false, message: "No onboarding submission found for this organization." });
  }

  let answers: Record<string, unknown>;
  try {
    answers = JSON.parse(latestSubmission.answersJson) as Record<string, unknown>;
  } catch {
    return res.status(400).json({ ok: false, message: "Latest onboarding answers are invalid JSON." });
  }

  const configPackage = buildConfigPackage(answers);
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
  const fallback =
    transfer.fallback && typeof transfer.fallback === "object" ? (transfer.fallback as Record<string, unknown>) : {};
  const fallbackTo = String(fallback.toNumber || "").trim();
  const transferNumbersWithFallback = Array.from(new Set([...(transferNumbers || []), ...(fallbackTo ? [fallbackTo] : [])]));
  const notifications = (configPackage.notifications as Record<string, unknown>) || {};
  const services = (configPackage.services as Record<string, unknown>) || {};

  const settings = await prisma.businessSettings.upsert({
    where: { orgId: req.params.id },
    update: {
      timezone: timezoneValue,
      hoursJson: JSON.stringify({ timezone: timezoneValue, schedule }),
      afterHoursMode: afterHoursModeValue,
      transferNumbersJson: JSON.stringify(transferNumbersWithFallback),
      servicesJson: JSON.stringify((services.offered as unknown[]) || []),
      policiesJson: JSON.stringify(configPackage.policies || {}),
      notificationEmailsJson: JSON.stringify((notifications.emails as unknown[]) || []),
      notificationPhonesJson: JSON.stringify((notifications.phones as unknown[]) || [])
    },
    create: {
      orgId: req.params.id,
      timezone: timezoneValue,
      hoursJson: JSON.stringify({ timezone: timezoneValue, schedule }),
      afterHoursMode: afterHoursModeValue,
      transferNumbersJson: JSON.stringify(transferNumbersWithFallback),
      servicesJson: JSON.stringify((services.offered as unknown[]) || []),
      policiesJson: JSON.stringify(configPackage.policies || {}),
      notificationEmailsJson: JSON.stringify((notifications.emails as unknown[]) || []),
      notificationPhonesJson: JSON.stringify((notifications.phones as unknown[]) || [])
    }
  });

  await upsertChecklistStep({
    prisma,
    orgId: req.params.id,
    key: "business_settings_confirmed",
    status: "DONE",
    userId: req.auth!.userId
  });
  await writeAuditLog({
    prisma,
    orgId: req.params.id,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "BUSINESS_SETTINGS_SYNCED_FROM_ONBOARDING",
    metadata: {
      onboardingSubmissionId: latestSubmission.id,
      timezone: timezoneValue,
      afterHoursMode: afterHoursModeValue
    }
  });

  return res.json({ ok: true, data: { settings } });
});

adminRouter.post("/orgs/:id/provisioning/generate-ai-config", async (req: AuthenticatedRequest, res) => {
  const [configPackageRecord, settings, knowledgeFiles] = await Promise.all([
    generateConfigPackage({
      prisma,
      orgId: req.params.id,
      generatedByUserId: req.auth?.userId
    }),
    prisma.businessSettings.findUnique({ where: { orgId: req.params.id } }),
    prisma.organizationKnowledgeFile.findMany({
      where: { orgId: req.params.id },
      orderBy: { createdAt: "desc" },
      select: { fileName: true, contentText: true }
    })
  ]);
  await ensureDefaultTestScenarios(prisma, req.params.id);
  const configPackage = (configPackageRecord.json || {}) as Record<string, unknown>;
  const businessSettings = settings
    ? {
        timezone: settings.timezone,
        hoursJson: settings.hoursJson,
        transferNumbersJson: settings.transferNumbersJson,
        languagesJson: settings.languagesJson
      }
    : {};
  const systemPrompt = `${buildVapiSystemPrompt(configPackage, businessSettings)}${buildKnowledgeContextSnippet(knowledgeFiles)}`;
  const tools = buildVapiTools(env.API_BASE_URL).map((tool) => ({
    ...tool,
    constraints: {
      requireOrgId: true,
      requireCallIdWhenAvailable: true
    }
  }));
  const intakeSchema =
    ((configPackage as Record<string, unknown>).intake as Record<string, unknown>)?.requiredFields || [];
  const transferRules = (configPackage as Record<string, unknown>).transfer || {};

  const ai = await prisma.aiAgentConfig.upsert({
    where: { orgId: req.params.id },
    update: {
      provider: "VAPI",
      systemPrompt,
      toolsJson: JSON.stringify(tools),
      intakeSchemaJson: JSON.stringify(intakeSchema),
      transferRulesJson: JSON.stringify(transferRules),
      status: "DRAFT"
    },
    create: {
      orgId: req.params.id,
      provider: "VAPI",
      systemPrompt,
      toolsJson: JSON.stringify(tools),
      intakeSchemaJson: JSON.stringify(intakeSchema),
      transferRulesJson: JSON.stringify(transferRules),
      status: "DRAFT"
    }
  });
  await snapshotAiConfigVersion({
    orgId: req.params.id,
    aiConfigId: ai.id,
    createdByUserId: req.auth?.userId
  });

  await upsertChecklistStep({
    prisma,
    orgId: req.params.id,
    key: "business_settings_confirmed",
    status: "DONE",
    userId: req.auth!.userId
  });
  await writeAuditLog({
    prisma,
    orgId: req.params.id,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "AI_PROMPT_GENERATED",
    metadata: { aiConfigId: ai.id, configVersion: configPackageRecord.version }
  });
  return res.json({ ok: true, data: { ai } });
});

adminRouter.post("/orgs/:id/twilio/assign-number", async (req: AuthenticatedRequest, res) => {
  const providerRaw = String(req.body?.provider || "").trim().toUpperCase();
  const provider = providerRaw === "VAPI" ? NumberProvider.VAPI : NumberProvider.TWILIO;
  const autoPurchase = Boolean(req.body?.autoPurchase);
  const areaCode = String(req.body?.areaCode || "").trim() || undefined;
  let e164Number = normalizePhoneE164(String(req.body?.e164Number || ""));
  let twilioPhoneSid = String(req.body?.twilioPhoneSid || "").trim() || null;
  const friendlyName = String(req.body?.friendlyName || "").trim() || null;

  if (provider === NumberProvider.TWILIO && autoPurchase && !e164Number) {
    const voiceWebhookUrl = `${env.API_BASE_URL}/api/twilio/voice`;
    const smsWebhookUrl = `${env.API_BASE_URL}/api/twilio/sms`;
    const purchased = await provisionNumber({
      areaCode,
      sms: false,
      voiceWebhookUrl,
      smsWebhookUrl
    });
    e164Number = purchased.phoneNumber;
    twilioPhoneSid = purchased.sid;
  }

  if (!e164Number) return res.status(400).json({ ok: false, message: "e164Number is required unless Twilio auto-purchase is enabled." });

  const phoneNumber = await prisma.phoneNumber.upsert({
    where: { e164Number },
    update: { orgId: req.params.id, provider, twilioPhoneSid, friendlyName, status: "ACTIVE" },
    create: { orgId: req.params.id, provider, e164Number, twilioPhoneSid, friendlyName, status: "ACTIVE" }
  });
  await prisma.organization.update({ where: { id: req.params.id }, data: { status: "PROVISIONING" } });
  await upsertChecklistStep({
    prisma,
    orgId: req.params.id,
    key: "twilio_number_assigned",
    status: "DONE",
    userId: req.auth!.userId
  });
  await writeAuditLog({
    prisma,
    orgId: req.params.id,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "NUMBER_ASSIGNED",
    metadata: { e164Number, provider, autoPurchase, areaCode: areaCode || null }
  });
  return res.json({ ok: true, data: { phoneNumber } });
});

adminRouter.patch("/orgs/:id/ai/config", async (req: AuthenticatedRequest, res) => {
  const parsed = updateAiConfigSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid AI config payload.", errors: parsed.error.flatten() });
  const payload = {
    provider: "VAPI" as const,
    vapiAgentId: parsed.data.vapiAgentId ?? undefined,
    vapiPhoneNumberId: parsed.data.vapiPhoneNumberId ?? undefined,
    agentId: parsed.data.vapiAgentId ?? undefined,
    voice: parsed.data.voice ?? undefined,
    model: parsed.data.model ?? undefined,
    temperature: parsed.data.temperature ?? undefined,
    systemPrompt: parsed.data.systemPrompt ?? undefined,
    toolsJson: parsed.data.toolsJson ?? undefined,
    intakeSchemaJson: parsed.data.intakeSchemaJson ?? undefined,
    transferRulesJson: parsed.data.transferRulesJson ?? undefined,
    status: parsed.data.status || ("ACTIVE" as const)
  };
  const existing = await prisma.aiAgentConfig.findFirst({ where: { orgId: req.params.id } });
  const ai = existing
    ? await prisma.aiAgentConfig.update({ where: { id: existing.id }, data: payload })
    : await prisma.aiAgentConfig.create({ data: { orgId: req.params.id, ...payload } });
  await snapshotAiConfigVersion({
    orgId: req.params.id,
    aiConfigId: ai.id,
    createdByUserId: req.auth?.userId
  });

  const vapiResult = await upsertVapiAgentIfConfigured({
    apiKey: env.VAPI_API_KEY,
    agentId: ai.vapiAgentId,
    payload: {
      name: `Khan Automation - ${req.params.id}`,
      model: ai.model || "gpt-4o-mini",
      voice: ai.voice || "alloy",
      systemPrompt: ai.systemPrompt || "",
      tools: ai.toolsJson ? JSON.parse(ai.toolsJson) : []
    }
  }).catch((error) => ({ skipped: true as const, reason: error instanceof Error ? error.message : "Unknown Vapi error" }));

  await upsertChecklistStep({
    prisma,
    orgId: req.params.id,
    key: "vapi_agent_configured",
    status: "DONE",
    userId: req.auth!.userId
  });
  await writeAuditLog({
    prisma,
    orgId: req.params.id,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "VAPI_CONFIG_UPDATED",
    metadata: { aiConfigId: ai.id, vapiResult }
  });
  return res.json({ ok: true, data: { ai, vapiResult } });
});

adminRouter.get("/orgs/:id/ai-config/versions", async (req, res) => {
  const versions = await prisma.aiAgentConfigVersion.findMany({
    where: { orgId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return res.json({ ok: true, data: { versions } });
});

adminRouter.post("/orgs/:id/ai-config/versions/:versionId/revert", async (req: AuthenticatedRequest, res) => {
  const target = await prisma.aiAgentConfigVersion.findFirst({
    where: { id: req.params.versionId, orgId: req.params.id }
  });
  if (!target) return res.status(404).json({ ok: false, message: "Version not found." });

  const snapshot = target.configJson as Record<string, unknown>;
  const payload = {
    provider: String(snapshot.provider || "VAPI") as "VAPI",
    vapiAgentId: toNullable(String(snapshot.vapiAgentId || "")),
    vapiPhoneNumberId: toNullable(String(snapshot.vapiPhoneNumberId || "")),
    agentId: toNullable(String(snapshot.agentId || "")),
    apiKeyRef: toNullable(String(snapshot.apiKeyRef || "")),
    voice: toNullable(String(snapshot.voice || "")),
    model: toNullable(String(snapshot.model || "")),
    temperature: typeof snapshot.temperature === "number" ? snapshot.temperature : null,
    systemPrompt: toNullable(String(snapshot.systemPrompt || "")),
    toolsJson: toNullable(String(snapshot.toolsJson || "")),
    intakeSchemaJson: toNullable(String(snapshot.intakeSchemaJson || "")),
    toolsEnabledJson: toNullable(String(snapshot.toolsEnabledJson || "")),
    transferRulesJson: toNullable(String(snapshot.transferRulesJson || "")),
    status: String(snapshot.status || "ACTIVE") as "DRAFT" | "ACTIVE"
  };

  const ai = await prisma.aiAgentConfig.upsert({
    where: { orgId: req.params.id },
    update: payload,
    create: { orgId: req.params.id, ...payload }
  });

  await snapshotAiConfigVersion({
    orgId: req.params.id,
    aiConfigId: ai.id,
    createdByUserId: req.auth?.userId
  });

  await writeAuditLog({
    prisma,
    orgId: req.params.id,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "AI_CONFIG_VERSION_RESTORED",
    metadata: { versionId: target.id, aiConfigId: ai.id }
  });

  return res.json({ ok: true, data: { ai } });
});

adminRouter.post("/orgs/:id/provisioning/testing", async (req: AuthenticatedRequest, res) => {
  const org = await prisma.organization.update({
    where: { id: req.params.id },
    data: { status: "TESTING", live: false }
  });
  await writeAuditLog({
    prisma,
    orgId: req.params.id,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "TEST_MODE_ENABLED"
  });
  return res.json({ ok: true, data: { org } });
});

adminRouter.post("/orgs/:id/provisioning/test-complete", async (req: AuthenticatedRequest, res) => {
  const notes = String(req.body?.notes || "").trim();
  if (!notes) return res.status(400).json({ ok: false, message: "Notes are required for test completion." });
  await upsertChecklistStep({
    prisma,
    orgId: req.params.id,
    key: "test_calls_completed",
    status: "DONE",
    userId: req.auth!.userId,
    notes
  });
  await writeAuditLog({
    prisma,
    orgId: req.params.id,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "TEST_CALLS_COMPLETED",
    metadata: { notes }
  });
  return res.json({ ok: true });
});

adminRouter.post("/orgs/:id/go-live", async (req: AuthenticatedRequest, res) => {
  const orgRow = await prisma.organization.findUnique({ where: { id: req.params.id } });
  if (!orgRow) return res.status(404).json({ ok: false, message: "Organization not found." });
  const readiness = await computeReadinessReport({
    prisma,
    org: orgRow,
    env: { VAPI_TOOL_SECRET: env.VAPI_TOOL_SECRET }
  });
  if (!readiness.canGoLive) {
    const missing = Object.entries(readiness.checks)
      .filter(([, value]) => !value.ok)
      .map(([key, value]) => ({ key, reason: value.reason, fixHint: value.fixHint }));
    return res.status(400).json({
      ok: false,
      message: "Go-live readiness checks are incomplete.",
      data: { missingChecks: missing, readiness }
    });
  }
  const org = await prisma.organization.update({
    where: { id: req.params.id },
    data: { live: true, status: "LIVE", goLiveAt: new Date() }
  });
  await upsertChecklistStep({ prisma, orgId: req.params.id, key: "go_live", status: "DONE", userId: req.auth!.userId });
  await writeAuditLog({
    prisma,
    orgId: req.params.id,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "LIVE_ENABLED"
  });
  return res.json({ ok: true, data: { org } });
});

adminRouter.post("/orgs/:id/pause", async (req: AuthenticatedRequest, res) => {
  const org = await prisma.organization.update({
    where: { id: req.params.id },
    data: { live: false, status: "PAUSED" }
  });
  await writeAuditLog({
    prisma,
    orgId: req.params.id,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "ORG_PAUSED"
  });
  return res.json({ ok: true, data: { org } });
});

adminRouter.post("/orgs/:id/users/:userId/reset-password", async (req, res) => {
  const parsed = resetUserPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid password payload.", errors: parsed.error.flatten() });
  const user = await prisma.user.findFirst({ where: { id: req.params.userId, orgId: req.params.id } });
  if (!user) return res.status(404).json({ ok: false, message: "User not found for this organization." });
  if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
    return res.status(403).json({ ok: false, message: "Cannot reset admin account password from org tools." });
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  return res.json({ ok: true, data: { user: { id: user.id, email: user.email, role: user.role } } });
});

adminRouter.post("/system/clear-data", async (req: AuthenticatedRequest, res) => {
  const parsed = clearAllDataSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: "Invalid clear-data payload.", errors: parsed.error.flatten() });
  }

  if (parsed.data.confirmationText.trim() !== "DELETE ALL DATA") {
    return res.status(400).json({ ok: false, message: 'Confirmation text must be exactly "DELETE ALL DATA".' });
  }

  const actor = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!actor) return res.status(404).json({ ok: false, message: "Admin user not found." });

  const passwordOk = await bcrypt.compare(parsed.data.password, actor.passwordHash);
  if (!passwordOk) return res.status(401).json({ ok: false, message: "Invalid admin password." });

  const result = await prisma.$transaction(async (tx) => {
    const deleted = {
      callLogs: 0,
      calls: 0,
      leads: 0,
      organizations: 0,
      clients: 0,
      subscriptions: 0,
      users: 0
    };

    deleted.callLogs = (await tx.callLog.deleteMany({})).count;
    deleted.calls = (await tx.call.deleteMany({})).count;
    deleted.leads = (await tx.lead.deleteMany({})).count;
    deleted.subscriptions = (await tx.subscription.deleteMany({})).count;
    await tx.provisioningChecklist.deleteMany({});
    await tx.businessSettings.deleteMany({});
    await tx.onboardingSubmission.deleteMany({});
    await tx.phoneNumber.deleteMany({});
    await tx.aiAgentConfig.deleteMany({});
    await tx.setting.deleteMany({});
    await tx.aIConfig.deleteMany({});
    await tx.phoneLine.deleteMany({});
    deleted.clients = (await tx.client.deleteMany({})).count;
    deleted.organizations = (await tx.organization.deleteMany({})).count;
    await tx.loginChallenge.deleteMany({});
    deleted.users = (
      await tx.user.deleteMany({
        where: {
          role: { in: [UserRole.CLIENT, UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF] }
        }
      })
    ).count;

    await tx.auditLog.create({
      data: {
        actorUserId: req.auth!.userId,
        actorRole: req.auth!.role,
        action: "SYSTEM_DATA_CLEARED",
        metadataJson: JSON.stringify(deleted)
      }
    });

    return deleted;
  });

  return res.json({ ok: true, data: { deleted: result } });
});

// Legacy client-based endpoints preserved for compatibility.
adminRouter.get("/clients", async (_req, res) => {
  const clients = await prisma.client.findMany({
    include: { subscriptions: true, phoneLine: true },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ ok: true, data: { clients } });
});

adminRouter.get("/clients/:id", async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: { subscriptions: true, setting: true, aiConfig: true, phoneLine: true }
  });
  if (!client) return res.status(404).json({ ok: false, message: "Client not found." });
  return res.json({ ok: true, data: { client } });
});

adminRouter.patch("/clients/:id/status", async (req, res) => {
  const parsed = updateClientStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid status payload." });
  const client = await prisma.client.update({
    where: { id: req.params.id },
    data: { status: parsed.data.status }
  });
  return res.json({ ok: true, data: { client } });
});
