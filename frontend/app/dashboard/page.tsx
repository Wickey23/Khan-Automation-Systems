"use client";

import Link from "next/link";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page";

export default function DashboardPage() {
  return (
    <ClientGuard>
      <PageShell className="space-y-6">
        <PageHeader
          eyebrow="Legacy workspace"
          title="Client dashboard"
          description="Manage setup, calls, leads, settings, and billing from one workspace."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["/dashboard/setup", "Setup Wizard"],
            ["/dashboard/calls", "Call Logs"],
            ["/dashboard/leads", "Leads"],
            ["/dashboard/settings", "Settings"],
            ["/dashboard/billing", "Billing"],
            ["/dashboard/support", "Support"]
          ].map(([href, label]) => (
            <Card key={href} className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-5">
                <Link href={href} className="font-semibold text-primary">
                  {label}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageShell>
    </ClientGuard>
  );
}
