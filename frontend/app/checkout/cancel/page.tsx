import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CheckoutCancelPage() {
  return (
    <div className="container py-16">
      <h1 className="text-4xl font-bold">Checkout Canceled</h1>
      <p className="mt-3 text-muted-foreground">
        No charge was made. You can restart checkout any time.
      </p>
      <Button asChild className="mt-6">
        <Link href="/pricing">Back to Pricing</Link>
      </Button>
    </div>
  );
}
