"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchCustomerBase, fetchOrgLeads, getBillingStatus, getMe, updateLeadPipelineStage } from "@/lib/api";
import { InfoHint } from "@/components/ui/info-hint";
import { resolvePlanFeatures } from "@/lib/plan-features";
import { clientBadgeClass } from "@/lib/client-badges";
import type { CustomerBaseRecord, Lead } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";

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
        const features = resolvePlanFeatures({
          plan: billing.subscription?.plan,
          status: billing.subscription?.status
        });
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
  const customerStats = useMemo(() => ({
    total: customers.length,
    vip: customers.filter((customer) => customer.flaggedVIP).length,
    repeatCallers: customers.filter((customer) => customer.totalCalls > 1).length,
    linkedLeads: customers.filter((customer) => Boolean(customer.lead)).length
  }), [customers]);

  const planLabel = plan === "PRO" ? "Pro" : plan === "STARTER" ? "Standard" : "No active plan";
  const planStatusCopy = plan === "PRO"
    ? "Pro active: manage open leads and review known customers from the same workspace."
    : "Standard active: this is your main lead pipeline workspace.";
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

  async function onPipelineChange(leadId: string, pipelineStage: "NEW_LEAD" | "QUOTED" | "NEEDS_SCHEDULING" | "SCHEDULED" | "COMPLETED") {
    if (!canEditPipeline || !pipelineAvailable) return;
    setSavingPipelineLeadId(leadId);
    try {
      await updateLeadPipelineStage(leadId, pipelineStage);
      setLeads((current) =>
        current.map((lead) => (lead.id === leadId ? { ...lead, pipelineStage } : lead))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Try again.";
      if (message.toLowerCase().includes("pipeline feature is disabled")) {
        setPipelineAvailable(false);
      }
      showToast({
        title: "Could not update pipeline stage",
        description: message,
        variant: "error"
      });
    } finally {
      setSavingPipelineLeadId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Track open opportunities and keep customer memory close by without leaving the lead pipeline.
          </p>
        </div>
        <div className="inline-flex rounded-lg border bg-white p-1">
          <button
            type="button"
            onClick={() => setView("OPEN_LEADS")}
            className={`rounded-md px-3 py-2 text-sm font-medium ${view === "OPEN_LEADS" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            Open Leads
          </button>
          <button
            type="button"
            onClick={() => setView("CUSTOMERS")}
            disabled={plan !== "PRO"}
            className={`rounded-md px-3 py-2 text-sm font-medium ${view === "CUSTOMERS" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"} disabled:cursor-not-allowed disabled:opacity-50`}
            title={plan !== "PRO" ? "Upgrade to Pro to unlock customer memory." : "View known customers"}
          >
            Customers
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-white p-3">
          <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            Plan
            <InfoHint text="Your current workspace tier determines what CRM surfaces are available." />
          </p>
          <p className="mt-1 text-xl font-semibold">{planLabel}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{view === "OPEN_LEADS" ? "Total leads" : "Known customers"}</p>
          <p className="mt-1 text-xl font-semibold">{view === "OPEN_LEADS" ? leads.length : customerStats.total}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{view === "OPEN_LEADS" ? "With phone" : "Repeat callers"}</p>
          <p className="mt-1 text-xl font-semibold">{view === "OPEN_LEADS" ? stats.withPhone : customerStats.repeatCallers}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{view === "OPEN_LEADS" ? "New status" : "VIP flagged"}</p>
          <p className="mt-1 text-xl font-semibold">{view === "OPEN_LEADS" ? stats.newCount : customerStats.vip}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm text-muted-foreground">{planStatusCopy}</p>
        {!pipelineAvailable ? (
          <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Pipeline stage controls are currently disabled for this workspace.
          </p>
        ) : null}
        {!canEditPipeline ? (
          <p className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Your role has read-only access to lead pipeline stages.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {plan === "PRO" ? (
            <button
              type="button"
              onClick={() => setView("CUSTOMERS")}
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Open Customers View
            </button>
          ) : (
            <Link href="/app/billing" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
              Upgrade to Pro
            </Link>
          )}
          {plan === "PRO" ? (
            <Link href="/app/customer-base" className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
              Open legacy customer memory
            </Link>
          ) : null}
        </div>
      </div>

      {view === "OPEN_LEADS" ? (
        <>
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
                  <th className="p-3">Customer</th>
                  <th className="p-3">Business</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">DNC</th>
                  <th className="p-3">Lead status</th>
                  <th className="p-3">Next action</th>
                  <th className="p-3">Classified</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr key={lead.id} className="border-t">
                    <td className="p-3">{new Date(lead.createdAt).toLocaleString()}</td>
                    <td className="p-3 font-medium">{lead.name}</td>
                    <td className="p-3">{lead.business}</td>
                    <td className="p-3">{lead.phone || "-"}</td>
                    <td className="p-3">
                      {lead.email && !lead.email.endsWith("@no-email.local") ? lead.email : "-"}
                    </td>
                    <td className="p-3">{lead.source || "-"}</td>
                    <td className="p-3">{lead.dnc ? "Yes" : "No"}</td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${clientBadgeClass(leadStatusTone(lead.status))}`}>
                        {lead.status}
                      </span>
                    </td>
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
                        disabled={!canEditPipeline || !pipelineAvailable || savingPipelineLeadId === lead.id}
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
        </>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Known customers</p>
              <p className="mt-1 text-xl font-semibold">{customerStats.total}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Repeat callers</p>
              <p className="mt-1 text-xl font-semibold">{customerStats.repeatCallers}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">VIP flagged</p>
              <p className="mt-1 text-xl font-semibold">{customerStats.vip}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Linked leads</p>
              <p className="mt-1 text-xl font-semibold">{customerStats.linkedLeads}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Last outcome</th>
                  <th className="p-3">Calls</th>
                  <th className="p-3">Last seen</th>
                  <th className="p-3">Lead link</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.phoneNumber} className="border-t">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{customer.displayName}</span>
                        {customer.flaggedVIP ? (
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${clientBadgeClass("booking")}`}>
                            VIP
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3">{customer.phoneNumber}</td>
                    <td className="p-3">{customer.lastOutcome || "-"}</td>
                    <td className="p-3">{customer.totalCalls}</td>
                    <td className="p-3">{new Date(customer.lastCallAt).toLocaleString()}</td>
                    <td className="p-3">
                      {customer.lead ? (
                        <Link href={`/app/leads?leadId=${encodeURIComponent(customer.lead.id)}`} className="text-sm font-medium text-blue-700 underline">
                          Open lead
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
                {!customers.length ? (
                  <tr>
                    <td className="p-3 text-muted-foreground" colSpan={6}>
                      No known customers yet. Customer memory appears here after repeat calls and follow-up activity.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
