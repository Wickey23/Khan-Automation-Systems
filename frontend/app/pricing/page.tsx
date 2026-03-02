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
        Transparent monthly plans for AI voice + messaging operations.
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
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-5 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Included usage</p>
          <ul className="mt-2 space-y-1">
            <li>Starter: 300 voice minutes included each billing cycle</li>
            <li>Pro: 500 voice minutes + 1,000 SMS segments included each billing cycle</li>
            <li>Starter setup: $199 one-time on initial activation</li>
            <li>Pro setup: $299 one-time on initial activation</li>
          </ul>
        </div>
        <div className="rounded-lg border bg-white p-5 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Overages + compliance</p>
          <ul className="mt-2 space-y-1">
            <li>Usage above included limits is billed at carrier/provider pass-through rates plus platform margin.</li>
            <li>US A2P 10DLC registration fees and monthly campaign fees are billed separately when SMS is enabled.</li>
            <li>Carrier compliance, filtering, and deliverability policies apply to all messaging traffic.</li>
          </ul>
        </div>
      </div>
      <div className="mt-6 rounded-lg border bg-white p-5 text-sm text-muted-foreground">
        Final implementation scope, any custom integrations, and custom overage schedules are defined in your signed MSA/order form.
      </div>
    </div>
  );
}
