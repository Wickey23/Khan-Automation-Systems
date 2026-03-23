"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { PageHeader, PageShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";

export default function AdminProspectsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/outreach/leads");
  }, [router]);

  return (
    <AdminGuard requireSuperAdmin>
      <PageShell className="space-y-6">
        <AdminTopTabs />
        <PageHeader
          eyebrow="Legacy route"
          title="Prospects moved to Outreach"
          description="This route now redirects to Outreach Leads."
        />
        <StateCard
          variant="loading"
          title="Redirecting"
          description="Prospects has been merged into Outreach. Sending you to Outreach Leads."
        />
      </PageShell>
    </AdminGuard>
  );
}
