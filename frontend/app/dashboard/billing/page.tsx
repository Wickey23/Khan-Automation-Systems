"use client";

import { useEffect, useState } from "react";
import { CreditCard, ReceiptText } from "lucide-react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { createCustomerPortalSession, fetchClientWorkspace } from "@/lib/api";
import type { Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, SectionShell } from "@/components/ui/page";

export default function DashboardBillingPage() {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchClientWorkspace().then((data) => setClient(data.client)).catch(() => setClient(null));
  }, []);

  async function onManageBilling() {
    setLoading(true);
    try {
      const data = await createCustomerPortalSession();
      window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <ClientGuard>
      <PageShell className="space-y-6">
        <PageHeader
          eyebrow="Legacy billing"
          title="Billing"
          description={`Current plan: ${client?.subscriptions?.[0]?.plan || "No active plan"}`}
        />
        <SectionShell className="surface-panel space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 text-sm text-slate-700">
              <p className="inline-flex items-center gap-1.5 font-medium text-slate-900">
                <CreditCard className="h-4 w-4 text-slate-500" />
                Active plan
              </p>
              <p className="mt-1">{client?.subscriptions?.[0]?.plan || "No active plan"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 text-sm text-slate-700">
              <p className="inline-flex items-center gap-1.5 font-medium text-slate-900">
                <ReceiptText className="h-4 w-4 text-slate-500" />
                Billing status
              </p>
              <p className="mt-1">{client?.subscriptions?.[0]?.status || "Not available"}</p>
            </div>
          </div>
          <Button onClick={onManageBilling} disabled={loading}>
            {loading ? "Opening..." : "Manage Billing"}
          </Button>
        </SectionShell>
      </PageShell>
    </ClientGuard>
  );
}
