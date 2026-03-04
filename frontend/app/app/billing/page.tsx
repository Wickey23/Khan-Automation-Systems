"use client";

import { useEffect, useState } from "react";
import {
  changeStripePlan,
  createStripeCheckoutSession,
  createCustomerPortalSession,
  getBillingDiagnostics,
  getBillingStatus
} from "@/lib/api";
import type { BillingDiagnosticCheck, BillingDiagnosticsPayload, OrgDemoStatus, OrgSubscription } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { useToast } from "@/components/site/toast-provider";

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
type StripePlanKey = "starter" | "pro";
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

function formatPlan(plan: OrgSubscription["plan"] | null | undefined) {
  if (plan === "PRO") return "Growth/Pro";
  if (plan === "STARTER") return "Standard";
  return "No Plan";
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

export default function AppBillingPage() {
  const { showToast } = useToast();
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [demo, setDemo] = useState<OrgDemoStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<BillingDiagnosticsPayload | null>(null);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [startingPlan, setStartingPlan] = useState<StripePlanKey | null>(null);
  const [changingPlan, setChangingPlan] = useState<StripePlanKey | null>(null);

  useEffect(() => {
    void Promise.all([getBillingStatus(), getBillingDiagnostics()])
      .then(([billing, diag]) => {
        setSubscription(billing.subscription);
        setDemo(billing.demo);
        setDiagnostics(diag);
        setDiagnosticsError(null);
      })
      .catch(() => {
        setSubscription(null);
        setDemo(null);
        setDiagnostics(null);
        setDiagnosticsError("Diagnostics unavailable.");
      });
  }, []);

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

  async function onChangePlan(plan: StripePlanKey) {
    setChangingPlan(plan);
    try {
      const result = await changeStripePlan(plan);
      const latest = await getBillingStatus();
      setSubscription(latest.subscription);
      setDemo(latest.demo);
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
      void refreshDiagnostics();
    } finally {
      setChangingPlan(null);
    }
  }

  const hasRealSubscription = Boolean(subscription);
  const isActiveSubscription = ACTIVE_STATUSES.has(normalizeStatus(subscription?.status));
  const showDemoCard = !subscription && demo?.mode === "GUIDED_DEMO";

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
          {showDemoCard ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-sm font-semibold text-amber-900">Guided Demo Mode</p>
              <p className="mt-1 text-xs text-amber-900/90">
                Evaluation mode only. This is not live deployment and has strict call limits until you activate a paid plan.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded border bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Usage</p>
                  <p className="text-sm font-semibold">
                    {demo?.callsUsed ?? 0}/{demo?.callCap ?? 15} calls
                  </p>
                </div>
                <div className="rounded border bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">State</p>
                  <p className="text-sm font-semibold">{demo?.state || "ACTIVE"}</p>
                </div>
                <div className="rounded border bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Window end</p>
                  <p className="text-sm font-semibold">
                    {demo?.windowEndsAt ? new Date(demo.windowEndsAt).toLocaleDateString() : "Starts on first AI call"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
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

          {hasRealSubscription ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4">
              <p className="text-sm text-blue-900">
                {isActiveSubscription
                  ? "Manage payment method, invoices, and cancellation in Stripe's customer portal."
                  : "Your subscription is not currently active. Restart checkout to reactivate live billing and runtime features."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={onOpenPortal} disabled={openingPortal || !hasRealSubscription}>
                  {openingPortal ? "Opening..." : "Open Stripe Billing Portal"}
                </Button>
                {isActiveSubscription && subscription?.plan === "STARTER" ? (
                  <Button
                    variant="outline"
                    onClick={() => void onChangePlan("pro")}
                    disabled={changingPlan !== null || !hasRealSubscription}
                  >
                    {changingPlan === "pro" ? "Upgrading..." : "Upgrade to Growth/Pro"}
                  </Button>
                ) : null}
                {isActiveSubscription && subscription?.plan === "PRO" ? (
                  <Button
                    variant="outline"
                    onClick={() => void onChangePlan("starter")}
                    disabled={changingPlan !== null || !hasRealSubscription}
                  >
                    {changingPlan === "starter" ? "Switching..." : "Switch to Standard"}
                  </Button>
                ) : null}
                {!isActiveSubscription ? (
                  <Button
                    variant="outline"
                    onClick={() => void onStartPlan(subscription?.plan === "PRO" ? "pro" : "starter")}
                    disabled={startingPlan !== null}
                  >
                    {startingPlan ? "Starting..." : "Reactivate subscription"}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {subscription
                ? "Compare plans below to see exactly what is included before you change tiers."
                : "Choose a plan to activate billing and unlock live production workflow."}
            </p>
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
                  : planKey === "founding"
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
                    className={`flex h-full flex-col rounded-xl border p-5 ${
                      planKey === "founding"
                        ? "border-amber-300 bg-gradient-to-b from-amber-50 via-amber-50/30 to-white shadow-[0_0_0_1px_rgba(245,158,11,0.14)]"
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
                    <p className="mt-3 rounded-md border bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
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
                          planKey === "founding" ||
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
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-slate-400 via-zinc-400 to-slate-500" />
        <CardHeader>
          <CardTitle>Billing diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {diagnosticsError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
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
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top issues</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {diagnostics.summary.topIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
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
                    <div key={title} className="rounded-md border bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
                      <div className="mt-2 space-y-2">
                        {list.map((check) => (
                          <div key={check.key} className="rounded border p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium">{check.key}</p>
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
                <p className="text-xs text-muted-foreground">
                  Summary-only diagnostics available for your role. Contact your account admin for detailed checks.
                </p>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
