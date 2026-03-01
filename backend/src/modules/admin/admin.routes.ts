import { Prisma, UserRole } from "@prisma/client";
import { Router, type Response } from "express";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../../middleware/require-auth";
import { toCsv } from "../../utils/csv";
import {
  assignNumberSchema,
  leadFilterSchema,
  updateAiConfigSchema,
  updateClientStatusSchema,
  updateLeadSchema
} from "./admin.schema";
import { configureWebhooks, provisionNumber, releaseNumber } from "../twilio/twilio.service";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(UserRole.ADMIN));

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
