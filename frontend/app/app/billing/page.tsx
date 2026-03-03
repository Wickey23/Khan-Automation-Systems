"use client";

import { useEffect, useMemo, useState } from "react";
import { changeStripePlan, createStripeCheckoutSession, createCustomerPortalSession, getBillingStatus } from "@/lib/api";
import type { OrgSubscription } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { useToast } from "@/components/site/toast-provider";

const PLAN_COPY: Record<
  "starter" | "pro",
  { title: string; price: string; subtitle: string; bestFor: string; includes: string[]; notes: string[] }
> = {
  starter: {
    title: "Starter",
    price: "$297 / month",
    subtitle: "Core AI receptionist for single-location operators",
    bestFor: "Best for shops that want immediate 24/7 call coverage with practical intake and follow-up.",
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
      "Advanced transfer logic and higher-touch automation are available in Pro."
    ]
  },
  pro: {
    title: "Pro",
    price: "$497 / month",
    subtitle: "Advanced routing and escalation for higher-volume operations",
    bestFor: "Best for teams that need stronger escalation rules, priority handling, and richer automation.",
    includes: [
      "Everything in Starter",
      "Advanced routing and transfer policies",
      "Priority/urgent escalation behavior",
      "Expanded automation workflows for operations",
      "More flexible call-handling configuration",
      "Faster iteration cadence for production tuning"
    ],
    notes: [
      "Recommended when multiple staff lines, urgent call triage, or tighter operational controls are required.",
      "Carrier and usage-dependent costs are still separate from subscription."
    ]
  }
};

type BillingPreviewPlan = "none" | "starter" | "pro";
const PREVIEW_PLANS: BillingPreviewPlan[] = ["none", "starter", "pro"];

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

function subscriptionToPreviewPlan(source: OrgSubscription | null): BillingPreviewPlan {
  if (!source) return "none";
  return source.plan === "PRO" ? "pro" : "starter";
}

function toPreviewSubscription(plan: BillingPreviewPlan, source: OrgSubscription | null): OrgSubscription | null {
  if (plan === "none") return null;
  if (source) {
    return {
      ...source,
      plan: plan === "pro" ? "PRO" : "STARTER"
    };
  }
  return {
    id: "preview-subscription",
    status: "active",
    plan: plan === "pro" ? "PRO" : "STARTER",
    currentPeriodEnd: null,
    stripeCustomerId: "preview-customer",
    stripeSubscriptionId: "preview-subscription"
  };
}

export default function AppBillingPage() {
  const { showToast } = useToast();
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [startingPlan, setStartingPlan] = useState<"starter" | "pro" | null>(null);
  const [changingPlan, setChangingPlan] = useState<"starter" | "pro" | null>(null);
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [previewPlan, setPreviewPlan] = useState<BillingPreviewPlan>("none");

  useEffect(() => {
    void getBillingStatus()
      .then((data) => {
        setSubscription(data.subscription);
        setPreviewPlan(subscriptionToPreviewPlan(data.subscription));
      })
      .catch(() => {
        setSubscription(null);
        setPreviewPlan("none");
      });
  }, []);

  const effectiveSubscription = useMemo(
    () => (previewEnabled ? toPreviewSubscription(previewPlan, subscription) : subscription),
    [previewEnabled, previewPlan, subscription]
  );

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
      setPreviewPlan(subscriptionToPreviewPlan(latest.subscription));
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

  const previewIndex = PREVIEW_PLANS.indexOf(previewPlan);
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
          <Badge className={statusStyles(effectiveSubscription?.status)}>
            {effectiveSubscription ? `Status: ${formatStatus(effectiveSubscription.status)}` : "No active subscription"}
          </Badge>
        </div>

        <div className="mt-4 rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Billing plan preview (temporary)
              <InfoHint text="Preview mode only changes UI visuals and does not modify your real Stripe subscription." />
            </p>
            {previewEnabled ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPreviewEnabled(false);
                  setPreviewPlan(subscriptionToPreviewPlan(subscription));
                }}
              >
                Return to live data
              </Button>
            ) : null}
          </div>
          <div className="mt-3 space-y-2">
            <input
              type="range"
              min={0}
              max={2}
              step={1}
              value={previewIndex}
              onChange={(event) => {
                const idx = Number(event.target.value);
                setPreviewPlan(PREVIEW_PLANS[idx] || "none");
                setPreviewEnabled(true);
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>No plan</span>
              <span>Starter</span>
              <span>Pro</span>
            </div>
            {previewEnabled ? (
              <p className="text-xs text-amber-700">Preview mode enabled. This only changes plan visuals and does not update Stripe or backend.</p>
            ) : null}
          </div>
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
              <p className="mt-1 text-base font-semibold">{effectiveSubscription?.plan || "No active plan"}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                Status
                <InfoHint text="Billing state from Stripe (for example active, trialing, or past_due)." />
              </p>
              <p className="mt-1 text-base font-semibold">{effectiveSubscription ? formatStatus(effectiveSubscription.status) : "not active"}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                Current period end
                <InfoHint text="Date the current paid billing period ends before renewal." />
              </p>
              <p className="mt-1 text-base font-semibold">
                {effectiveSubscription?.currentPeriodEnd ? new Date(effectiveSubscription.currentPeriodEnd).toLocaleDateString() : "-"}
              </p>
            </div>
          </div>

          {effectiveSubscription ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4">
              <p className="text-sm text-blue-900">
                Manage payment method, invoices, and cancellation in Stripe&apos;s customer portal.
              </p>
              {!hasRealSubscription ? (
                <p className="mt-2 text-xs text-amber-700">Preview state only: no real subscription exists for this account yet.</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={onOpenPortal} disabled={openingPortal || previewEnabled || !hasRealSubscription}>
                  {openingPortal ? "Opening..." : "Open Stripe Billing Portal"}
                </Button>
                {effectiveSubscription.plan === "STARTER" ? (
                  <Button
                    variant="outline"
                    onClick={() => void onChangePlan("pro")}
                    disabled={changingPlan !== null || previewEnabled || !hasRealSubscription}
                  >
                    {changingPlan === "pro" ? "Upgrading..." : "Upgrade to Pro"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => void onChangePlan("starter")}
                    disabled={changingPlan !== null || previewEnabled || !hasRealSubscription}
                  >
                    {changingPlan === "starter" ? "Switching..." : "Switch to Starter"}
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {effectiveSubscription
                ? "Compare plans below to see exactly what is included before you change tiers."
                : "Choose a plan to activate billing and unlock live production workflow."}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {(["starter", "pro"] as const).map((planKey) => {
                const isCurrentPlan =
                  effectiveSubscription &&
                  ((effectiveSubscription.plan === "STARTER" && planKey === "starter") ||
                    (effectiveSubscription.plan === "PRO" && planKey === "pro"));

                const actionLabel = isCurrentPlan
                  ? "Current plan"
                  : !effectiveSubscription
                    ? `Start ${PLAN_COPY[planKey].title}`
                    : planKey === "pro"
                      ? "Upgrade to Pro"
                      : "Switch to Starter";

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
                          if (isCurrentPlan) return;
                          if (!effectiveSubscription) {
                            void onStartPlan(planKey);
                            return;
                          }
                          void onChangePlan(planKey);
                        }}
                        disabled={
                          isCurrentPlan ||
                          previewEnabled ||
                          startingPlan !== null ||
                          changingPlan !== null ||
                          (Boolean(effectiveSubscription) && !hasRealSubscription)
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
