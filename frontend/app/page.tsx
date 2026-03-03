import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, CalendarClock, Clock3, Handshake, MessageSquareText, PhoneCall, Plug, ShieldCheck } from "lucide-react";
import { MotionInView } from "@/components/site/motion-in-view";
import { LeadCaptureForm } from "@/components/site/lead-capture-form";
import { PricingCards } from "@/components/site/pricing-cards";
import { FAQAccordion } from "@/components/site/faq-accordion";
import { SmsDemo } from "@/components/site/sms-demo";
import { DemoCallCard } from "@/components/site/demo-call-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/lib/config";

const outcomes: Array<{ title: string; icon: LucideIcon }> = [
  { title: "24/7 call answer coverage", icon: PhoneCall },
  { title: "Faster quote turnaround", icon: Clock3 },
  { title: "Consistent intake notes", icon: BadgeCheck },
  { title: "Automated SMS confirmations", icon: MessageSquareText },
  { title: "Smart scheduling + handoff", icon: CalendarClock },
  { title: "Call log visibility", icon: ShieldCheck }
];

const steps: Array<{ title: string; icon: LucideIcon; copy: string }> = [
  { title: "Audit", icon: Handshake, copy: "Map your current call, intake, and scheduling flow." },
  { title: "Setup", icon: Plug, copy: "Configure scripts, routing, and lead capture rules." },
  { title: "Launch", icon: PhoneCall, copy: "Go live with call handling and SMS follow-up." },
  { title: "Optimize", icon: BadgeCheck, copy: "Tune response quality and conversion weekly." }
];

export default function HomePage() {
  return (
    <div>
      <section className="container grid gap-10 py-14 md:py-20 lg:grid-cols-[1.05fr_0.95fr]">
        <MotionInView>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Engineering AI Automation Agency</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
              AI Reception + Follow-Up System for Service Shops
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              Answers calls 24/7, captures job details, confirms by text, books appointments, and escalates to your team
              when needed.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/book">Book a 15-min Call</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/how-it-works">See How It Works</Link>
              </Button>
            </div>
          </div>
        </MotionInView>
        <MotionInView delay={0.1}>
          <LeadCaptureForm sourcePage="/" />
        </MotionInView>
      </section>

      <section className="border-y bg-white">
        <div className="container flex flex-col items-start justify-between gap-4 py-8 md:flex-row md:items-center">
          <p className="text-sm font-semibold">Built for service shops</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="rounded-full border px-3 py-1">LOGO_PLACEHOLDER_1</span>
            <span className="rounded-full border px-3 py-1">LOGO_PLACEHOLDER_2</span>
            <span className="rounded-full border px-3 py-1">LOGO_PLACEHOLDER_3</span>
            <span className="rounded-full border px-3 py-1">LOGO_PLACEHOLDER_4</span>
          </div>
        </div>
      </section>

      <section className="container py-14">
        <h2 className="text-3xl font-semibold">The Cost of Missed Calls</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            "Placeholder: 27% of high-value calls hit voicemail or ring out.",
            "Placeholder: 42% of prospects choose the first shop that responds.",
            "Placeholder: 15-20% of potential jobs are lost from delayed follow-up."
          ].map((item) => (
            <Card key={item}>
              <CardContent className="p-5 text-sm text-muted-foreground">{item}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container py-14">
        <h2 className="text-3xl font-semibold">What You Get</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outcomes.map(({ title, icon: Icon }, index) => (
            <MotionInView delay={index * 0.04} key={title}>
              <Card>
                <CardContent className="flex items-start gap-3 p-5">
                  <Icon className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Built to improve speed, quality, and booking consistency.</p>
                  </div>
                </CardContent>
              </Card>
            </MotionInView>
          ))}
        </div>
      </section>

      <section className="container grid gap-6 py-14 lg:grid-cols-2">
        <DemoCallCard demoNumber={siteConfig.demoNumber} />
        <SmsDemo />
      </section>

      <section className="container py-14">
        <h2 className="text-3xl font-semibold">How It Works</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {steps.map(({ title, icon: Icon, copy }) => (
            <Card key={title}>
              <CardContent className="space-y-3 p-5">
                <Icon className="h-5 w-5 text-primary" />
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{copy}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y bg-white">
        <div className="container py-14">
          <h2 className="text-3xl font-semibold">Works with your current tools</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Integrates with existing workflows first. Placeholder examples: CDK, shop management systems, Google Calendar, CRM tools.
          </p>
          <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            {["CDK", "Shop Mgmt Systems", "Google Calendar", "CRM/Dispatch Tool"].map((item) => (
              <div key={item} className="rounded-md border bg-background px-4 py-3">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-14">
        <h2 className="text-3xl font-semibold">Pricing</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pilot-first pricing designed for reliable rollout, measurable outcomes, and disciplined scale.
        </p>
        <div className="mt-6">
          <PricingCards />
        </div>
        <div className="mt-6 overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="p-3 text-left">Feature</th>
                <th className="p-3 text-left">Founding Partner</th>
                <th className="p-3 text-left">Standard</th>
                <th className="p-3 text-left">Growth/Pro</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-3">Call handling + intake</td>
                <td className="p-3">Included</td>
                <td className="p-3">Included</td>
                <td className="p-3">Included</td>
              </tr>
              <tr className="border-t">
                <td className="p-3">Commitment</td>
                <td className="p-3">6 months</td>
                <td className="p-3">Month-to-month or 3 months</td>
                <td className="p-3">6 or 12 months</td>
              </tr>
              <tr className="border-t">
                <td className="p-3">Support model</td>
                <td className="p-3">High-touch pilot + monthly feedback ritual</td>
                <td className="p-3">Structured standard support</td>
                <td className="p-3">Priority SLA-oriented support</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-y bg-white">
        <div className="container py-14">
          <h2 className="text-2xl font-semibold">Also on our roadmap</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Not part of v1 implementation yet. Planned extensions: review + reactivation SMS automation, tool/inventory tracking,
            and operations dashboards.
          </p>
        </div>
      </section>

      <section className="container py-14">
        <h2 className="text-3xl font-semibold">FAQ</h2>
        <div className="mt-5">
          <FAQAccordion />
        </div>
      </section>

      <section className="container py-14">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold">About the Founder</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sameer Khan is an engineering student with hands-on exposure to service shop operations. Khan Automation Systems
              is built around practical workflows that reduce missed calls and improve follow-through.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="container grid gap-6 py-14 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold">Ready to tighten your lead flow?</h2>
          <p className="text-sm text-muted-foreground">
            Book your call or submit your details. We will send a practical rollout plan for your operation.
          </p>
          <Button asChild>
            <Link href="/book">Book a 15-min Call</Link>
          </Button>
        </div>
        <LeadCaptureForm sourcePage="/#final-cta" title="Prefer we contact you first?" />
      </section>
    </div>
  );
}
