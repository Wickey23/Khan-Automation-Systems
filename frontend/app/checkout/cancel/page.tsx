import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CheckoutCancelPage() {
  return (
    <div className="container py-16">
      <h1 className="text-4xl font-bold">Checkout Canceled</h1>
      <p className="mt-3 text-muted-foreground">
        No charge was made. Return to billing when you are ready to continue the plan change.
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link href="/app/billing?checkout=cancel">Return to Billing</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/app">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
