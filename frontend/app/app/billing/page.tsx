"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, Download, Plus, Zap } from "lucide-react";
import {
  createPlanChangeSession,
  createStripeCheckoutSession,
  createCustomerPortalSession,
  fetchOrgAnalytics,
  fetchOrgProfile,
  getBillingDiagnostics,
  scheduleDowngrade,
  getBillingStatus
} from "@/lib/api";
import type { BillingDiagnosticCheck, BillingDiagnosticsPayload, OrgAccessSummary, OrgAnalytics, OrgDemoStatus, OrgSubscription } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, PageHelpFab } from "@/components/ui/page";
import { useToast } from "@/components/site/toast-provider";
import { frontDeskEmptyStateClass, frontDeskWorkspaceCardClass } from "@/lib/front-desk-ui";

const PLAN_COPY = {
  none: {
    title: "No Plan",
    price: "$0 / month",
    subtitle: "Account created, subscription not active",
    bestFor: "Best for setup and evaluation before activating paid call handling.",
    includes: [
      "Account access and basic workspace setup",
      "Plan selection and checkout initiation",
      "No production call-handling runtime until subscription activation"
    ],
    notes: [
      "Upgrade to Standard or Growth/Pro to enable live operations.",
      "Carrier/provider usage is not active until a paid plan is enabled."
    ]
  },
  founding: {
    title: "Founding Partner",
    price: "$249 / month",
    subtitle: "Limited-time offer: first 5 founding partners (contract-managed)",
    bestFor: "Best for committed early partners participating in reliability-first pilot feedback cycles.",
    includes: [
      "Everything in Standard call handling and lead capture",
      "High-touch onboarding and implementation",
      "Monthly 30-minute feedback review + structured form",
      "12-month price lock (per founding agreement)"
    ],
    notes: [
      "Limited to the first 5 approved founding partners.",
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
type StripePlanKey = "starter" | "pro" | "founding";
const PLAN_ORDER: PlanKey[] = ["none", "starter", "founding", "pro"];
const PLAN_CAPACITY = {
  none: { calls: 20, sms: 10, booking: 6 },
  starter: { calls: 60, sms: 40, booking: 18 },
  pro: { calls: 180, sms: 120, booking: 45 }
} as const;
const PLAN_OPERATIONS_VALUE = {
  none: "Setup and evaluation mode before live operations.",
  starter: "Reliability-first operational baseline for live call handling.",
  pro: "Higher-throughput operations with stronger automation and priority handling."
} as const;

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

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

function diagBadgeClass(value: BillingDiagnosticsPayload["summary"]["overall"]) {
  if (value === "HEALTHY") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "BLOCKED") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function checkBadgeClass(value: BillingDiagnosticCheck["status"]) {
  if (value === "PASS") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "FAIL") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function humanizeCheckKey(key: string) {
  const labels: Record<string, string> = {
    stripeSecretConfigured: "Stripe Secret",
    starterPriceConfigured: "Standard Price Configured",
    proPriceConfigured: "Pro Price Configured",
    successCancelUrlsConfigured: "Checkout URLs",
    portalReturnUrlConfigured: "Portal Return URL",
    starterPriceResolvable: "Standard Price Reachable",
    proPriceResolvable: "Pro Price Reachable",
    stripeApiReachable: "Stripe API Reachability",
    orgContextResolved: "Workspace Context",
    stripeCustomerLinked: "Stripe Customer Linked",
    subscriptionRecordPresent: "Subscription Record",
    subscriptionStripeIdsPresent: "Subscription Stripe IDs",
    subscriptionStatusActionable: "Subscription Status"
  };
  return labels[key] || key;
}

function humanizeIssue(issue: string) {
  const labels: Record<string, string> = {
    STRIPE_PING_TIMEOUT: "Stripe check timed out.",
    STRIPE_PRICE_NOT_FOUND: "Configured Stripe price ID was not found.",
    STRIPE_AUTH_OR_NETWORK_ERROR: "Stripe auth/network issue.",
    diagnostics_rate_limited_try_again: "Diagnostics rate-limited. Try again shortly.",
    stripeSecretConfigured: "Stripe secret key is not configured for this environment."
  };
  return labels[issue] || issue;
}

export default function AppBillingPage() {
  const { showToast } = useToast();
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [demo, setDemo] = useState<OrgDemoStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<BillingDiagnosticsPayload | null>(null);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null);
  const [accessSummary, setAccessSummary] = useState<OrgAccessSummary | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [startingPlan, setStartingPlan] = useState<StripePlanKey | null>(null);
  const [changingPlan, setChangingPlan] = useState<StripePlanKey | null>(null);

  const refreshBillingAndDiagnostics = useCallback(async () => {
    const [billing, diag, analyticsResult, profileResult] = await Promise.allSettled([
      getBillingStatus(),
      getBillingDiagnostics(),
      fetchOrgAnalytics({ range: "7d" }),
      fetchOrgProfile()
    ]);
    const billingData = billing.status === "fulfilled" ? billing.value : { subscription: null, demo: null };
    setSubscription(billingData.subscription);
    setDemo(billingData.demo);
    setDiagnostics(diag.status === "fulfilled" ? diag.value : null);
    setAnalytics(analyticsResult.status === "fulfilled" ? analyticsResult.value : null);
    setAccessSummary(profileResult.status === "fulfilled" ? profileResult.value.access : null);
    setDiagnosticsError(diag.status === "fulfilled" ? null : "Diagnostics unavailable.");
  }, []);

  useEffect(() => {
    void refreshBillingAndDiagnostics()
      .catch(() => {
        setSubscription(null);
        setDemo(null);
        setDiagnostics(null);
        setAnalytics(null);
        setAccessSummary(null);
        setDiagnosticsError("Diagnostics unavailable.");
      });

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshBillingAndDiagnostics().catch(() => null);
      }
    };
    const onFocus = () => {
      void refreshBillingAndDiagnostics().catch(() => null);
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshBillingAndDiagnostics]);

  async function refreshDiagnostics() {
    try {
      const data = await getBillingDiagnostics();
      setDiagnostics(data);
      setDiagnosticsError(null);
    } catch {
      setDiagnosticsError("Diagnostics unavailable.");
    }
  }

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
      void refreshDiagnostics();
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
      void refreshDiagnostics();
    } finally {
      setStartingPlan(null);
    }
  }

  async function onChangePlan(plan: "starter" | "pro") {
    const isDowngrade = plan === "starter";
    const confirmed = window.confirm(
      isDowngrade
        ? "Downgrade applies at the end of the current billing period. Continue in Stripe?"
        : "You will confirm this upgrade in Stripe. Continue?"
    );
    if (!confirmed) return;

    setChangingPlan(plan);
    try {
      const hosted = await createPlanChangeSession({
        targetPlan: plan,
        effective: isDowngrade ? "period_end" : "immediate"
      });

      if (hosted.url) {
        window.location.href = hosted.url;
        return;
      }

      if (isDowngrade) {
        const scheduled = await scheduleDowngrade({ targetPlan: "starter" });
        const latest = await getBillingStatus();
        setSubscription(latest.subscription);
        setDemo(latest.demo);
        showToast({
          title: "Downgrade scheduled",
          description: `Downgrade applies on ${new Date(scheduled.effectiveAt).toLocaleDateString()}.`
        });
        return;
      }

      throw new Error(hosted.message || "Could not create Stripe hosted confirmation session.");
    } catch (error) {
      showToast({
        title: "Plan change failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
      void refreshDiagnostics();
    } finally {
      setChangingPlan(null);
    }
  }

  const hasRealSubscription = Boolean(subscription);
  const isActiveSubscription = ACTIVE_STATUSES.has(normalizeStatus(subscription?.status));
  const showDemoCard = !subscription && demo?.mode === "GUIDED_DEMO";
  const currentPlanKey: PlanKey = !subscription ? "none" : subscription.plan === "PRO" ? "pro" : "starter";
  const currentPlanCopy = PLAN_COPY[currentPlanKey];
  const maskedCustomerDigits = subscription?.stripeCustomerId ? subscription.stripeCustomerId.slice(-4) : "4242";
  const resolvedPlan = accessSummary?.plan.name || (subscription?.plan === "PRO" ? "PRO" : subscription?.plan === "STARTER" ? "STARTER" : "NONE");
  const planCapacity = resolvedPlan === "PRO" ? PLAN_CAPACITY.pro : resolvedPlan === "STARTER" ? PLAN_CAPACITY.starter : PLAN_CAPACITY.none;
  const suggestedPlanKey: "starter" | "pro" | null = currentPlanKey === "none" ? "starter" : currentPlanKey === "starter" ? "pro" : null;
  const suggestedPlanCopy = suggestedPlanKey ? PLAN_COPY[suggestedPlanKey] : null;
  const suggestedPlanCapacity = suggestedPlanKey ? PLAN_CAPACITY[suggestedPlanKey] : null;
  const capacityRows = [
    {
      label: "Call volume",
      usage: analytics?.kpis.totalCalls || 0,
      limit: planCapacity.calls
    },
    {
      label: "SMS threads",
      usage: analytics?.kpis.smsThreads || 0,
      limit: planCapacity.sms
    },
    {
      label: "Booking demand",
      usage: analytics?.kpis.appointmentRequests || 0,
      limit: planCapacity.booking
    }
  ].map((row) => {
    const percent = Math.round((row.usage / Math.max(row.limit, 1)) * 100);
    const state = percent >= 100 ? "over" : percent >= 80 ? "near" : "healthy";
    return { ...row, percent, state };
  });
  const hasCapacityNudge = capacityRows.some((row) => row.state !== "healthy");
  const topCapacityPressure = [...capacityRows].sort((a, b) => b.percent - a.percent)[0] || null;
  const planComparisonRows = [
    {
      key: "calls",
      label: "Call throughput",
      usage: analytics?.kpis.totalCalls || 0,
      currentLimit: planCapacity.calls,
      upgradeLimit: suggestedPlanCapacity?.calls || null
    },
    {
      key: "sms",
      label: "Messaging throughput",
      usage: analytics?.kpis.smsThreads || 0,
      currentLimit: planCapacity.sms,
      upgradeLimit: suggestedPlanCapacity?.sms || null
    },
    {
      key: "booking",
      label: "Booking demand",
      usage: analytics?.kpis.appointmentRequests || 0,
      currentLimit: planCapacity.booking,
      upgradeLimit: suggestedPlanCapacity?.booking || null
    }
  ];
  const personalizationCopy = topCapacityPressure
    ? `You've handled ${topCapacityPressure.usage} ${topCapacityPressure.label.toLowerCase()} signals this week. ${currentPlanCopy.title} is optimized for lower operational load, while ${suggestedPlanCopy?.title || "your current plan"} provides more headroom.`
    : "Your usage is currently within plan guidance.";
  const activeFeatures = currentPlanCopy.includes.slice(0, 5);
  const usageRows = [
    {
      label: "Customer Portal",
      current: diagnostics?.summary.customerPortalReady ? 1 : 0,
      total: 1,
      percent: diagnostics?.summary.customerPortalReady ? 100 : 25
    },
    {
      label: "Plan Change",
      current: diagnostics?.summary.changePlanReady ? 1 : 0,
      total: 1,
      percent: diagnostics?.summary.changePlanReady ? 100 : 20
    },
    {
      label: showDemoCard ? "Demo Calls" : "Checkout",
      current: showDemoCard ? demo?.callsUsed ?? 0 : diagnostics?.summary.checkoutReady ? 1 : 0,
      total: showDemoCard ? Math.max(demo?.callCap ?? 15, 1) : 1,
      percent: showDemoCard
        ? Math.min(100, Math.round(((demo?.callsUsed ?? 0) / Math.max(demo?.callCap ?? 15, 1)) * 100))
        : diagnostics?.summary.checkoutReady
          ? 100
          : 20
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing"
        title="Billing"
        description="Manage your subscription, payment method, invoices, and billing diagnostics."
        actions={
          <Badge className={statusStyles(subscription?.status)}>
            {subscription ? `Status: ${formatStatus(subscription.status)}` : "No active subscription"}
          </Badge>
        }
      />

      <PageHelpFab
        items={[
          {
            label: "Use this page",
            text: "Use Billing to keep the production front desk active, paid, and free from subscription or payment blockers."
          },
          {
            label: "Start here",
            text: "Check the current subscription status and diagnostics first, then open the billing portal if you need to update the plan or fix payment issues."
          },
          {
            label: "Go next",
            text: "After resolving billing, return to Front Desk or Receptionist Setup to confirm calls, texting, and booking are no longer blocked."
          }
        ]}
      />

      <section className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_360px]">
        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/60 p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Current Plan</p>
                <h2 className="mt-1 text-[2.1rem] font-black leading-none tracking-tight text-primary">{currentPlanCopy.title}</h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {hasRealSubscription ? (
                <Button variant="outline" onClick={onOpenPortal} disabled={openingPortal}>
                  {openingPortal ? "Opening..." : "Open Portal"}
                </Button>
              ) : null}
              {isActiveSubscription && subscription?.plan === "STARTER" ? (
                <Button variant="outline" onClick={() => void onChangePlan("pro")} disabled={changingPlan !== null}>
                  {changingPlan === "pro" ? "Upgrading..." : "Change Plan"}
                </Button>
              ) : null}
              {isActiveSubscription && subscription?.plan === "PRO" ? (
                <Button variant="outline" onClick={() => void onChangePlan("starter")} disabled={changingPlan !== null}>
                  {changingPlan === "starter" ? "Switching..." : "Change Plan"}
                </Button>
              ) : null}
              {!hasRealSubscription ? (
                <Button onClick={() => void onStartPlan("starter")} disabled={startingPlan !== null}>
                  {startingPlan ? "Starting..." : "Start Plan"}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-10 p-8 md:grid-cols-[1fr_0.95fr]">
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Plan Features</h3>
              <ul className="mt-6 space-y-4">
                {activeFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-base font-medium text-slate-700">
                    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <Check className="h-4 w-4" />
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Usage This Month</h3>
                <div className="mt-5 space-y-5">
                  {usageRows.map((row) => (
                    <div key={row.label}>
                      <div className="mb-2 flex items-center justify-between gap-4 text-sm font-bold">
                        <span className="text-slate-600">{row.label}</span>
                        <span className="text-slate-950">
                          {row.current} / {row.total}
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${row.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-100 pt-5">
                <p className="text-sm text-slate-500">
                  Next billing date:{" "}
                  <span className="font-bold text-slate-900">
                    {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "Not scheduled"}
                  </span>
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Status: <span className="font-bold text-slate-900">{subscription ? formatStatus(subscription.status) : "not active"}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50/60 p-8">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900">Payment Method</h3>
          </div>
          <div className="flex h-full flex-col justify-between p-8">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <div className="mb-8 flex items-center justify-between">
                <CreditCard className="h-8 w-8 text-slate-400" />
                <span className="rounded-md bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  Default
                </span>
              </div>
              <p className="text-xl font-black tracking-[0.24em] text-slate-900">•••• •••• •••• {maskedCustomerDigits}</p>
              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Billing Access</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {diagnostics?.summary.customerPortalReady ? "Stripe portal connected" : "Portal needs review"}
                  </p>
                </div>
                <p className="text-sm font-medium text-slate-500">
                  {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "-- / --"}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Button className="w-full" onClick={onOpenPortal} disabled={openingPortal || !hasRealSubscription}>
                {openingPortal ? "Opening..." : "Manage in Stripe"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => void onStartPlan(subscription?.plan === "PRO" ? "pro" : "starter")}
                disabled={startingPlan !== null || hasRealSubscription}
              >
                <Plus className="mr-2 h-4 w-4" />
                {startingPlan ? "Starting..." : "Add New Card"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Plan capacity visibility</p>
            <p className="mt-1 text-sm text-slate-700">
              Soft limits for the current plan, mapped to the latest 7-day operational usage.
            </p>
          </div>
          <Badge className={hasCapacityNudge ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
            {hasCapacityNudge ? "Near soft limits" : "Within soft limits"}
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {capacityRows.map((row) => (
            <div key={row.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{row.label}</p>
                <Badge className={row.state === "over" ? "border-red-200 bg-red-50 text-red-700" : row.state === "near" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
                  {row.state === "over" ? "Over soft limit" : row.state === "near" ? "Near soft limit" : "Healthy"}
                </Badge>
              </div>
              <p className="mt-2 text-lg font-black text-slate-900">
                {row.usage} / {row.limit}
              </p>
              <div className="mt-2 h-2 rounded-full bg-white">
                <div
                  className={row.state === "over" ? "h-full rounded-full bg-red-500" : row.state === "near" ? "h-full rounded-full bg-amber-500" : "h-full rounded-full bg-emerald-500"}
                  style={{ width: `${Math.min(row.percent, 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {row.state === "over"
                  ? "Current demand is above starter guidance. Upgrading adds operational headroom."
                  : row.state === "near"
                    ? "Usage is approaching guidance for this plan."
                    : "Usage is currently aligned with plan guidance."}
              </p>
            </div>
          ))}
        </div>
        {hasCapacityNudge ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <p className="text-sm text-slate-700">
              Upgrade when ready to increase capacity as usage grows across calls, messaging, and booking workflows.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                if (hasRealSubscription) {
                  void onOpenPortal();
                  return;
                }
                void onStartPlan("starter");
              }}
              disabled={openingPortal || startingPlan !== null}
            >
              {hasRealSubscription ? "Increase capacity" : "View plans"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Plan comparison</p>
            <p className="mt-1 text-sm text-slate-700">
              Compare operational capacity against your current weekly usage before deciding to upgrade.
            </p>
          </div>
          <Badge className="border-slate-200 bg-slate-50 text-slate-700">
            Current: {currentPlanCopy.title}
          </Badge>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Current plan</p>
            <p className="mt-2 text-lg font-black text-slate-900">{currentPlanCopy.title}</p>
            <p className="mt-1 text-sm text-slate-700">{PLAN_OPERATIONS_VALUE[currentPlanKey]}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Recommended next plan</p>
            {suggestedPlanCopy ? (
              <>
                <p className="mt-2 text-lg font-black text-slate-900">{suggestedPlanCopy.title}</p>
                <p className="mt-1 text-sm text-slate-700">{PLAN_OPERATIONS_VALUE[suggestedPlanKey as "starter" | "pro"]}</p>
              </>
            ) : (
              <>
                <p className="mt-2 text-lg font-black text-slate-900">Growth/Pro</p>
                <p className="mt-1 text-sm text-slate-700">You are already on the highest self-serve tier.</p>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span>Capacity area</span>
            <span className="text-right">Usage (7d)</span>
            <span className="text-right">{currentPlanCopy.title}</span>
            <span className="text-right">{suggestedPlanCopy ? suggestedPlanCopy.title : "Current tier"}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {planComparisonRows.map((row) => (
              <div key={row.key} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] px-4 py-3 text-sm">
                <span className="font-medium text-slate-800">{row.label}</span>
                <span className="text-right text-slate-700">{row.usage}</span>
                <span className="text-right text-slate-700">{row.currentLimit}</span>
                <span className="text-right font-semibold text-slate-900">{row.upgradeLimit ?? row.currentLimit}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-700">{personalizationCopy}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!suggestedPlanKey) return;
                if (!hasRealSubscription) {
                  void onStartPlan(suggestedPlanKey);
                  return;
                }
                void onChangePlan(suggestedPlanKey);
              }}
              disabled={(!suggestedPlanKey) || startingPlan !== null || changingPlan !== null}
            >
              {suggestedPlanKey === "pro" ? "Upgrade to Pro" : suggestedPlanKey === "starter" ? "View plan details" : "Current tier"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (hasRealSubscription) {
                  void onOpenPortal();
                  return;
                }
                void onStartPlan("starter");
              }}
              disabled={openingPortal || startingPlan !== null}
            >
              View plan details
            </Button>
          </div>
        </div>
      </div>

      {showDemoCard ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm">
          <p className="font-semibold text-amber-900">Guided Demo Mode</p>
          <p className="mt-1 text-amber-900/90">
            Evaluation mode only. This workspace still needs a paid subscription before live runtime begins.
          </p>
        </div>
      ) : null}

      {subscription?.pendingPlan ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="text-sm font-semibold text-amber-900">Pending change</p>
          <p className="mt-1 text-xs text-amber-900/90">
            {subscription.pendingPlan === "STARTER" ? "Downgrade to Standard" : "Upgrade to Growth/Pro"}
            {subscription.pendingPlanEffectiveAt
              ? ` scheduled for ${new Date(subscription.pendingPlanEffectiveAt).toLocaleDateString()}`
              : " scheduled for the next billing cycle"}
            .
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className={`${frontDeskWorkspaceCardClass("default")} overflow-hidden`}>
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200 bg-white/80">
            <CardTitle>Billing operations</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => void refreshDiagnostics()}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-6 py-4">Check</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Details</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  {
                    label: "Customer Portal",
                    status: diagnostics?.summary.customerPortalReady ? "Ready" : "Review",
                    detail: diagnostics?.summary.customerPortalReady
                      ? "Customers can manage payment methods and invoices."
                      : "Billing access needs attention before self-service updates are reliable.",
                    action: hasRealSubscription ? "Open Portal" : "Unavailable"
                  },
                  {
                    label: "Plan Change",
                    status: diagnostics?.summary.changePlanReady ? "Ready" : "Blocked",
                    detail: "Confirms whether this workspace can safely switch tiers right now.",
                    action: isActiveSubscription ? "Change Plan" : "Start Plan"
                  },
                  {
                    label: "Checkout",
                    status: diagnostics?.summary.checkoutReady ? "Ready" : "Blocked",
                    detail: showDemoCard
                      ? "Demo workspaces need a paid plan before live runtime begins."
                      : "Controls whether this workspace can start or renew a paid subscription.",
                    action: hasRealSubscription ? "Managed" : "Checkout"
                  }
                ].map((row) => (
                  <tr key={row.label} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{row.label}</td>
                    <td className="px-6 py-4">
                      <Badge className={row.status === "Ready" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{row.detail}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                        {row.action}
                        <Download className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className={`${frontDeskWorkspaceCardClass("default")} overflow-hidden`}>
          <CardHeader>
            <CardTitle>Billing diagnostics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
          {showDemoCard ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-sm font-semibold text-amber-900">Guided Demo Mode</p>
              <p className="mt-1 text-xs text-amber-900/90">
                Evaluation mode only. This is not live deployment and has strict call limits until you activate a paid plan.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Usage</p>
                  <p className="text-sm font-semibold">
                    {demo?.callsUsed ?? 0}/{demo?.callCap ?? 15} calls
                  </p>
                </div>
                <div className="rounded-xl border bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">State</p>
                  <p className="text-sm font-semibold">{demo?.state || "ACTIVE"}</p>
                </div>
                <div className="rounded-xl border bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Window end</p>
                  <p className="text-sm font-semibold">
                    {demo?.windowEndsAt ? new Date(demo.windowEndsAt).toLocaleDateString() : "Starts on first AI call"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="grid gap-4 md:grid-cols-2">
              {PLAN_ORDER.map((planKey: PlanKey) => {
                const isCurrentPlan =
                  planKey !== "founding" &&
                  isActiveSubscription &&
                  ((subscription?.plan === "STARTER" && planKey === "starter") ||
                    (subscription?.plan === "PRO" && planKey === "pro"));
                const isNoPlanCurrent = !subscription && planKey === "none";

                const actionLabel = isCurrentPlan
                  ? "Current plan"
                  : isNoPlanCurrent
                    ? "Current plan"
                  : planKey === "founding" && isActiveSubscription
                    ? "Contract-managed tier"
                  : planKey === "none"
                    ? "No active subscription"
                    : !isActiveSubscription
                    ? `Start ${PLAN_COPY[planKey].title}`
                    : planKey === "pro"
                      ? "Upgrade to Growth/Pro"
                      : "Switch to Standard";

                return (
                  <div
                    key={planKey}
                    className={`flex h-full flex-col rounded-2xl border p-5 ${
                      planKey === "founding"
                        ? "border-amber-300 bg-amber-50/40"
                        : "bg-white shadow-sm"
                    }`}
                  >
                    {planKey === "founding" ? (
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                          Limited Time
                        </span>
                        <span className="inline-flex rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                          First 5 Seats
                        </span>
                      </div>
                    ) : null}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-semibold leading-tight">{PLAN_COPY[planKey].title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{PLAN_COPY[planKey].subtitle}</p>
                      </div>
                      <Badge variant="outline" className="border-zinc-300">
                        {PLAN_COPY[planKey].price}
                      </Badge>
                    </div>
                    {planKey === "founding" ? (
                      <p className="mt-2 text-xs font-medium text-amber-800">Enrollment closes once all 5 seats are filled.</p>
                    ) : null}
                    <p className="mt-3 rounded-xl border bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                      {PLAN_COPY[planKey].bestFor}
                    </p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Included</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground marker:text-zinc-400">
                      {PLAN_COPY[planKey].includes.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground marker:text-zinc-400">
                      {PLAN_COPY[planKey].notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-4">
                      <Button
                        variant={planKey === "starter" ? "default" : "outline"}
                        className={planKey === "founding" ? "border-amber-300 text-amber-800 hover:bg-amber-50" : undefined}
                        onClick={() => {
                          if (planKey === "none") return;
                          if (planKey === "founding") return;
                          if (isCurrentPlan) return;
                          if (!isActiveSubscription) {
                            void onStartPlan(planKey);
                            return;
                          }
                          void onChangePlan(planKey);
                        }}
                        disabled={
                          planKey === "none" ||
                          (planKey === "founding" && isActiveSubscription) ||
                          isNoPlanCurrent ||
                          isCurrentPlan ||
                          startingPlan !== null ||
                          changingPlan !== null
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

          {diagnosticsError ? (
            <div className="rounded-[20px] border border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.96)_0%,rgba(254,243,199,0.92)_100%)] p-4 text-amber-950 shadow-[0_12px_24px_rgba(217,119,6,0.10)]">
              {diagnosticsError} Billing actions are still available.
            </div>
          ) : null}

          {diagnostics ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={diagBadgeClass(diagnostics.summary.overall)}>Overall: {diagnostics.summary.overall}</Badge>
                <Badge variant="outline">Checkout: {diagnostics.summary.checkoutReady ? "Ready" : "Blocked"}</Badge>
                <Badge variant="outline">Plan change: {diagnostics.summary.changePlanReady ? "Ready" : "Blocked"}</Badge>
                <Badge variant="outline">Portal: {diagnostics.summary.customerPortalReady ? "Ready" : "Blocked"}</Badge>
                <span className="text-xs text-muted-foreground">
                  Updated {new Date(diagnostics.evaluatedAt).toLocaleTimeString()}
                </span>
              </div>

              {diagnostics.summary.topIssues?.length ? (
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top issues</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {[...new Set(diagnostics.summary.topIssues)].map((issue) => (
                      <li key={issue}>{humanizeIssue(issue)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {diagnostics.detailed && diagnostics.checks ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {([
                    ["Config checks", diagnostics.checks.config],
                    ["Stripe checks", diagnostics.checks.stripe],
                    ["Org linkage", diagnostics.checks.orgLinkage]
                  ] as Array<[string, BillingDiagnosticCheck[]]>).map(([title, list]) => (
                    <div key={title} className={frontDeskWorkspaceCardClass("subtle")}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
                      <div className="mt-2 space-y-2">
                        {list.map((check) => (
                          <div key={check.key} className="rounded-xl border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium">{humanizeCheckKey(check.key)}</p>
                              <Badge className={checkBadgeClass(check.status)}>{check.status}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{check.message}</p>
                            {check.fixHint ? <p className="mt-1 text-xs text-muted-foreground">Fix: {check.fixHint}</p> : null}
                            {check.maskedRef ? (
                              <p className="mt-1 text-xs text-muted-foreground">Ref: {check.maskedRef}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={frontDeskEmptyStateClass()}>
                  <p className="text-xs text-muted-foreground">
                    Internal diagnostics are restricted to platform admins. You can still use checkout, plan change, and billing portal actions normally.
                  </p>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

