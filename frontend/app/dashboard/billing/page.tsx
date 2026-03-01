"use client";

import { useEffect, useState } from "react";
import { ClientGuard } from "@/components/dashboard/client-guard";
import { createCustomerPortalSession, fetchClientWorkspace } from "@/lib/api";
import type { Client } from "@/lib/types";
import { Button } from "@/components/ui/button";

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
      <div className="container py-10">
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Current plan: {client?.subscriptions?.[0]?.plan || "No active plan"}
        </p>
        <Button className="mt-6" onClick={onManageBilling} disabled={loading}>
          {loading ? "Opening..." : "Manage Billing"}
        </Button>
      </div>
    </ClientGuard>
  );
}
