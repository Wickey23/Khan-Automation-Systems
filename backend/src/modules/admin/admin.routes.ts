import { Prisma, UserRole } from "@prisma/client";
import { Router, type Response } from "express";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { requireAnyRole, requireAuth, type AuthenticatedRequest } from "../../middleware/require-auth";
import { toCsv } from "../../utils/csv";
import {
  assignNumberSchema,
  leadFilterSchema,
  resetUserPasswordSchema,
  updateAiConfigSchema,
  updateClientStatusSchema,
  updateLeadSchema
} from "./admin.schema";
import { configureWebhooks, provisionNumber, releaseNumber } from "../twilio/twilio.service";
import bcrypt from "bcryptjs";

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
      clientId: lead.clientId || "",
      name: lead.name,
      business: lead.business,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      tags: lead.tags,
      sourcePage: lead.sourcePage || "",
      createdAt: lead.createdAt.toISOString()
    }))
  );
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=leads.csv");
  return res.send(csv);
});

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
    include: {
      subscriptions: true,
      setting: true,
      aiConfig: true,
      phoneLine: true
    }
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

adminRouter.get("/clients/:id/leads", async (req, res) => {
  const leads = await prisma.lead.findMany({
    where: { clientId: req.params.id },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ ok: true, data: { leads } });
});

adminRouter.get("/clients/:id/calls", async (req, res) => {
  const calls = await prisma.call.findMany({
    where: { clientId: req.params.id },
    orderBy: { startedAt: "desc" }
  });
  return res.json({ ok: true, data: { calls } });
});

adminRouter.get("/clients/:id/phone-line", async (req, res) => {
  const phoneLine = await prisma.phoneLine.findUnique({ where: { clientId: req.params.id } });
  return res.json({ ok: true, data: { phoneLine } });
});

adminRouter.post("/clients/:id/twilio/assign-number", async (req, res) => {
  const parsed = assignNumberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid payload." });
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ ok: false, message: "Client not found." });

  const voiceWebhookUrl = `${env.API_BASE_URL}/api/twilio/voice?clientId=${client.id}`;
  const smsWebhookUrl = `${env.API_BASE_URL}/api/twilio/sms?clientId=${client.id}`;

  try {
    const assigned = await provisionNumber({
      areaCode: parsed.data.areaCode,
      sms: parsed.data.sms,
      voiceWebhookUrl,
      smsWebhookUrl
    });

    const phoneLine = await prisma.phoneLine.upsert({
      where: { clientId: client.id },
      update: {
        provider: "TWILIO",
        phoneNumber: assigned.phoneNumber || null,
        twilioIncomingPhoneSid: assigned.sid,
        voiceWebhookUrl,
        smsWebhookUrl: parsed.data.sms ? smsWebhookUrl : null,
        capabilitiesJson: assigned.capabilitiesJson
      },
      create: {
        clientId: client.id,
        provider: "TWILIO",
        phoneNumber: assigned.phoneNumber || null,
        twilioIncomingPhoneSid: assigned.sid,
        voiceWebhookUrl,
        smsWebhookUrl: parsed.data.sms ? smsWebhookUrl : null,
        capabilitiesJson: assigned.capabilitiesJson
      }
    });

    return res.json({ ok: true, data: { phoneLine } });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Could not assign number."
    });
  }
});

adminRouter.post("/clients/:id/twilio/replace-number", async (req, res) => {
  const parsed = assignNumberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid payload." });

  const existing = await prisma.phoneLine.findUnique({ where: { clientId: req.params.id } });
  if (existing?.twilioIncomingPhoneSid) {
    try {
      await releaseNumber(existing.twilioIncomingPhoneSid);
    } catch {
      // Continue and reassign.
    }
  }

  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ ok: false, message: "Client not found." });

  const voiceWebhookUrl = `${env.API_BASE_URL}/api/twilio/voice?clientId=${client.id}`;
  const smsWebhookUrl = `${env.API_BASE_URL}/api/twilio/sms?clientId=${client.id}`;
  const assigned = await provisionNumber({
    areaCode: parsed.data.areaCode,
    sms: parsed.data.sms,
    voiceWebhookUrl,
    smsWebhookUrl
  });

  const phoneLine = await prisma.phoneLine.upsert({
    where: { clientId: client.id },
    update: {
      phoneNumber: assigned.phoneNumber || null,
      twilioIncomingPhoneSid: assigned.sid,
      voiceWebhookUrl,
      smsWebhookUrl: parsed.data.sms ? smsWebhookUrl : null,
      capabilitiesJson: assigned.capabilitiesJson
    },
    create: {
      clientId: client.id,
      provider: "TWILIO",
      phoneNumber: assigned.phoneNumber || null,
      twilioIncomingPhoneSid: assigned.sid,
      voiceWebhookUrl,
      smsWebhookUrl: parsed.data.sms ? smsWebhookUrl : null,
      capabilitiesJson: assigned.capabilitiesJson
    }
  });

  return res.json({ ok: true, data: { phoneLine } });
});

adminRouter.get("/clients/:id/ai-config", async (req, res) => {
  const aiConfig = await prisma.aIConfig.findUnique({ where: { clientId: req.params.id } });
  return res.json({ ok: true, data: { aiConfig } });
});

adminRouter.patch("/clients/:id/ai-config", async (req, res) => {
  const parsed = updateAiConfigSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid AI config payload." });
  const aiConfig = await prisma.aIConfig.upsert({
    where: { clientId: req.params.id },
    update: parsed.data,
    create: {
      clientId: req.params.id,
      ...parsed.data
    }
  });
  return res.json({ ok: true, data: { aiConfig } });
});

adminRouter.post("/clients/:id/twilio/configure-webhooks", async (req, res) => {
  const phoneLine = await prisma.phoneLine.findUnique({ where: { clientId: req.params.id } });
  if (!phoneLine?.twilioIncomingPhoneSid) {
    return res.status(404).json({ ok: false, message: "No Twilio line assigned." });
  }
  try {
    await configureWebhooks({
      sid: phoneLine.twilioIncomingPhoneSid,
      voiceWebhookUrl: phoneLine.voiceWebhookUrl || `${env.API_BASE_URL}/api/twilio/voice?clientId=${req.params.id}`,
      smsWebhookUrl: phoneLine.smsWebhookUrl
    });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed to configure webhooks."
    });
  }
});

adminRouter.get("/orgs", async (_req, res) => {
  const orgs = await prisma.organization.findMany({
    include: {
      users: { select: { id: true, email: true, role: true } },
      subscriptions: true,
      onboardingSubmissions: { orderBy: { updatedAt: "desc" }, take: 1 },
      phoneNumbers: true,
      aiAgentConfigs: { orderBy: { updatedAt: "desc" }, take: 1 }
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
      callLogs: { orderBy: { startedAt: "desc" }, take: 25 }
    }
  });
  if (!org) return res.status(404).json({ ok: false, message: "Organization not found." });
  return res.json({ ok: true, data: { org } });
});

adminRouter.patch("/orgs/:id/status", async (req, res) => {
  const status = String(req.body?.status || "");
  if (!["NEW", "ONBOARDING", "READY_FOR_REVIEW", "PROVISIONING", "LIVE", "PAUSED"].includes(status)) {
    return res.status(400).json({ ok: false, message: "Invalid status value." });
  }
  const org = await prisma.organization.update({
    where: { id: req.params.id },
    data: { status: status as any }
  });
  return res.json({ ok: true, data: { org } });
});

adminRouter.post("/orgs/:id/notes", async (req, res) => {
  const notes = String(req.body?.notes || "").trim();
  const statusValue = String(req.body?.status || "NEEDS_CHANGES");
  if (!notes) return res.status(400).json({ ok: false, message: "Notes are required." });

  const submission = await prisma.onboardingSubmission.upsert({
    where: { orgId: req.params.id },
    update: {
      notesFromAdmin: notes,
      status: (statusValue === "APPROVED" ? "APPROVED" : "NEEDS_CHANGES") as any,
      reviewedAt: new Date()
    },
    create: {
      orgId: req.params.id,
      notesFromAdmin: notes,
      status: (statusValue === "APPROVED" ? "APPROVED" : "NEEDS_CHANGES") as any,
      reviewedAt: new Date(),
      answersJson: "{}"
    }
  });
  return res.json({ ok: true, data: { submission } });
});

adminRouter.post("/orgs/:id/twilio/assign-number", async (req, res) => {
  const e164Number = String(req.body?.e164Number || "").trim();
  const twilioPhoneSid = String(req.body?.twilioPhoneSid || "").trim() || null;
  const friendlyName = String(req.body?.friendlyName || "").trim() || null;
  if (!e164Number) return res.status(400).json({ ok: false, message: "e164Number is required." });

  const phoneNumber = await prisma.phoneNumber.upsert({
    where: { e164Number },
    update: {
      orgId: req.params.id,
      twilioPhoneSid,
      friendlyName,
      status: "ACTIVE"
    },
    create: {
      orgId: req.params.id,
      e164Number,
      twilioPhoneSid,
      friendlyName,
      status: "ACTIVE"
    }
  });

  await prisma.organization.update({
    where: { id: req.params.id },
    data: { status: "PROVISIONING" }
  });

  return res.json({ ok: true, data: { phoneNumber } });
});

adminRouter.patch("/orgs/:id/ai/config", async (req, res) => {
  const payload = {
    provider: req.body?.provider || "VAPI",
    agentId: req.body?.agentId || null,
    apiKeyRef: req.body?.apiKeyRef || null,
    voice: req.body?.voice || null,
    model: req.body?.model || null,
    temperature: typeof req.body?.temperature === "number" ? req.body.temperature : null,
    systemPrompt: req.body?.systemPrompt || null,
    toolsEnabledJson: req.body?.toolsEnabledJson ? JSON.stringify(req.body.toolsEnabledJson) : null,
    transferRulesJson: req.body?.transferRulesJson ? JSON.stringify(req.body.transferRulesJson) : null,
    status: req.body?.status || "DRAFT"
  };
  const existing = await prisma.aiAgentConfig.findFirst({ where: { orgId: req.params.id } });
  const ai = existing
    ? await prisma.aiAgentConfig.update({ where: { id: existing.id }, data: payload })
    : await prisma.aiAgentConfig.create({ data: { orgId: req.params.id, ...payload } });
  return res.json({ ok: true, data: { ai } });
});

adminRouter.post("/orgs/:id/go-live", async (req, res) => {
  const [phone, ai] = await Promise.all([
    prisma.phoneNumber.findFirst({ where: { orgId: req.params.id, status: "ACTIVE" } }),
    prisma.aiAgentConfig.findFirst({ where: { orgId: req.params.id, status: "ACTIVE" } })
  ]);
  if (!phone || !ai) {
    return res.status(400).json({
      ok: false,
      message: "Go-live checklist incomplete. Need active phone number and active AI config."
    });
  }
  const org = await prisma.organization.update({
    where: { id: req.params.id },
    data: { live: true, status: "LIVE" }
  });
  return res.json({ ok: true, data: { org } });
});

adminRouter.post("/orgs/:id/pause", async (req, res) => {
  const org = await prisma.organization.update({
    where: { id: req.params.id },
    data: { live: false, status: "PAUSED" }
  });
  return res.json({ ok: true, data: { org } });
});

adminRouter.post("/orgs/:id/users/:userId/reset-password", async (req, res) => {
  const parsed = resetUserPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: "Invalid password payload.",
      errors: parsed.error.flatten()
    });
  }

  const user = await prisma.user.findFirst({
    where: {
      id: req.params.userId,
      orgId: req.params.id
    }
  });

  if (!user) return res.status(404).json({ ok: false, message: "User not found for this organization." });
  if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
    return res.status(403).json({ ok: false, message: "Cannot reset admin account password from org tools." });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash }
  });

  return res.json({
    ok: true,
    data: {
      user: { id: user.id, email: user.email, role: user.role }
    }
  });
});
