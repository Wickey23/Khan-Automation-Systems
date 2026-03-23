import Link from "next/link";
import { CheckCircle2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CheckoutSuccessPage() {
  return (
    <div className="relative min-h-[78vh] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.2),transparent_55%),linear-gradient(180deg,#f8fafc_0%,#ecfeff_100%)] px-4 py-14 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <Card className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white/95 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.5)]">
          <CardHeader className="border-b border-slate-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.92)_0%,rgba(240,249,255,0.78)_100%)]">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <CardTitle className="text-3xl tracking-[-0.03em] text-slate-950">Subscription Successful</CardTitle>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Your workspace is being prepared. Plan changes finalize after Stripe confirms the update.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
              <p className="inline-flex items-center gap-2 font-medium text-slate-800">
                <CreditCard className="h-4 w-4 text-slate-500" />
                Next step
              </p>
              <p className="mt-1">
                Return to Billing to verify subscription status, then continue onboarding to complete configuration.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/auth/login">Go to Login</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/app/onboarding">Go to Onboarding</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/app/billing">Open Billing</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
