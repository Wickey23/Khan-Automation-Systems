"use client";

import Link from "next/link";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <ClientGuard>
      <div className="container py-10">
        <h1 className="text-3xl font-bold">Client Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage setup, calls, leads, settings, and billing from one workspace.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["/dashboard/setup", "Setup Wizard"],
            ["/dashboard/calls", "Call Logs"],
            ["/dashboard/leads", "Leads"],
            ["/dashboard/settings", "Settings"],
            ["/dashboard/billing", "Billing"],
            ["/dashboard/support", "Support"]
          ].map(([href, label]) => (
            <Card key={href}>
              <CardContent className="p-5">
                <Link href={href} className="font-medium text-primary">
                  {label}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ClientGuard>
  );
}
