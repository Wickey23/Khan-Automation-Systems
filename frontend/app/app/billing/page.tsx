"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, Plus, Zap } from "lucide-react";
import {
  createPlanChangeSession,
  createStripeCheckoutSession,
  createCustomerPortalSession,
  getBillingDiagnostics,
  scheduleDowngrade,
  getBillingStatus
} from "@/lib/api";
import type { BillingDiagnosticCheck, BillingDiagnosticsPayload, OrgDemoStatus, OrgSubscription } from "@/lib/types";
import { CommandHeader } from "@/components/ops";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHelpFab } from "@/components/ui/page";
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
  const [openingPortal, setOpeningPortal] = useState(false);
  const [startingPlan, setStartingPlan] = useState<StripePlanKey | null>(null);
  const [changingPlan, setChangingPlan] = useState<StripePlanKey | null>(null);

  const refreshBillingAndDiagnostics = useCallback(async () => {
    const [billing, diag] = await Promise.all([getBillingStatus(), getBillingDiagnostics()]);
    setSubscription(billing.subscription);
    setDemo(billing.demo);
    setDiagnostics(diag);
    setDiagnosticsError(null);
  }, []);

  useEffect(() => {
    void refreshBillingAndDiagnostics()
      .catch(() => {
        setSubscription(null);
        setDemo(null);
        setDiagnostics(null);
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
  const billingHighlights = [
    {
      label: "Current plan",
      value: currentPlanCopy.title,
      detail: currentPlanCopy.price
    },
    {
      label: "Subscription status",
      value: subscription ? formatStatus(subscription.status) : "Not active",
      detail: subscription?.currentPeriodEnd ? `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}` : "No billing cycle"
    },
    {
      label: "Diagnostics",
      value: diagnostics?.summary.overall || "UNKNOWN",
      detail: diagnostics?.summary.overall === "HEALTHY" ? "Billing ops are ready." : "Review diagnostics before go-live."
    },
    {
      label: showDemoCard ? "Demo usage" : "Portal access",
      value: showDemoCard ? `${demo?.callsUsed ?? 0}/${demo?.callCap ?? 0}` : diagnostics?.summary.customerPortalReady ? "Ready" : "Review",
      detail: showDemoCard ? "Guided demo consumption." : "Stripe customer self-service access."
    }
  ];
  const primaryBillingCta = hasRealSubscription
    ? { label: openingPortal ? "Opening..." : "Open billing portal", onClick: onOpenPortal, disabled: openingPortal }
    : { label: startingPlan ? "Starting..." : "Start Standard plan", onClick: () => void onStartPlan("starter"), disabled: startingPlan !== null };

  return (
    <div className="space-y-5">
      <CommandHeader
        eyebrow="Billing"
        title="Subscription & Billing"
        description="See plan status, billing health, and the next action to keep this workspace active."
        actions={
          <div className="flex items-center gap-2">
            <Badge className={statusStyles(subscription?.status)}>
              {subscription ? `Status: ${formatStatus(subscription.status)}` : "No active subscription"}
            </Badge>
            <Button size="sm" onClick={primaryBillingCta.onClick} disabled={primaryBillingCta.disabled}>
              {primaryBillingCta.label}
            </Button>
          </div>
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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {billingHighlights.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
            <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
          </div>
        ))}
      </div>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/60 p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Current Plan</p>
                <h2 className="mt-1 text-[2.1rem] font-semibold leading-none tracking-tight text-primary">{currentPlanCopy.title}</h2>
              </div>
            </div>
              <div className="flex flex-wrap gap-2">
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
              <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Plan Features</h3>
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

            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Usage This Month</h3>
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

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50/60 p-8">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-900">Payment Method</h3>
          </div>
          <div className="flex h-full flex-col justify-between p-8">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
              <div className="mb-8 flex items-center justify-between">
                <CreditCard className="h-8 w-8 text-slate-400" />
                <span className="rounded-md bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                  Default
                </span>
              </div>
              <p className="text-xl font-semibold tracking-[0.24em] text-slate-900">**** **** **** {maskedCustomerDigits}</p>
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
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
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
                      {row.label === "Customer Portal" ? (
                        <Button size="sm" variant="outline" onClick={onOpenPortal} disabled={!hasRealSubscription || openingPortal}>
                          {openingPortal ? "Opening..." : row.action}
                        </Button>
                      ) : row.label === "Plan Change" ? (
                        isActiveSubscription ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void onChangePlan(subscription?.plan === "PRO" ? "starter" : "pro")}
                            disabled={changingPlan !== null}
                          >
                            {changingPlan ? "Working..." : row.action}
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => void onStartPlan("starter")} disabled={startingPlan !== null}>
                            {startingPlan ? "Starting..." : row.action}
                          </Button>
                        )
                      ) : hasRealSubscription ? (
                        <span className="text-sm text-slate-500">Managed</span>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => void onStartPlan("starter")} disabled={startingPlan !== null}>
                          {startingPlan ? "Starting..." : row.action}
                        </Button>
                      )}
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
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
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








