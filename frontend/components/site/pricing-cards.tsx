import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const tiers = [
  {
    name: "Starter",
    price: "$1,500 setup + $399/mo",
    features: ["24/7 AI call intake", "SMS confirmation flow", "Basic routing + transfer", "Monthly optimization"]
  },
  {
    name: "Pro",
    price: "$2,500 setup + $699/mo",
    features: [
      "Everything in Starter",
      "Advanced escalation rules",
      "Calendar + workflow integrations",
      "Priority performance tuning"
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
