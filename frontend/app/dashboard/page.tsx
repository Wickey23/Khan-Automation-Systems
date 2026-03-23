"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function DashboardPage() {
  const modules = [
    ["/dashboard/setup", "Setup Wizard", "Finalize voice and workflow setup before production routing."],
    ["/dashboard/calls", "Call Logs", "Review completed calls, outcomes, and transcript context."],
    ["/dashboard/leads", "Leads", "Track incoming leads and manage next actions."],
    ["/dashboard/settings", "Settings", "Control routing, prompts, and operational defaults."],
    ["/dashboard/billing", "Billing", "Manage plan status, invoices, and subscription changes."],
    ["/dashboard/support", "Support", "Open support requests and onboarding assistance."]
  ] as const;

  return (
    <ClientGuard>
      <PageShell className="space-y-6">
        <PageHeader
          eyebrow="Legacy workspace"
          title="Client dashboard"
          description="Manage setup, calls, leads, settings, and billing from one workspace."
        />
        <div className="rounded-[28px] border border-slate-200/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.96)_0%,rgba(239,246,255,0.84)_100%)] p-4 shadow-[0_24px_46px_-34px_rgba(15,23,42,0.45)] sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map(([href, label, copy]) => (
              <Card key={href} className="border-slate-200/90 bg-white/95 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.42)] transition-transform duration-150 hover:-translate-y-0.5">
                <CardContent className="space-y-3 p-5">
                  <p className="text-base font-semibold text-slate-900">{label}</p>
                  <p className="text-sm leading-6 text-slate-600">{copy}</p>
                  <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    Open {label}
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Legacy routes remain available while the new `/app` workspace continues rollout.
          </p>
        </div>
      </PageShell>
    </ClientGuard>
  );
}
