"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchOrgLeads, getBillingStatus, updateLeadPipelineStage } from "@/lib/api";
import { InfoHint } from "@/components/ui/info-hint";
import { resolvePlanFeatures } from "@/lib/plan-features";
import type { Lead } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";

export default function AppLeadsPage() {
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [plan, setPlan] = useState<"NONE" | "STARTER" | "PRO">("NONE");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Lead["status"] | "ALL">("ALL");

  useEffect(() => {
    void Promise.all([fetchOrgLeads(), getBillingStatus()])
      .then(([leadData, billing]) => {
        setLeads(leadData.leads || []);
        const features = resolvePlanFeatures({
          plan: billing.subscription?.plan,
          status: billing.subscription?.status
        });
        setPlan(features.plan);
      })
      .catch(() => {
        setLeads([]);
        setPlan("NONE");
      });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const statusMatches = statusFilter === "ALL" || lead.status === statusFilter;
      if (!statusMatches) return false;
      if (!q) return true;
      const haystack = [
        lead.name,
        lead.business,
        lead.phone || "",
        lead.email || "",
        lead.source || "",
        lead.status,
        lead.message || ""
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [leads, query, statusFilter]);

  const stats = useMemo(() => {
    const withPhone = leads.filter((lead) => Boolean(lead.phone)).length;
    const withEmail = leads.filter((lead) => Boolean(lead.email && !lead.email.endsWith("@no-email.local"))).length;
    const newCount = leads.filter((lead) => lead.status === "NEW").length;
    return { withPhone, withEmail, newCount };
  }, [leads]);

  const planLabel = plan === "PRO" ? "Pro" : plan === "STARTER" ? "Standard" : "No active plan";
  const planStatusCopy = plan === "PRO"
    ? "Pro active: use Leads for pipeline, and Customer Base for advanced caller memory."
    : "Standard active: this is your main lead pipeline workspace.";

  async function onPipelineChange(leadId: string, pipelineStage: "NEW_LEAD" | "QUOTED" | "NEEDS_SCHEDULING" | "SCHEDULED" | "COMPLETED") {
    try {
      await updateLeadPipelineStage(leadId, pipelineStage);
      setLeads((current) =>
        current.map((lead) => (lead.id === leadId ? { ...lead, pipelineStage } : lead))
      );
    } catch (error) {
      showToast({
        title: "Could not update pipeline stage",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Leads</h1>
      <p className="text-sm text-muted-foreground">Scoped to your organization.</p>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-white p-3">
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            Plan
            <InfoHint text="Your current workspace tier determines what CRM surfaces are available." />
          </p>
          <p className="mt-1 text-xl font-semibold">{planLabel}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total leads</p>
          <p className="mt-1 text-xl font-semibold">{leads.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">With phone</p>
          <p className="mt-1 text-xl font-semibold">{stats.withPhone}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">New status</p>
          <p className="mt-1 text-xl font-semibold">{stats.newCount}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm text-muted-foreground">{planStatusCopy}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {plan === "PRO" ? (
            <Link href="/app/customer-base" className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
              Open Customer Base
            </Link>
          ) : (
            <Link href="/app/billing" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
              Upgrade to Pro
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, business, phone, email, source..."
              className="mt-1 h-10 w-full rounded-md border border-input px-3 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as Lead["status"] | "ALL")}
              className="mt-1 h-10 w-full rounded-md border border-input px-3 text-sm"
            >
              <option value="ALL">All statuses</option>
              <option value="NEW">NEW</option>
              <option value="CONTACTED">CONTACTED</option>
              <option value="QUALIFIED">QUALIFIED</option>
              <option value="WON">WON</option>
              <option value="LOST">LOST</option>
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-3">Created</th>
              <th className="p-3">Name</th>
              <th className="p-3">Business</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Email</th>
              <th className="p-3">Source</th>
              <th className="p-3">DNC</th>
              <th className="p-3">Status</th>
              <th className="p-3">Pipeline</th>
              <th className="p-3">Classified</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => (
              <tr key={lead.id} className="border-t">
                <td className="p-3">{new Date(lead.createdAt).toLocaleString()}</td>
                <td className="p-3">{lead.name}</td>
                <td className="p-3">{lead.business}</td>
                <td className="p-3">{lead.phone || "-"}</td>
                <td className="p-3">
                  {lead.email && !lead.email.endsWith("@no-email.local") ? lead.email : "-"}
                </td>
                <td className="p-3">{lead.source || "-"}</td>
                <td className="p-3">{lead.dnc ? "Yes" : "No"}</td>
                <td className="p-3">{lead.status}</td>
                <td className="p-3">
                  <select
                    value={lead.pipelineStage || "NEW_LEAD"}
                    onChange={(event) =>
                      void onPipelineChange(
                        lead.id,
                        event.target.value as "NEW_LEAD" | "QUOTED" | "NEEDS_SCHEDULING" | "SCHEDULED" | "COMPLETED"
                      )
                    }
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    <option value="NEW_LEAD">NEW_LEAD</option>
                    <option value="QUOTED">QUOTED</option>
                    <option value="NEEDS_SCHEDULING">NEEDS_SCHEDULING</option>
                    <option value="SCHEDULED">SCHEDULED</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </td>
                <td className="p-3">
                  {lead.classification ? (
                    <div className="text-xs">
                      <div>{lead.classification}</div>
                      <div className="text-muted-foreground">
                        {typeof lead.classificationConfidence === "number"
                          ? `${Math.round(lead.classificationConfidence * 100)}%`
                          : "-"}
                      </div>
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={10}>
                  No leads match this filter yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
