"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchCustomerBase, fetchOrgLeads, getBillingStatus, getMe, updateLeadPipelineStage } from "@/lib/api";
import { resolvePlanFeatures } from "@/lib/plan-features";
import { clientBadgeClass } from "@/lib/client-badges";
import type { CustomerBaseRecord, Lead } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";

const pipelineStages = ["NEW_LEAD", "QUOTED", "NEEDS_SCHEDULING", "SCHEDULED", "COMPLETED"] as const;

function prettyStage(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

export default function AppLeadsPage() {
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<CustomerBaseRecord[]>([]);
  const [plan, setPlan] = useState<"NONE" | "STARTER" | "PRO">("NONE");
  const [role, setRole] = useState<"CLIENT" | "CLIENT_STAFF" | "CLIENT_ADMIN" | "ADMIN" | "SUPER_ADMIN" | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Lead["status"] | "ALL">("ALL");
  const [pipelineAvailable, setPipelineAvailable] = useState(true);
  const [savingPipelineLeadId, setSavingPipelineLeadId] = useState<string | null>(null);
  const [view, setView] = useState<"OPEN_LEADS" | "CUSTOMERS">("OPEN_LEADS");

  useEffect(() => {
    void Promise.all([fetchOrgLeads(), getBillingStatus(), getMe(), fetchCustomerBase().catch(() => null)])
      .then(([leadData, billing, me, customerBaseData]) => {
        setLeads(leadData.leads || []);
        setPipelineAvailable(leadData.pipelineFeatureEnabled !== false);
        const features = resolvePlanFeatures({ plan: billing.subscription?.plan, status: billing.subscription?.status });
        setPlan(features.plan);
        setRole(me.user.role);
        setCustomers(customerBaseData?.customers || []);
      })
      .catch(() => {
        setLeads([]);
        setCustomers([]);
        setPlan("NONE");
        setRole(null);
        setPipelineAvailable(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter !== "ALL" && lead.status !== statusFilter) return false;
      if (!q) return true;
      return [lead.name, lead.business, lead.phone || "", lead.email || "", lead.source || "", lead.status, lead.message || ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [leads, query, statusFilter]);

  const customerFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((customer) =>
      [customer.displayName, customer.phoneNumber, customer.lastOutcome || ""].join(" ").toLowerCase().includes(q)
    );
  }, [customers, query]);

  const planLabel = plan === "PRO" ? "Pro" : plan === "STARTER" ? "Standard" : "No active plan";
  const canEditPipeline = role === "CLIENT_STAFF" || role === "CLIENT_ADMIN" || role === "ADMIN" || role === "SUPER_ADMIN";

  function leadStatusTone(status: Lead["status"]) {
    switch (status) {
      case "NEW":
        return "warning";
      case "CONTACTED":
      case "QUALIFIED":
        return "pending";
      case "WON":
        return "success";
      case "LOST":
        return "critical";
      default:
        return "neutral";
    }
  }

  async function onPipelineChange(leadId: string, pipelineStage: (typeof pipelineStages)[number]) {
    if (!canEditPipeline || !pipelineAvailable) return;
    setSavingPipelineLeadId(leadId);
    try {
      await updateLeadPipelineStage(leadId, pipelineStage);
      setLeads((current) => current.map((lead) => (lead.id === leadId ? { ...lead, pipelineStage } : lead)));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Try again.";
      if (message.toLowerCase().includes("pipeline feature is disabled")) setPipelineAvailable(false);
      showToast({ title: "Could not update pipeline stage", description: message, variant: "error" });
    } finally {
      setSavingPipelineLeadId(null);
    }
  }

  const stats =
    view === "OPEN_LEADS"
      ? [
          { label: "Plan", value: planLabel },
          { label: "Open leads", value: filtered.length },
          { label: "New", value: filtered.filter((lead) => lead.status === "NEW").length },
          { label: "Need scheduling", value: filtered.filter((lead) => lead.pipelineStage === "NEEDS_SCHEDULING").length }
        ]
      : [
          { label: "Plan", value: planLabel },
          { label: "Known customers", value: customerFiltered.length },
          { label: "Repeat callers", value: customerFiltered.filter((customer) => customer.totalCalls > 1).length },
          { label: "VIP", value: customerFiltered.filter((customer) => customer.flaggedVIP).length }
        ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Leads"
        title="Leads"
        description="This page should help you see who needs follow-up next, not make you manage a spreadsheet."
        actions={
          <div className="inline-flex rounded-xl border bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setView("OPEN_LEADS")}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${view === "OPEN_LEADS" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              Follow-up queue
            </button>
            <button
              type="button"
              onClick={() => setView("CUSTOMERS")}
              disabled={plan !== "PRO"}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${view === "CUSTOMERS" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"} disabled:cursor-not-allowed disabled:opacity-50`}
              title={plan !== "PRO" ? "Upgrade to Pro to unlock customer memory." : "View known customers"}
            >
              Customers
            </button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5">
              <p className="page-eyebrow">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={view === "OPEN_LEADS" ? "Search by name, business, phone, email, or source" : "Search customers by name or phone"}
          />
          {view === "OPEN_LEADS" ? (
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as Lead["status"] | "ALL")}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
            >
              <option value="ALL">All statuses</option>
              <option value="NEW">NEW</option>
              <option value="CONTACTED">CONTACTED</option>
              <option value="QUALIFIED">QUALIFIED</option>
              <option value="WON">WON</option>
              <option value="LOST">LOST</option>
            </select>
          ) : (
            <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Pro customer memory view
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {plan === "PRO" ? (
              <Button asChild variant="outline">
                <Link href="/app/customer-base">Legacy customer memory</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/app/billing">Upgrade to Pro</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!pipelineAvailable && view === "OPEN_LEADS" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Pipeline stage controls are currently disabled for this workspace.
        </div>
      ) : null}

      {!canEditPipeline && view === "OPEN_LEADS" ? (
        <div className="rounded-2xl border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Your role has read-only access to lead pipeline stages.
        </div>
      ) : null}

      {view === "OPEN_LEADS" ? (
        <div className="space-y-3">
          {filtered.length ? (
            filtered.map((lead) => (
              <Card key={lead.id}>
                <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.2fr)_180px_190px] lg:items-center">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-foreground">{lead.name}</p>
                        <p className="text-sm text-muted-foreground">{lead.business}</p>
                      </div>
                      <Badge className={clientBadgeClass(leadStatusTone(lead.status))}>{lead.status}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>{lead.phone || lead.email || "No contact info"}</p>
                      <p className="mt-1 line-clamp-2">{lead.serviceRequested || lead.message || "No service details yet."}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="page-eyebrow">Next stage</p>
                    <select
                      value={lead.pipelineStage || "NEW_LEAD"}
                      onChange={(event) => void onPipelineChange(lead.id, event.target.value as (typeof pipelineStages)[number])}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
                      disabled={!canEditPipeline || !pipelineAvailable || savingPipelineLeadId === lead.id}
                    >
                      {pipelineStages.map((stage) => (
                        <option key={stage} value={stage}>
                          {prettyStage(stage)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 text-sm">
                    <p className="page-eyebrow">Details</p>
                    <p className="text-muted-foreground">Created {new Date(lead.createdAt).toLocaleDateString()}</p>
                    <p className="text-muted-foreground">Source: {lead.source || "-"}</p>
                    {lead.classification ? (
                      <p className="text-muted-foreground">
                        Classified as {lead.classification.toLowerCase()} {typeof lead.classificationConfidence === "number" ? `(${Math.round(lead.classificationConfidence * 100)}%)` : ""}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="empty-state">No leads match this filter yet.</div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {customerFiltered.length ? (
            customerFiltered.map((customer) => (
              <Card key={customer.phoneNumber}>
                <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_220px_120px] lg:items-center">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-foreground">{customer.displayName}</p>
                      {customer.flaggedVIP ? <Badge className={clientBadgeClass("booking")}>VIP</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{customer.phoneNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      Last outcome: {customer.lastOutcome || "Unknown"} · Last seen {new Date(customer.lastCallAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Total calls: {customer.totalCalls}</p>
                    <p>{customer.lead ? "Linked to a lead" : "No linked lead yet"}</p>
                  </div>
                  <div>
                    {customer.lead ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/app/leads?leadId=${encodeURIComponent(customer.lead.id)}`}>Open lead</Link>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="empty-state">No known customers yet. Customer memory appears here after repeat calls and follow-up activity.</div>
          )}
        </div>
      )}
    </div>
  );
}
