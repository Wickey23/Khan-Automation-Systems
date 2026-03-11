"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";

export default function AdminProspectsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/outreach/leads");
  }, [router]);

  return (
    <AdminGuard requireSuperAdmin>
      <div className="container py-10 space-y-4">
        <AdminTopTabs />
        <div className="rounded-lg border bg-white p-6 text-sm text-muted-foreground">
          Prospects has been merged into Outreach. Redirecting to Outreach Leads...
        </div>
      </div>
    </AdminGuard>
  );
}
