"use client";

import { useEffect, useState } from "react";
import { changeStripePlan, createStripeCheckoutSession, createCustomerPortalSession, getBillingStatus } from "@/lib/api";
import type { OrgSubscription } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/site/toast-provider";

const PLAN_COPY: Record<"starter" | "pro", { title: string; price: string; points: string[] }> = {
  starter: {
    title: "Starter",
    price: "$297 / month",
    points: ["Inbound call handling", "Lead capture and summaries", "Voicemail + routing basics"]
  },
  pro: {
    title: "Pro",
    price: "$497 / month",
    points: ["Everything in Starter", "Advanced routing + escalation", "Higher-touch automation workflows"]
  }
};

function normalizeStatus(status: string | null | undefined) {
  return String(status || "not_active").toLowerCase();
}

function statusStyles(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  if (normalized === "active" || normalized === "trialing") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (normalized === "past_due") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-zinc-200 bg-zinc-100 text-zinc-700";
}

function formatStatus(status: string | null | undefined) {
  return normalizeStatus(status).replace(/_/g, " ");
}

export default function AppBillingPage() {
  const { showToast } = useToast();
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [startingPlan, setStartingPlan] = useState<"starter" | "pro" | null>(null);
  const [changingPlan, setChangingPlan] = useState<"starter" | "pro" | null>(null);

  useEffect(() => {
    void getBillingStatus()
      .then((data) => setSubscription(data.subscription))
      .catch(() => setSubscription(null));
  }, []);

  async function onOpenPortal() {
    setOpeningPortal(true);
    try {
      const data = await createCustomerPortalSession();
      window.location.href = data.url;
    } catch (error) {
      showToast({
        title: "Could not open billing portal",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setOpeningPortal(false);
    }
  }

  async function onStartPlan(plan: "starter" | "pro") {
    setStartingPlan(plan);
    try {
      const data = await createStripeCheckoutSession(plan);
      window.location.href = data.url;
    } catch (error) {
      showToast({
        title: "Checkout failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setStartingPlan(null);
    }
  }

  async function onChangePlan(plan: "starter" | "pro") {
    setChangingPlan(plan);
    try {
      const result = await changeStripePlan(plan);
      const latest = await getBillingStatus();
      setSubscription(latest.subscription);
      showToast({
        title: result.changed ? "Plan updated" : "No changes made",
        description: result.changed
          ? `You are now on ${plan === "pro" ? "Pro" : "Starter"}.`
          : result.message || "Plan is already set."
      });
    } catch (error) {
      showToast({
        title: "Plan change failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setChangingPlan(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Billing</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your subscription, payment method, and invoices.
            </p>
          </div>
          <Badge className={statusStyles(subscription?.status)}>
            {subscription ? `Status: ${formatStatus(subscription.status)}` : "No active subscription"}
          </Badge>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500" />
        <CardHeader>
          <CardTitle>Current subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan</p>
              <p className="mt-1 text-base font-semibold">{subscription?.plan || "No active plan"}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
              <p className="mt-1 text-base font-semibold">{subscription ? formatStatus(subscription.status) : "not active"}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Current period end</p>
              <p className="mt-1 text-base font-semibold">
                {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "-"}
              </p>
            </div>
          </div>

          {subscription ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4">
              <p className="text-sm text-blue-900">
                Manage payment method, invoices, and cancellation in Stripe&apos;s customer portal.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={onOpenPortal} disabled={openingPortal}>
                  {openingPortal ? "Opening..." : "Open Stripe Billing Portal"}
                </Button>
                {subscription.plan === "STARTER" ? (
                  <Button
                    variant="outline"
                    onClick={() => void onChangePlan("pro")}
                    disabled={changingPlan !== null}
                  >
                    {changingPlan === "pro" ? "Upgrading..." : "Upgrade to Pro"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => void onChangePlan("starter")}
                    disabled={changingPlan !== null}
                  >
                    {changingPlan === "starter" ? "Switching..." : "Switch to Starter"}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Choose a plan to activate billing and unlock live production workflow.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {(["starter", "pro"] as const).map((planKey) => (
                  <div
                    key={planKey}
                    className="rounded-lg border bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold">{PLAN_COPY[planKey].title}</h3>
                      <Badge variant="outline" className="border-zinc-300">
                        {PLAN_COPY[planKey].price}
                      </Badge>
                    </div>
                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {PLAN_COPY[planKey].points.map((point) => (
                        <li key={point}>- {point}</li>
                      ))}
                    </ul>
                    <div className="mt-4">
                      <Button
                        variant={planKey === "starter" ? "default" : "outline"}
                        onClick={() => void onStartPlan(planKey)}
                        disabled={startingPlan !== null}
                      >
                        {startingPlan === planKey ? "Starting..." : `Start ${PLAN_COPY[planKey].title}`}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
