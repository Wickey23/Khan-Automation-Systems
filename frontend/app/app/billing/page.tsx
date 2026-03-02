"use client";

import { useEffect, useState } from "react";
import { createStripeCheckoutSession, createCustomerPortalSession, getBillingStatus } from "@/lib/api";
import type { OrgSubscription } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/site/toast-provider";

export default function AppBillingPage() {
  const { showToast } = useToast();
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [startingPlan, setStartingPlan] = useState<"starter" | "pro" | null>(null);

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage plan, payment method, and invoices.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current subscription</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p>
            Plan: <span className="font-medium">{subscription?.plan || "No active plan"}</span>
          </p>
          <p>
            Status: <span className="font-medium">{subscription?.status || "Not active"}</span>
          </p>
          <p>
            Current period end:{" "}
            <span className="font-medium">
              {subscription?.currentPeriodEnd
                ? new Date(subscription.currentPeriodEnd).toLocaleString()
                : "-"}
            </span>
          </p>
          <div className="pt-2">
            {subscription ? (
              <Button onClick={onOpenPortal} disabled={openingPortal}>
                {openingPortal ? "Opening..." : "Open Stripe Billing Portal"}
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void onStartPlan("starter")}
                  disabled={startingPlan !== null}
                >
                  {startingPlan === "starter" ? "Starting..." : "Start Starter"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void onStartPlan("pro")}
                  disabled={startingPlan !== null}
                >
                  {startingPlan === "pro" ? "Starting..." : "Start Pro"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
