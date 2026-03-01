import type { Metadata } from "next";
import { LeadCaptureForm } from "@/components/site/lead-capture-form";

export const metadata: Metadata = {
  title: "Contact"
};

export default function ContactPage() {
  return (
    <div className="container py-14">
      <h1 className="text-4xl font-bold">Contact</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Share your current bottlenecks. We will map a practical rollout for your team.
      </p>
      <div className="mt-8 max-w-3xl">
        <LeadCaptureForm sourcePage="/contact" />
      </div>
    </div>
  );
}
