"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchLeadById } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { LeadDetailForm } from "@/components/admin/lead-detail-form";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";

export default function AdminLeadDetailPage() {
  const params = useParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const data = await fetchLeadById(params.id);
        if (!active) return;
        setLead(data.lead);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load lead.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [params.id]);

  return (
    <AdminGuard>
      <PageShell className="space-y-5">
        <AdminTopTabs />
        <PageHeader
          eyebrow="Lead detail"
          title={lead?.name || "Lead workspace"}
          description="Inspect and edit lead fields, outcomes, and assignment details."
          actions={
            <Button asChild variant="outline">
              <Link href="/admin/leads">Back to leads</Link>
            </Button>
          }
        />

        {loading ? <StateCard variant="loading" title="Loading lead" /> : null}
        {!loading && (error || !lead) ? (
          <StateCard
            variant="error"
            title="Unable to load lead"
            description={error || "Lead not found."}
            action={
              <Button asChild variant="outline">
                <Link href="/admin/leads">Back to leads</Link>
              </Button>
            }
          />
        ) : null}
        {!loading && lead ? <LeadDetailForm lead={lead} /> : null}
      </PageShell>
    </AdminGuard>
  );
}
