"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Mail, Target, Zap } from "lucide-react";
import { CommandHeader } from "@/components/ops";
import { PageShell, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";
import { StatusBadge } from "@/components/ui/status-badge";

const capabilityRows = [
  {
    title: "Smart follow-up",
    detail: "AI-guided SMS and email sequences with operator oversight.",
    icon: Zap
  },
  {
    title: "Lead prioritization",
    detail: "Rank prospects by urgency and engagement before manual outreach.",
    icon: Target
  },
  {
    title: "Campaign analytics",
    detail: "Track delivery and reply quality during controlled rollout.",
    icon: BarChart3
  }
] as const;

const rolloutChecks = [
  "Outbound delivery reliability under live traffic",
  "Transcript and summary integrity across edge cases",
  "Approval and follow-up controls verified in monitored runs"
];

export default function AppOutreachPage() {
  return (
    <PageShell className="space-y-5">
      <CommandHeader
        eyebrow="Outreach"
        title="Outreach (Limited Release)"
        description="This module is in controlled rollout. Use core operator queues for daily work while outreach readiness is validated."
        actions={
          <Link
            href="/app/leads"
            className="inline-flex items-center gap-2 rounded-md border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Open Lead Queue
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <SectionShell className="surface-panel space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">Feature availability</p>
          <StatusBadge kind="feature" state="limited" label="Ops-monitored rollout" />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {capabilityRows.map((item) => (
            <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <item.icon className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Readiness checks</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {rolloutChecks.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>

        <StateCard
          variant="locked"
          title="Gated until readiness is complete"
          description="Outreach activates per-org after reliability and monitoring checks pass."
          action={
            <div className="flex gap-2">
              <Link href="/app/calls" className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Call Queue
              </Link>
              <Link href="/app/messages" className="inline-flex items-center gap-2 rounded-md border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800">
                Inbox
                <Mail className="h-4 w-4" />
              </Link>
            </div>
          }
        />
      </SectionShell>
    </PageShell>
  );
}



