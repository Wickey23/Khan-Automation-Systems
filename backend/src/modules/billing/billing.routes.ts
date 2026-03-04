import { OrganizationStatus, Prisma, SubscriptionPlan, UserRole } from "@prisma/client";
import { Router } from "express";
import Stripe from "stripe";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { requireAnyRole, requireAuth, type AuthenticatedRequest } from "../../middleware/require-auth";
import { sendBillingConfirmationEmail } from "../../services/email";
import { deriveOrgLifecycleFromBilling } from "./billing-lifecycle.service";
import {
  changePlanSchema,
  createCheckoutSessionSchema,
  createPlanChangeSessionSchema,
  scheduleDowngradeSchema
} from "./billing.schema";
import { getDemoState } from "./demo-access.service";
import { computeBillingDiagnostics } from "./billing-diagnostics.service";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20"
});

export const billingRouter = Router();

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

function planFromPrice(priceId: string | null | undefined): SubscriptionPlan {
  if (priceId && priceId === env.STRIPE_PRO_PRICE_ID) return SubscriptionPlan.PRO;
  return SubscriptionPlan.STARTER;
}

type CheckoutPlan = "starter" | "pro" | "founding";

function priceIdForPlan(plan: CheckoutPlan): string {
  if (plan === "starter") return env.STRIPE_STARTER_PRICE_ID;
  if (plan === "pro") return env.STRIPE_PRO_PRICE_ID;
  return env.STRIPE_FOUNDING_PRICE_ID || "";
}

function setupFeePriceIdForPlan(plan: CheckoutPlan): string {
  if (plan === "starter") return env.STRIPE_STARTER_SETUP_FEE_PRICE_ID || "";
  if (plan === "pro") return env.STRIPE_PRO_SETUP_FEE_PRICE_ID || "";
  return env.STRIPE_FOUNDING_SETUP_FEE_PRICE_ID || "";
}

function subscriptionPlanFromInput(plan: "starter" | "pro"): SubscriptionPlan {
  return plan === "pro" ? SubscriptionPlan.PRO : SubscriptionPlan.STARTER;
}

function labelFromPlanInput(plan: CheckoutPlan): string {
  if (plan === "pro") return "Growth/Pro";
  if (plan === "founding") return "Founding Partner";
  return "Standard";
}

function normalizeSubscriptionStatus(status: string | null | undefined): string {
  return String(status || "inactive").toLowerCase();
}

function isBillingActive(status: string | null | undefined): boolean {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(normalizeSubscriptionStatus(status));
}

function logBillingEvent(level: "info" | "error", details: Record<string, unknown>) {
  const payload = JSON.stringify({
    scope: "billing-webhook",
    ...details
  });
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(payload);
    return;
  }
  // eslint-disable-next-line no-console
  console.log(payload);
}

async function ensureOrgContext(req: AuthenticatedRequest): Promise<{
  orgId: string;
  stripeCustomerId: string | null;
}> {
  if (!req.auth?.userId) {
    throw new Error("Missing authenticated user.");
  }

  // Always re-read from DB so stale JWTs without orgId still work.
  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: {
      id: true,
      orgId: true,
      client: { select: { name: true, industry: true } }
    }
  });
  if (!user) throw new Error("Authenticated user not found.");

  let orgId = user.orgId || req.auth.orgId || null;
  if (!orgId) {
    const created = await prisma.organization.create({
      data: {
        name: user.client?.name || req.auth.email || "Customer Organization",
        industry: user.client?.industry || null,
        status: OrganizationStatus.NEW,
        live: false
      },
      select: { id: true }
    });
    orgId = created.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { orgId }
    });
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, stripeCustomerId: true }
  });
  if (!org) throw new Error("Organization not found.");
  return { orgId: org.id, stripeCustomerId: org.stripeCustomerId };
}

async function upsertSubscriptionAndOrg(input: {
  orgId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  plan: SubscriptionPlan;
  currentPeriodEnd?: Date | null;
  pendingPlan?: SubscriptionPlan | null;
  pendingPlanEffectiveAt?: Date | null;
  pendingPlanSource?: "STRIPE_HOSTED" | "APP_FALLBACK" | null;
}) {
  const normalizedStatus = normalizeSubscriptionStatus(input.status);
  const billingActive = isBillingActive(normalizedStatus);
  const org = await prisma.organization.findUnique({
    where: { id: input.orgId },
    select: { status: true, live: true }
  });
  if (!org) throw new Error("Organization not found.");
  const lifecycle = deriveOrgLifecycleFromBilling({
    currentStatus: org.status,
    currentLive: org.live,
    billingActive
  });

  const sharedUpdate = {
    orgId: input.orgId,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    status: normalizedStatus,
    plan: input.plan,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    pendingPlan: input.pendingPlan,
    pendingPlanEffectiveAt: input.pendingPlanEffectiveAt,
    pendingPlanSource: input.pendingPlanSource
  };

  const existingBySubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: input.stripeSubscriptionId },
    select: { id: true }
  });

  if (existingBySubscription) {
    await prisma.subscription.update({
      where: { id: existingBySubscription.id },
      data: sharedUpdate
    });
  } else {
    const existingByCustomerOrOrg = await prisma.subscription.findFirst({
      where: {
        OR: [{ stripeCustomerId: input.stripeCustomerId }, { orgId: input.orgId }]
      },
      orderBy: { createdAt: "desc" },
      select: { id: true }
    });

    if (existingByCustomerOrOrg) {
      await prisma.subscription.update({
        where: { id: existingByCustomerOrOrg.id },
        data: sharedUpdate
      });
    } else {
      await prisma.subscription.create({
        data: sharedUpdate
      });
    }
  }

  await prisma.organization.update({
    where: { id: input.orgId },
    data: {
      stripeCustomerId: input.stripeCustomerId,
      subscriptionStatus: normalizedStatus,
      billingActive,
      status: lifecycle.status,
      live: lifecycle.live
    }
  });
}

async function resolveOrgAndPlanFromSubscription(stripeSubscriptionId: string): Promise<{
  orgId: string | null;
  plan: SubscriptionPlan;
  stripeCustomerId: string | null;
  status: string;
  currentPeriodEnd: Date | null;
}> {
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    select: {
      orgId: true,
      plan: true,
      stripeCustomerId: true,
      status: true,
      currentPeriodEnd: true
    }
  });
  if (existing?.orgId) {
    return {
      orgId: existing.orgId,
      plan: existing.plan,
      stripeCustomerId: existing.stripeCustomerId,
      status: existing.status,
      currentPeriodEnd: existing.currentPeriodEnd
    };
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["items.data.price"]
  });

  const metadataOrgId = stripeSubscription.metadata?.orgId || null;
  const firstPriceId = stripeSubscription.items.data[0]?.price?.id || null;
  const stripeCustomerId =
    typeof stripeSubscription.customer === "string"
      ? stripeSubscription.customer
      : stripeSubscription.customer?.id || null;

  return {
    orgId: metadataOrgId,
    plan: planFromPrice(firstPriceId),
    stripeCustomerId,
    status: normalizeSubscriptionStatus(stripeSubscription.status),
    currentPeriodEnd: stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000)
      : null
  };
}

function mapPendingPlanSource(value: string | null | undefined): "STRIPE_HOSTED" | "APP_FALLBACK" | null {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "STRIPE_HOSTED") return "STRIPE_HOSTED";
  if (normalized === "APP_FALLBACK") return "APP_FALLBACK";
  return null;
}

async function markEventProcessed(eventId: string, update: { processed: boolean; processingError?: string | null }) {
  await prisma.billingWebhookEvent.update({
    where: { eventId },
    data: {
      processed: update.processed,
      processingError: update.processingError || null
    }
  });
}

async function clearPendingIfApplied(input: {
  stripeSubscriptionId: string;
  plan: SubscriptionPlan;
  currentPeriodEnd?: Date | null;
}) {
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: input.stripeSubscriptionId },
    select: {
      id: true,
      pendingPlan: true,
      pendingPlanEffectiveAt: true
    }
  });
  if (!existing?.pendingPlan) return;
  const now = new Date();
  const effectivePassed = existing.pendingPlanEffectiveAt ? existing.pendingPlanEffectiveAt <= now : false;
  if (existing.pendingPlan === input.plan || effectivePassed) {
    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        pendingPlan: null,
        pendingPlanEffectiveAt: null,
        pendingPlanSource: null
      }
    });
  }
}

billingRouter.post(
  "/create-checkout-session",
  requireAuth,
  requireAnyRole([UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF, UserRole.CLIENT]),
  async (req: AuthenticatedRequest, res) => {
    if (!req.auth?.userId) return res.status(400).json({ ok: false, message: "Missing authenticated user." });

    const parsed = createCheckoutSessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid billing payload." });

    try {
      const org = await ensureOrgContext(req);

      const selectedPlan = parsed.data.plan as CheckoutPlan;
      const priceId = priceIdForPlan(selectedPlan);
      if (!priceId || priceId.includes("placeholder")) {
        return res.status(500).json({
          ok: false,
          message: "Stripe price ID is not configured for this plan."
        });
      }
      if (!env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY.includes("placeholder")) {
        return res.status(500).json({
          ok: false,
          message: "Stripe secret key is not configured."
        });
      }
      if (!env.STRIPE_SUCCESS_URL || !env.STRIPE_CANCEL_URL) {
        return res.status(500).json({
          ok: false,
          message: "Stripe success/cancel URLs are not configured."
        });
      }
      const latest = await prisma.subscription.findFirst({
        where: { orgId: org.orgId },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true }
      });
      const hasActiveSubscription = Boolean(latest && isBillingActive(latest.status));
      const setupFeePriceId = setupFeePriceIdForPlan(selectedPlan);
      const includeSetupFee = !hasActiveSubscription && Boolean(setupFeePriceId && !setupFeePriceId.includes("placeholder"));

      const checkoutMetadata = {
        orgId: org.orgId,
        userId: req.auth.userId,
        plan: selectedPlan,
        setupFeeIncluded: includeSetupFee ? "true" : "false"
      };

      const lineItems: Array<{ price: string; quantity: number }> = [{ price: priceId, quantity: 1 }];
      if (includeSetupFee && setupFeePriceId) {
        lineItems.push({ price: setupFeePriceId, quantity: 1 });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: lineItems,
        success_url: env.STRIPE_SUCCESS_URL,
        cancel_url: env.STRIPE_CANCEL_URL,
        customer: org.stripeCustomerId || undefined,
        customer_email: org.stripeCustomerId ? undefined : req.auth.email,
        metadata: checkoutMetadata,
        subscription_data: {
          metadata: checkoutMetadata
        }
      });

      return res.json({ ok: true, data: { url: session.url } });
    } catch (error) {
      const stripeMessage =
        error instanceof Stripe.errors.StripeError
          ? error.message
          : error instanceof Error
            ? error.message
            : "unknown_error";
      logBillingEvent("error", {
        action: "create_checkout_session_failed",
        userId: req.auth.userId,
        orgId: req.auth.orgId || null,
        message: stripeMessage
      });
      return res.status(500).json({
        ok: false,
        message: `Checkout failed: ${stripeMessage}`
      });
    }
  }
);

billingRouter.post(
  "/create-plan-change-session",
  requireAuth,
  requireAnyRole([UserRole.CLIENT_ADMIN, UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res) => {
    if (!req.auth?.userId) return res.status(400).json({ ok: false, message: "Missing authenticated user." });

    const parsed = createPlanChangeSessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid plan change payload." });

    try {
      const org = await ensureOrgContext(req);
      if (!org.stripeCustomerId) {
        return res.status(409).json({
          ok: false,
          code: "stripe_customer_missing",
          fixHint: "run_checkout_first",
          message: "Stripe customer not found. Run checkout first."
        });
      }

      const currentSubscription = await prisma.subscription.findFirst({
        where: { orgId: org.orgId },
        orderBy: { createdAt: "desc" }
      });

      if (!currentSubscription || !isBillingActive(currentSubscription.status)) {
        return res.status(400).json({
          ok: false,
          code: "no_active_subscription",
          fixHint: "start_checkout",
          message: "No active subscription. Start checkout first."
        });
      }

      const targetPlan = subscriptionPlanFromInput(parsed.data.targetPlan);
      if (currentSubscription.plan === targetPlan) {
        return res.json({
          ok: true,
          data: { changed: false, message: "already_on_target_plan" }
        });
      }

      if (parsed.data.targetPlan === "pro" && parsed.data.effective !== "immediate") {
        return res.status(400).json({
          ok: false,
          message: "Upgrades must use immediate effective mode."
        });
      }
      if (parsed.data.targetPlan === "starter" && parsed.data.effective !== "period_end") {
        return res.status(400).json({
          ok: false,
          message: "Downgrades must use period_end effective mode."
        });
      }

      if (parsed.data.targetPlan === "pro") {
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: [{ price: env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
          success_url: env.STRIPE_SUCCESS_URL,
          cancel_url: env.STRIPE_CANCEL_URL,
          customer: org.stripeCustomerId,
          metadata: {
            orgId: org.orgId,
            userId: req.auth.userId,
            plan: "pro",
            planChange: "upgrade"
          },
          subscription_data: {
            metadata: {
              orgId: org.orgId,
              userId: req.auth.userId,
              plan: "pro",
              planChange: "upgrade"
            }
          }
        });
        return res.json({ ok: true, data: { url: session.url } });
      }

      await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          pendingPlan: SubscriptionPlan.STARTER,
          pendingPlanEffectiveAt: currentSubscription.currentPeriodEnd ?? null,
          pendingPlanSource: "STRIPE_HOSTED"
        }
      });

      const portal = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: env.STRIPE_PORTAL_RETURN_URL || `${env.FRONTEND_APP_URL}/app/billing`
      });
      return res.json({ ok: true, data: { url: portal.url } });
    } catch (error) {
      const stripeMessage =
        error instanceof Stripe.errors.StripeError
          ? error.message
          : error instanceof Error
            ? error.message
            : "unknown_error";
      logBillingEvent("error", {
        action: "create_plan_change_session_failed",
        userId: req.auth.userId,
        orgId: req.auth.orgId || null,
        message: stripeMessage
      });
      return res.status(500).json({
        ok: false,
        message: `Plan change session failed: ${stripeMessage}`
      });
    }
  }
);

billingRouter.post(
  "/schedule-downgrade",
  requireAuth,
  requireAnyRole([UserRole.CLIENT_ADMIN, UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res) => {
    if (!req.auth?.userId) return res.status(400).json({ ok: false, message: "Missing authenticated user." });
    const parsed = scheduleDowngradeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid downgrade payload." });

    try {
      const org = await ensureOrgContext(req);
      const currentSubscription = await prisma.subscription.findFirst({
        where: { orgId: org.orgId },
        orderBy: { createdAt: "desc" }
      });
      if (!currentSubscription || !currentSubscription.stripeSubscriptionId || !isBillingActive(currentSubscription.status)) {
        return res.status(400).json({ ok: false, message: "No active subscription available for downgrade scheduling." });
      }
      if (currentSubscription.plan !== SubscriptionPlan.PRO) {
        return res.status(400).json({ ok: false, message: "Downgrade scheduling is only available from Pro to Standard." });
      }

      const stripeSubscription = await stripe.subscriptions.retrieve(currentSubscription.stripeSubscriptionId, {
        expand: ["items.data.price"]
      });
      const firstItem = stripeSubscription.items.data[0];
      const currentPriceId = firstItem?.price?.id;
      const currentPeriodEnd = stripeSubscription.current_period_end
        ? new Date(stripeSubscription.current_period_end * 1000)
        : null;

      if (!firstItem?.id || !currentPriceId || !currentPeriodEnd) {
        return res.status(400).json({ ok: false, message: "Unable to schedule downgrade due to missing Stripe subscription details." });
      }

      await stripe.subscriptionSchedules.create({
        from_subscription: stripeSubscription.id,
        phases: [
          {
            start_date: "now",
            end_date: Math.floor(currentPeriodEnd.getTime() / 1000),
            items: [{ price: currentPriceId, quantity: 1 }]
          },
          {
            items: [{ price: env.STRIPE_STARTER_PRICE_ID, quantity: 1 }]
          }
        ]
      } as any);

      await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          pendingPlan: SubscriptionPlan.STARTER,
          pendingPlanEffectiveAt: currentPeriodEnd,
          pendingPlanSource: "APP_FALLBACK"
        }
      });

      return res.json({
        ok: true,
        data: {
          scheduled: true,
          effectiveAt: currentPeriodEnd.toISOString()
        }
      });
    } catch (error) {
      const stripeMessage =
        error instanceof Stripe.errors.StripeError
          ? error.message
          : error instanceof Error
            ? error.message
            : "unknown_error";
      logBillingEvent("error", {
        action: "schedule_downgrade_failed",
        userId: req.auth.userId,
        orgId: req.auth.orgId || null,
        message: stripeMessage
      });
      return res.status(500).json({ ok: false, message: `Schedule downgrade failed: ${stripeMessage}` });
    }
  }
);

billingRouter.post(
  "/change-plan",
  requireAuth,
  requireAnyRole([UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF, UserRole.CLIENT]),
  async (req: AuthenticatedRequest, res) => {
    logBillingEvent("info", {
      action: "legacy_plan_change_route_used",
      userId: req.auth?.userId || null,
      orgId: req.auth?.orgId || null
    });
    if (!req.auth?.userId) return res.status(400).json({ ok: false, message: "Missing authenticated user." });

    const parsed = changePlanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid billing payload." });

    try {
      const org = await ensureOrgContext(req);
      const targetPriceId = priceIdForPlan(parsed.data.plan);
      const targetPlan = subscriptionPlanFromInput(parsed.data.plan);

      if (!targetPriceId || targetPriceId.includes("placeholder")) {
        return res.status(500).json({
          ok: false,
          message: "Stripe price ID is not configured for this plan."
        });
      }

      const currentSubscription = await prisma.subscription.findFirst({
        where: { orgId: org.orgId },
        orderBy: { createdAt: "desc" }
      });
      if (!currentSubscription?.stripeSubscriptionId) {
        return res.status(404).json({
          ok: false,
          message: "No active subscription found. Start a plan first."
        });
      }

      if (currentSubscription.plan === targetPlan) {
        return res.json({
          ok: true,
          data: {
            changed: false,
            message: `Plan is already ${targetPlan}.`
          }
        });
      }

      if (!isBillingActive(currentSubscription.status)) {
        return res.status(400).json({
          ok: false,
          message: "Subscription is not active. Restart checkout to reactivate and choose a plan."
        });
      }

      const stripeSubscription = await stripe.subscriptions.retrieve(currentSubscription.stripeSubscriptionId, {
        expand: ["items.data.price"]
      });
      const itemId = stripeSubscription.items.data[0]?.id;
      if (!itemId) {
        return res.status(400).json({
          ok: false,
          message: "Subscription item missing. Open Stripe Billing Portal to update the plan."
        });
      }

      const updated = await stripe.subscriptions.update(currentSubscription.stripeSubscriptionId, {
        items: [{ id: itemId, price: targetPriceId }],
        proration_behavior: "create_prorations",
        metadata: {
          ...(stripeSubscription.metadata || {}),
          orgId: org.orgId,
          updatedByUserId: req.auth.userId,
          plan: parsed.data.plan
        }
      });

      const stripeCustomerId =
        typeof updated.customer === "string" ? updated.customer : updated.customer?.id || org.stripeCustomerId;
      if (!stripeCustomerId) {
        return res.status(400).json({
          ok: false,
          message: "Stripe customer is missing for this subscription."
        });
      }

      const normalizedStatus = normalizeSubscriptionStatus(updated.status);
      const currentPeriodEnd = updated.current_period_end ? new Date(updated.current_period_end * 1000) : null;

      await upsertSubscriptionAndOrg({
        orgId: org.orgId,
        stripeCustomerId,
        stripeSubscriptionId: updated.id,
        status: normalizedStatus,
        plan: targetPlan,
        currentPeriodEnd
      });

      logBillingEvent("info", {
        action: "plan_changed",
        userId: req.auth.userId,
        orgId: org.orgId,
        stripeSubscriptionId: updated.id,
        fromPlan: currentSubscription.plan,
        toPlan: targetPlan,
        status: normalizedStatus
      });

      return res.json({
        ok: true,
        data: {
          changed: true,
          subscriptionId: updated.id,
          status: normalizedStatus,
          plan: targetPlan
        }
      });
    } catch (error) {
      const stripeMessage =
        error instanceof Stripe.errors.StripeError
          ? error.message
          : error instanceof Error
            ? error.message
            : "unknown_error";
      logBillingEvent("error", {
        action: "change_plan_failed",
        userId: req.auth.userId,
        orgId: req.auth.orgId || null,
        message: stripeMessage
      });
      return res.status(500).json({
        ok: false,
        message: `Plan change failed: ${stripeMessage}`
      });
    }
  }
);

billingRouter.get("/status", requireAuth, async (req: AuthenticatedRequest, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  if (!req.auth?.userId) return res.status(400).json({ ok: false, message: "Missing authenticated user." });
  let orgId = req.auth.orgId;
  if (!orgId) {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { orgId: true }
    });
    orgId = user?.orgId || null;
  }
  if (!orgId) {
    const demo = await getDemoState({
      prisma,
      orgId: null,
      subscriptionStatus: null,
      allowStart: false
    });
    return res.json({ ok: true, data: { subscription: null, demo } });
  }
  const subscription = await prisma.subscription.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" }
  });
  const demo = await getDemoState({
    prisma,
    orgId,
    subscriptionStatus: subscription?.status || null,
    allowStart: false
  });
  const subscriptionPayload = subscription
    ? {
        ...subscription,
        pendingPlan: subscription.pendingPlan || null,
        pendingPlanEffectiveAt: subscription.pendingPlanEffectiveAt || null,
        pendingPlanSource: mapPendingPlanSource(subscription.pendingPlanSource)
      }
    : null;
  return res.json({ ok: true, data: { subscription: subscriptionPayload, demo } });
});

billingRouter.get("/diagnostics", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.userId) return res.status(401).json({ ok: false, message: "Unauthorized" });

  const detailed = req.auth.role === UserRole.CLIENT_ADMIN || req.auth.role === UserRole.ADMIN || req.auth.role === UserRole.SUPER_ADMIN;
  try {
    const diagnostics = await computeBillingDiagnostics({
      prisma,
      stripe,
      auth: {
        userId: req.auth.userId,
        orgId: req.auth.orgId || null,
        role: req.auth.role
      },
      now: new Date(),
      detailed
    });
    return res.status(200).json({ ok: true, data: diagnostics });
  } catch (error) {
    const evaluatedAt = new Date().toISOString();
    const fallback = {
      summary: {
        overall: "NEEDS_ACTION" as const,
        checkoutReady: false,
        changePlanReady: false,
        customerPortalReady: false,
        topIssues: ["diagnostics_unavailable"]
      },
      evaluatedAt,
      detailed: false
    };

    logBillingEvent("error", {
      action: "billing_diagnostics_failed",
      userId: req.auth.userId,
      orgId: req.auth.orgId || null,
      message: error instanceof Error ? error.message : "unknown_error"
    });
    return res.status(200).json({ ok: true, data: fallback });
  }
});

billingRouter.post("/customer-portal", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.userId) return res.status(400).json({ ok: false, message: "Missing authenticated user." });

  const org = await ensureOrgContext(req);
  const stripeCustomerId = org.stripeCustomerId;
  if (!stripeCustomerId) {
    return res.status(404).json({ ok: false, message: "No Stripe customer found for this organization." });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: env.STRIPE_PORTAL_RETURN_URL || `${env.FRONTEND_APP_URL}/app/billing`
  });

  return res.json({ ok: true, data: { url: session.url } });
});

billingRouter.post("/webhook", async (req: AuthenticatedRequest, res) => {
  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") return res.status(401).send("Missing signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    logBillingEvent("error", {
      eventType: "signature_verification_failed",
      message: error instanceof Error ? error.message : "unknown_error",
      requestId: req.requestId || null
    });
    return res.status(401).send("Invalid signature");
  }

  const baseLog = {
    eventId: event.id,
    eventType: event.type,
    requestId: req.requestId || null
  };

  try {
    await prisma.billingWebhookEvent.create({
      data: {
        eventId: event.id,
        eventType: event.type,
        processed: false
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      logBillingEvent("info", { ...baseLog, message: "duplicate_event_ignored" });
      return res.status(200).json({ received: true, duplicate: true });
    }
    logBillingEvent("error", {
      ...baseLog,
      message: "event_registration_failed",
      error: error instanceof Error ? error.message : "unknown_error"
    });
    return res.status(200).json({ received: true, processed: false });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.orgId || null;
      const planValue = (session.metadata?.plan || "starter").toLowerCase();
      const plan = planValue === "pro" ? SubscriptionPlan.PRO : SubscriptionPlan.STARTER;
      const planLabel = labelFromPlanInput((planValue === "founding" ? "founding" : planValue === "pro" ? "pro" : "starter") as CheckoutPlan);
      const stripeCustomerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id || null;
      const stripeSubscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id || null;

      if (!orgId || !stripeCustomerId || !stripeSubscriptionId) {
        await markEventProcessed(event.id, {
          processed: false,
          processingError: "checkout_session_missing_org_or_subscription_fields"
        });
        logBillingEvent("error", {
          ...baseLog,
          orgId,
          stripeCustomerId,
          stripeSubscriptionId,
          message: "checkout_session_missing_fields"
        });
        return res.status(200).json({ received: true, processed: false });
      }

      await upsertSubscriptionAndOrg({
        orgId,
        stripeCustomerId,
        stripeSubscriptionId,
        status: "active",
        plan
      });
      await clearPendingIfApplied({
        stripeSubscriptionId,
        plan
      });

      await prisma.billingWebhookEvent.update({
        where: { eventId: event.id },
        data: {
          processed: true,
          orgId,
          stripeCustomerId,
          stripeSubscriptionId,
          processingError: null
        }
      });

      logBillingEvent("info", {
        ...baseLog,
        orgId,
        stripeSubscriptionId,
        stripeCustomerId,
        status: "active",
        billingActive: true
      });

      const email =
        session.customer_details?.email ||
        session.customer_email ||
        (session.metadata?.userId
          ? (
              await prisma.user.findUnique({
                where: { id: session.metadata.userId },
                select: { email: true }
              })
            )?.email
          : null);
      if (email) {
        void sendBillingConfirmationEmail({
          email,
          planLabel,
          statusLabel: "active",
          source: "checkout"
        }).catch((error) => {
          logBillingEvent("error", {
            ...baseLog,
            message: "billing_confirmation_email_failed",
            email,
            error: error instanceof Error ? error.message : "unknown_error"
          });
        });
      }
      return res.status(200).json({ received: true });
    }

    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeSubscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id || null;
      const stripeCustomerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id || null;

      if (!stripeSubscriptionId) {
        await markEventProcessed(event.id, {
          processed: false,
          processingError: "invoice_missing_subscription_id"
        });
        logBillingEvent("error", {
          ...baseLog,
          message: "invoice_missing_subscription_id"
        });
        return res.status(200).json({ received: true, processed: false });
      }

      const resolved = await resolveOrgAndPlanFromSubscription(stripeSubscriptionId);
      const resolvedCustomerId = stripeCustomerId || resolved.stripeCustomerId;
      if (!resolved.orgId || !resolvedCustomerId) {
        await markEventProcessed(event.id, {
          processed: false,
          processingError: "invoice_unresolved_org_or_customer"
        });
        logBillingEvent("error", {
          ...baseLog,
          stripeSubscriptionId,
          stripeCustomerId,
          resolvedOrgId: resolved.orgId,
          message: "invoice_unresolved_org_or_customer"
        });
        return res.status(200).json({ received: true, processed: false });
      }

      const nextStatus = event.type === "invoice.paid" ? "active" : "past_due";
      await upsertSubscriptionAndOrg({
        orgId: resolved.orgId,
        stripeCustomerId: resolvedCustomerId,
        stripeSubscriptionId,
        status: nextStatus,
        plan: resolved.plan,
        currentPeriodEnd: resolved.currentPeriodEnd
      });
      await clearPendingIfApplied({
        stripeSubscriptionId,
        plan: resolved.plan,
        currentPeriodEnd: resolved.currentPeriodEnd
      });

      await prisma.billingWebhookEvent.update({
        where: { eventId: event.id },
        data: {
          processed: true,
          orgId: resolved.orgId,
          stripeCustomerId: resolvedCustomerId,
          stripeSubscriptionId,
          processingError: null
        }
      });

      logBillingEvent("info", {
        ...baseLog,
        orgId: resolved.orgId,
        stripeSubscriptionId,
        stripeCustomerId: stripeCustomerId || resolved.stripeCustomerId,
        status: nextStatus,
        billingActive: isBillingActive(nextStatus)
      });
      return res.status(200).json({ received: true });
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeSubscriptionId = subscription.id;
      const stripeCustomerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id || null;
      const metadataOrgId = subscription.metadata?.orgId || null;
      const firstPriceId = subscription.items.data[0]?.price?.id || null;
      const currentPlan = planFromPrice(firstPriceId);
      const currentPeriodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null;

      let orgId = metadataOrgId;
      if (!orgId) {
        const existing = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId },
          select: { orgId: true }
        });
        orgId = existing?.orgId || null;
      }

      if (!orgId || !stripeCustomerId) {
        await markEventProcessed(event.id, {
          processed: false,
          processingError: "subscription_updated_unresolved_org_or_customer"
        });
        logBillingEvent("error", {
          ...baseLog,
          stripeSubscriptionId,
          message: "subscription_updated_unresolved_org_or_customer"
        });
        return res.status(200).json({ received: true, processed: false });
      }

      const existingBefore = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId },
        select: { plan: true, status: true }
      });

      await upsertSubscriptionAndOrg({
        orgId,
        stripeCustomerId,
        stripeSubscriptionId,
        status: normalizeSubscriptionStatus(subscription.status),
        plan: currentPlan,
        currentPeriodEnd
      });
      await clearPendingIfApplied({
        stripeSubscriptionId,
        plan: currentPlan,
        currentPeriodEnd
      });

      await prisma.billingWebhookEvent.update({
        where: { eventId: event.id },
        data: {
          processed: true,
          orgId,
          stripeCustomerId,
          stripeSubscriptionId,
          processingError: null
        }
      });

      const normalizedStatus = normalizeSubscriptionStatus(subscription.status);
      const changed = !existingBefore || existingBefore.plan !== currentPlan || normalizeSubscriptionStatus(existingBefore.status) !== normalizedStatus;
      if (changed) {
        const user = await prisma.user.findFirst({
          where: { orgId, role: { in: [UserRole.CLIENT_ADMIN, UserRole.CLIENT] } },
          orderBy: { createdAt: "asc" },
          select: { email: true }
        });
        if (user?.email) {
          const planLabel = currentPlan === SubscriptionPlan.PRO ? "Growth/Pro" : "Standard";
          void sendBillingConfirmationEmail({
            email: user.email,
            planLabel,
            statusLabel: normalizedStatus,
            effectiveAt: currentPeriodEnd?.toISOString() || null,
            source: "subscription_update"
          }).catch((error) => {
            logBillingEvent("error", {
              ...baseLog,
              message: "billing_confirmation_email_failed",
              email: user.email,
              error: error instanceof Error ? error.message : "unknown_error"
            });
          });
        }
      }
      return res.status(200).json({ received: true });
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeSubscriptionId = subscription.id;
      const resolved = await resolveOrgAndPlanFromSubscription(stripeSubscriptionId);
      const stripeCustomerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id || resolved.stripeCustomerId;

      if (!resolved.orgId || !stripeCustomerId) {
        await markEventProcessed(event.id, {
          processed: false,
          processingError: "subscription_deleted_unresolved_org_or_customer"
        });
        logBillingEvent("error", {
          ...baseLog,
          stripeSubscriptionId,
          message: "subscription_deleted_unresolved_org_or_customer"
        });
        return res.status(200).json({ received: true, processed: false });
      }

      await upsertSubscriptionAndOrg({
        orgId: resolved.orgId,
        stripeCustomerId,
        stripeSubscriptionId,
        status: "canceled",
        plan: resolved.plan
      });
      await clearPendingIfApplied({
        stripeSubscriptionId,
        plan: resolved.plan
      });

      await prisma.billingWebhookEvent.update({
        where: { eventId: event.id },
        data: {
          processed: true,
          orgId: resolved.orgId,
          stripeCustomerId,
          stripeSubscriptionId,
          processingError: null
        }
      });

      logBillingEvent("info", {
        ...baseLog,
        orgId: resolved.orgId,
        stripeSubscriptionId,
        stripeCustomerId,
        status: "canceled",
        billingActive: false
      });
      return res.status(200).json({ received: true });
    }

    await markEventProcessed(event.id, { processed: true, processingError: null });
    logBillingEvent("info", { ...baseLog, message: "event_ignored" });
    return res.status(200).json({ received: true, ignored: true });
  } catch (error) {
    await markEventProcessed(event.id, {
      processed: false,
      processingError: error instanceof Error ? error.message : "unknown_error"
    });

    logBillingEvent("error", {
      ...baseLog,
      message: "webhook_processing_failed",
      error: error instanceof Error ? error.message : "unknown_error"
    });
    return res.status(200).json({ received: true, processed: false });
  }
});
