import type { Metadata } from "next";
import { CalendarClock, PhoneCall } from "lucide-react";
import { CalendlyEmbed } from "@/components/site/calendly-embed";
import { LeadCaptureForm } from "@/components/site/lead-capture-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Book a Call"
};

export default function BookPage() {
  return (
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_52%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
      <div className="container py-14 sm:py-16">
        <div className="mx-auto max-w-6xl space-y-8">
          <section className="rounded-[28px] border border-slate-200/90 bg-white/92 p-6 shadow-[0_26px_50px_-34px_rgba(15,23,42,0.45)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Live onboarding call</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">Book a 15-minute call</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Use the calendar below. If no live slot is available, submit the callback request form and we&apos;ll schedule directly.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Card className="border-slate-200/90 bg-slate-50/80">
                <CardContent className="p-4">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <CalendarClock className="h-4 w-4 text-slate-500" />
                    Live scheduling
                  </p>
                  <p className="mt-2 text-sm text-slate-700">Pick a time and confirm instantly through the embedded scheduler.</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200/90 bg-slate-50/80">
                <CardContent className="p-4">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <PhoneCall className="h-4 w-4 text-slate-500" />
                    Callback fallback
                  </p>
                  <p className="mt-2 text-sm text-slate-700">No slot available? Submit details and we&apos;ll reach out to schedule manually.</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <CalendlyEmbed />
            <LeadCaptureForm sourcePage="/book" title="Request a callback" compact />
          </div>
        </div>
      </div>
    </div>
  );
}
