import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BadgeCheck, BarChart3, CalendarClock, Clock3, Handshake, LayoutDashboard, MessageSquareText, PhoneCall, Plug, ShieldCheck, SlidersHorizontal, UserRoundSearch } from "lucide-react";
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
import { caseStudies } from "@/lib/case-studies";

const outcomes: Array<{ title: string; icon: LucideIcon; copy: string }> = [
  {
    title: "24/7 call answer coverage",
    icon: PhoneCall,
    copy: "Every inbound call is answered or captured, including nights, weekends, and peak hours."
  },
  {
    title: "Faster quote turnaround",
    icon: Clock3,
    copy: "Collect the right job details on first contact so your team can quote and follow up faster."
  },
  {
    title: "Consistent intake notes",
    icon: BadgeCheck,
    copy: "Standardized summaries reduce missed details and keep dispatch, techs, and office aligned."
  },
  {
    title: "Automated SMS confirmations",
    icon: MessageSquareText,
    copy: "Send immediate confirmations and follow-up messages to reduce drop-off after first contact."
  },
  {
    title: "Smart scheduling + handoff",
    icon: CalendarClock,
    copy: "Route urgent calls correctly and hand off priority jobs to the right person without delay."
  },
  {
    title: "Call log visibility",
    icon: ShieldCheck,
    copy: "Give your team a searchable record of calls, outcomes, and summaries for operational control."
  }
];

const steps: Array<{ title: string; icon: LucideIcon; copy: string }> = [
  { title: "Audit", icon: Handshake, copy: "Map your current call, intake, and scheduling flow." },
  { title: "Setup", icon: Plug, copy: "Configure scripts, routing, and lead capture rules." },
  { title: "Launch", icon: PhoneCall, copy: "Go live with call handling and SMS follow-up." },
  { title: "Optimize", icon: BadgeCheck, copy: "Tune response quality and conversion weekly." }
];

const heroMetrics = [
  { value: "24/7", label: "Coverage for inbound calls" },
  { value: "<1 min", label: "Intake start target" },
  { value: "1 workspace", label: "Calls, leads, appointments, and SMS" }
];

const platformUpdates: Array<{ title: string; icon: LucideIcon; copy: string }> = [
  {
    title: "Client portal navigation",
    icon: LayoutDashboard,
    copy: "The client workspace now gives staff a clearer path across overview, conversations, leads, appointments, messages, analytics, and settings."
  },
  {
    title: "Inbox with thread context",
    icon: MessageSquareText,
    copy: "The messages area now surfaces thread previews, search, readiness state, and cleaner conversation context for manual follow-up."
  },
  {
    title: "Scheduling workspace",
    icon: CalendarClock,
    copy: "Appointments are organized around request review first, schedule visibility second, and manual booking only when needed."
  },
  {
    title: "Operations dashboard",
    icon: BarChart3,
    copy: "The overview page now acts more like a front-desk command view, with daily focus, requests, booking activity, and action-needed items."
  }
];

const portalViews: Array<{ title: string; eyebrow: string; copy: string; bullets: string[]; icon: LucideIcon }> = [
  {
    eyebrow: "Front desk overview",
    title: "A cleaner command layer for daily operations",
    icon: SlidersHorizontal,
    copy: "The client portal is designed to help office staff decide what matters now: who needs a reply, what needs review, and what is already booked.",
    bullets: ["Daily dashboard with action queue", "Request review tied to schedule flow", "System and messaging readiness visibility"]
  },
  {
    eyebrow: "Lead + call continuity",
    title: "Conversations stay connected to real customer records",
    icon: UserRoundSearch,
    copy: "Calls, lead capture, summaries, and follow-up workflows stay tied together so your team is not jumping between disconnected tools.",
    bullets: ["Call outcomes and summaries in one place", "Lead records tied to follow-up context", "Cleaner handoff from first contact to booking"]
  },
  {
    eyebrow: "Messaging + booking",
    title: "Follow-up tools built around operational speed",
    icon: BadgeCheck,
    copy: "Manual texts, automated confirmations, and appointment follow-up live closer to the booking workflow so staff can move faster.",
    bullets: ["Threaded inbox with previews", "Scheduling workspace for request triage", "Manual outreach when the office needs to step in"]
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
  "Current phone workflows",
  "Scheduling calendars",
  "CRM and dispatch systems",
  "Existing intake processes"
];

export default function HomePage() {
  return (
    <div>
      <section className="border-b bg-[radial-gradient(circle_at_top_left,_rgba(31,58,138,0.08),_transparent_36%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
        <div className="page-shell grid gap-10 py-14 md:py-20 lg:grid-cols-[minmax(0,1.1fr)_420px] lg:items-start">
          <MotionInView>
            <div className="space-y-8">
              <div className="space-y-4">
                <p className="page-eyebrow">Enterprise Call Operations Infrastructure</p>
                <h1 className="max-w-3xl">
                  AI reception and follow-up for service shops that need cleaner intake and faster response.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Answers calls around the clock, captures job details, confirms by text, books appointments, and escalates to your team when needed. The result is a tighter front-desk workflow, a clearer client portal, and less leakage between first contact and booked work.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/book">Book a 15-min Call</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/how-it-works">See How It Works</Link>
                </Button>
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
            <LeadCaptureForm sourcePage="/" />
          </MotionInView>
        </div>
      </section>

      <section className="page-shell section-shell pt-12 md:pt-16">
        <SectionHeading
          eyebrow="Platform updates"
          title="Built out for the way a service office actually works"
          description="The product now reflects a fuller operating loop: dashboard triage, cleaner client navigation, message threads with context, and a scheduling workspace that prioritizes request review before manual data entry."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {platformUpdates.map(({ title, icon: Icon, copy }, index) => (
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

      <section className="page-shell section-shell">
        <SectionHeading
          eyebrow="Built for service operations"
          title="What the system improves first"
          description="The goal is not more software. The goal is cleaner intake, faster first response, and less operational leakage after the first call."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outcomes.map(({ title, icon: Icon, copy }, index) => (
            <MotionInView delay={index * 0.04} key={title}>
              <Card>
                <CardContent className="flex items-start gap-3 p-5">
                  <div className="rounded-xl bg-muted p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm leading-6 text-muted-foreground">{copy}</p>
                  </div>
                </CardContent>
              </Card>
            </MotionInView>
          ))}
        </div>
      </section>

      <section className="surface-muted">
        <div className="page-shell section-shell">
          <SectionHeading
            eyebrow="Operational reality"
            title="Missed calls create avoidable revenue leakage"
            description="These directional benchmarks show why first response and consistent follow-up matter so much in service businesses."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
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
          <p className="mt-4 text-xs text-muted-foreground">
            Figures are directional operating benchmarks and vary by market, call volume, and response process.
          </p>
        </div>
      </section>

      <section className="page-shell section-shell">
        <SectionHeading
          eyebrow="Client portal"
          title="A more professional operating surface for your team"
          description="This is not just an answering layer. It is a workspace for office staff to review what came in, see what needs action, and move customers toward booked work without losing context."
        />
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {portalViews.map(({ eyebrow, title, copy, bullets, icon: Icon }, index) => (
            <MotionInView delay={index * 0.05} key={title}>
              <Card className="h-full">
                <CardContent className="space-y-5 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="page-eyebrow text-primary">{eyebrow}</p>
                      <p className="text-xl font-semibold">{title}</p>
                    </div>
                    <div className="rounded-2xl bg-muted p-3">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{copy}</p>
                  <div className="space-y-2">
                    {bullets.map((item) => (
                      <div key={item} className="rounded-xl border bg-muted/35 px-4 py-3 text-sm text-foreground/88">
                        {item}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </MotionInView>
          ))}
        </div>
      </section>

      <section className="surface-muted">
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

      <section id="how-it-works" className="surface-muted scroll-mt-24">
        <div className="page-shell section-shell">
          <SectionHeading
            eyebrow="How it works"
            title="A clean rollout sequence"
            description="Implementation starts with your current intake workflow, then tightens routing, capture, and follow-up without forcing a disruptive process reset."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {steps.map(({ title, icon: Icon, copy }) => (
              <Card key={title} className="shadow-none">
                <CardContent className="space-y-4 p-6">
                  <div className="rounded-xl bg-white p-2.5 shadow-sm w-fit">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold">{title}</p>
                    <p className="text-sm leading-6 text-muted-foreground">{copy}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell section-shell">
        <SectionHeading
          eyebrow="Compatibility"
          title="Works with your current tools"
          description="Launch into the operating stack you already use first. Tool changes can come later if they actually improve throughput."
        />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {integrationLabels.map((item) => (
            <div key={item} className="rounded-2xl border bg-white px-4 py-4 text-sm text-muted-foreground shadow-sm">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section id="case-studies" className="surface-muted scroll-mt-24">
        <div className="page-shell section-shell">
          <SectionHeading
            eyebrow="Proof"
            title="Case studies"
            description="Examples of how cleaner intake and follow-up can improve service-operations throughput."
            actions={
              <Button asChild variant="outline">
                <Link href="/case-studies">View all case studies</Link>
              </Button>
            }
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {caseStudies.slice(0, 2).map((item) => (
              <Card key={item.slug}>
                <CardContent className="space-y-3 p-6">
                  <p className="page-eyebrow text-primary">{item.industry}</p>
                  <p className="text-lg font-semibold">{item.title}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{item.summary}</p>
                  <Link href="/case-studies" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    View all case studies
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
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
          <LeadCaptureForm sourcePage="/#final-cta" title="Prefer we contact you first?" />
        </div>
      </section>
    </div>
  );
}
