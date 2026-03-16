"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Lock, Mail, Rocket, Sparkles, Target, Zap } from "lucide-react";
import { PageHelpFab } from "@/components/ui/page";

const launchBlocks = [
  {
    title: "Smart Follow-ups",
    desc: "AI-driven SMS and email sequences that adapt to lead behavior while staying separate from the live front-desk queues.",
    icon: Zap,
    color: "bg-amber-100 text-amber-600"
  },
  {
    title: "Lead Scoring",
    desc: "Automatically prioritize leads based on engagement and intent before they move into higher-touch sales or booking workflows.",
    icon: Target,
    color: "bg-emerald-100 text-emerald-600"
  },
  {
    title: "Performance Analytics",
    desc: "Track outreach ROI, conversion, and message/call performance once reliability gates are cleared for client use.",
    icon: BarChart3,
    color: "bg-blue-100 text-blue-600"
  }
] as const;

const releaseChecks = [
  "Call completion logging has to stay reliable on real-world outbound runs.",
  "Transcript and summary capture need to hold up across voicemail, pickup, and transfer outcomes.",
  "Delivery and result syncing must stay dependable before clients can run outreach unattended."
];

export default function AppOutreachPage() {
  return (
    <div className="flex min-h-[calc(100vh-220px)] flex-col items-center justify-center overflow-y-auto bg-background-light px-6 py-12">
      <PageHelpFab
        title="What this workspace will cover"
        items={[
          { label: "What belongs here", text: "Client-managed prospecting, outbound follow-up, and campaign monitoring will live in Outreach rather than in the live front-desk queues." },
          { label: "Current state", text: "The engine exists internally, but it is still being proven with supervised real-world runs before client activation." },
          { label: "Go next", text: "Use Calls, Leads, and Inbox for live front-desk work today. Outreach will open after reliability and monitoring are fully proven." }
        ]}
      />

      <div className="w-full max-w-5xl">
        <div className="mb-16 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary">
            <Rocket className="h-3.5 w-3.5" />
            Coming Soon
          </div>
          <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight text-slate-900">
            Automate your <span className="text-primary">Outreach</span>
            <br />
            with AI-powered precision
          </h1>
          <p className="mx-auto max-w-2xl text-xl leading-relaxed text-slate-500">
            We&apos;re building the outbound engine for Front Desk OS. It will automate follow-ups, re-engage cold leads,
            and create more booked work once delivery and reporting are proven reliable enough for production use.
          </p>
        </div>

        <div className="mb-16 grid gap-8 md:grid-cols-3">
          {launchBlocks.map((feature) => (
            <div key={feature.title} className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md">
              <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl ${feature.color}`}>
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-lg font-bold text-slate-900">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-12 text-center shadow-2xl">
          <div className="pointer-events-none absolute inset-0 opacity-10">
            <div className="absolute left-10 top-10 h-32 w-32 rounded-full bg-primary blur-3xl" />
            <div className="absolute bottom-10 right-10 h-32 w-32 rounded-full bg-primary blur-3xl" />
          </div>

          <div className="relative z-10">
            <h2 className="mb-4 flex items-center justify-center gap-3 text-3xl font-bold text-white">
              <Sparkles className="text-primary" />
              Behind a reliability gate
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-slate-400">
              Outreach is intentionally held back until outbound delivery, logging, transcript capture, and follow-up
              monitoring are consistently trustworthy in supervised use.
            </p>

            <div className="mx-auto grid max-w-3xl gap-3 text-left">
              {releaseChecks.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-sm leading-6 text-slate-200">
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/app/calls"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-slate-700"
              >
                Open Call Queue
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/app/leads"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
              >
                Open Lead Queue
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-amber-200">
              <Lock className="h-3.5 w-3.5" />
              Client activation locked for now
            </div>

            <div className="mx-auto mt-10 flex max-w-md gap-3">
              <div className="relative flex-1">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  placeholder="Enter your email address"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-11 py-4 text-white outline-none transition-all placeholder:text-slate-500 focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-4 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
              >
                Join Waitlist
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              No spam. This is only for launch notice and early-access updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
