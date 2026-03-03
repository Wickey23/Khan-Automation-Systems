"use client";

import { useEffect, useState } from "react";
import { changeStripePlan, createStripeCheckoutSession, createCustomerPortalSession, getBillingStatus } from "@/lib/api";
import type { OrgSubscription } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { useToast } from "@/components/site/toast-provider";

const PLAN_COPY = {
  founding: {
    title: "Founding Partner",
    price: "$249 / month",
    subtitle: "Limited pilot cohort (contract-managed)",
    bestFor: "Best for committed early partners participating in reliability-first pilot feedback cycles.",
    includes: [
      "Everything in Standard call handling and lead capture",
      "High-touch onboarding and implementation",
      "Monthly 30-minute feedback review + structured form",
      "12-month price lock (per founding agreement)"
    ],
    notes: [
      "Limited seat availability and contract approval required.",
      "Founding setup credit: $200 applied in month 6 when participation requirements are met.",
      "Miss 2 consecutive or 3 total feedback cycles: plan reverts to Standard pricing."
    ]
  },
  starter: {
    title: "Standard",
    price: "$349 / month",
    subtitle: "Reliability-first core operations plan",
    bestFor: "Best for teams that need production-ready call handling, lead capture, and operational visibility.",
    includes: [
      "24/7 inbound AI receptionist coverage",
      "Structured call intake and lead capture",
      "Call summaries and transcript logging",
      "Voicemail handling and basic call routing",
      "Client portal access for onboarding, settings, calls, and leads",
      "Admin provisioning support (number + agent setup)"
    ],
    notes: [
      "Phone carrier charges (if applicable) are billed separately.",
      "Founding pricing is managed by contract and may not be shown as a public billing tier."
    ]
  },
  pro: {
    title: "Growth/Pro",
    price: "$599 / month",
    subtitle: "Priority support and expanded operational controls",
    bestFor: "Best for higher-volume teams that need stronger escalation behavior and tighter operational response.",
    includes: [
      "Everything in Standard",
      "Advanced routing and transfer policies",
      "Priority/urgent escalation behavior",
      "Expanded automation workflows for operations",
      "More flexible call-handling configuration",
      "Higher-touch production tuning cadence"
    ],
    notes: [
      "Recommended when multiple staff lines, urgent call triage, or tighter operational controls are required.",
      "Carrier and usage-dependent costs are still separate from subscription."
    ]
  }
} as const;

type PlanKey = keyof typeof PLAN_COPY;
type StripePlanKey = "starter" | "pro";

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

function formatPlan(plan: OrgSubscription["plan"] | null | undefined) {
  if (plan === "PRO") return "Growth/Pro";
  if (plan === "STARTER") return "Standard";
  return "No active plan";
}

export default function AppBillingPage() {
  const { showToast } = useToast();
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [startingPlan, setStartingPlan] = useState<StripePlanKey | null>(null);
  const [changingPlan, setChangingPlan] = useState<StripePlanKey | null>(null);

  useEffect(() => {
    void getBillingStatus()
      .then((data) => {
        setSubscription(data.subscription);
      })
      .catch(() => {
        setSubscription(null);
      });
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

  async function onStartPlan(plan: StripePlanKey) {
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

  async function onChangePlan(plan: StripePlanKey) {
    setChangingPlan(plan);
    try {
      const result = await changeStripePlan(plan);
      const latest = await getBillingStatus();
      setSubscription(latest.subscription);
      showToast({
        title: result.changed ? "Plan updated" : "No changes made",
        description: result.changed
          ? `You are now on ${plan === "pro" ? "Growth/Pro" : "Standard"}.`
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

  const hasRealSubscription = Boolean(subscription);

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
              <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                Plan
                <InfoHint text="Active plan tier used for feature access and pricing." />
              </p>
              <p className="mt-1 text-base font-semibold">{formatPlan(subscription?.plan)}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                Status
                <InfoHint text="Billing state from Stripe (for example active, trialing, or past_due)." />
              </p>
              <p className="mt-1 text-base font-semibold">{subscription ? formatStatus(subscription.status) : "not active"}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                Current period end
                <InfoHint text="Date the current paid billing period ends before renewal." />
              </p>
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
                <Button onClick={onOpenPortal} disabled={openingPortal || !hasRealSubscription}>
                  {openingPortal ? "Opening..." : "Open Stripe Billing Portal"}
                </Button>
                {subscription.plan === "STARTER" ? (
                  <Button
                    variant="outline"
                    onClick={() => void onChangePlan("pro")}
                    disabled={changingPlan !== null || !hasRealSubscription}
                  >
                    {changingPlan === "pro" ? "Upgrading..." : "Upgrade to Growth/Pro"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => void onChangePlan("starter")}
                    disabled={changingPlan !== null || !hasRealSubscription}
                  >
                    {changingPlan === "starter" ? "Switching..." : "Switch to Standard"}
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {subscription
                ? "Compare plans below to see exactly what is included before you change tiers."
                : "Choose a plan to activate billing and unlock live production workflow."}
            </p>
            <div className="grid gap-3 lg:grid-cols-3">
              {(["founding", "starter", "pro"] as const).map((planKey: PlanKey) => {
                const isCurrentPlan =
                  planKey !== "founding" &&
                  subscription &&
                  ((subscription.plan === "STARTER" && planKey === "starter") ||
                    (subscription.plan === "PRO" && planKey === "pro"));

                const actionLabel = isCurrentPlan
                  ? "Current plan"
                  : planKey === "founding"
                    ? "Contract-managed tier"
                  : !subscription
                    ? `Start ${PLAN_COPY[planKey].title}`
                    : planKey === "pro"
                      ? "Upgrade to Growth/Pro"
                      : "Switch to Standard";

                return (
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
                    <p className="mt-1 text-xs text-muted-foreground">{PLAN_COPY[planKey].subtitle}</p>
                    <p className="mt-3 rounded-md border bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                      {PLAN_COPY[planKey].bestFor}
                    </p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Included</p>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {PLAN_COPY[planKey].includes.map((point) => (
                        <li key={point}>- {point}</li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {PLAN_COPY[planKey].notes.map((note) => (
                        <li key={note}>- {note}</li>
                      ))}
                    </ul>
                    <div className="mt-4">
                      <Button
                        variant={planKey === "starter" ? "default" : "outline"}
                        onClick={() => {
                          if (planKey === "founding") return;
                          if (isCurrentPlan) return;
                          if (!subscription) {
                            void onStartPlan(planKey);
                            return;
                          }
                          void onChangePlan(planKey);
                        }}
                        disabled={
                          planKey === "founding" ||
                          isCurrentPlan ||
                          startingPlan !== null ||
                          changingPlan !== null ||
                          (Boolean(subscription) && !hasRealSubscription)
                        }
                      >
                        {startingPlan === planKey || changingPlan === planKey ? "Processing..." : actionLabel}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
