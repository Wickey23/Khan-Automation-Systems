import { Router, type Request, type Response } from "express";
import { createLeadSchema } from "./lead.schema";
import { prisma } from "../../lib/prisma";
import { sendClientWelcomeEmail, sendLeadNotificationEmail } from "../../services/email";
import bcrypt from "bcryptjs";
import { ClientStatus, OrganizationStatus, UserRole } from "@prisma/client";
import { env } from "../../config/env";

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
    let resolvedOrgId = parsed.data.orgId || null;
    let accountCreated = false;

    const shouldCreateAccount = parsed.data.createAccount !== false;
    if (shouldCreateAccount) {
      const email = parsed.data.email.toLowerCase();
      const existingUser = await prisma.user.findUnique({ where: { email } });

      if (existingUser?.orgId) {
        resolvedOrgId = existingUser.orgId;
      } else {
        const org = await prisma.organization.create({
          data: {
            name: parsed.data.business,
            industry: parsed.data.industry || null,
            status: OrganizationStatus.ONBOARDING,
            live: false
          }
        });

        const client = await prisma.client.create({
          data: {
            name: parsed.data.business,
            industry: parsed.data.industry || null,
            status: ClientStatus.NEEDS_CONFIGURATION
          }
        });

        await prisma.setting.create({
          data: {
            clientId: client.id,
            transferNumber: ""
          }
        });

        await prisma.aIConfig.create({
          data: {
            clientId: client.id,
            testMode: true,
            smsEnabled: false
          }
        });

        await prisma.onboardingSubmission.upsert({
          where: { orgId: org.id },
          update: {},
          create: {
            orgId: org.id,
            status: "DRAFT",
            answersJson: "{}"
          }
        });

        if (existingUser) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              role: UserRole.CLIENT_ADMIN,
              orgId: org.id,
              clientId: existingUser.clientId || client.id
            }
          });
        } else {
          const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
          const passwordHash = await bcrypt.hash(tempPassword, 12);
          await prisma.user.create({
            data: {
              email,
              passwordHash,
              role: UserRole.CLIENT_ADMIN,
              orgId: org.id,
              clientId: client.id
            }
          });
          try {
            await sendClientWelcomeEmail({
              email,
              tempPassword,
              appUrl: env.FRONTEND_APP_URL
            });
          } catch (welcomeError) {
            // eslint-disable-next-line no-console
            console.error("Welcome email failed", welcomeError);
          }
        }

        resolvedOrgId = org.id;
        accountCreated = true;
      }
    }

    const lead = await prisma.lead.create({
      data: {
        ...parsed.data,
        orgId: resolvedOrgId,
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
      data: { leadId: lead.id, accountCreated }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Lead create failed", error);
    return res.status(500).json({ ok: false, message: "Could not create lead." });
  }
});
