import bcrypt from "bcryptjs";
import { ClientStatus, OrganizationStatus, UserRole } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma";
import { signAuthToken } from "../../lib/auth";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/require-auth";
import { authRateLimit } from "../../middleware/rate-limit";
import { loginSchema, signupSchema } from "./auth.schema";

export const authRouter = Router();

authRouter.post("/signup", authRateLimit, async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid signup payload." });

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ ok: false, message: "Email already exists. Please log in." });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const organization = await prisma.organization.create({
    data: {
      name: parsed.data.businessName,
      industry: parsed.data.industry || null,
      status: OrganizationStatus.ONBOARDING,
      live: false
    }
  });

  const client = await prisma.client.create({
    data: {
      name: parsed.data.businessName,
      industry: parsed.data.industry || null,
      status: ClientStatus.NEEDS_CONFIGURATION
    }
  });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: UserRole.CLIENT_ADMIN,
      clientId: client.id,
      orgId: organization.id
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

  await prisma.onboardingSubmission.create({
    data: {
      orgId: organization.id,
      status: "DRAFT",
      answersJson: "{}"
    }
  });

  const token = signAuthToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    clientId: user.clientId,
    orgId: user.orgId
  });

  res.cookie("kas_auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return res.status(201).json({
    ok: true,
    data: {
      token,
      user: { userId: user.id, email: user.email, role: user.role, clientId: user.clientId, orgId: user.orgId }
    }
  });
});

authRouter.post("/login", authRateLimit, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid login payload." });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() }
  });
  if (!user) return res.status(401).json({ ok: false, message: "Invalid credentials." });

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return res.status(401).json({ ok: false, message: "Invalid credentials." });

  const token = signAuthToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    clientId: user.clientId,
    orgId: user.orgId
  });

  res.cookie("kas_auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return res.json({
    ok: true,
    data: {
      token,
      user: { userId: user.id, email: user.email, role: user.role, clientId: user.clientId, orgId: user.orgId }
    }
  });
});

authRouter.post("/logout", requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  res.clearCookie("kas_auth_token");
  return res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const org =
    req.auth?.orgId
      ? await prisma.organization.findUnique({
          where: { id: req.auth.orgId },
          select: { id: true, name: true, industry: true, status: true, live: true }
        })
      : null;
  return res.json({
    ok: true,
    data: {
      user: req.auth,
      org
    }
  });
});
