"use client";

import Link from "next/link";
import { useState } from "react";
import { sendSupportMessage } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";

const capabilities = [
  { label: "Email Outreach", icon: "mail" },
  { label: "SMS Marketing", icon: "sms" },
  { label: "Multi-Channel", icon: "hub" }
];

export default function AppOutreachPage() {
  const { showToast } = useToast();
  const [joining, setJoining] = useState(false);

  async function joinWaitlist() {
    setJoining(true);
    try {
      await sendSupportMessage(
        "Outreach waitlist request",
        "Please add this workspace to the outreach feature waitlist and notify me when client rollout begins."
      );
      showToast({
        title: "Waitlist request sent",
        description: "The product team has been notified that this workspace wants outreach access."
      });
    } catch (error) {
      showToast({
        title: "Could not join waitlist",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-11rem)] flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_36px_rgba(15,23,42,0.10)]">
        <div className="p-1">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 to-primary/30">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-[96px] text-primary/40">construction</span>
            </div>
            <div className="absolute bottom-4 right-4 rounded bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
              Under Development
            </div>
          </div>
        </div>

        <div className="px-8 py-10 text-center">
          <span className="mb-6 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
            Coming Soon
          </span>
          <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-slate-950">Gated for Scale</h1>
          <p className="mx-auto mt-4 max-w-[420px] text-base leading-relaxed text-slate-600">
            We&apos;re putting the finishing touches on outreach tools so they scale cleanly with your business. Join the waitlist to be first when the marketing suite opens.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button className="min-w-[160px] flex-1" onClick={() => void joinWaitlist()} disabled={joining}>
              {joining ? "Joining..." : "Join the Waitlist"}
            </Button>
            <Button asChild variant="secondary" className="min-w-[160px] flex-1">
              <Link href="/app">Back to Overview</Link>
            </Button>
          </div>

          <p className="mt-8 text-xs italic text-slate-400">estimated availability: after reliability sign-off</p>
        </div>
      </div>

      <div className="mt-12 flex items-center justify-center gap-8 opacity-50">
        {capabilities.map((capability, index) => (
          <div key={capability.label} className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-slate-400">{capability.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{capability.label}</span>
            </div>
            {index < capabilities.length - 1 ? <div className="h-4 w-px bg-slate-300" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
