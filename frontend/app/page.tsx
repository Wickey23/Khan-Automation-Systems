import Link from "next/link";
import { ArrowRight, CheckCircle2, Shield, Sparkles, Zap } from "lucide-react";
import { AdminProductShowcase } from "@/components/site/admin-product-showcase";
import { HeroProductTour } from "@/components/site/hero-product-tour";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicNav } from "@/components/site/public-nav";

const trustItems = ["24/7 Coverage", "Structured Onboarding", "Keep Your Number", "Operator Workspace", "Admin Control Plane"];

const featureCards = [
  {
    title: "24/7 AI call answering",
    copy: "Answer inbound calls instantly, capture intent, and keep your office from bleeding high-intent leads."
  },
  {
    title: "Appointment booking",
    copy: "Handle booking requests, respect business rules, and keep operator review in the loop."
  },
  {
    title: "Missed-call recovery",
    copy: "If a caller hangs up or misses the AI, Front Desk OS follows up by SMS before the lead cools off."
  },
  {
    title: "Team routing and escalation",
    copy: "Urgent issues can escalate to staff based on your actual front-desk logic, not a generic call script."
  },
  {
    title: "Operator workspace",
    copy: "Review transcripts, message threads, booking queues, and follow-up tasks from one place."
  },
  {
    title: "Admin reporting",
    copy: "Get a true control plane for diagnostics, testing, org management, and operational reporting."
  }
];

const pricingPlans = [
  {
    name: "Founding Partner",
    price: "$249",
    setup: "$500 one-time setup",
    commitment: "6-month commitment",
    badge: "Limited Pilot",
    cta: "Apply for Founding",
    href: "/contact",
    description: "Limited to the first 5 pilot seats. For early partners willing to provide structured feedback.",
    features: [
      "AI call handling and summaries",
      "Lead capture and analytics",
      "Real-time notifications",
      "12-month price lock",
      "$200 credit in month 6 if feedback cycles are completed",
      "Monthly 30-minute review cadence"
    ]
  },
  {
    name: "Standard",
    price: "$349",
    setup: "$750 one-time setup",
    commitment: "Month-to-month or 3-month term",
    cta: "Start Standard",
    href: "/app/onboarding",
    popular: true,
    description: "The default production plan for reliability-first front desk operations.",
    features: [
      "AI call handling and summaries",
      "Lead capture and analytics",
      "Real-time notifications",
      "Structured onboarding",
      "Standard support cadence",
      "Production-ready reliability"
    ]
  },
  {
    name: "Growth / Pro",
    price: "$599",
    setup: "$1,500+ implementation",
    commitment: "6- or 12-month agreement",
    cta: "Contact Sales",
    href: "/contact",
    description: "For larger teams and multi-location workflows that need SLA-oriented operations and deeper control.",
    features: [
      "Everything in Standard",
      "Multi-location controls",
      "Advanced routing logic",
      "Priority support and SLA alignment",
      "Custom implementation",
      "Durability-gated activation"
    ]
  }
];

const faqItems = [
  ["Can we keep our existing business number?", "Yes. Front Desk OS is built around keeping your number and forwarding calls into the AI receptionist flow."],
  ["How long does setup take?", "Forwarding setup usually takes 5 to 10 minutes. Structured onboarding and go-live review are part of the rollout."],
  ["Can staff still take over?", "Yes. Human handoff, transfer rules, and operator intervention are core parts of the system."],
  ["Does it support SMS and follow-up?", "Yes. Missed-call recovery and outbound follow-up workflows are built into the front-desk operating model."]
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f5f7f8] font-sans text-slate-900 selection:bg-sky-100 selection:text-sky-700">
      <PublicNav />
      <main>
        <section className="px-6 pb-24 pt-32">
          <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#3caff6]">
                <Sparkles size={12} />
                AI Receptionist for Real Front Desk Operations
              </div>
              <div className="space-y-6">
                <h1 className="max-w-4xl text-5xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-6xl">
                  The AI receptionist that actually <span className="text-[#3caff6] italic">runs your front desk.</span>
                </h1>
                <p className="max-w-2xl text-xl leading-relaxed text-slate-500">
                  Front Desk OS answers calls, captures customer intent, routes urgent issues, recovers missed calls with SMS,
                  and gives your team a clean operator workspace instead of another generic dashboard.
                </p>
                <p className="text-sm font-bold uppercase tracking-widest text-slate-400">
                  Keep your number. Structured onboarding. Reliability-first rollout.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Link href="/contact" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#3caff6] px-8 py-4 text-sm font-bold text-white shadow-xl shadow-sky-200 transition-all hover:bg-sky-500">
                  Book a Demo
                  <ArrowRight size={18} />
                </Link>
                <Link href="/how-it-works" className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 py-4 text-sm font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50">
                  See How It Works
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  ["24/7", "Answers when your office cannot"],
                  ["5-10 min", "Typical forwarding setup"],
                  ["Human-ready", "Escalate calls to staff when needed"]
                ].map((item) => (
                  <div key={item[0]} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-3xl font-black text-slate-900">{item[0]}</p>
                    <p className="mt-1 text-sm text-slate-500">{item[1]}</p>
                  </div>
                ))}
              </div>
            </div>

            <HeroProductTour />
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-6 py-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-4 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
            {trustItems.map((item) => (
              <span key={item} className="rounded-full border border-slate-200 px-4 py-2">{item}</span>
            ))}
          </div>
        </section>

        <section className="px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 max-w-3xl">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#3caff6]">The Problem</p>
              <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Missed calls turn into lost jobs faster than most teams realize.</h2>
              <p className="mt-6 text-lg leading-relaxed text-slate-500">
                Busy offices miss calls, delay callbacks, lose booking opportunities, and force staff to manage fragmented workflows across voicemail,
                text threads, calendars, and notes. Front Desk OS closes that operational gap.
              </p>
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="rounded-[2.5rem] border border-red-100 bg-red-50 p-10">
                <h3 className="mb-6 text-2xl font-bold text-slate-900">What breaks today</h3>
                <ul className="space-y-4 text-sm font-medium text-slate-600">
                  {[
                    "Missed calls during busy periods or after hours",
                    "Slow callback loops that kill lead intent",
                    "Manual scheduling chaos across staff and calendars",
                    "Lost context between calls, texts, and bookings"
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3"><span className="mt-1 h-2 w-2 rounded-full bg-red-400" />{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[2.5rem] border border-sky-100 bg-white p-10 shadow-sm">
                <h3 className="mb-6 text-2xl font-bold text-slate-900">How Front Desk OS fixes it</h3>
                <ul className="space-y-4 text-sm font-medium text-slate-600">
                  {[
                    "AI answers instantly and captures customer intent",
                    "Urgent issues route correctly instead of getting buried",
                    "Missed-call recovery SMS keeps leads warm",
                    "Operators review everything in one workspace"
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 text-[#3caff6]" size={18} />{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="bg-white px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 max-w-3xl">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#3caff6]">Feature Grid</p>
              <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Built for the actual front desk operating loop.</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {featureCards.map((card) => (
                <div key={card.title} className="rounded-[2rem] border border-slate-200 bg-slate-50 p-8">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-[#3caff6]"><Zap size={22} /></div>
                  <h3 className="text-xl font-bold text-slate-900">{card.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-500">{card.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <AdminProductShowcase />
          </div>
        </section>

        <section id="pricing" className="bg-white px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-20 text-center">
              <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Pilot-first pricing built for disciplined rollout.</h2>
              <p className="mx-auto mt-6 max-w-2xl text-xl leading-relaxed text-slate-500">
                We prioritize onboarding quality and operational reliability over raw client volume. The pricing model reflects that.
              </p>
            </div>
            <div className="mb-16 grid gap-8 md:grid-cols-3">
              {pricingPlans.map((plan) => (
                <div key={plan.name} className={`relative flex flex-col rounded-[2.5rem] border p-10 transition-all ${plan.popular ? "z-10 scale-105 border-[#3caff6] bg-white shadow-2xl" : "border-slate-200 bg-white shadow-sm"}`}>
                  {plan.popular ? <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#3caff6] px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white">Default Production</div> : null}
                  {!plan.popular && plan.badge ? <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white">{plan.badge}</div> : null}
                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                    <p className="mt-2 min-h-[44px] text-sm leading-relaxed text-slate-500">{plan.description}</p>
                  </div>
                  <div className="mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black text-slate-900">{plan.price}</span>
                      <span className="font-bold text-slate-400">/mo</span>
                    </div>
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#3caff6]">{plan.setup}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{plan.commitment}</p>
                    </div>
                  </div>
                  <ul className="mb-10 flex-1 space-y-4">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-sm font-medium text-slate-600">
                        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#3caff6]" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.href} className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-center font-bold transition-all ${plan.popular ? "bg-[#3caff6] text-white shadow-lg shadow-sky-200 hover:bg-sky-500" : "bg-slate-100 text-slate-900 hover:bg-slate-200"}`}>
                    {plan.cta}
                    <ArrowRight size={18} />
                  </Link>
                </div>
              ))}
            </div>
            <div className="mx-auto max-w-4xl space-y-12">
              <div className="grid gap-12 rounded-[2rem] border border-slate-100 bg-slate-50 p-10 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-900"><Zap size={16} className="text-[#3caff6]" />Implementation Model</h4>
                  <ul className="space-y-2 text-sm text-slate-500">
                    {[
                      "Keep your existing business number",
                      "Forwarding setup takes 5-10 minutes",
                      "Structured onboarding is included",
                      "Controlled go-live for production readiness"
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2"><div className="h-1 w-1 rounded-full bg-[#3caff6]" />{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-900"><Shield size={16} className="text-[#3caff6]" />Operational Integrity</h4>
                  <p className="text-sm leading-relaxed text-slate-500">
                    Setup quality and rollout discipline are core to the model. We verify workflows before live production traffic is routed through the system.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <div className="mb-16 text-center">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#3caff6]">FAQ</p>
              <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Questions teams usually ask before rollout.</h2>
            </div>
            <div className="space-y-4">
              {faqItems.map((item) => (
                <div key={item[0]} className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-900">{item[0]}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-500">{item[1]}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-24">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[3rem] bg-slate-900 px-10 py-16 text-center text-white md:px-16 md:py-24">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
                Ready for a disciplined <span className="text-[#3caff6] italic">operational rollout?</span>
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-slate-300">
                Book a demo, review your current front-desk flow, and see how Front Desk OS fits into your existing number, routing, and booking process.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-6 sm:flex-row">
                <Link href="/contact" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3caff6] px-10 py-5 text-lg font-bold text-white shadow-2xl shadow-sky-500/30 transition-all hover:bg-sky-500 sm:w-auto">
                  Book a Demo
                  <ArrowRight size={20} />
                </Link>
                <Link href="/contact" className="inline-flex w-full items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-10 py-5 text-lg font-bold text-white transition-all hover:bg-white/20 sm:w-auto">
                  Talk to Sales
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
