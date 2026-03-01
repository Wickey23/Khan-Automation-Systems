import { Router, type Request, type Response } from "express";
import { createLeadSchema } from "./lead.schema";
import { prisma } from "../../lib/prisma";
import { sendLeadNotificationEmail } from "../../services/email";

export const leadRouter = Router();

leadRouter.post("/", async (req: Request, res: Response) => {
  const parsed = createLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: "Invalid lead payload.",
      errors: parsed.error.flatten()
    });
  }

  try {
    const ipHeader = req.headers["x-forwarded-for"];
    const ip = Array.isArray(ipHeader) ? ipHeader[0] : ipHeader?.split(",")[0]?.trim() || req.ip;
    const userAgent = req.headers["user-agent"] || null;

    const lead = await prisma.lead.create({
      data: {
        ...parsed.data,
        orgId: parsed.data.orgId || null,
        source: parsed.data.source || "WEB_FORM",
        ip,
        userAgent
      }
    });

    try {
      await sendLeadNotificationEmail({
        leadId: lead.id,
        name: lead.name,
        business: lead.business,
        phone: lead.phone,
        email: lead.email,
        sourcePage: lead.sourcePage,
        adminUrl: process.env.ALLOWED_ORIGIN || "http://localhost:3000"
      });
    } catch (notifyError) {
      // eslint-disable-next-line no-console
      console.error("Lead notification failed", notifyError);
    }

    return res.status(201).json({
      ok: true,
      data: { leadId: lead.id }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Lead create failed", error);
    return res.status(500).json({ ok: false, message: "Could not create lead." });
  }
});
