import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  ConciergeBell,
  LayoutDashboard,
  MessageSquare,
  PhoneCall,
  Search,
  Shield,
  Smartphone,
  Sparkles,
  Users,
  Zap
} from "lucide-react";
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

            <div className="relative">
              <div className="absolute -inset-4 rounded-[3rem] bg-[#3caff6]/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl">
                <div className="flex min-h-[560px]">
                  <div className="hidden w-48 shrink-0 border-r border-slate-100 bg-white p-6 lg:flex lg:flex-col lg:gap-8">
                    <div className="flex items-center gap-2 px-1">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#3caff6] text-white">
                        <ConciergeBell size={14} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-tight text-slate-900">Front Desk OS</span>
                    </div>
                    <nav className="space-y-1">
                      {[
                        { icon: LayoutDashboard, label: "Dashboard", active: true },
                        { icon: PhoneCall, label: "Calls", active: false },
                        { icon: Users, label: "Leads", active: false },
                        { icon: MessageSquare, label: "Messages", active: false }
                      ].map(({ icon: Icon, label, active }) => (
                        <div
                          key={label}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[10px] font-bold transition-all ${
                            active ? "bg-[#3caff6] text-white shadow-lg shadow-sky-200" : "text-slate-400"
                          }`}
                        >
                          <Icon size={16} />
                          <span>{label}</span>
                        </div>
                      ))}
                    </nav>
                  </div>

                  <div className="flex flex-1 flex-col overflow-hidden bg-slate-50/50">
                    <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 bg-white px-6">
                      <div className="flex items-center gap-3 rounded-lg bg-slate-100 px-3 py-1.5">
                        <Search size={12} className="text-slate-400" />
                        <div className="h-2 w-24 rounded bg-slate-200" />
                      </div>
                      <div className="flex items-center gap-3">
                        <Bell size={14} className="text-slate-400" />
                        <div className="h-6 w-6 rounded-full bg-slate-200" />
                      </div>
                    </div>

                    <div className="flex-1 p-6">
                      <div className="grid h-full gap-4 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
                        <div className="space-y-4">
                          <div className="grid gap-4">
                            {[
                              ["Calls", "1,284", "+12%"],
                              ["Leads", "456", "+5%"],
                              ["Bookings", "89", "+8%"]
                            ].map((item) => (
                              <div key={item[0]} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">{item[0]}</p>
                                <div className="mt-2 flex items-baseline gap-2">
                                  <span className="text-2xl font-black text-slate-900">{item[1]}</span>
                                  <span className="text-[8px] font-bold text-emerald-500">{item[2]}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="mb-4 flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Action Needed</span>
                              <span className="rounded-full bg-sky-50 px-2 py-1 text-[8px] font-bold uppercase tracking-widest text-[#3caff6]">
                                3 active
                              </span>
                            </div>
                            <div className="space-y-3">
                              {["John Doe", "Sarah Smith", "Marcus Wright"].map((name, index) => (
                                <div key={name} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                                  <div className="space-y-1">
                                    <p className="text-sm font-bold text-slate-900">{name}</p>
                                    <p className="text-[10px] text-slate-500">
                                      {index === 0 ? "Urgent callback requested" : index === 1 ? "Booking confirmation waiting" : "SMS follow-up ready"}
                                    </p>
                                  </div>
                                  <ArrowRight size={14} className="text-slate-300" />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[#3caff6]">
                                <PhoneCall size={14} />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Review</p>
                                <p className="text-base font-bold text-slate-900">Sarah J. Mason</p>
                              </div>
                            </div>
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[8px] font-bold uppercase tracking-widest text-emerald-700">
                              Completed
                            </span>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_210px]">
                            <div className="space-y-4">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">AI Summary</p>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                  Caller asked for Saturday morning availability and confirmed requirements before requesting a booking hold.
                                </p>
                              </div>
                              <div className="space-y-3">
                                <div className="flex gap-2">
                                  <div className="mt-1 h-4 w-4 rounded-full bg-slate-100" />
                                  <div className="w-full rounded-xl rounded-tl-none bg-slate-50 p-3 text-sm text-slate-600">
                                    Hi, do you have anything open this Saturday morning for a deep clean?
                                  </div>
                                </div>
                                <div className="flex flex-row-reverse gap-2">
                                  <div className="mt-1 h-4 w-4 rounded-full bg-primary/10" />
                                  <div className="w-full rounded-xl rounded-tr-none bg-primary/5 p-3 text-sm text-slate-700">
                                    Yes, I can hold a 10:00 AM slot and send a confirmation right after this call.
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="rounded-2xl border border-slate-200 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Intent</p>
                                <p className="mt-2 text-sm font-bold text-slate-900">Booking Request</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Channel</p>
                                <p className="mt-2 text-sm font-bold text-slate-900">Call + SMS</p>
                              </div>
                              <div className="rounded-2xl bg-slate-900 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Next Action</p>
                                <div className="mt-3 space-y-2">
                                  <div className="rounded-xl bg-[#3caff6] px-3 py-2 text-center text-sm font-bold text-white">Call Back</div>
                                  <div className="rounded-xl bg-white/10 px-3 py-2 text-center text-sm font-bold text-white">Send SMS</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
          <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
            <div className="space-y-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#3caff6]">Product Showcase</p>
              <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">A real operator workspace and a real admin control plane.</h2>
              <p className="text-lg leading-relaxed text-slate-500">
                Front Desk OS does not stop at answering the phone. It gives your operators queues, context panes, message threads,
                and booking triage while giving admins reporting, testing, and org-level controls.
              </p>
            </div>
            <div className="relative">
              <div className="absolute -inset-10 rounded-[4rem] bg-[#3caff6]/20 blur-[100px] opacity-50" />
              <div className="relative overflow-hidden rounded-[3rem] border border-slate-800 bg-slate-950 shadow-2xl">
                <div className="flex min-h-[560px]">
                  <div className="hidden w-48 shrink-0 border-r border-slate-800 bg-slate-950 p-6 lg:flex lg:flex-col lg:gap-8">
                    <div className="flex items-center gap-2 px-1">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#3caff6] text-white">
                        <Shield size={14} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase leading-none tracking-tight text-white">Front Desk OS</span>
                        <span className="mt-1 text-[8px] font-bold uppercase tracking-widest text-[#3caff6]">Admin Console</span>
                      </div>
                    </div>
                    <nav className="space-y-1">
                      {[
                        { icon: Shield, label: "Overview", active: true },
                        { icon: Building2, label: "Organizations", active: false },
                        { icon: Activity, label: "System Health", active: false },
                        { icon: BarChart3, label: "Reports", active: false }
                      ].map(({ icon: Icon, label, active }) => (
                        <div
                          key={label}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[10px] font-bold transition-all ${
                            active ? "bg-[#3caff6] text-white shadow-lg shadow-sky-500/20" : "text-slate-500"
                          }`}
                        >
                          <Icon size={16} />
                          <span>{label}</span>
                        </div>
                      ))}
                    </nav>
                  </div>

                  <div className="flex flex-1 flex-col overflow-hidden">
                    <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-6">
                      <div className="relative w-48">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={12} />
                        <div className="h-8 w-full rounded-lg border border-slate-800 bg-slate-900 pl-8" />
                      </div>
                      <div className="flex items-center gap-3">
                        <Bell size={14} className="text-slate-500" />
                        <div className="h-6 w-6 rounded-full bg-slate-800" />
                      </div>
                    </div>

                    <div className="flex-1 p-6">
                      <div className="grid h-full gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
                        <div className="space-y-5">
                          <div className="grid gap-4 sm:grid-cols-3">
                            {[
                              ["Total Orgs", "142", "+4"],
                              ["Active Calls", "18", "Live"],
                              ["Success", "98.4%", "+0.2%"]
                            ].map((item) => (
                              <div key={item[0]} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{item[0]}</p>
                                <div className="mt-2 flex items-baseline justify-between gap-2">
                                  <span className="text-xl font-black text-white">{item[1]}</span>
                                  <span className={`text-[8px] font-bold ${item[2] === "Live" ? "text-[#3caff6]" : "text-emerald-400"}`}>{item[2]}</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                            <div className="mb-4 flex items-center justify-between">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Operational Reporting</p>
                                <p className="mt-1 text-lg font-bold text-white">Analytics and control center</p>
                              </div>
                              <span className="rounded-lg bg-[#3caff6] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white">Export</span>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                              {[
                                ["Call Resolution", "84% completion across routed calls"],
                                ["Revenue Impact", "Recovered pipeline and booking trend"],
                                ["Health Snapshot", "Latency, alerts, and readiness state"]
                              ].map((item) => (
                                <div key={item[0]} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                                  <p className="text-sm font-bold text-white">{item[0]}</p>
                                  <p className="mt-2 text-xs leading-5 text-slate-400">{item[1]}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Recipients</p>
                            <div className="mt-4 space-y-3">
                              {["Founder", "Ops Lead", "Support"].map((item) => (
                                <div key={item} className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                                  <p className="text-sm font-bold text-white">{item}</p>
                                  <p className="mt-1 text-xs text-slate-400">Scheduled report delivery</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">System State</p>
                            <p className="mt-2 text-sm font-medium text-white">Validation clear. Reports and admin automation are healthy.</p>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            {[
                              { icon: Smartphone, label: "Mobile-ready access" },
                              { icon: Calendar, label: "Scheduled batch runs" }
                            ].map(({ icon: Icon, label }) => (
                              <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm font-medium text-slate-300">
                                <div className="mb-2 text-[#3caff6]">
                                  <Icon size={16} />
                                </div>
                                {label}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
