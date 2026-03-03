import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const tiers = [
  {
    name: "Founding Partner",
    price: "$249/mo",
    badge: "Limited: 5 pilot seats",
    features: [
      "$500 one-time setup",
      "6-month commitment + 12-month price lock",
      "$200 credit applied in month 6 if all feedback cycles are completed",
      "Monthly 30-minute feedback review + structured form",
      "AI call handling, summaries, lead capture, analytics, notifications"
    ],
    ctaLabel: "Apply for Founding",
    ctaHref: "/book?program=founding"
  },
  {
    name: "Standard",
    price: "$349/mo",
    badge: "Default production plan",
    features: [
      "$750 one-time setup",
      "Month-to-month or 3-month commitment option",
      "AI call handling, summaries, lead capture, analytics, notifications",
      "Structured onboarding + standard support cadence",
      "Built for reliability-first operations, not self-serve volume"
    ],
    ctaLabel: "Start Standard",
    ctaHref: "/book?plan=standard"
  },
  {
    name: "Growth/Pro",
    price: "$599/mo",
    badge: "Roadmap tier (30+ clients)",
    features: [
      "$1,500+ onboarding and implementation",
      "6- or 12-month agreement",
      "Priority support + SLA-oriented operations",
      "Expanded controls for larger/multi-location workflows",
      "Activated after pilot durability gates are consistently passing"
    ],
    ctaLabel: "Join Waitlist",
    ctaHref: "/contact?plan=growth-pro"
  }
];

export function PricingCards() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {tiers.map((tier) => (
        <Card key={tier.name} className="border-border">
          <CardHeader>
            <p className="text-sm font-semibold text-primary">{tier.name}</p>
            <p className="text-xs text-muted-foreground">{tier.badge}</p>
            <CardTitle>{tier.price}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tier.features.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary" />
                <span>{item}</span>
              </div>
            ))}
            <Button asChild className="mt-4 w-full">
              <Link href={tier.ctaHref}>{tier.ctaLabel}</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
