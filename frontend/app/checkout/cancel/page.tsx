import Link from "next/link";
import { ArrowLeft, CircleSlash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CheckoutCancelPage() {
  return (
    <div className="relative min-h-[78vh] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.12),transparent_55%),linear-gradient(180deg,#f8fafc_0%,#fff7ed_100%)] px-4 py-14 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <Card className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white/95 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.5)]">
          <CardHeader className="border-b border-slate-200 bg-[linear-gradient(180deg,rgba(255,241,242,0.92)_0%,rgba(255,247,237,0.78)_100%)]">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-rose-600 text-white">
              <CircleSlash2 className="h-5 w-5" />
            </div>
            <CardTitle className="text-3xl tracking-[-0.03em] text-slate-950">Checkout Canceled</CardTitle>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              No charge was made. Plan changes finalize only after Stripe confirms the update.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
              You can return to Pricing any time and restart checkout when you are ready.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/pricing">Back to Pricing</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/app/billing">Open Billing</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/">
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Go to Homepage
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
