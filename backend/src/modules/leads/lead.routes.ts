import { Router, type Request, type Response } from "express";
import { createLeadSchema } from "./lead.schema";
import { prisma } from "../../lib/prisma";
import { sendClientWelcomeEmail, sendLeadNotificationEmail } from "../../services/email";
import bcrypt from "bcryptjs";
import { ClientStatus, OrganizationStatus, TeamMembershipRole, TeamMembershipStatus, UserRole } from "@prisma/client";
import { env } from "../../config/env";
import { randomUUID } from "crypto";

export const leadRouter = Router();

async function createLeadResilient(data: {
  name: string;
  business: string;
  email: string;
  phone: string;
  industry?: string;
  message?: string;
  preferredContact?: "call" | "text" | "email";
  urgency?: "this_week" | "this_month" | "exploring";
  sourcePage?: string;
  orgId?: string | null;
  source?: "WEB_FORM" | "PHONE_CALL" | "SMS";
  ip?: string | null;
  userAgent?: string | null;
}) {
  try {
    return await prisma.lead.create({
      data: {
        ...data,
        orgId: data.orgId || null,
        source: data.source || "WEB_FORM",
        ip: data.ip || null,
        userAgent: data.userAgent || null
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const isSchemaDrift =
      message.includes("column") || message.includes("p2022") || message.includes("invalid `prisma.lead.create()`");
    if (!isSchemaDrift) throw error;

    const legacyId = `lead_${Date.now()}_${randomUUID().slice(0, 8)}`;
    await prisma.$executeRaw`
      INSERT INTO "Lead"
      ("id","name","business","email","phone","industry","message","preferredContact","urgency","sourcePage","ip","userAgent","createdAt","updatedAt")
      VALUES
      (${legacyId},${data.name},${data.business},${data.email},${data.phone},${data.industry || null},${data.message || null},${data.preferredContact || null},${data.urgency || null},${data.sourcePage || null},${data.ip || null},${data.userAgent || null},NOW(),NOW())
    `;
    return { id: legacyId };
  }
}

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
      if (!parsed.data.accountPassword) {
        return res.status(400).json({
          ok: false,
          message: "Account password is required.",
          errors: { fieldErrors: { accountPassword: ["Password is required to create an account."] } }
        });
      }

      const email = parsed.data.email.toLowerCase();
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(409).json({
          ok: false,
          message: "That email is already in use. Please log in at /auth/login.",
          errors: { fieldErrors: { email: ["Email already used. Log in instead."] } }
        });
      }

      const accountPasswordHash = await bcrypt.hash(parsed.data.accountPassword, 12);
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

      const createdUser = await prisma.user.create({
        data: {
          email,
          passwordHash: accountPasswordHash,
          role: UserRole.CLIENT_ADMIN,
          orgId: org.id,
          clientId: client.id
        }
      });
      await prisma.organizationMembership.upsert({
        where: {
          organizationId_userId: {
            organizationId: org.id,
            userId: createdUser.id
          }
        },
        update: {
          role: TeamMembershipRole.ADMIN,
          status: TeamMembershipStatus.ACTIVE,
          invitedEmail: createdUser.email,
          acceptedAt: new Date()
        },
        create: {
          organizationId: org.id,
          userId: createdUser.id,
          role: TeamMembershipRole.ADMIN,
          status: TeamMembershipStatus.ACTIVE,
          invitedEmail: createdUser.email,
          invitedAt: new Date(),
          acceptedAt: new Date()
        }
      });
      void sendClientWelcomeEmail({
        email,
        tempPassword: "(set during signup)",
        appUrl: env.FRONTEND_APP_URL
      }).catch((welcomeError) => {
        // eslint-disable-next-line no-console
        console.error("Welcome email failed", welcomeError);
      });

      resolvedOrgId = org.id;
      accountCreated = true;
    }

    const lead = await createLeadResilient({
      ...parsed.data,
      orgId: resolvedOrgId,
      source: parsed.data.source || "WEB_FORM",
      ip,
      userAgent
    });

    try {
      await sendLeadNotificationEmail({
        leadId: lead.id,
        name: parsed.data.name,
        business: parsed.data.business,
        phone: parsed.data.phone,
        email: parsed.data.email,
        sourcePage: parsed.data.sourcePage,
        adminUrl: env.FRONTEND_APP_URL
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
