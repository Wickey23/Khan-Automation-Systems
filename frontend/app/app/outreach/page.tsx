"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Mail, Rocket, Sparkles, Target, Zap } from "lucide-react";
import { PageHelpFab, PageShell, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";
import { StatusBadge } from "@/components/ui/status-badge";

const launchBlocks = [
  {
    title: "Smart Follow-ups",
    desc: "AI-driven SMS and email sequences that adapt to lead behavior while remaining separate from the live front-desk queues.",
    icon: Zap,
    color: "bg-amber-100 text-amber-600"
  },
  {
    title: "Lead Prioritization",
    desc: "Automatically rank leads by intent and engagement so operators know what human follow-up is mission critical.",
    icon: Target,
    color: "bg-emerald-100 text-emerald-600"
  },
  {
    title: "Performance Analytics",
    desc: "Track delivery, open, and call metrics during the monitored rollout before opening this capability to every tenant.",
    icon: BarChart3,
    color: "bg-blue-100 text-blue-600"
  }
] as const;

const releaseChecks = [
  "Outbound delivery needs to stay reliable on real-world runs before the feature is enabled.",
  "Transcript and summary capture must survive voicemail, pickup, and transfer flows without loss.",
  "Delivery results must sync cleanly before elevated automation touches live customers."
];

const rolloutPhases = [
  { label: "Phase 1", title: "Internal shadow mode", detail: "Ops-only runs validate event capture, retries, and transcript consistency." },
  { label: "Phase 2", title: "Limited tenant pilot", detail: "Approved orgs run monitored campaigns with strict send windows and review loops." },
  { label: "Phase 3", title: "General availability", detail: "Feature unlocks broadly once reliability and analytics thresholds hold." }
] as const;

export default function AppOutreachPage() {
  return (
    <PageShell className="space-y-10 py-12">
      <PageHelpFab
        title="What this workspace covers"
        items={[
          {
            label: "What belongs here",
            text: "Client-managed prospecting, e-commerce follow-up, and campaign monitoring live in Outreach rather than our live front-desk queues."
          },
          {
            label: "Current state",
            text: "The system is in a gated rollout. Supervised runs validate reliability before broader client activation."
          },
          {
            label: "Next step",
            text: "Use Calls, Leads, and Inbox today. Revisit Outreach once your org is approved for the monitored release."
          }
        ]}
      />

      <SectionShell className="surface-panel space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            <Rocket className="h-4 w-4" />
            <span>Limited release - monitored rollout</span>
          </div>
          <h1 className="mt-6 text-5xl font-black leading-tight text-slate-900">
            Automate outbound follow-up
            <br />
            with calm, inspectable AI
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-lg text-slate-500">
            Outreach is available through a controlled, ops-approved gate. Once your org is ready, the same AI that powers Front Desk OS can manage follow-ups, nurture flows,
            and call-based outreach without burdening the live booking queues.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {launchBlocks.map((feature) => (
            <div key={feature.title} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:shadow-md">
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${feature.color}`}>
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{feature.title}</h3>
              <p className="mt-3 text-sm text-slate-500">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {rolloutPhases.map((phase) => (
            <div key={phase.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{phase.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{phase.title}</p>
              <p className="mt-1 text-xs text-slate-600">{phase.detail}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-950 p-10 text-center text-white shadow-2xl">
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <StatusBadge kind="feature" state="limited" label="Ops-monitored rollout" />
            </div>
            <h2 className="text-3xl font-bold">Behind a reliability gate</h2>
            <p className="mx-auto max-w-3xl text-sm text-slate-300">
              Outreach remains gated until outbound delivery, logging, transcript capture, and follow-up controls stay trustworthy in supervised runs. Operators
              and ops staff monitor every release increment, and we enable tenants once configuration and readiness checks are satisfied.
            </p>

            <div className="mx-auto grid max-w-3xl gap-3 text-left">
              {releaseChecks.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm text-slate-200">
                  {item}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/app/calls"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open Call Queue
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/app/leads"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-primary/90"
              >
                Open Lead Queue
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mx-auto mt-6 max-w-md">
              <StateCard
                variant="locked"
                title="Gated for readiness"
                description="Request access once your org has the delivery, monitoring, and analytics wiring in place. Ops activates Outreach per org readiness."
              />
            </div>

            <div className="mx-auto flex max-w-md gap-3">
              <div className="relative flex-1">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  placeholder="Enter your email address"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-11 py-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-4 font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90"
              >
                Join waitlist
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-400">No spam. Updates are ops-approved launch notices.</p>
          </div>
        </div>
      </SectionShell>
    </PageShell>
  );
}
