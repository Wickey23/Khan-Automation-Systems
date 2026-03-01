import type { Metadata } from "next";
import { CalendlyEmbed } from "@/components/site/calendly-embed";
import { LeadCaptureForm } from "@/components/site/lead-capture-form";

export const metadata: Metadata = {
  title: "Book a Call"
};

export default function BookPage() {
  return (
    <div className="container py-14">
      <h1 className="text-4xl font-bold">Book a 15-min Call</h1>
      <p className="mt-3 text-muted-foreground">
        Use the calendar below. If unavailable, submit the fallback form and we will reach out directly.
      </p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <CalendlyEmbed />
        <LeadCaptureForm sourcePage="/book" title="Fallback lead form" compact />
      </div>
    </div>
  );
}
