"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { createPlanChangeSession, createStripeCheckoutSession, getBillingStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageShell, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";

type UpgradePlan = "starter" | "pro" | "founding";

function normalizePlan(input: string | null): UpgradePlan {
  const value = String(input || "").toLowerCase();
  if (value === "pro") return "pro";
  if (value === "founding") return "founding";
  return "starter";
}

export default function AppUpgradePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const targetPlan = useMemo(() => normalizePlan(searchParams.get("plan")), [searchParams]);
  const returnTo = useMemo(() => searchParams.get("returnTo") || "/app/billing", [searchParams]);

  useEffect(() => {
    let active = true;
    async function beginCheckout() {
      try {
        const billing = await getBillingStatus();
        const currentPlan = billing.subscription?.plan?.toLowerCase() || null;
        const isActive = ["active", "trialing"].includes(String(billing.subscription?.status || "").toLowerCase());

        if (isActive && currentPlan === targetPlan) {
          router.replace("/app/billing?checkout=already_active");
          return;
        }

        if (isActive && billing.subscription && (targetPlan === "pro" || targetPlan === "starter")) {
          const session = await createPlanChangeSession({
            targetPlan,
            effective: targetPlan === "starter" ? "period_end" : "immediate"
          });
          if (session.url) {
            window.location.href = session.url;
            return;
          }
          throw new Error(session.message || "Could not start plan-change checkout session.");
        }

        const checkout = await createStripeCheckoutSession(targetPlan);
        window.location.href = checkout.url;
      } catch (requestError) {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Could not start checkout.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void beginCheckout();
    return () => {
      active = false;
    };
  }, [router, targetPlan]);

  if (loading) {
    return (
      <PageShell className="space-y-6">
        <SectionShell className="surface-panel">
          <StateCard
            variant="loading"
            title="Starting secure checkout"
            description={`Preparing your ${targetPlan.toUpperCase()} subscription in Stripe...`}
          />
        </SectionShell>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell className="space-y-6">
        <SectionShell className="surface-panel">
          <StateCard
            variant="error"
            title="Could not start checkout"
            description={error}
            action={
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => router.refresh()}>
                  <Loader2 className="mr-1.5 h-4 w-4" />
                  Retry
                </Button>
                <Button size="sm" variant="outline" onClick={() => router.push(returnTo)}>
                  Return to billing
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            }
          />
        </SectionShell>
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-6">
      <SectionShell className="surface-panel">
        <StateCard
          variant="loading"
          title="Redirecting to Stripe"
          description="If redirect did not start, return to billing and retry."
          action={
            <Button size="sm" variant="outline" onClick={() => router.push(returnTo)}>
              Return to billing
            </Button>
          }
        />
      </SectionShell>
    </PageShell>
  );
}
