import bcrypt from "bcryptjs";
import { NumberProvider, OrganizationStatus, Prisma, UserRole } from "@prisma/client";
import { Router, type Response } from "express";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { requireAnyRole, requireAuth, type AuthenticatedRequest } from "../../middleware/require-auth";
import { toCsv } from "../../utils/csv";
import { buildVapiSystemPrompt, buildVapiTools, upsertVapiAgentIfConfigured } from "../voice/vapi/vapi.service";
import { provisionNumber } from "../twilio/twilio.service";
import {
  assignNumberSchema,
  clearAllDataSchema,
  createProspectSchema,
  discoverProspectsSchema,
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

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAnyRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]));

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
    return res.json({ ok: true, data: { lead } });
  } catch {
    return res.status(404).json({ ok: false, message: "Lead not found." });
  }
});

adminRouter.delete("/leads/:id", async (req, res) => {
  try {
    const lead = await prisma.lead.delete({ where: { id: req.params.id } });
    return res.json({ ok: true, data: { id: lead.id } });
  } catch {
    return res.status(404).json({ ok: false, message: "Lead not found." });
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
    return res.json({ ok: true, data: { prospect } });
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
    return res.status(502).json({
      ok: false,
      message: error instanceof Error ? `Failed to load Vapi resources: ${error.message}` : "Failed to load Vapi resources."
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
  await writeAuditLog({
    prisma,
    orgId: req.params.id,
    actorUserId: req.auth!.userId,
    actorRole: req.auth!.role,
    action: "ORG_APPROVED"
  });
  return res.json({ ok: true });
});

adminRouter.post("/orgs/:id/provisioning/generate-ai-config", async (req: AuthenticatedRequest, res) => {
  const [submission, settings] = await Promise.all([
    prisma.onboardingSubmission.findUnique({ where: { orgId: req.params.id } }),
    prisma.businessSettings.findUnique({ where: { orgId: req.params.id } })
  ]);
  const configPackage = submission?.configPackageJson ? JSON.parse(submission.configPackageJson) : {};
  const businessSettings = settings
    ? {
        timezone: settings.timezone,
        hoursJson: settings.hoursJson,
        transferNumbersJson: settings.transferNumbersJson,
        languagesJson: settings.languagesJson
      }
    : {};
  const systemPrompt = buildVapiSystemPrompt(configPackage, businessSettings);
  const tools = buildVapiTools(env.API_BASE_URL);
  const intakeSchema = (configPackage as Record<string, unknown>).intakeSchema || [];
  const transferRules = (configPackage as Record<string, unknown>).transferRules || {};

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
    metadata: { aiConfigId: ai.id }
  });
  return res.json({ ok: true, data: { ai } });
});

adminRouter.post("/orgs/:id/twilio/assign-number", async (req: AuthenticatedRequest, res) => {
  const providerRaw = String(req.body?.provider || "").trim().toUpperCase();
  const provider = providerRaw === "VAPI" ? NumberProvider.VAPI : NumberProvider.TWILIO;
  const autoPurchase = Boolean(req.body?.autoPurchase);
  const areaCode = String(req.body?.areaCode || "").trim() || undefined;
  let e164Number = String(req.body?.e164Number || "").trim();
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
  const [phone, ai] = await Promise.all([
    prisma.phoneNumber.findFirst({ where: { orgId: req.params.id, status: "ACTIVE" } }),
    prisma.aiAgentConfig.findFirst({ where: { orgId: req.params.id, status: "ACTIVE" } })
  ]);
  if (!phone || !ai) {
    return res.status(400).json({ ok: false, message: "Go-live checklist incomplete. Need active phone number and active AI config." });
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
