"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createCustomerPortalSession,
  createStripeCheckoutSession,
  getBillingDiagnostics,
  getBillingStatus
} from "@/lib/api";
import type { BillingDiagnosticsPayload, OrgDemoStatus, OrgSubscription } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { clientBadgeClass } from "@/lib/client-badges";

function normalizeStatus(status: string | null | undefined) {
  return String(status || "not_active").toLowerCase();
}

function isRuntimeBlocked(status: string | null | undefined) {
  return ["past_due", "unpaid", "incomplete", "payment_failed"].includes(normalizeStatus(status));
}

function formatPlan(plan: OrgSubscription["plan"] | null | undefined) {
  if (plan === "PRO") return "Growth Tier";
  if (plan === "STARTER") return "Standard Tier";
  return "No active plan";
}

function formatStatus(status: string | null | undefined) {
  return normalizeStatus(status).replaceAll("_", " ");
}

function diagnosticsTone(overall: BillingDiagnosticsPayload["summary"]["overall"] | undefined) {
  if (overall === "BLOCKED") return "critical" as const;
  if (overall === "NEEDS_ACTION") return "warning" as const;
  return "success" as const;
}

export default function AppBillingPage() {
  const { showToast } = useToast();
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [demo, setDemo] = useState<OrgDemoStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<BillingDiagnosticsPayload | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState<"starter" | "pro" | null>(null);

  const load = useCallback(async () => {
    const [billing, diag] = await Promise.all([getBillingStatus(), getBillingDiagnostics()]);
    setSubscription(billing.subscription);
    setDemo(billing.demo);
    setDiagnostics(diag);
  }, []);

  useEffect(() => {
    void load().catch(() => {
      setSubscription(null);
      setDemo(null);
      setDiagnostics(null);
    });
  }, [load]);

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

  async function onStartCheckout(plan: "starter" | "pro") {
    setStartingCheckout(plan);
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
      setStartingCheckout(null);
    }
  }

  const blocked = isRuntimeBlocked(subscription?.status);
  const currentPlan = subscription ? formatPlan(subscription.plan) : demo?.mode === "GUIDED_DEMO" ? "Guided Demo" : "No active plan";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing governance"
        title="Billing & Subscription"
        description="Centralized control for subscription state, payment issues, plan changes, and operational billing readiness."
        actions={
          <Badge className={clientBadgeClass(blocked ? "critical" : diagnosticsTone(diagnostics?.summary.overall))}>
            {blocked ? "Operations blocked" : subscription ? formatStatus(subscription.status) : "Setup mode"}
          </Badge>
        }
      />

      {blocked ? (
        <div className="rounded-[18px] border border-red-200 bg-[linear-gradient(180deg,rgba(254,242,242,0.96)_0%,rgba(254,226,226,0.92)_100%)] p-5 text-red-950 shadow-[0_12px_24px_rgba(185,28,28,0.10)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="text-lg font-semibold">Action Required: Operations Suspended</p>
              <p className="max-w-3xl text-sm leading-6 text-red-900/90">
                The last payment failed. AI voice runtime, receptionist handling, and operational workflows may be paused until billing is resolved.
              </p>
            </div>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => void onOpenPortal()} disabled={openingPortal}>
              {openingPortal ? "Opening..." : "Fix billing now"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="metric-card">
          <CardContent className="p-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Current plan</p>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{currentPlan}</p>
            <p className="mt-2 text-sm text-slate-500">
              {subscription?.plan === "PRO"
                ? "Expanded operational controls enabled."
                : subscription?.plan === "STARTER"
                  ? "Core production runtime plan."
                  : demo?.mode === "GUIDED_DEMO"
                    ? "Evaluation mode only."
                    : "No production runtime yet."}
            </p>
          </CardContent>
        </Card>
        <Card className="metric-card">
          <CardContent className="p-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Subscription state</p>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              {subscription ? formatStatus(subscription.status) : "Not active"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {subscription?.currentPeriodEnd ? `Next bill date: ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}` : "Activate billing to start live runtime."}
            </p>
          </CardContent>
        </Card>
        <Card className="metric-card">
          <CardContent className="p-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Operational health</p>
            <p className={`mt-3 text-2xl font-semibold tracking-[-0.04em] ${blocked ? "text-red-600" : "text-emerald-600"}`}>
              {blocked ? "Services offline" : "Billing healthy"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {blocked ? "Resolve payment to resume runtime services." : "Billing is not blocking the office workflow."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[16px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-950">Billing diagnostics</h3>
            <Badge className={clientBadgeClass(diagnosticsTone(diagnostics?.summary.overall))}>
              {diagnostics?.summary.overall || "Unavailable"}
            </Badge>
          </div>
          {diagnostics ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-600">Checkout readiness</span>
                  <span className="font-semibold text-slate-950">{diagnostics.summary.checkoutReady ? "Ready" : "Blocked"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-600">Plan change readiness</span>
                  <span className="font-semibold text-slate-950">{diagnostics.summary.changePlanReady ? "Ready" : "Blocked"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-600">Customer portal readiness</span>
                  <span className="font-semibold text-slate-950">{diagnostics.summary.customerPortalReady ? "Ready" : "Blocked"}</span>
                </div>
              </div>
              <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Top issues</p>
                {diagnostics.summary.topIssues?.length ? (
                  <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-slate-700">
                    {diagnostics.summary.topIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No blocking diagnostics issues are currently flagged.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state">Billing diagnostics are unavailable right now.</div>
          )}
        </section>

        <section className="rounded-[16px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
          <h3 className="text-lg font-semibold text-slate-950">Payment method & portal</h3>
          <div className="mt-6 rounded-[14px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-950">{subscription ? "Saved payment method managed in Stripe" : "No active billing profile"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Use the Stripe customer portal for payment method changes, invoices, and subscription management.
                </p>
              </div>
              <Button variant="outline" onClick={() => void onOpenPortal()} disabled={openingPortal || !subscription}>
                {openingPortal ? "Opening..." : "Open portal"}
              </Button>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-[12px] border border-slate-200 p-3">Download the latest invoice and update billing details in Stripe.</div>
            <div className="rounded-[12px] border border-slate-200 p-3">Resolve payment failures before routing or AI runtime is affected.</div>
          </div>
        </section>
      </div>

      <div>
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">Plan Comparison</h2>
          <p className="mt-2 text-slate-500">Choose the tier that matches the real operational load of the office.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              key: "starter" as const,
              name: "Starter",
              price: "$49/mo",
              features: ["500 monthly AI minutes", "1 receptionist seat", "Standard support"]
            },
            {
              key: "starter" as const,
              name: "Growth",
              price: "$149/mo",
              current: subscription?.plan === "STARTER",
              features: ["2,500 monthly AI minutes", "5 receptionist seats", "Priority support", "Operational tuning"]
            },
            {
              key: "pro" as const,
              name: "Enterprise",
              price: "$499/mo",
              current: subscription?.plan === "PRO",
              features: ["Unlimited seats", "Higher-volume runtime", "SSO and audit depth", "Dedicated support path"]
            }
          ].map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-[16px] border p-6 ${
                plan.current ? "border-blue-500 bg-white ring-4 ring-blue-100" : "border-slate-300 bg-white"
              }`}
            >
              {plan.current ? (
                <div className="mb-3 inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                  Current plan
                </div>
              ) : null}
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">{plan.name}</p>
              <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-slate-950">{plan.price}</p>
              <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700">
                {plan.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <Button
                className="mt-6"
                variant={plan.current ? "outline" : "default"}
                disabled={Boolean(plan.current) || startingCheckout !== null}
                onClick={() => void onStartCheckout(plan.key)}
              >
                {plan.current ? "Active" : startingCheckout === plan.key ? "Opening..." : "Choose plan"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
