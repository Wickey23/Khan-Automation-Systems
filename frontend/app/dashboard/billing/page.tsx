"use client";

import { useEffect, useState } from "react";
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
        <SectionShell className="surface-panel">
          <Button onClick={onManageBilling} disabled={loading}>
            {loading ? "Opening..." : "Manage Billing"}
          </Button>
        </SectionShell>
      </PageShell>
    </ClientGuard>
  );
}
