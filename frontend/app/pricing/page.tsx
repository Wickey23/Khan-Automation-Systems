"use client";

import { PricingCards } from "@/components/site/pricing-cards";
import { InfoHint } from "@/components/ui/info-hint";
import { SectionHeading } from "@/components/ui/page";

export default function PricingPage() {
  return (
    <div className="page-shell space-y-10 py-14">
      <SectionHeading
        eyebrow="Pricing"
        title="Reliability-first plans for service teams"
        description="Pricing is structured for disciplined rollout, cleaner onboarding, and measurable operational improvement rather than self-serve volume."
      />

      <PricingCards />

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="surface-panel p-6 text-sm leading-6 text-muted-foreground">
          <p className="inline-flex items-center gap-1 font-semibold text-foreground">
            Founding Partner program rules
            <InfoHint text="This tier is a limited pilot cohort with required participation and a fixed seat cap." />
          </p>
          <ul className="mt-3 space-y-2">
            <li>Limited to 5 pilot seats while the reliability proof window is active.</li>
            <li>Requires a monthly 30-minute feedback call plus a structured feedback form.</li>
            <li>Missing 2 consecutive or 3 total feedback cycles reverts pricing to Standard.</li>
            <li>A $200 setup credit is applied in month 6 when participation requirements are met.</li>
          </ul>
        </div>
        <div className="surface-panel p-6 text-sm leading-6 text-muted-foreground">
          <p className="inline-flex items-center gap-1 font-semibold text-foreground">
            Support and operational guardrails
            <InfoHint text="Guardrails keep onboarding quality high and protect reliability under shared platform capacity." />
          </p>
          <ul className="mt-3 space-y-2">
            <li>High-touch onboarding is included and implementation scope is finalized before go-live.</li>
            <li>Fair-use and anti-abuse policies apply to protect system reliability.</li>
            <li>Carrier and provider pass-through fees for voice, SMS, and compliance are billed separately when applicable.</li>
            <li>Advanced SLA support and expanded controls sit in the Growth/Pro roadmap tier.</li>
          </ul>
        </div>
      </div>

      <div className="surface-muted p-6 text-sm leading-6 text-muted-foreground">
        We are not optimizing for volume right now. We are optimizing for reliability and conversion performance with each client cohort.
      </div>
    </div>
  );
}
