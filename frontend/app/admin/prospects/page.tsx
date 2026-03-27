"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
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
      <PageShell className="space-y-5">
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
          action={
            <Link href="/admin/outreach/leads" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Open Outreach Leads now
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      </PageShell>
    </AdminGuard>
  );
}

