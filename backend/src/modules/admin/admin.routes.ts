import bcrypt from "bcryptjs";
import { OrganizationStatus, Prisma, UserRole } from "@prisma/client";
import { Router, type Response } from "express";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { requireAnyRole, requireAuth, type AuthenticatedRequest } from "../../middleware/require-auth";
import { toCsv } from "../../utils/csv";
import { buildVapiSystemPrompt, buildVapiTools, upsertVapiAgentIfConfigured } from "../voice/vapi/vapi.service";
import {
  assignNumberSchema,
  leadFilterSchema,
  provisioningStepUpdateSchema,
  resetUserPasswordSchema,
  updateAiConfigSchema,
  updateClientStatusSchema,
  updateLeadSchema
} from "./admin.schema";
import { getDefaultChecklistSteps, upsertChecklistStep, writeAuditLog } from "./provisioning.service";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAnyRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]));

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
  const e164Number = String(req.body?.e164Number || "").trim();
  const twilioPhoneSid = String(req.body?.twilioPhoneSid || "").trim() || null;
  const friendlyName = String(req.body?.friendlyName || "").trim() || null;
  if (!e164Number) return res.status(400).json({ ok: false, message: "e164Number is required." });

  const phoneNumber = await prisma.phoneNumber.upsert({
    where: { e164Number },
    update: { orgId: req.params.id, twilioPhoneSid, friendlyName, status: "ACTIVE" },
    create: { orgId: req.params.id, e164Number, twilioPhoneSid, friendlyName, status: "ACTIVE" }
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
    metadata: { e164Number }
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
