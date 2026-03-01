import bcrypt from "bcryptjs";
import { ClientStatus, SubscriptionPlan, UserRole } from "@prisma/client";
import { Router } from "express";
import Stripe from "stripe";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../../middleware/require-auth";
import { sendClientWelcomeEmail, sendNewSubscribedClientNotification } from "../../services/email";
import { createCheckoutSchema } from "./stripe.schema";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20"
});

export const stripeRouter = Router();

stripeRouter.post("/create-checkout-session", async (req, res) => {
  const parsed = createCheckoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid checkout payload." });

  const priceId =
    parsed.data.plan === "starter" ? env.STRIPE_STARTER_PRICE_ID : env.STRIPE_PRO_PRICE_ID;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: env.STRIPE_SUCCESS_URL,
    cancel_url: env.STRIPE_CANCEL_URL,
    metadata: {
      plan: parsed.data.plan
    },
    allow_promotion_codes: true
  });

  return res.json({ ok: true, data: { url: session.url } });
});

stripeRouter.post("/customer-portal", requireAuth, requireRole(UserRole.CLIENT), async (req: AuthenticatedRequest, res) => {
  const clientId = req.auth?.clientId;
  if (!clientId) return res.status(400).json({ ok: false, message: "No client workspace assigned." });

  const subscription = await prisma.subscription.findFirst({ where: { clientId } });
  if (!subscription) return res.status(404).json({ ok: false, message: "Subscription not found." });

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${env.FRONTEND_APP_URL}/dashboard/billing`
  });

  return res.json({ ok: true, data: { url: session.url } });
});

stripeRouter.post("/webhook", async (req, res) => {
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
    const customerEmail = session.customer_details?.email || session.customer_email;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

    if (customerEmail && customerId && subscriptionId) {
      const existingUser = await prisma.user.findUnique({
        where: { email: customerEmail.toLowerCase() }
      });

      const client =
        existingUser?.clientId
          ? await prisma.client.findUnique({ where: { id: existingUser.clientId } })
          : await prisma.client.create({
              data: {
                name: customerEmail.split("@")[0],
                status: ClientStatus.NEEDS_CONFIGURATION
              }
            });

      if (!client) return res.status(400).json({ ok: false, message: "Could not create client." });

      const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      await prisma.user.upsert({
        where: { email: customerEmail.toLowerCase() },
        update: { clientId: client.id, role: UserRole.CLIENT },
        create: {
          email: customerEmail.toLowerCase(),
          passwordHash,
          role: UserRole.CLIENT,
          clientId: client.id
        }
      });

      const planValue = (session.metadata?.plan || "starter").toLowerCase();
      const plan = planValue === "pro" ? SubscriptionPlan.PRO : SubscriptionPlan.STARTER;

      await prisma.subscription.upsert({
        where: { stripeSubscriptionId: subscriptionId },
        update: {
          plan,
          stripeCustomerId: customerId,
          status: "active",
          clientId: client.id
        },
        create: {
          clientId: client.id,
          plan,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          status: "active"
        }
      });

      await prisma.setting.upsert({
        where: { clientId: client.id },
        update: {},
        create: { clientId: client.id, transferNumber: "" }
      });

      await prisma.aIConfig.upsert({
        where: { clientId: client.id },
        update: {},
        create: { clientId: client.id, testMode: true, smsEnabled: false }
      });

      await sendNewSubscribedClientNotification({
        clientName: client.name,
        email: customerEmail,
        plan,
        clientId: client.id
      });

      if (!existingUser) {
        await sendClientWelcomeEmail({
          email: customerEmail,
          tempPassword,
          appUrl: env.FRONTEND_APP_URL
        });
      }
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
