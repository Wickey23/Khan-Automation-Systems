"use client";

import { PricingCards } from "@/components/site/pricing-cards";
import { InfoHint } from "@/components/ui/info-hint";

export default function PricingPage() {
  return (
    <div className="container py-14">
      <h1 className="text-4xl font-bold">Pricing</h1>
      <p className="mt-3 text-muted-foreground">
        Reliability-first pricing for high-touch pilot onboarding and disciplined scale.
      </p>
      <div className="mt-8">
        <PricingCards />
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-5 text-sm text-muted-foreground">
          <p className="inline-flex items-center gap-1 font-semibold text-foreground">
            Founding Partner program rules
            <InfoHint text="This tier is a limited pilot cohort with required participation and a fixed seat cap." />
          </p>
          <ul className="mt-2 space-y-1">
            <li>Limited to 5 pilot seats while reliability proof window is active</li>
            <li>Requires monthly 30-minute feedback call + structured feedback form</li>
            <li>Miss 2 consecutive or 3 total feedback cycles: plan reverts to Standard pricing</li>
            <li>Founding setup credit: $200 applied in month 6 if participation requirements are met</li>
          </ul>
        </div>
        <div className="rounded-lg border bg-white p-5 text-sm text-muted-foreground">
          <p className="inline-flex items-center gap-1 font-semibold text-foreground">
            Support and operational guardrails
            <InfoHint text="Guardrails keep onboarding quality high and protect reliability under shared platform capacity." />
          </p>
          <ul className="mt-2 space-y-1">
            <li>High-touch onboarding is included; onboarding scope is finalized before go-live</li>
            <li>Fair-use and anti-abuse policies apply to protect system reliability</li>
            <li>Carrier/provider pass-through fees (voice/SMS/compliance) are billed separately as applicable</li>
            <li>Advanced SLA support and expanded controls are available in Growth/Pro roadmap tier</li>
          </ul>
        </div>
      </div>
      <div className="mt-6 rounded-lg border bg-white p-5 text-sm text-muted-foreground">
        We are not optimizing for volume right now. We are optimizing for reliability and conversion performance with
        each client cohort.
      </div>
    </div>
  );
}
