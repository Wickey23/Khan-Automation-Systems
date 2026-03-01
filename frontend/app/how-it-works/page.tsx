import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "How It Works"
};

export default function HowItWorksPage() {
  return (
    <div className="container py-14">
      <h1 className="text-4xl font-bold">How It Works</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Implementation is scoped for speed and reliability: audit current workflow, launch quickly, then optimize based on real call data.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {[
          ["1. Audit", "We review call handling, dispatcher flow, and quote process."],
          ["2. Setup", "We configure scripts, routing, intake fields, and alerts."],
          ["3. Launch", "Your AI reception stack goes live with escalation controls."],
          ["4. Optimize", "Weekly iteration on conversion and handoff quality."]
        ].map(([title, body]) => (
          <Card key={title}>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
