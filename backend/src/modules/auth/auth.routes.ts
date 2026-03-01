import bcrypt from "bcryptjs";
import { ClientStatus, OrganizationStatus, UserRole } from "@prisma/client";
import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma";
import { signAuthToken } from "../../lib/auth";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/require-auth";
import { authRateLimit } from "../../middleware/rate-limit";
import { sendLoginOtpEmail } from "../../services/email";
import { loginSchema, resendLoginOtpSchema, signupSchema, verifyLoginOtpSchema } from "./auth.schema";

export const authRouter = Router();

const OTP_EXP_MINUTES = 10;

function hashOtp(code: string) {
  return crypto.createHash("sha256").update(`${code}:${process.env.JWT_SECRET || "fallback-secret"}`).digest("hex");
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] || "*"}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

async function createAndSendLoginChallenge(user: { id: string; email: string }) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXP_MINUTES * 60 * 1000);

  await prisma.loginChallenge.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: now }
  });

  const challenge = await prisma.loginChallenge.create({
    data: {
      userId: user.id,
      email: user.email,
      codeHash: hashOtp(code),
      expiresAt,
      maxAttempts: 5
    }
  });

  await sendLoginOtpEmail({
    email: user.email,
    code,
    expiresMinutes: OTP_EXP_MINUTES
  });

  return challenge;
}

authRouter.post("/signup", authRateLimit, async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Signup failed", error);
    return res.status(500).json({ ok: false, message: "Signup failed. Please try again." });
  }
});

authRouter.post("/login", authRateLimit, async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid login payload." });

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() }
    });
    if (!user) return res.status(401).json({ ok: false, message: "Invalid credentials." });

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) return res.status(401).json({ ok: false, message: "Invalid credentials." });

    const requiresTwoFactor =
      process.env.ADMIN_2FA_ENABLED === "true" &&
      (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN);
    if (requiresTwoFactor) {
      const challenge = await createAndSendLoginChallenge(user);
      return res.json({
        ok: true,
        data: {
          requiresTwoFactor: true,
          challengeId: challenge.id,
          email: maskEmail(user.email)
        }
      });
    }

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
        requiresTwoFactor: false,
        token,
        user: { userId: user.id, email: user.email, role: user.role, clientId: user.clientId, orgId: user.orgId }
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Login failed", error);
    return res.status(500).json({ ok: false, message: "Login failed. Database schema may be out of date." });
  }
});

authRouter.post("/login/verify-otp", authRateLimit, async (req: Request, res: Response) => {
  try {
    const parsed = verifyLoginOtpSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid OTP payload." });

    const email = parsed.data.email.toLowerCase();
    const challenge = await prisma.loginChallenge.findUnique({
      where: { id: parsed.data.challengeId },
      include: { user: true }
    });

    if (!challenge || challenge.email !== email) {
      return res.status(400).json({ ok: false, message: "Invalid verification request." });
    }
    if (challenge.consumedAt) {
      return res.status(400).json({ ok: false, message: "This code is already used. Request a new code." });
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ ok: false, message: "Code expired. Request a new code." });
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      return res.status(429).json({ ok: false, message: "Too many invalid attempts. Request a new code." });
    }

    const codeOk = challenge.codeHash === hashOtp(parsed.data.code);
    if (!codeOk) {
      await prisma.loginChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } }
      });
      return res.status(401).json({ ok: false, message: "Invalid verification code." });
    }

    await prisma.loginChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() }
    });

    const token = signAuthToken({
      userId: challenge.user.id,
      email: challenge.user.email,
      role: challenge.user.role,
      clientId: challenge.user.clientId,
      orgId: challenge.user.orgId
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
        user: {
          userId: challenge.user.id,
          email: challenge.user.email,
          role: challenge.user.role,
          clientId: challenge.user.clientId,
          orgId: challenge.user.orgId
        }
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("OTP verification failed", error);
    return res.status(500).json({ ok: false, message: "Could not verify code." });
  }
});

authRouter.post("/login/resend-otp", authRateLimit, async (req: Request, res: Response) => {
  try {
    const parsed = resendLoginOtpSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid resend request." });

    const email = parsed.data.email.toLowerCase();
    const challenge = await prisma.loginChallenge.findUnique({
      where: { id: parsed.data.challengeId },
      include: { user: true }
    });
    if (!challenge || challenge.email !== email) {
      return res.status(400).json({ ok: false, message: "Invalid resend request." });
    }

    const createdAgoMs = Date.now() - challenge.createdAt.getTime();
    if (createdAgoMs < 30_000) {
      return res.status(429).json({ ok: false, message: "Please wait before requesting another code." });
    }

    const next = await createAndSendLoginChallenge(challenge.user);
    return res.json({
      ok: true,
      data: {
        challengeId: next.id,
        email: maskEmail(challenge.user.email)
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("OTP resend failed", error);
    return res.status(500).json({ ok: false, message: "Could not resend code." });
  }
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
