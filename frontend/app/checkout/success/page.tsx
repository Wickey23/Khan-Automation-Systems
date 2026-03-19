"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function CheckoutSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace("/app/billing?checkout=success");
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <div className="container py-16">
      <h1 className="text-4xl font-bold">Subscription Successful</h1>
      <p className="mt-3 text-muted-foreground">
        Stripe confirmed your checkout. Redirecting to billing to refresh subscription state.
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link href="/app/billing?checkout=success">Go to Billing</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/app">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
