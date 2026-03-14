"use client";

import Link from "next/link";
import { Lock, Mail, Megaphone, PhoneCall, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, WorkflowHint } from "@/components/ui/page";
import { clientBadgeClass } from "@/lib/client-badges";

const launchBlocks = [
  {
    title: "Lead lists and import",
    description: "Upload prospect batches, validate contact data, and prepare outreach-ready leads without mixing them into the live front-desk queues.",
    icon: Megaphone
  },
  {
    title: "Email sequences",
    description: "Build controlled outbound sequences, preview each step, and monitor replies, failures, and unsubscribes from one place.",
    icon: Mail
  },
  {
    title: "Caller AI",
    description: "Queue AI outreach calls during the allowed daily window, review call outcomes, and verify summaries, transcripts, and provider health.",
    icon: PhoneCall
  }
];

const releaseChecks = [
  "Call completion logging has to be consistently reliable on real calls.",
  "Transcript and summary capture need to prove out across voicemail, pickup, and transfer paths.",
  "Provider and webhook reconciliation has to stay dependable before clients can run this unattended."
];

export default function AppOutreachPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Growth workspace"
        title="Outreach"
        description="Outbound email and AI calling will live here once the system is fully hardened for client use."
        actions={
          <Badge className={clientBadgeClass("pending")}>
            Coming soon
          </Badge>
        }
      />

      <WorkflowHint
        title="What this workspace will cover"
        items={[
          { label: "What belongs here", text: "Client-managed prospecting, outbound follow-up, and campaign monitoring will live in Outreach rather than in the live front-desk queues." },
          { label: "Current state", text: "The engine exists internally, but it is still being proven with supervised real-world runs before client activation." },
          { label: "Go next", text: "Use Calls, Leads, and Inbox for live front-desk work today. Outreach will open after reliability and monitoring are fully proven." }
        ]}
      />

      <Card className="border-amber-200/90 bg-[linear-gradient(135deg,rgba(255,251,235,0.98)_0%,rgba(254,243,199,0.92)_100%)]">
        <CardContent className="flex flex-col gap-4 px-5 py-5 text-sm text-amber-950 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="flex gap-3">
            <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-300/80 bg-white/80">
              <Lock className="h-4 w-4" />
            </div>
            <div className="space-y-1.5">
              <p className="font-semibold">Client activation is locked for now.</p>
              <p className="max-w-3xl leading-6 text-amber-900/90">
                Outreach is being held behind a coming-soon release until call outcomes, transcript capture, and provider reliability are consistently trustworthy in supervised use.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-amber-300 bg-white/85 text-amber-950 hover:bg-white">
              <Link href="/app/calls">Open Call Queue</Link>
            </Button>
            <Button asChild variant="outline" className="border-amber-300 bg-white/85 text-amber-950 hover:bg-white">
              <Link href="/app/leads">Open Lead Queue</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="grid gap-4 lg:grid-cols-3">
          {launchBlocks.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title}>
                <CardHeader className="space-y-4">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-xl">{item.title}</CardTitle>
                    <p className="text-sm leading-6 text-slate-600">{item.description}</p>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <Badge className={clientBadgeClass("pending")}>Release gate</Badge>
            </div>
            <CardTitle className="text-xl">What still has to be proven</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            {releaseChecks.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 leading-6">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
