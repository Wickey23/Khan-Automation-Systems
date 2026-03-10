import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, BarChart3, CalendarClock, LayoutDashboard, MessageSquareText, PhoneCall, Plug, ShieldCheck } from "lucide-react";
import { MotionInView } from "@/components/site/motion-in-view";
import { LeadCaptureForm } from "@/components/site/lead-capture-form";
import { PricingCards } from "@/components/site/pricing-cards";
import { FAQAccordion } from "@/components/site/faq-accordion";
import { SmsDemo } from "@/components/site/sms-demo";
import { DemoCallCard } from "@/components/site/demo-call-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/page";
import { siteConfig } from "@/lib/config";

const setupSteps: Array<{ step: string; title: string; icon: LucideIcon; copy: string }> = [
  {
    step: "Step 1",
    title: "Keep your existing business number",
    icon: PhoneCall,
    copy: "Customers continue calling the same number they already use."
  },
  {
    step: "Step 2",
    title: "Forward calls to your AI receptionist",
    icon: Plug,
    copy: "Most carriers and business phone systems can forward calls in 1 to 3 minutes."
  },
  {
    step: "Step 3",
    title: "The AI answers when you cannot",
    icon: MessageSquareText,
    copy: "It captures leads, sends follow-up texts, and transfers callers to your office when needed."
  }
];

const howItWorksSteps: Array<{ title: string; icon: LucideIcon; copy: string }> = [
  {
    title: "Customer calls your number",
    icon: PhoneCall,
    copy: "Your customers use the same business line they always have."
  },
  {
    title: "The AI answers and gathers job details",
    icon: MessageSquareText,
    copy: "Collects the service request, urgency, and caller information."
  },
  {
    title: "Urgent or human-needed calls transfer to your office",
    icon: CalendarClock,
    copy: "Callers can always ask for a person."
  },
  {
    title: "Your team reviews leads, requests, and follow-up",
    icon: LayoutDashboard,
    copy: "Everything lands in one operator workspace with transcripts, summaries, and next steps."
  }
];

const heroMetrics = [
  { value: "24/7", label: "Answers when your office can't" },
  { value: "5-10 min", label: "Typical forwarding setup" },
  { value: "Always human", label: "Callers can ask for a person anytime" }
];

const visibilityCards: Array<{ title: string; icon: LucideIcon; copy: string }> = [
  {
    title: "Call review workspace",
    icon: ShieldCheck,
    copy: "Review transcripts, summaries, transfer outcomes, and call recordings."
  },
  {
    title: "Lead and appointment visibility",
    icon: CalendarClock,
    copy: "See which calls became leads and which customers requested appointments."
  },
  {
    title: "Messages and follow-up",
    icon: MessageSquareText,
    copy: "Track missed-call recovery texts and ongoing customer replies."
  },
  {
    title: "Daily action queue",
    icon: BarChart3,
    copy: "Know which calls need review, which requests are waiting, and what needs a callback."
  }
];

const trustCards: Array<{ title: string; icon: LucideIcon; copy: string }> = [
  {
    title: "Always escape to human",
    icon: PhoneCall,
    copy: "Customers can say “talk to a person” and the call transfers to your office."
  },
  {
    title: "Every call is reviewable",
    icon: ShieldCheck,
    copy: "Your team can review transcripts, summaries, outcomes, and recordings when available."
  },
  {
    title: "Missed calls still get a second chance",
    icon: BadgeCheck,
    copy: "If a call is missed, the system sends a follow-up text so the customer can still turn into a lead."
  }
];

const missedCallFigures = [
  {
    figure: "20-30%",
    title: "Calls can hit voicemail or ring out",
    detail: "Common range when shops are busy, after-hours, or short-staffed."
  },
  {
    figure: "<5 min",
    title: "Response window for high-intent callers",
    detail: "Fast first response often decides who wins the booking."
  },
  {
    figure: "10-20%",
    title: "Pipeline can leak from delayed follow-up",
    detail: "Missed or late callbacks compound into lost jobs over time."
  }
];

const integrationLabels = [
  "Verizon",
  "AT&T",
  "Google Voice",
  "RingCentral",
  "Dialpad",
  "Most business phone systems"
];

export default function HomePage() {
  return (
    <div>
      <section className="border-b bg-[radial-gradient(circle_at_top_left,_rgba(31,58,138,0.08),_transparent_36%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
        <div className="page-shell grid gap-10 py-14 md:py-20 lg:grid-cols-[minmax(0,1.1fr)_420px] lg:items-start">
          <MotionInView>
            <div className="space-y-8">
              <div className="space-y-4">
                <p className="page-eyebrow">For Service Businesses That Cannot Afford To Miss Calls</p>
                <h1 className="max-w-3xl">
                  Stop losing jobs from missed calls.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  When your team is busy, closed, or tied up on another line, the AI receptionist answers, captures the job request, sends follow-up texts, and transfers urgent callers to your office when needed.
                </p>
                <p className="text-sm font-medium text-foreground/80">
                  Keep your existing phone number. Setup takes about 5 to 10 minutes.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="#how-it-works">See How It Works</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="#demo">Listen to a Demo Call</Link>
                </Button>
              </div>

              <div className="space-y-2">
                <Link
                  href="#demo"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  <span className="text-base leading-none">▶</span>
                  Hear how the AI answers a service call
                </Link>
                <p className="text-sm text-muted-foreground">
                  Built for HVAC, electrical, plumbing, repair shops, and other busy service offices.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {heroMetrics.map((item) => (
                  <div key={item.label} className="rounded-2xl border bg-white/90 px-4 py-4 shadow-sm">
                    <p className="text-2xl font-semibold tracking-tight">{item.value}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </MotionInView>

          <MotionInView delay={0.08}>
            <LeadCaptureForm
              sourcePage="/"
              sourceSection="hero"
              ctaVariant="primary"
              title="See how this works with your phone setup"
              compact
            />
          </MotionInView>
        </div>
      </section>

      <section className="page-shell section-shell pt-12 md:pt-16">
        <SectionHeading
          eyebrow="Setup in minutes"
          title="Keep your number. Forward calls. Start capturing missed jobs."
          description="No new phone system. No telecom replacement. Your customers keep calling the same number they already know."
        />
        <div className="mt-6 rounded-2xl border bg-muted/40 px-5 py-4 text-sm leading-6 text-foreground/80">
          You do not need to replace your current office phone setup to get started.
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <div className="grid gap-4 md:grid-cols-3">
            {setupSteps.map(({ step, title, icon: Icon, copy }, index) => (
              <MotionInView delay={index * 0.05} key={title}>
                <Card className="h-full">
                  <CardContent className="flex h-full flex-col gap-4 p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="w-fit rounded-2xl bg-muted px-3 py-3">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <p className="page-eyebrow text-primary">{step}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-semibold">{title}</p>
                      <p className="text-sm leading-6 text-muted-foreground">{copy}</p>
                    </div>
                  </CardContent>
                </Card>
              </MotionInView>
            ))}
          </div>
          <MotionInView delay={0.08}>
            <Card className="h-full border-primary/20 bg-[linear-gradient(180deg,rgba(31,58,138,0.04),rgba(31,58,138,0.01))]">
              <CardContent className="space-y-5 p-6">
                <div className="rounded-2xl border border-primary/20 bg-white/80 p-4">
                  <p className="page-eyebrow text-primary">Call flow</p>
                  <div className="mt-3 space-y-3 text-sm">
                    {["Customer", "Your business number", "Forward to AI receptionist", "Lead captured or transfer to office"].map((item, index) => (
                      <div key={item} className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {index + 1}
                        </div>
                        <p className="font-medium text-foreground/85">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-950">
                  Customers can always say “talk to a person” and the call transfers instantly.
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  {integrationLabels.map((item) => (
                    <span key={item} className="rounded-full border bg-white px-3 py-1.5">
                      {item}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </MotionInView>
        </div>
      </section>

      <section className="surface-muted">
        <div className="page-shell section-shell">
          <SectionHeading
            eyebrow="Missed calls cost jobs"
            title="When nobody answers, the customer usually calls the next shop."
            description="High-intent callers rarely wait long. Missed calls, ring-outs, and delayed callbacks create avoidable revenue leakage."
          />
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.95fr)]">
            <div className="grid gap-4 md:grid-cols-3">
              {missedCallFigures.map((item) => (
                <Card key={item.title} className="shadow-none">
                  <CardContent className="space-y-3 p-6">
                    <p className="text-3xl font-semibold tracking-tight">{item.figure}</p>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm leading-6 text-muted-foreground">{item.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="shadow-none">
              <CardContent className="grid gap-4 p-6 md:grid-cols-2">
                <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-5">
                  <p className="page-eyebrow text-rose-700">Without the system</p>
                  <div className="space-y-2 text-sm font-medium text-rose-950">
                    <p>Customer calls</p>
                    <p className="text-rose-500">No answer</p>
                    <p>Calls competitor</p>
                  </div>
                </div>
                <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="page-eyebrow text-emerald-700">With Khan Automation</p>
                  <div className="space-y-2 text-sm font-medium text-emerald-950">
                    <p>Customer calls</p>
                    <p>AI answers</p>
                    <p>Lead captured</p>
                    <p>Office follows up</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Figures are directional operating benchmarks and vary by market, call volume, and response process.
          </p>
        </div>
      </section>

      <section id="how-it-works" className="page-shell section-shell scroll-mt-24">
        <SectionHeading
          eyebrow="How it works"
          title="A simple front-desk layer for inbound calls"
          description="The system answers when your team cannot, captures job details, follows up by text, and keeps every interaction reviewable."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {howItWorksSteps.map(({ title, icon: Icon, copy }, index) => (
            <MotionInView delay={index * 0.05} key={title}>
              <Card className="shadow-none">
                <CardContent className="space-y-4 p-6">
                  <div className="rounded-xl bg-muted p-2.5 shadow-sm w-fit">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm leading-6 text-muted-foreground">{copy}</p>
                  </div>
                </CardContent>
              </Card>
            </MotionInView>
          ))}
        </div>
      </section>

      <section className="page-shell section-shell">
        <SectionHeading
          eyebrow="Operations visibility"
          title="See every call, lead, request, and follow-up in one place"
          description="Owners and office staff should be able to understand what happened, what was captured, and what still needs action."
        />
        <div className="mt-4 max-w-3xl rounded-2xl border bg-muted/35 px-5 py-4 text-sm leading-6 text-foreground/78">
          This section should read like what your office can see and act on, not a feature inventory or internal product dashboard.
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {visibilityCards.map(({ title, icon: Icon, copy }, index) => (
            <MotionInView delay={index * 0.05} key={title}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-4 p-6">
                  <div className="w-fit rounded-2xl bg-muted px-3 py-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-semibold">{title}</p>
                    <p className="text-sm leading-6 text-muted-foreground">{copy}</p>
                  </div>
                </CardContent>
              </Card>
            </MotionInView>
          ))}
        </div>
      </section>

      <section className="surface-muted" id="demo">
        <div className="page-shell section-shell">
          <SectionHeading
            eyebrow="Experience"
            title="See the call, SMS, and booking flow together"
            description="The system should feel cohesive for your staff: conversations, summaries, follow-up messages, appointment requests, and daily dashboard priorities all live in one operational view."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <DemoCallCard demoNumber={siteConfig.demoNumber} />
            <SmsDemo />
          </div>
        </div>
      </section>

      <section className="page-shell section-shell">
        <SectionHeading
          eyebrow="Built for trust"
          title="Customers are never trapped in an AI loop"
          description="The system is designed to help your office, not block your customers from reaching a person."
        />
        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <div className="grid gap-4 md:grid-cols-3">
            {trustCards.map(({ title, icon: Icon, copy }, index) => (
              <MotionInView delay={index * 0.05} key={title}>
                <Card className="h-full">
                  <CardContent className="space-y-4 p-6">
                    <div className="w-fit rounded-2xl bg-muted px-3 py-3">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-semibold">{title}</p>
                      <p className="text-sm leading-6 text-muted-foreground">{copy}</p>
                    </div>
                  </CardContent>
                </Card>
              </MotionInView>
            ))}
          </div>
          <Card className="border-primary/15 bg-[linear-gradient(180deg,rgba(31,58,138,0.04),rgba(31,58,138,0.01))]">
            <CardContent className="space-y-4 p-6">
              <div>
                <p className="page-eyebrow text-primary">Operator review</p>
                <p className="mt-2 text-lg font-semibold">What your office can check on every important call</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {["Transcript", "Summary", "Outcome", "Recording", "Next action"].map((item) => (
                  <div key={item} className="rounded-xl border bg-white/85 px-4 py-3 text-sm font-medium text-foreground/85">
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="pricing" className="page-shell section-shell scroll-mt-24">
        <SectionHeading
          eyebrow="Pricing"
          title="Pilot-first pricing built for disciplined rollout"
          description="Pricing is set up to keep onboarding quality high and deployment reliable, not to optimize for raw client volume."
        />
        <div className="mt-8">
          <PricingCards />
        </div>
      </section>

      <section className="page-shell section-shell pt-0">
        <SectionHeading
          eyebrow="Questions"
          title="FAQ"
          description="Common rollout, workflow, and implementation questions."
        />
        <div className="mt-6">
          <FAQAccordion />
        </div>
      </section>

      <section id="contact" className="border-t scroll-mt-24">
        <div className="page-shell grid gap-8 py-14 lg:grid-cols-[minmax(0,0.95fr)_420px] lg:items-start">
          <div className="space-y-4">
            <p className="page-eyebrow">Next step</p>
            <h2>Ready to tighten your lead flow?</h2>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Book a call or send your details. The follow-up should be practical: current process review, rollout constraints, and the clearest first deployment path.
            </p>
            <Button asChild>
              <Link href="/book">Book a 15-min Call</Link>
            </Button>
          </div>
          <LeadCaptureForm sourcePage="/#final-cta" sourceSection="final_cta" ctaVariant="secondary" title="Prefer we contact you first?" />
        </div>
      </section>
    </div>
  );
}
