"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchLeadById } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { LeadDetailForm } from "@/components/admin/lead-detail-form";
import { Button } from "@/components/ui/button";

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

  if (loading) return <div className="container py-12 text-sm text-muted-foreground">Loading lead...</div>;
  if (error || !lead) {
    return (
      <div className="container py-12">
        <p className="text-sm text-red-700">{error || "Lead not found."}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/admin/leads">Back to leads</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="mb-5">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/leads">Back to leads</Link>
        </Button>
      </div>
      <LeadDetailForm lead={lead} />
    </div>
  );
}
