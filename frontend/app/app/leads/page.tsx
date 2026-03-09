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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const pipelineStages = ["NEW_LEAD", "QUOTED", "NEEDS_SCHEDULING", "SCHEDULED", "COMPLETED"] as const;

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

  const stats = useMemo(() => {
    const withPhone = leads.filter((lead) => Boolean(lead.phone)).length;
    const withEmail = leads.filter((lead) => Boolean(lead.email && !lead.email.endsWith("@no-email.local"))).length;
    const newCount = leads.filter((lead) => lead.status === "NEW").length;
    return { total: leads.length, withPhone, withEmail, newCount };
  }, [leads]);

  const customerStats = useMemo(
    () => ({
      total: customers.length,
      vip: customers.filter((customer) => customer.flaggedVIP).length,
      repeatCallers: customers.filter((customer) => customer.totalCalls > 1).length,
      linkedLeads: customers.filter((customer) => Boolean(customer.lead)).length
    }),
    [customers]
  );

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

  const primaryStats =
    view === "OPEN_LEADS"
      ? [
          { label: "Plan", value: planLabel },
          { label: "Total leads", value: stats.total },
          { label: "With phone", value: stats.withPhone },
          { label: "New status", value: stats.newCount }
        ]
      : [
          { label: "Plan", value: planLabel },
          { label: "Known customers", value: customerStats.total },
          { label: "Repeat callers", value: customerStats.repeatCallers },
          { label: "VIP flagged", value: customerStats.vip }
        ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lead pipeline"
        title="Leads"
        description="Track open opportunities and keep customer memory visible without leaving the workspace."
        actions={
          <div className="inline-flex rounded-xl border bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setView("OPEN_LEADS")}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${view === "OPEN_LEADS" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              Open leads
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

      <div className="metric-grid">
        {primaryStats.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5">
              <p className="page-eyebrow">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="space-y-2">
            <p className="text-sm leading-6 text-muted-foreground">
              {plan === "PRO"
                ? "Pro active: manage open leads and review known customers from the same workspace."
                : "Standard active: this is your main lead pipeline workspace."}
            </p>
            {!pipelineAvailable ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Pipeline stage controls are currently disabled for this workspace.
              </div>
            ) : null}
            {!canEditPipeline ? (
              <div className="rounded-xl border bg-muted px-4 py-3 text-sm text-muted-foreground">
                Your role has read-only access to lead pipeline stages.
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {plan === "PRO" ? (
              <>
                <Button variant="outline" onClick={() => setView("CUSTOMERS")}>Open customers view</Button>
                <Button asChild variant="ghost">
                  <Link href="/app/customer-base">Legacy customer memory</Link>
                </Button>
              </>
            ) : (
              <Button asChild>
                <Link href="/app/billing">Upgrade to Pro</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {view === "OPEN_LEADS" ? (
        <>
          <div className="data-toolbar grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, business, phone, email, or source" />
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
          </div>

          <div className="table-shell">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pipeline</TableHead>
                  <TableHead>Classified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>{new Date(lead.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.dnc ? "Do not contact" : "Contactable"}</p>
                      </div>
                    </TableCell>
                    <TableCell>{lead.business}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p>{lead.phone || "-"}</p>
                        <p className="text-xs text-muted-foreground">{lead.email && !lead.email.endsWith("@no-email.local") ? lead.email : "-"}</p>
                      </div>
                    </TableCell>
                    <TableCell>{lead.source || "-"}</TableCell>
                    <TableCell>
                      <Badge className={clientBadgeClass(leadStatusTone(lead.status))}>{lead.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <select
                        value={lead.pipelineStage || "NEW_LEAD"}
                        onChange={(event) => void onPipelineChange(lead.id, event.target.value as (typeof pipelineStages)[number])}
                        className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium shadow-sm"
                        disabled={!canEditPipeline || !pipelineAvailable || savingPipelineLeadId === lead.id}
                      >
                        {pipelineStages.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      {lead.classification ? (
                        <div className="text-xs">
                          <div className="font-medium">{lead.classification}</div>
                          <div className="text-muted-foreground">
                            {typeof lead.classificationConfidence === "number" ? `${Math.round(lead.classificationConfidence * 100)}%` : "-"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered.length ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="empty-state">No leads match this filter yet.</div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="metric-grid">
            {[
              { label: "Known customers", value: customerStats.total },
              { label: "Repeat callers", value: customerStats.repeatCallers },
              { label: "VIP flagged", value: customerStats.vip },
              { label: "Linked leads", value: customerStats.linkedLeads }
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="p-5">
                  <p className="page-eyebrow">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="table-shell">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Last outcome</TableHead>
                  <TableHead>Calls</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>Lead link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.phoneNumber}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{customer.displayName}</span>
                        {customer.flaggedVIP ? <Badge className={clientBadgeClass("booking")}>VIP</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>{customer.phoneNumber}</TableCell>
                    <TableCell>{customer.lastOutcome || "-"}</TableCell>
                    <TableCell>{customer.totalCalls}</TableCell>
                    <TableCell>{new Date(customer.lastCallAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {customer.lead ? (
                        <Link href={`/app/leads?leadId=${encodeURIComponent(customer.lead.id)}`} className="font-medium text-primary underline-offset-4 hover:underline">
                          Open lead
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!customers.length ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="empty-state">No known customers yet. Customer memory appears here after repeat calls and follow-up activity.</div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
