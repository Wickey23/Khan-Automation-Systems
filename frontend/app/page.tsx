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

const outcomes: Array<{ title: string; icon: LucideIcon; copy: string }> = [
  {
    title: "24/7 call answer coverage",
    icon: PhoneCall,
    copy: "Every inbound call gets answered or captured, including nights, weekends, and peak hours."
  },
  {
    title: "Faster quote turnaround",
    icon: Clock3,
    copy: "Collects the right job details on first contact so your team can quote and follow up faster."
  },
  {
    title: "Consistent intake notes",
    icon: BadgeCheck,
    copy: "Standardized summaries reduce missed details and keep dispatch, techs, and office aligned."
  },
  {
    title: "Automated SMS confirmations",
    icon: MessageSquareText,
    copy: "Sends immediate confirmations and follow-up messages to reduce drop-off after first contact."
  },
  {
    title: "Smart scheduling + handoff",
    icon: CalendarClock,
    copy: "Routes urgent calls correctly and hands off priority jobs to the right person without delay."
  },
  {
    title: "Call log visibility",
    icon: ShieldCheck,
    copy: "Gives your team a searchable record of calls, outcomes, and summaries for operational control."
  }
];

const steps: Array<{ title: string; icon: LucideIcon; copy: string }> = [
  { title: "Audit", icon: Handshake, copy: "Map your current call, intake, and scheduling flow." },
  { title: "Setup", icon: Plug, copy: "Configure scripts, routing, and lead capture rules." },
  { title: "Launch", icon: PhoneCall, copy: "Go live with call handling and SMS follow-up." },
  { title: "Optimize", icon: BadgeCheck, copy: "Tune response quality and conversion weekly." }
];

export default function HomePage() {
  const missedCallFigures = [
    {
      figure: "20-30%",
      title: "Calls can hit voicemail or ring out",
      detail: "Common range when shops are busy, after-hours, or short-staffed."
    },
    {
      figure: "<5 min",
      title: "Response window for many high-intent callers",
      detail: "Fast first response often decides who wins the booking."
    },
    {
      figure: "10-20%",
      title: "Pipeline can leak from delayed follow-up",
      detail: "Missed or late callbacks compound into lost jobs over time."
    }
  ];

  const integrationLabels = [
    "Current phone workflows",
    "Scheduling calendars",
    "CRM and dispatch systems",
    "Existing intake processes"
  ];

  const serviceShopFigures = [
    { figure: "24/7", label: "Inbound coverage" },
    { figure: "<1 min", label: "Intake start target" },
    { figure: "1 view", label: "Calls + leads visibility" },
    { figure: "Weekly", label: "Optimization cadence" }
  ];

  return (
    <div>
      <section className="container grid gap-10 py-14 md:py-20 lg:grid-cols-[1.05fr_0.95fr]">
        <MotionInView>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Enterprise Call Operations Infrastructure
            </p>
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
          <div>
            <p className="text-sm font-semibold">Built for service shops</p>
            <p className="mt-1 text-xs text-muted-foreground">HVAC, Auto & Diesel, Home Services, Field Operations</p>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
            {serviceShopFigures.map((item) => (
              <div key={item.label} className="rounded-md border bg-background px-3 py-2">
                <p className="text-sm font-semibold text-foreground">{item.figure}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-14">
        <h2 className="text-3xl font-semibold">The Cost of Missed Calls</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {missedCallFigures.map((item) => (
            <Card key={item.title}>
              <CardContent className="space-y-2 p-5">
                <p className="text-2xl font-semibold text-foreground">{item.figure}</p>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Figures are directional operating benchmarks and vary by market, call volume, and response process.
        </p>
      </section>

      <section className="container py-14">
        <h2 className="text-3xl font-semibold">What You Get</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outcomes.map(({ title, icon: Icon, copy }, index) => (
            <MotionInView delay={index * 0.04} key={title}>
              <Card>
                <CardContent className="flex items-start gap-3 p-5">
                  <Icon className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
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
            Integrates into your current operating stack first, so you can launch without disrupting the way your team already works.
          </p>
          <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            {integrationLabels.map((item) => (
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
