import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const tiers = [
  {
    name: "Starter",
    price: "$297/mo",
    features: [
      "$199 one-time setup",
      "Includes 300 inbound/outbound voice minutes",
      "24/7 AI call intake and voicemail capture",
      "Call summaries, transcripts, and lead logging",
      "Basic transfer logic + manager notifications"
    ]
  },
  {
    name: "Pro",
    price: "$497/mo",
    features: [
      "Everything in Starter",
      "Includes 500 voice minutes + 1,000 SMS segments",
      "Two-way messaging automation and follow-up flows",
      "Advanced escalation, after-hours, and transfer logic",
      "Priority tuning and deeper automation support"
    ]
  }
];

export function PricingCards() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {tiers.map((tier) => (
        <Card key={tier.name} className="border-border">
          <CardHeader>
            <p className="text-sm font-semibold text-primary">{tier.name}</p>
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
              <Link href="/book">Book a 15-min Call</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
