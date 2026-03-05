import bcrypt from "bcryptjs";
import { ClientStatus, OrganizationStatus, TeamMembershipRole, TeamMembershipStatus, UserRole } from "@prisma/client";
import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { issueCsrfCookie } from "../../middleware/csrf";
import { requireCsrf } from "../../middleware/csrf";
import { hashToken, signAuthToken, signTrusted2faToken, verifyTrusted2faToken } from "../../lib/auth";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/require-auth";
import { authRateLimit } from "../../middleware/rate-limit";
import { isEmailProviderConfigured, sendLoginOtpEmail, sendPasswordResetEmail } from "../../services/email";
import {
  createRefreshSession,
  revokeAllRefreshSessionsForUser,
  rotateRefreshSession
} from "./refresh-session.service";
import {
  forgotPasswordSchema,
  loginSchema,
  resendLoginOtpSchema,
  resetPasswordSchema,
  signupSchema,
  verifyLoginOtpSchema
} from "./auth.schema";

export const authRouter = Router();

const OTP_EXP_MINUTES = 10;
const LOGIN_FAILS = new Map<string, { count: number; lastAt: number }>();
const MAX_BACKOFF_MS = 10_000;
const OTP_CHALLENGE_TIMEOUT_MS = 15_000;
const TRUSTED_2FA_COOKIE = "kas_2fa_trust";
const PASSWORD_RESET_TIMEOUT_MS = 15_000;

function hashOtp(code: string) {
  return crypto.createHash("sha256").update(`${code}:${process.env.JWT_SECRET || "fallback-secret"}`).digest("hex");
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] || "*"}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function authCookieOptions() {
  const isProd = env.SECURITY_MODE === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
    path: "/"
  };
}

function isSessionPersistenceEnabled() {
  return String(env.AUTH_SESSION_PERSISTENCE_ENABLED || "true").toLowerCase() !== "false";
}

function clearRefreshCookie(res: Response) {
  res.clearCookie("kas_refresh_token", { ...authCookieOptions(), path: "/" });
}

function fingerprintUserAgent(value: unknown) {
  return crypto.createHash("sha256").update(String(value || "unknown_ua")).digest("hex");
}

function readTrusted2fa(req: Request) {
  const raw = String(req.cookies?.[TRUSTED_2FA_COOKIE] || "").trim();
  if (!raw) return null;
  try {
    return verifyTrusted2faToken(raw);
  } catch {
    return null;
  }
}

function setTrusted2faCookie(req: Request, res: Response, userId: string) {
  const token = signTrusted2faToken({
    userId,
    uaHash: fingerprintUserAgent(req.headers["user-agent"])
  });
  const trustDays = Number.parseInt(env.AUTH_2FA_TRUST_DAYS, 10);
  const maxAge = (Number.isFinite(trustDays) && trustDays > 0 ? trustDays : 1) * 24 * 60 * 60 * 1000;
  res.cookie(TRUSTED_2FA_COOKIE, token, {
    ...authCookieOptions(),
    maxAge
  });
}

function trackAuthFailure(key: string) {
  const now = Date.now();
  const current = LOGIN_FAILS.get(key);
  const count = current && now - current.lastAt < 15 * 60 * 1000 ? current.count + 1 : 1;
  LOGIN_FAILS.set(key, { count, lastAt: now });
  return Math.min(MAX_BACKOFF_MS, Math.max(0, (count - 2) * 750));
}

function otpEmailUnavailableInProduction() {
  return env.SECURITY_MODE === "production" && !isEmailProviderConfigured();
}

function roleRequiresTwoFactor(role: UserRole) {
  if (process.env.ADMIN_2FA_ENABLED !== "true") return false;
  if (env.AUTH_2FA_ENFORCE_ALL_USERS === "true") return true;
  return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, code: string): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(code)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
}

async function auditAuthEvent(action: string, metadata: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: {
      actorUserId: "auth",
      actorRole: "SYSTEM",
      action,
      metadataJson: JSON.stringify(metadata)
    }
  });
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

function genericForgotPasswordResponse(res: Response) {
  return res.json({
    ok: true,
    data: {
      sent: true,
      message: "If that email exists, a password reset link has been sent."
    }
  });
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

    const emailDomain = email.split("@")[1] || "";
    const ipHash = crypto.createHash("sha256").update(String(req.ip || "unknown")).digest("hex");
    const [existingDomainUsers, existingBusinessNameOrgs] = await Promise.all([
      emailDomain
        ? prisma.user.count({
            where: {
              email: { endsWith: `@${emailDomain}` }
            }
          })
        : Promise.resolve(0),
      prisma.organization.count({
        where: {
          name: {
            equals: parsed.data.businessName,
            mode: "insensitive"
          }
        }
      })
    ]);

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

    await prisma.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id
        }
      },
      update: {
        role: TeamMembershipRole.ADMIN,
        status: TeamMembershipStatus.ACTIVE,
        invitedEmail: user.email,
        acceptedAt: new Date()
      },
      create: {
        organizationId: organization.id,
        userId: user.id,
        role: TeamMembershipRole.ADMIN,
        status: TeamMembershipStatus.ACTIVE,
        invitedEmail: user.email,
        invitedAt: new Date(),
        acceptedAt: new Date()
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
      ...authCookieOptions(),
      maxAge: Number.parseInt(env.ACCESS_TOKEN_TTL_MINUTES, 10) * 60 * 1000
    });
    if (isSessionPersistenceEnabled()) {
      const refresh = await createRefreshSession(prisma, user.id);
      res.cookie("kas_refresh_token", refresh.token, {
        ...authCookieOptions(),
        maxAge: Number.parseInt(env.REFRESH_TOKEN_TTL_DAYS, 10) * 24 * 60 * 60 * 1000
      });
    } else {
      clearRefreshCookie(res);
    }
    issueCsrfCookie(req, res);

    const signals: string[] = [];
    if (existingDomainUsers > 0) signals.push("email_domain_match");
    if (existingBusinessNameOrgs > 0) signals.push("business_name_match");

    if (signals.length > 0) {
      await prisma.auditLog.create({
        data: {
          orgId: organization.id,
          actorUserId: user.id,
          actorRole: user.role,
          action: "DEMO_ORG_CREATED_SUSPECTED_DUPLICATE",
          metadataJson: JSON.stringify({
            signals,
            emailDomain: emailDomain || null,
            hashedIp: ipHash,
            matchedOrgCount: existingBusinessNameOrgs,
            matchedDomainUserCount: existingDomainUsers
          })
        }
      });
    }

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
    if (!user) {
      const delay = trackAuthFailure(`login:${parsed.data.email.toLowerCase()}`);
      await auditAuthEvent("AUTH_LOGIN_FAIL", { email: parsed.data.email.toLowerCase(), reason: "user_not_found" });
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      return res.status(401).json({ ok: false, message: "Invalid credentials." });
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      const delay = trackAuthFailure(`login:${user.email.toLowerCase()}`);
      await auditAuthEvent("AUTH_LOGIN_FAIL", { userId: user.id, email: user.email, reason: "invalid_password" });
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      return res.status(401).json({ ok: false, message: "Invalid credentials." });
    }

    const requiresTwoFactor = roleRequiresTwoFactor(user.role);
    if (requiresTwoFactor) {
      const trusted = readTrusted2fa(req);
      if (trusted && trusted.userId === user.id && trusted.uaHash === fingerprintUserAgent(req.headers["user-agent"])) {
        const token = signAuthToken({
          userId: user.id,
          email: user.email,
          role: user.role,
          clientId: user.clientId,
          orgId: user.orgId
        });

        res.cookie("kas_auth_token", token, {
          ...authCookieOptions(),
          maxAge: Number.parseInt(env.ACCESS_TOKEN_TTL_MINUTES, 10) * 60 * 1000
        });
        if (isSessionPersistenceEnabled()) {
          const refresh = await createRefreshSession(prisma, user.id);
          res.cookie("kas_refresh_token", refresh.token, {
            ...authCookieOptions(),
            maxAge: Number.parseInt(env.REFRESH_TOKEN_TTL_DAYS, 10) * 24 * 60 * 60 * 1000
          });
        } else {
          clearRefreshCookie(res);
        }
        issueCsrfCookie(req, res);
        await auditAuthEvent("AUTH_LOGIN_SUCCESS", { userId: user.id, role: user.role, via: "trusted_2fa" });

        return res.json({
          ok: true,
          data: {
            requiresTwoFactor: false,
            token,
            user: { userId: user.id, email: user.email, role: user.role, clientId: user.clientId, orgId: user.orgId }
          }
        });
      }

      if (otpEmailUnavailableInProduction()) {
        await auditAuthEvent("AUTH_LOGIN_FAIL", {
          userId: user.id,
          email: user.email,
          reason: "otp_email_not_configured"
        });
        return res.status(503).json({
          ok: false,
          message: "Two-factor email is not configured. Contact support to complete login."
        });
      }

      let challenge;
      try {
        challenge = await withTimeout(
          createAndSendLoginChallenge(user),
          OTP_CHALLENGE_TIMEOUT_MS,
          "otp_challenge_timeout"
        );
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("OTP challenge creation failed", {
          userId: user.id,
          email: user.email,
          reason: error instanceof Error ? error.message : "unknown_error"
        });
        await auditAuthEvent("AUTH_LOGIN_FAIL", {
          userId: user.id,
          email: user.email,
          reason: error instanceof Error ? error.message : "otp_email_send_failed"
        });
        return res.status(503).json({
          ok: false,
          message: "Could not send verification code email. Please try again or contact support."
        });
      }

      await auditAuthEvent("AUTH_2FA_REQUIRED", { userId: user.id, role: user.role });
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
      ...authCookieOptions(),
      maxAge: Number.parseInt(env.ACCESS_TOKEN_TTL_MINUTES, 10) * 60 * 1000
    });
    if (isSessionPersistenceEnabled()) {
      const refresh = await createRefreshSession(prisma, user.id);
      res.cookie("kas_refresh_token", refresh.token, {
        ...authCookieOptions(),
        maxAge: Number.parseInt(env.REFRESH_TOKEN_TTL_DAYS, 10) * 24 * 60 * 60 * 1000
      });
    } else {
      clearRefreshCookie(res);
    }
    issueCsrfCookie(req, res);
    await auditAuthEvent("AUTH_LOGIN_SUCCESS", { userId: user.id, role: user.role });

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
      await auditAuthEvent("AUTH_LOGIN_FAIL", {
        userId: challenge.user.id,
        email: challenge.user.email,
        reason: "invalid_otp"
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
      ...authCookieOptions(),
      maxAge: Number.parseInt(env.ACCESS_TOKEN_TTL_MINUTES, 10) * 60 * 1000
    });
    if (isSessionPersistenceEnabled()) {
      const refresh = await createRefreshSession(prisma, challenge.user.id);
      res.cookie("kas_refresh_token", refresh.token, {
        ...authCookieOptions(),
        maxAge: Number.parseInt(env.REFRESH_TOKEN_TTL_DAYS, 10) * 24 * 60 * 60 * 1000
      });
    } else {
      clearRefreshCookie(res);
    }
    setTrusted2faCookie(req, res, challenge.user.id);
    issueCsrfCookie(req, res);
    await auditAuthEvent("AUTH_LOGIN_SUCCESS", { userId: challenge.user.id, role: challenge.user.role, via: "otp" });

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

    if (otpEmailUnavailableInProduction()) {
      await auditAuthEvent("AUTH_LOGIN_FAIL", {
        userId: challenge.user.id,
        email: challenge.user.email,
        reason: "otp_email_not_configured_resend"
      });
      return res.status(503).json({
        ok: false,
        message: "Two-factor email is not configured. Contact support to complete login."
      });
    }

    let next;
    try {
      next = await withTimeout(
        createAndSendLoginChallenge(challenge.user),
        OTP_CHALLENGE_TIMEOUT_MS,
        "otp_challenge_timeout_resend"
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("OTP resend challenge failed", {
        userId: challenge.user.id,
        email: challenge.user.email,
        reason: error instanceof Error ? error.message : "unknown_error"
      });
      await auditAuthEvent("AUTH_LOGIN_FAIL", {
        userId: challenge.user.id,
        email: challenge.user.email,
        reason: error instanceof Error ? error.message : "otp_email_send_failed_resend"
      });
      return res.status(503).json({
        ok: false,
        message: "Could not resend verification code email. Please try again or contact support."
      });
    }
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

authRouter.post("/forgot-password", authRateLimit, async (req: Request, res: Response) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) return genericForgotPasswordResponse(res);

    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true }
    });

    if (!user) {
      await auditAuthEvent("AUTH_PASSWORD_RESET_REQUESTED", {
        email,
        reason: "user_not_found"
      });
      return genericForgotPasswordResponse(res);
    }

    if (otpEmailUnavailableInProduction()) {
      await auditAuthEvent("AUTH_PASSWORD_RESET_REQUESTED", {
        userId: user.id,
        email: user.email,
        reason: "email_provider_not_configured"
      });
      return genericForgotPasswordResponse(res);
    }

    const rawToken = crypto.randomBytes(32).toString("base64url");
    const expiresMinutes = Number.parseInt(env.PASSWORD_RESET_TTL_MINUTES, 10);
    const expiresAt = new Date(
      Date.now() + (Number.isFinite(expiresMinutes) && expiresMinutes > 0 ? expiresMinutes : 30) * 60 * 1000
    );

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        email: user.email,
        tokenHash: hashToken(rawToken),
        expiresAt
      }
    });

    const resetUrl = `${env.FRONTEND_APP_URL}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;
    try {
      await withTimeout(
        sendPasswordResetEmail({
          email: user.email,
          resetUrl,
          expiresMinutes: Number.isFinite(expiresMinutes) && expiresMinutes > 0 ? expiresMinutes : 30
        }),
        PASSWORD_RESET_TIMEOUT_MS,
        "password_reset_email_timeout"
      );
      await auditAuthEvent("AUTH_PASSWORD_RESET_REQUESTED", {
        userId: user.id,
        email: user.email,
        expiresAt: expiresAt.toISOString()
      });
    } catch (error) {
      await prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          tokenHash: hashToken(rawToken),
          usedAt: null
        },
        data: { usedAt: new Date() }
      });
      await auditAuthEvent("AUTH_PASSWORD_RESET_REQUESTED", {
        userId: user.id,
        email: user.email,
        reason: error instanceof Error ? error.message : "password_reset_email_failed"
      });
    }

    return genericForgotPasswordResponse(res);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Forgot password failed", error);
    return genericForgotPasswordResponse(res);
  }
});

authRouter.post("/reset-password", authRateLimit, async (req: Request, res: Response) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid reset payload." });

    const tokenHash = hashToken(parsed.data.token);
    const tokenRow = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt.getTime() < Date.now()) {
      await auditAuthEvent("AUTH_PASSWORD_RESET_FAILED", {
        reason: "invalid_or_expired_token"
      });
      return res.status(400).json({ ok: false, message: "Reset link is invalid or expired." });
    }

    const nextPasswordHash = await bcrypt.hash(parsed.data.password, 12);
    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: tokenRow.userId },
        data: { passwordHash: nextPasswordHash }
      }),
      prisma.passwordResetToken.update({
        where: { id: tokenRow.id },
        data: { usedAt: now }
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: tokenRow.userId, id: { not: tokenRow.id }, usedAt: null },
        data: { usedAt: now }
      })
    ]);

    await revokeAllRefreshSessionsForUser(prisma, tokenRow.userId);
    res.clearCookie("kas_auth_token", { ...authCookieOptions(), path: "/" });
    res.clearCookie("kas_refresh_token", { ...authCookieOptions(), path: "/" });
    res.clearCookie(TRUSTED_2FA_COOKIE, { ...authCookieOptions(), path: "/" });
    res.clearCookie("kas_csrf_token", { ...authCookieOptions(), path: "/" });

    await auditAuthEvent("AUTH_PASSWORD_RESET_COMPLETED", {
      userId: tokenRow.userId,
      email: tokenRow.email
    });

    return res.json({ ok: true, data: { reset: true } });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Reset password failed", error);
    return res.status(500).json({ ok: false, message: "Could not reset password." });
  }
});

authRouter.post("/logout", requireAuth, requireCsrf, async (_req: AuthenticatedRequest, res: Response) => {
  res.clearCookie("kas_auth_token", {
    ...authCookieOptions(),
    path: "/"
  });
  res.clearCookie("kas_refresh_token", { ...authCookieOptions(), path: "/" });
  res.clearCookie(TRUSTED_2FA_COOKIE, { ...authCookieOptions(), path: "/" });
  return res.json({ ok: true });
});

authRouter.get("/csrf-token", async (req: Request, res: Response) => {
  const token = issueCsrfCookie(req, res);
  return res.json({ ok: true, data: { csrfToken: token } });
});

authRouter.post("/refresh", authRateLimit, requireCsrf, async (req: Request, res: Response) => {
  try {
    if (!isSessionPersistenceEnabled()) {
      clearRefreshCookie(res);
      return res.status(401).json({ ok: false, message: "Refresh session is disabled." });
    }
    const refreshToken = String(req.cookies?.kas_refresh_token || "").trim();
    if (!refreshToken) return res.status(401).json({ ok: false, message: "Missing refresh token." });

    const rotated = await rotateRefreshSession(prisma, refreshToken);
    if (!rotated.ok) {
      if (rotated.reason === "reuse" && rotated.familyId) {
        await auditAuthEvent("AUTH_REFRESH_REVOKED", { reason: "reuse_detected", familyId: rotated.familyId });
      }
      return res.status(401).json({ ok: false, message: "Invalid refresh session." });
    }

    const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user) return res.status(401).json({ ok: false, message: "Invalid session user." });

    const token = signAuthToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      clientId: user.clientId,
      orgId: user.orgId
    });
    res.cookie("kas_auth_token", token, {
      ...authCookieOptions(),
      maxAge: Number.parseInt(env.ACCESS_TOKEN_TTL_MINUTES, 10) * 60 * 1000
    });
    res.cookie("kas_refresh_token", rotated.token, {
      ...authCookieOptions(),
      maxAge: Number.parseInt(env.REFRESH_TOKEN_TTL_DAYS, 10) * 24 * 60 * 60 * 1000
    });
    issueCsrfCookie(req, res);
    await auditAuthEvent("AUTH_REFRESH_ROTATED", { userId: user.id, familyId: rotated.familyId });
    return res.json({ ok: true, data: { token } });
  } catch (error) {
    return res.status(401).json({ ok: false, message: error instanceof Error ? error.message : "Refresh failed." });
  }
});

authRouter.post("/logout-all", requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.auth?.userId) return res.status(401).json({ ok: false, message: "Unauthorized" });
  await revokeAllRefreshSessionsForUser(prisma, req.auth.userId);
  res.clearCookie("kas_auth_token", { ...authCookieOptions(), path: "/" });
  res.clearCookie("kas_refresh_token", { ...authCookieOptions(), path: "/" });
  res.clearCookie(TRUSTED_2FA_COOKIE, { ...authCookieOptions(), path: "/" });
  res.clearCookie("kas_csrf_token", { ...authCookieOptions(), path: "/" });
  await auditAuthEvent("AUTH_REFRESH_REVOKED", { userId: req.auth.userId, reason: "logout_all" });
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

authRouter.get("/security-status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth?.userId;
  const role = req.auth?.role;
  const email = req.auth?.email;
  if (!userId || !role || !email) return res.status(401).json({ ok: false, message: "Unauthorized" });

  const relevant = await prisma.auditLog.findMany({
    where: {
      actorUserId: "auth",
      action: { in: ["AUTH_LOGIN_FAIL", "AUTH_2FA_REQUIRED", "AUTH_LOGIN_SUCCESS", "AUTH_2FA_TEST_EMAIL_SENT", "AUTH_2FA_TEST_EMAIL_FAILED"] }
    },
    orderBy: { createdAt: "desc" },
    take: 400,
    select: { action: true, metadataJson: true, createdAt: true }
  });

  let lastOtpEmailSentAt: Date | null = null;
  let lastOtpEmailFailedAt: Date | null = null;
  let lastOtpVerifiedAt: Date | null = null;
  let lastOtpFailureReason: string | null = null;
  let lastTestEmailSentAt: Date | null = null;
  let lastTestEmailFailedAt: Date | null = null;
  for (const row of relevant) {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = row.metadataJson ? (JSON.parse(row.metadataJson) as Record<string, unknown>) : {};
    } catch {
      metadata = {};
    }
    if (String(metadata.userId || "") !== userId) continue;

    if (!lastOtpEmailSentAt && row.action === "AUTH_2FA_REQUIRED") lastOtpEmailSentAt = row.createdAt;
    if (!lastOtpVerifiedAt && row.action === "AUTH_LOGIN_SUCCESS" && String(metadata.via || "") === "otp") lastOtpVerifiedAt = row.createdAt;
    if (!lastOtpEmailFailedAt && row.action === "AUTH_LOGIN_FAIL" && String(metadata.reason || "").includes("otp_email")) {
      lastOtpEmailFailedAt = row.createdAt;
      lastOtpFailureReason = String(metadata.reason || "otp_email_failed");
    }
    if (!lastOtpFailureReason && row.action === "AUTH_LOGIN_FAIL" && String(metadata.reason || "") === "invalid_otp") {
      lastOtpFailureReason = "invalid_otp";
    }
    if (!lastTestEmailSentAt && row.action === "AUTH_2FA_TEST_EMAIL_SENT") lastTestEmailSentAt = row.createdAt;
    if (!lastTestEmailFailedAt && row.action === "AUTH_2FA_TEST_EMAIL_FAILED") lastTestEmailFailedAt = row.createdAt;
  }

  return res.json({
    ok: true,
    data: {
      email,
      role,
      twoFactorEnabledForAccount: roleRequiresTwoFactor(role),
      emailProviderConfigured: isEmailProviderConfigured(),
      lastOtpEmailSentAt: lastOtpEmailSentAt?.toISOString() || null,
      lastOtpEmailFailedAt: lastOtpEmailFailedAt?.toISOString() || null,
      lastOtpVerifiedAt: lastOtpVerifiedAt?.toISOString() || null,
      lastOtpFailureReason,
      lastTestEmailSentAt: lastTestEmailSentAt?.toISOString() || null,
      lastTestEmailFailedAt: lastTestEmailFailedAt?.toISOString() || null
    }
  });
});

authRouter.post("/security/send-test-otp", requireAuth, requireCsrf, authRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth?.userId;
  const email = req.auth?.email;
  const role = req.auth?.role;
  if (!userId || !email || !role) return res.status(401).json({ ok: false, message: "Unauthorized" });

  if (otpEmailUnavailableInProduction()) {
    await auditAuthEvent("AUTH_2FA_TEST_EMAIL_FAILED", { userId, email, reason: "otp_email_not_configured" });
    return res.status(503).json({ ok: false, message: "Email provider is not configured." });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  try {
    await withTimeout(
      sendLoginOtpEmail({
        email,
        code,
        expiresMinutes: OTP_EXP_MINUTES
      }),
      OTP_CHALLENGE_TIMEOUT_MS,
      "otp_test_email_timeout"
    );
    await auditAuthEvent("AUTH_2FA_TEST_EMAIL_SENT", { userId, email, role, requiresTwoFactor: roleRequiresTwoFactor(role) });
    return res.json({ ok: true, data: { sent: true } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "otp_test_email_failed";
    await auditAuthEvent("AUTH_2FA_TEST_EMAIL_FAILED", {
      userId,
      email,
      role,
      reason
    });
    return res.status(503).json({ ok: false, message: `Could not send test verification email (${reason}).` });
  }
});
