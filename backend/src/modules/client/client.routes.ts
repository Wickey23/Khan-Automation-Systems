import { UserRole } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../../middleware/require-auth";
import { sendLeadNotificationEmail } from "../../services/email";
import { supportSchema, updateSettingSchema } from "./client.schema";

export const clientRouter = Router();

clientRouter.use(requireAuth, requireRole(UserRole.CLIENT));

clientRouter.get("/me", async (req: AuthenticatedRequest, res) => {
  const clientId = req.auth?.clientId;
  if (!clientId) return res.status(400).json({ ok: false, message: "No client workspace assigned." });

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { setting: true, phoneLine: true, subscriptions: true }
  });
  if (!client) return res.status(404).json({ ok: false, message: "Client not found." });

  return res.json({ ok: true, data: { client } });
});

clientRouter.get("/calls", async (req: AuthenticatedRequest, res) => {
  const clientId = req.auth?.clientId;
  if (!clientId) return res.status(400).json({ ok: false, message: "No client workspace assigned." });
  const calls = await prisma.call.findMany({ where: { clientId }, orderBy: { startedAt: "desc" } });
  return res.json({ ok: true, data: { calls } });
});

clientRouter.get("/leads", async (req: AuthenticatedRequest, res) => {
  const clientId = req.auth?.clientId;
  if (!clientId) return res.status(400).json({ ok: false, message: "No client workspace assigned." });
  const leads = await prisma.lead.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } });
  return res.json({ ok: true, data: { leads } });
});

clientRouter.patch("/settings", async (req: AuthenticatedRequest, res) => {
  const clientId = req.auth?.clientId;
  if (!clientId) return res.status(400).json({ ok: false, message: "No client workspace assigned." });
  const parsed = updateSettingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid settings payload." });

  const { name, ...settingData } = parsed.data;

  if (name) {
    await prisma.client.update({ where: { id: clientId }, data: { name } });
  }

  const setting = await prisma.setting.upsert({
    where: { clientId },
    update: settingData,
    create: {
      clientId,
      ...settingData,
      transferNumber: settingData.transferNumber || ""
    }
  });

  return res.json({ ok: true, data: { setting } });
});

clientRouter.post("/support", async (req: AuthenticatedRequest, res) => {
  const clientId = req.auth?.clientId;
  if (!clientId) return res.status(400).json({ ok: false, message: "No client workspace assigned." });
  const parsed = supportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid support payload." });

  const client = await prisma.client.findUnique({ where: { id: clientId } });

  await sendLeadNotificationEmail({
    leadId: `support-${Date.now()}`,
    name: req.auth?.email || "Client User",
    business: client?.name || "Client Workspace",
    phone: "-",
    email: req.auth?.email || "",
    sourcePage: "/dashboard/support",
    adminUrl: process.env.ALLOWED_ORIGIN || "http://localhost:3000"
  });

  return res.json({ ok: true });
});
