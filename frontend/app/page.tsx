import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckSquare,
  MessageSquareText,
  PhoneCall,
  ShieldCheck,
  Workflow
} from "lucide-react";
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

const operatorPillars: Array<{ title: string; icon: LucideIcon; copy: string; code: string }> = [
  {
    title: "Answer",
    icon: PhoneCall,
    copy: "The AI receptionist picks up when the office is busy, closed, or tied up on another line.",
    code: "01 // CALL HANDLING"
  },
  {
    title: "Capture",
    icon: Workflow,
    copy: "Caller name, phone number, service need, urgency, and booking intent are pushed into one reviewable workspace.",
    code: "02 // REQUEST CAPTURE"
  },
  {
    title: "Follow-up",
    icon: MessageSquareText,
    copy: "Missed-call recovery texts, booking handoff, and office next steps stay visible instead of disappearing into voicemail.",
    code: "03 // OFFICE ACTION"
  }
];

const visibilityCards: Array<{ title: string; icon: LucideIcon; copy: string }> = [
  {
    title: "Call review workspace",
    icon: PhoneCall,
    copy: "Open the transcript, summary, transfer result, and next action from one place."
  },
  {
    title: "Lead and booking flow",
    icon: CalendarClock,
    copy: "Track when a call becomes a lead, booking request, or scheduled job."
  },
  {
    title: "Operator inbox",
    icon: MessageSquareText,
    copy: "Keep office replies, missed-call recovery texts, and live customer threads in one queue."
  },
  {
    title: "Daily action queue",
    icon: BarChart3,
    copy: "Make it obvious what matters now and what the office should do next."
  }
];

const trustPoints: Array<{ title: string; icon: LucideIcon; copy: string }> = [
  {
    title: "Human-in-the-loop rollout",
    icon: ShieldCheck,
    copy: "Setup is reviewed against real business rules before the workspace goes live."
  },
  {
    title: "Verified workflows",
    icon: CheckSquare,
    copy: "Calls, leads, messages, and booking requests are reviewable instead of black-box automation."
  },
  {
    title: "Operator-first design",
    icon: Workflow,
    copy: "The product is built around front-desk work, not generic CRM theater."
  }
];

const planNotes = [
  "Keep your existing phone number",
  "Forward calls in minutes",
  "Customers can always ask for a person",
  "Office staff review everything in one workspace"
];

export default function HomePage() {
  return (
    <div className="pb-12">
      <section className="border-b border-slate-300 bg-[linear-gradient(180deg,#f7f9fb_0%,#eef3f8_100%)]">
        <div className="page-shell grid gap-10 py-14 md:py-20 lg:grid-cols-[minmax(0,1.05fr)_460px] lg:items-center">
          <MotionInView>
            <div className="space-y-8">
              <div className="space-y-4">
                <p className="inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-900">
                  Operational Intelligence
                </p>
                <h1 className="max-w-3xl text-[46px] font-semibold leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-[62px] lg:text-[74px]">
                  The OS for your{" "}
                  <span className="text-blue-700">Front Desk</span>
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-slate-700">
                  AI receptionists for service businesses that answer calls, capture customer intent, and keep the office on top of what needs action next.
                </p>
                <p className="max-w-2xl text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
                  Built for HVAC, plumbing, electrical, repair, and busy service offices.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-md px-6">
                  <Link href="/book">Book a demo</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-md px-6">
                  <Link href="#how-it-works">See how it works</Link>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { value: "24/7", label: "Covers missed calls" },
                  { value: "5-10 min", label: "Typical forwarding setup" },
                  { value: "Human-first", label: "Escalates when needed" }
                ].map((item) => (
                  <div key={item.label} className="rounded-[14px] border border-slate-300 bg-white px-4 py-4 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
                    <p className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">{item.value}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </MotionInView>

          <MotionInView delay={0.08}>
            <div className="overflow-hidden rounded-[18px] border border-slate-300 bg-slate-950 p-4 text-white shadow-[0_24px_52px_rgba(15,23,42,0.24)]">
              <div className="rounded-[14px] border border-slate-800 bg-slate-900 p-5">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    <span className="h-3 w-3 rounded-full bg-emerald-500" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Front Desk Runtime
                  </span>
                </div>
                <div className="space-y-3 font-mono text-sm">
                  <div className="flex gap-3 text-blue-300">
                    <span>[09:41:02]</span>
                    <span>CALL STARTED: +1 (555) 012-3456</span>
                  </div>
                  <div className="flex gap-3 text-slate-400">
                    <span>[09:41:04]</span>
                    <span>AI GREETING: office pickup and triage</span>
                  </div>
                  <div className="flex gap-3 text-emerald-400">
                    <span>[09:41:27]</span>
                    <span>REQUEST CAPTURED: deep cleaning, urgent, Oct 28</span>
                  </div>
                  <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-white">
                    <div className="flex gap-3">
                      <span>[09:41:44]</span>
                      <span>ACTION NEEDED: office review and booking follow-up</span>
                    </div>
                  </div>
                  <div className="flex gap-3 text-slate-400">
                    <span>[09:42:02]</span>
                    <span>SMS FOLLOW-UP: booking handoff sent to customer</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-[14px] border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">What exists now</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Inbound call handling, lead capture, SMS follow-up, booking-request handoff, and one operator workspace for the office team.
                </p>
              </div>
            </div>
          </MotionInView>
        </div>
      </section>

      <section id="how-it-works" className="page-shell section-shell scroll-mt-24">
        <SectionHeading
          eyebrow="Core infrastructure"
          title="Three pillars of front-desk automation"
          description="This product is strongest when it answers the phone, captures the request correctly, and makes the office next step obvious."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {operatorPillars.map(({ title, icon: Icon, copy, code }, index) => (
            <MotionInView key={title} delay={index * 0.05}>
              <Card className="h-full rounded-[16px] border-slate-300 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
                <CardContent className="flex h-full flex-col gap-6 p-7">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-[12px] bg-blue-50 text-blue-700">
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-[28px] font-semibold uppercase tracking-[-0.04em] text-slate-950">{title}</h3>
                    <p className="text-sm leading-7 text-slate-600">{copy}</p>
                  </div>
                  <div className="mt-auto border-t border-slate-200 pt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                    {code}
                  </div>
                </CardContent>
              </Card>
            </MotionInView>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-300 bg-slate-100/80">
        <div className="page-shell section-shell">
          <SectionHeading
            eyebrow="Operations visibility"
            title="One workspace for the office team"
            description="The office should be able to understand what happened, what the customer wanted, and what needs action without switching between disconnected tools."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {visibilityCards.map(({ title, icon: Icon, copy }, index) => (
              <MotionInView key={title} delay={index * 0.05}>
                <Card className="h-full rounded-[16px] border-slate-300 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                  <CardContent className="flex h-full flex-col gap-4 p-6">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-[12px] bg-slate-100 text-blue-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-semibold text-slate-950">{title}</p>
                      <p className="text-sm leading-6 text-slate-600">{copy}</p>
                    </div>
                  </CardContent>
                </Card>
              </MotionInView>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell section-shell">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_420px]">
          <div className="rounded-[20px] border-4 border-slate-950 bg-white p-8 shadow-[0_16px_36px_rgba(15,23,42,0.12)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Unmatched reliability</p>
            <h2 className="mt-4 text-[40px] font-semibold uppercase italic tracking-[-0.05em] text-slate-950">
              Backed by real humans
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-700">
              This is not a set-it-and-forget-it fantasy product. Real rollout quality comes from verified business rules, human review, and clear operator visibility after go-live.
            </p>
            <Link href="/how-it-works" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-blue-700 transition-all hover:gap-3">
              Learn about the workflow
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-[18px] border border-slate-300 bg-slate-50 p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Operational guardrails</p>
            <ul className="mt-4 space-y-4">
              {trustPoints.map(({ title, icon: Icon, copy }) => (
                <li key={title} className="rounded-[14px] border border-slate-200 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-700">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-950">{title}</p>
                      <p className="text-sm leading-6 text-slate-600">{copy}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-950 text-white">
        <div className="page-shell section-shell">
          <SectionHeading
            className="[&_h2]:text-white [&_p]:text-slate-300"
            eyebrow="Operational scaling plans"
            title="Pricing built for controlled rollout"
            description="Launch honestly. Expand only after the office workflow is stable."
          />
          <div className="mt-6 rounded-[16px] border border-slate-800 bg-slate-900/70 p-5 text-sm leading-6 text-slate-300">
            <p className="font-medium text-white">What the product supports best today</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {planNotes.map((item) => (
                <span key={item} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-8">
            <PricingCards />
          </div>
        </div>
      </section>

      <section className="page-shell section-shell">
        <SectionHeading
          eyebrow="Product flow"
          title="See the operator loop together"
          description="Call review, SMS follow-up, and booking handoff should feel like one workflow."
        />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <DemoCallCard demoNumber={siteConfig.demoNumber} />
          <SmsDemo />
        </div>
      </section>

      <section className="page-shell section-shell pt-0">
        <SectionHeading eyebrow="Questions" title="FAQ" description="Common rollout, workflow, and setup questions." />
        <div className="mt-6">
          <FAQAccordion />
        </div>
      </section>

      <section className="border-t border-slate-300">
        <div className="page-shell grid gap-8 py-14 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
          <div className="space-y-4">
            <p className="page-eyebrow">Next step</p>
            <h2 className="max-w-2xl">Show us your current phone flow and we will map the first honest rollout.</h2>
            <p className="max-w-xl text-sm leading-6 text-slate-600">
              The first conversation should be practical: current call coverage, routing constraints, booking workflow, and what your office actually wants automated.
            </p>
            <Button asChild>
              <Link href="/book">Book a 15-min call</Link>
            </Button>
          </div>
          <LeadCaptureForm sourcePage="/#final-cta" sourceSection="final_cta" ctaVariant="secondary" title="Prefer we contact you first?" />
        </div>
      </section>
    </div>
  );
}
