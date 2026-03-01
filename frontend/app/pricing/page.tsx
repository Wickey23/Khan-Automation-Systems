"use client";

import { useState } from "react";
import { createStripeCheckoutSession } from "@/lib/api";
import { useRouter } from "next/navigation";
import { PricingCards } from "@/components/site/pricing-cards";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<"starter" | "pro" | null>(null);
  const { showToast } = useToast();
  const router = useRouter();

  async function onStart(plan: "starter" | "pro") {
    setLoadingPlan(plan);
    try {
      const data = await createStripeCheckoutSession(plan);
      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Try again.";
      if (message.toLowerCase().includes("unauthorized")) {
        router.push("/auth/login");
        return;
      }
      showToast({
        title: "Checkout failed",
        description: message,
        variant: "error"
      });
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="container py-14">
      <h1 className="text-4xl font-bold">Pricing</h1>
      <p className="mt-3 text-muted-foreground">
        Start with one offer: AI Reception + Follow-Up for service businesses.
      </p>
      <div className="mt-8">
        <PricingCards />
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={() => onStart("starter")} disabled={loadingPlan !== null}>
          {loadingPlan === "starter" ? "Redirecting..." : "Start Starter"}
        </Button>
        <Button onClick={() => onStart("pro")} variant="outline" disabled={loadingPlan !== null}>
          {loadingPlan === "pro" ? "Redirecting..." : "Start Pro"}
        </Button>
      </div>
      <div className="mt-6 rounded-lg border bg-white p-5 text-sm text-muted-foreground">
        Optional setup fees are configured in Stripe and can be added during onboarding.
      </div>
    </div>
  );
}
