import { OrganizationStatus, SubscriptionPlan, UserRole } from "@prisma/client";
import { Router } from "express";
import Stripe from "stripe";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireAnyRole, type AuthenticatedRequest } from "../../middleware/require-auth";
import { createCheckoutSessionSchema } from "./billing.schema";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20"
});

export const billingRouter = Router();

billingRouter.post(
  "/create-checkout-session",
  requireAuth,
  requireAnyRole([UserRole.CLIENT_ADMIN, UserRole.CLIENT_STAFF, UserRole.CLIENT]),
  async (req: AuthenticatedRequest, res) => {
    if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
    const parsed = createCheckoutSessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid billing payload." });

    const priceId = parsed.data.plan === "starter" ? env.STRIPE_STARTER_PRICE_ID : env.STRIPE_PRO_PRICE_ID;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: env.STRIPE_SUCCESS_URL,
      cancel_url: env.STRIPE_CANCEL_URL,
      metadata: {
        orgId: req.auth.orgId,
        plan: parsed.data.plan
      }
    });

    return res.json({ ok: true, data: { url: session.url } });
  }
);

billingRouter.get("/status", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.auth?.orgId) return res.status(400).json({ ok: false, message: "No organization assigned." });
  const subscription = await prisma.subscription.findFirst({
    where: { orgId: req.auth.orgId },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ ok: true, data: { subscription } });
});

billingRouter.post("/webhook", async (req, res) => {
  const signature = req.headers["stripe-signature"] as string;
  if (!signature) return res.status(400).send("Missing signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error instanceof Error ? error.message : "unknown"}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orgId = session.metadata?.orgId;
    const planValue = (session.metadata?.plan || "starter").toLowerCase();
    const plan = planValue === "pro" ? SubscriptionPlan.PRO : SubscriptionPlan.STARTER;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    const stripeSubscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

    if (orgId && customerId && stripeSubscriptionId) {
      await prisma.subscription.upsert({
        where: { stripeSubscriptionId },
        update: {
          orgId,
          status: "active",
          plan,
          stripeCustomerId: customerId
        },
        create: {
          orgId,
          status: "active",
          plan,
          stripeCustomerId: customerId,
          stripeSubscriptionId
        }
      });

      await prisma.organization.update({
        where: { id: orgId },
        data: { status: OrganizationStatus.ONBOARDING }
      });
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null
      }
    });
  }

  return res.json({ received: true });
});
