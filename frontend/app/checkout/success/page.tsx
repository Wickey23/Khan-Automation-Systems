import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CheckoutSuccessPage() {
  return (
    <div className="container py-16">
      <h1 className="text-4xl font-bold">Subscription Successful</h1>
      <p className="mt-3 text-muted-foreground">
        Your workspace is being prepared. Log in to complete setup.
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link href="/login">Go to Login</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/setup">Go to Setup</Link>
        </Button>
      </div>
    </div>
  );
}
