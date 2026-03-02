import { OrganizationStatus, Prisma, SubscriptionPlan, UserRole } from "@prisma/client";
import { Router } from "express";
import Stripe from "stripe";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { requireAnyRole, requireAuth, type AuthenticatedRequest } from "../../middleware/require-auth";
import { createCheckoutSessionSchema } from "./billing.schema";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20"
});

export const billingRouter = Router();

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

function planFromPrice(priceId: string | null | undefined): SubscriptionPlan {
  if (priceId && priceId === env.STRIPE_PRO_PRICE_ID) return SubscriptionPlan.PRO;
  return SubscriptionPlan.STARTER;
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
}) {
  const normalizedStatus = normalizeSubscriptionStatus(input.status);
  const billingActive = isBillingActive(normalizedStatus);

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: input.stripeSubscriptionId },
    update: {
      orgId: input.orgId,
      stripeCustomerId: input.stripeCustomerId,
      status: normalizedStatus,
      plan: input.plan,
      currentPeriodEnd: input.currentPeriodEnd ?? null
    },
    create: {
      orgId: input.orgId,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      status: normalizedStatus,
      plan: input.plan,
      currentPeriodEnd: input.currentPeriodEnd ?? null
    }
  });

  await prisma.organization.update({
    where: { id: input.orgId },
    data: {
      stripeCustomerId: input.stripeCustomerId,
      subscriptionStatus: normalizedStatus,
      billingActive,
      status: billingActive ? OrganizationStatus.ONBOARDING : OrganizationStatus.PAUSED,
      live: billingActive ? undefined : false
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

async function markEventProcessed(eventId: string, update: { processed: boolean; processingError?: string | null }) {
  await prisma.billingWebhookEvent.update({
    where: { eventId },
    data: {
      processed: update.processed,
      processingError: update.processingError || null
    }
  });
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

      const priceId = parsed.data.plan === "starter" ? env.STRIPE_STARTER_PRICE_ID : env.STRIPE_PRO_PRICE_ID;
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
      const checkoutMetadata = {
        orgId: org.orgId,
        userId: req.auth.userId,
        plan: parsed.data.plan
      };

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
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

billingRouter.get("/status", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.userId) return res.status(400).json({ ok: false, message: "Missing authenticated user." });
  let orgId = req.auth.orgId;
  if (!orgId) {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: { orgId: true }
    });
    orgId = user?.orgId || null;
  }
  if (!orgId) return res.json({ ok: true, data: { subscription: null } });
  const subscription = await prisma.subscription.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ ok: true, data: { subscription } });
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
  if (!signature || typeof signature !== "string") return res.status(400).send("Missing signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    logBillingEvent("error", {
      eventType: "signature_verification_failed",
      message: error instanceof Error ? error.message : "unknown_error",
      requestId: req.requestId || null
    });
    return res.status(400).send("Invalid signature");
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
