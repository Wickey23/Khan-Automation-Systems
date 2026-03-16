"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search, UserRoundSearch } from "lucide-react";
import { fetchCustomerBase, fetchOrgLeads, getBillingStatus, getMe, updateLeadPipelineStage } from "@/lib/api";
import { resolvePlanFeatures } from "@/lib/plan-features";
import { clientBadgeClass } from "@/lib/client-badges";
import type { CustomerBaseRecord, FrontDeskPriority, Lead } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClientModuleTabs } from "@/components/ui/client-module";
import { Input } from "@/components/ui/input";
import { PageHelpFab } from "@/components/ui/page";
import {
  frontDeskActionBadgeClass,
  frontDeskCardClass,
  frontDeskContextPanelClass,
  frontDeskEmptyStateClass,
  frontDeskLoadingCardClass,
  frontDeskMetricCardClass,
  frontDeskOutcomeSurfaceClass,
  frontDeskOutcomeBadgeMeta,
  frontDeskPriorityBadgeClass,
  frontDeskPriorityMeta,
  frontDeskWorkspaceCardClass,
  frontDeskSkeletonLineClass
} from "@/lib/front-desk-ui";

const pipelineStages = ["NEW_LEAD", "QUOTED", "NEEDS_SCHEDULING", "SCHEDULED", "COMPLETED"] as const;
const queueStates = ["ALL", "needs_follow_up", "contacted", "booked", "closed", "spam"] as const;
type PipelineStage = (typeof pipelineStages)[number];

function prettyStage(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function frontDeskPriorityWeight(priority: FrontDeskPriority | undefined) {
  if (priority === "urgent") return 0;
  if (priority === "high") return 1;
  if (priority === "normal") return 2;
  return 3;
}

function frontDeskStateWeight(state: string | undefined) {
  if (state === "needs_follow_up") return 0;
  if (state === "contacted") return 1;
  if (state === "booked") return 2;
  if (state === "closed") return 3;
  if (state === "spam") return 4;
  return 1;
}

function frontDeskTone(lead: Lead) {
  if (lead.frontDesk?.frontDeskPriority === "urgent") return "critical";
  if (lead.frontDesk?.frontDeskPriority === "high") return "warning";
  if (lead.frontDesk?.state === "booked") return "booking";
  if (lead.frontDesk?.state === "contacted") return "pending";
  if (lead.frontDesk?.state === "closed") return "success";
  if (lead.frontDesk?.state === "spam") return "neutral";
  return leadStatusTone(lead.status);
}

function frontDeskStateLabel(lead: Lead) {
  switch (lead.frontDesk?.state) {
    case "needs_follow_up":
      return "Needs follow-up";
    case "contacted":
      return "Contacted";
    case "booked":
      return "Booked";
    case "closed":
      return "Resolved";
    case "spam":
      return "Spam";
    default:
      return lead.status;
  }
}

function frontDeskPriorityLabel(lead: Lead) {
  return frontDeskPriorityMeta(lead.frontDesk?.frontDeskPriority).label;
}

function leadWorkTypeLabel(lead: Lead) {
  if (lead.frontDesk?.recommendedAction === "Call back now") return "Callback";
  if (lead.frontDesk?.recommendedAction === "Offer times" || lead.pipelineStage === "NEEDS_SCHEDULING") return "Scheduling";
  if (lead.frontDesk?.state === "booked") return "Booked work";
  if (lead.frontDesk?.state === "closed") return "Resolved";
  if (lead.frontDesk?.state === "spam") return "Spam";
  return "General follow-up";
}

function queueStateLabel(value: (typeof queueStates)[number]) {
  switch (value) {
    case "needs_follow_up":
      return "Needs follow-up";
    case "contacted":
      return "Contacted";
    case "booked":
      return "Booked";
    case "closed":
      return "Resolved";
    case "spam":
      return "Spam";
    default:
      return "All queue states";
  }
}

function formatActivityLabel(lead: Lead) {
  if (!lead.frontDesk?.lastActivityAt) return `Created ${new Date(lead.createdAt).toLocaleDateString()}`;
  const kind = lead.frontDesk.lastActivityType ? lead.frontDesk.lastActivityType.replaceAll("_", " ") : "activity";
  return `Last ${kind} ${new Date(lead.frontDesk.lastActivityAt).toLocaleDateString()}`;
}

function summarizeLead(lead: Lead) {
  return lead.frontDesk?.summary || lead.serviceRequested || lead.message || "No service details yet.";
}

function latestLeadMovementLabel(lead: Lead) {
  if (lead.latestAppointmentRequestId && lead.frontDesk?.recommendedAction === "Offer times") {
    return "Booking follow-up in progress";
  }
  if (lead.latestMessageThreadId && lead.frontDesk?.state === "needs_follow_up") {
    return "Customer replied";
  }
  if (lead.frontDesk?.state === "contacted") {
    return "Office sent follow-up";
  }
  return formatActivityLabel(lead);
}

function leadNextActionLabel(lead: Lead) {
  if (lead.latestAppointmentRequestId && lead.latestMessageThreadId && latestLeadMovementLabel(lead) === "Customer replied") {
    return "Review reply";
  }
  return lead.frontDesk?.recommendedAction || "Review request";
}

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

function leadQuickActions(lead: Lead): Array<{ label: string; stage: PipelineStage; tone: "default" | "outline" }> {
  if (lead.frontDesk?.state === "spam") {
    return [{ label: "Mark resolved", stage: "COMPLETED", tone: "outline" }];
  }
  if (lead.frontDesk?.state === "booked" || lead.pipelineStage === "SCHEDULED") {
    return [
      { label: "Mark booked", stage: "SCHEDULED", tone: "default" },
      { label: "Mark resolved", stage: "COMPLETED", tone: "outline" }
    ];
  }
  if (lead.frontDesk?.recommendedAction === "Offer times" || lead.pipelineStage === "NEEDS_SCHEDULING") {
    return [
      { label: "Schedule appointment", stage: "NEEDS_SCHEDULING", tone: "default" },
      { label: "Mark booked", stage: "SCHEDULED", tone: "outline" }
    ];
  }
  if (lead.frontDesk?.state === "contacted") {
    return [
      { label: "Schedule appointment", stage: "NEEDS_SCHEDULING", tone: "default" },
      { label: "Mark resolved", stage: "COMPLETED", tone: "outline" }
    ];
  }
  return [
    { label: "Keep open", stage: "NEW_LEAD", tone: "outline" },
    { label: "Schedule appointment", stage: "NEEDS_SCHEDULING", tone: "default" }
  ];
}

function leadOutcomeNote(lead: Lead) {
  if (lead.frontDesk?.state === "booked") {
    return "This request is already booked. Use the linked booking or inbox thread only if the office needs to confirm details.";
  }
  if (lead.frontDesk?.state === "closed") {
    return "This request is already resolved. Review the linked records only if the office needs to double-check the outcome.";
  }
  return null;
}

function leadOutcomeListNote(lead: Lead) {
  if (lead.frontDesk?.state === "booked") return "Booked work already confirmed.";
  if (lead.frontDesk?.state === "closed") return "Handled and resolved by the office.";
  return null;
}

function leadOutcomeBadge(lead: Lead) {
  if (lead.frontDesk?.state === "booked") return frontDeskOutcomeBadgeMeta("booked");
  if (lead.frontDesk?.state === "closed") return frontDeskOutcomeBadgeMeta("resolved");
  if (lead.latestMessageThreadId && latestLeadMovementLabel(lead) === "Customer replied") return frontDeskOutcomeBadgeMeta("saved");
  return null;
}

export default function AppLeadsPage() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const highlightedLeadId = searchParams.get("leadId") || "";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<CustomerBaseRecord[]>([]);
  const [plan, setPlan] = useState<"NONE" | "STARTER" | "PRO">("NONE");
  const [role, setRole] = useState<"CLIENT" | "CLIENT_STAFF" | "CLIENT_ADMIN" | "ADMIN" | "SUPER_ADMIN" | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [queueFilter, setQueueFilter] = useState<(typeof queueStates)[number]>("ALL");
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
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!highlightedLeadId) return;
    setQuery(highlightedLeadId);
    setView("OPEN_LEADS");
  }, [highlightedLeadId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (queueFilter !== "ALL" && lead.frontDesk?.state !== queueFilter) return false;
      if (!q) return true;
      return [lead.id, lead.name, lead.business, lead.phone || "", lead.email || "", lead.source || "", lead.status, lead.message || "", summarizeLead(lead), leadNextActionLabel(lead), lead.frontDesk?.state || ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    }).sort((a, b) => {
      const stateDelta = frontDeskStateWeight(a.frontDesk?.state) - frontDeskStateWeight(b.frontDesk?.state);
      if (stateDelta !== 0) return stateDelta;
      const priorityDelta = frontDeskPriorityWeight(a.frontDesk?.frontDeskPriority) - frontDeskPriorityWeight(b.frontDesk?.frontDeskPriority);
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(b.frontDesk?.lastActivityAt || b.updatedAt).getTime() - new Date(a.frontDesk?.lastActivityAt || a.updatedAt).getTime();
    });
  }, [leads, query, queueFilter]);

  const customerFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((customer) =>
      [customer.displayName, customer.phoneNumber, customer.lastOutcome || ""].join(" ").toLowerCase().includes(q)
    );
  }, [customers, query]);

  const planLabel = plan === "PRO" ? "Pro" : plan === "STARTER" ? "Standard" : "No active plan";
  const canEditPipeline = role === "CLIENT_STAFF" || role === "CLIENT_ADMIN" || role === "ADMIN" || role === "SUPER_ADMIN";

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
          { label: "Need follow-up", value: filtered.filter((lead) => lead.frontDesk?.needsFollowUp).length },
          { label: "Urgent", value: filtered.filter((lead) => lead.frontDesk?.frontDeskPriority === "urgent").length },
          { label: "Need scheduling", value: filtered.filter((lead) => lead.pipelineStage === "NEEDS_SCHEDULING" || lead.frontDesk?.recommendedAction === "Offer times").length }
        ]
      : [
          { label: "Plan", value: planLabel },
          { label: "Known customers", value: customerFiltered.length },
          { label: "Repeat callers", value: customerFiltered.filter((customer) => customer.totalCalls > 1).length },
          { label: "VIP", value: customerFiltered.filter((customer) => customer.flaggedVIP).length }
        ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UserRoundSearch className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Follow-up Queue</p>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Lead Queue</h1>
            </div>
          </div>
          <label className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input readOnly value="" placeholder="Search leads..." className="h-10 w-64 rounded-2xl border-slate-200 bg-slate-50 pl-10" />
          </label>
        </div>
        <div className="grid gap-4 px-6 py-5 md:grid-cols-4">
          {stats.map((item) => (
            <div key={item.label} className={frontDeskContextPanelClass()}>
              <p className="page-eyebrow">{item.label}</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{item.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.label === "Plan"
                  ? "Current workspace package and feature tier."
                  : item.label === "Need follow-up"
                    ? "Requests still waiting on office action."
                    : item.label === "Urgent"
                      ? "Highest-priority items in the current queue."
                      : item.label === "Need scheduling"
                        ? "Leads nearest to booking."
                        : "Saved customer context."}
              </p>
            </div>
          ))}
        </div>
      </section>

      <ClientModuleTabs
        items={[
          { value: "OPEN_LEADS", label: "Follow-up", badge: filtered.length },
          { value: "CUSTOMERS", label: "Customers", badge: customerFiltered.length, disabled: plan !== "PRO", title: plan !== "PRO" ? "Upgrade to Pro to unlock customer memory." : undefined }
        ]}
        value={view}
        onChange={setView}
      />

      <PageHelpFab
        items={[
          { label: "Use this page", text: "Work open requests that still need callback, scheduling, reply handling, or final resolution." },
          { label: "Start here", text: "Open the freshest request first, confirm the latest movement, then choose the next step." },
          { label: "Go next", text: "Move to Inbox for live customer replies or Booking Queue once the request is ready for scheduling." }
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,420px)] xl:items-start">
        <div className={`${frontDeskWorkspaceCardClass("hero")} p-6 sm:p-7`}>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Queue summary</p>
              <p className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-slate-900">
                {view === "OPEN_LEADS"
                  ? filtered.length
                    ? `${filtered.length} open requests are in the queue`
                    : "No open requests need follow-up right now"
                  : `${customerFiltered.length} known customers are in memory`}
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {view === "OPEN_LEADS"
                  ? "Search, open the freshest request, and move it forward."
                  : "Open customer memory when you need repeat-caller context."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              {stats.map((item) => (
                <div key={item.label} className={frontDeskMetricCardClass()}>
                  <div className="p-5">
                    <p className="page-eyebrow">{item.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`${frontDeskWorkspaceCardClass("default")} p-5`}>
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Queue controls</p>
              <p className="text-base font-semibold text-slate-900">Search the queue, change the current view, and keep customer memory close at hand.</p>
            </div>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={view === "OPEN_LEADS" ? "Search by name, business, phone, email, or source" : "Search customers by name or phone"}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {view === "OPEN_LEADS" ? (
                <label className="text-sm">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Queue state</span>
                  <select
                    value={queueFilter}
                    onChange={(event) => setQueueFilter(event.target.value as (typeof queueStates)[number])}
                    className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
                  >
                    {queueStates.map((state) => (
                      <option key={state} value={state}>
                        {queueStateLabel(state)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  Pro customer memory view
                </div>
              )}
              <div className="rounded-2xl border border-slate-200/90 bg-white/70 px-4 py-4 text-sm text-slate-700">
                <p className="page-eyebrow">Customer memory</p>
                <p className="mt-2 leading-6">
                  Keep repeat callers and prior outcomes nearby when the office needs more context before responding.
                </p>
                <div className="mt-3">
                  {plan === "PRO" ? (
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/app/customer-base">Open customer memory</Link>
                    </Button>
                  ) : (
                    <Button asChild className="w-full">
                      <Link href="/app/billing">Upgrade to Pro</Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className={frontDeskLoadingCardClass()}>
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] xl:items-start">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className={frontDeskSkeletonLineClass("md")} />
                          <div className={frontDeskSkeletonLineClass("sm")} />
                        </div>
                        <div className="flex gap-2">
                          <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200/90" />
                          <div className="h-6 w-24 animate-pulse rounded-full bg-slate-200/90" />
                        </div>
                      </div>
                      <div className="h-6 w-36 animate-pulse rounded-full bg-slate-200/90" />
                      <div className={frontDeskSkeletonLineClass()} />
                      <div className={frontDeskSkeletonLineClass("lg")} />
                    </div>
                    <div className={frontDeskLoadingCardClass()}>
                      <div className="space-y-3">
                        <div className={frontDeskSkeletonLineClass("sm")} />
                        <div className="h-10 animate-pulse rounded-xl bg-slate-200/90" />
                      </div>
                    </div>
                    <div className={frontDeskLoadingCardClass()}>
                      <div className="space-y-3">
                        <div className={frontDeskSkeletonLineClass("sm")} />
                        <div className={frontDeskSkeletonLineClass("md")} />
                        <div className={frontDeskSkeletonLineClass("lg")} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length ? (
            filtered.map((lead) => (
                <Card key={lead.id} className={`${frontDeskCardClass("default")} ${
                  lead.frontDesk?.state === "closed"
                    ? frontDeskOutcomeSurfaceClass("resolved")
                    : lead.frontDesk?.state === "booked"
                      ? frontDeskOutcomeSurfaceClass("booked")
                      : lead.latestMessageThreadId && latestLeadMovementLabel(lead) === "Customer replied"
                        ? frontDeskOutcomeSurfaceClass("saved")
                        : frontDeskOutcomeSurfaceClass("active")
                } ${lead.id === highlightedLeadId ? "border-primary ring-1 ring-primary/20 shadow-[0_10px_24px_rgba(31,58,138,0.08)]" : ""}`}>
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 border-b border-border/60 pb-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <p className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">{lead.name}</p>
                        <p className="text-sm text-muted-foreground">{lead.business}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${frontDeskActionBadgeClass(leadNextActionLabel(lead))}`}>
                          {leadNextActionLabel(lead)}
                        </span>
                        <Badge className={clientBadgeClass(frontDeskTone(lead))}>{leadWorkTypeLabel(lead)}</Badge>
                        <Badge className={clientBadgeClass(frontDeskTone(lead))}>{frontDeskStateLabel(lead)}</Badge>
                        <Badge className={frontDeskPriorityBadgeClass(lead.frontDesk?.frontDeskPriority)}>{frontDeskPriorityLabel(lead)}</Badge>
                        {leadOutcomeBadge(lead) ? (
                          <Badge className={clientBadgeClass(leadOutcomeBadge(lead)!.tone)}>{leadOutcomeBadge(lead)!.label}</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid gap-2 sm:flex sm:flex-wrap xl:justify-end">
                      {leadQuickActions(lead).map((action) => (
                        <Button
                          key={`${lead.id}-${action.stage}`}
                          size="sm"
                          variant={action.tone}
                          className="w-full sm:w-auto"
                          disabled={!canEditPipeline || !pipelineAvailable || savingPipelineLeadId === lead.id}
                          onClick={() => void onPipelineChange(lead.id, action.stage)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                        <div className={`${frontDeskContextPanelClass()} space-y-1`}>
                          <p className="page-eyebrow">Contact</p>
                          <p className="text-sm font-medium text-foreground">{lead.phone || lead.email || "No contact info"}</p>
                        </div>
                        <div className={`${frontDeskContextPanelClass()} space-y-1`}>
                          <p className="page-eyebrow">Service request</p>
                          <p className="text-sm text-foreground">{summarizeLead(lead)}</p>
                        </div>
                        <div className={`${frontDeskContextPanelClass()} space-y-1`}>
                          <p className="page-eyebrow">Urgency</p>
                          <p className="text-sm text-foreground">{lead.urgency || lead.frontDesk?.frontDeskPriority || "normal"}</p>
                        </div>
                        <div className={`${frontDeskContextPanelClass()} space-y-1`}>
                          <p className="page-eyebrow">Latest movement</p>
                          <p className="text-sm text-foreground">{latestLeadMovementLabel(lead)}</p>
                        </div>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,320px)] xl:items-start">
                      <div className="grid gap-4">
                        <div className={`${frontDeskContextPanelClass()} space-y-4 text-sm`}>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <p className="page-eyebrow">Customer context</p>
                              <p className="font-medium text-foreground">{lead.name || "Unknown customer"}</p>
                              <p className="text-muted-foreground">Source: {lead.source || "-"}</p>
                              <p className="text-muted-foreground">Pipeline: {prettyStage(lead.pipelineStage || "NEW_LEAD")}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="page-eyebrow">Why this matters now</p>
                              <p className="text-muted-foreground">
                                {leadNextActionLabel(lead)}. Stay in Lead Queue while the office still needs to decide the next follow-up, scheduling, or resolution step for this request.
                              </p>
                            </div>
                          </div>
                          {leadOutcomeListNote(lead) ? (
                            <div className="rounded-2xl border border-border/60 bg-white/70 px-4 py-3 text-xs text-muted-foreground">
                              {leadOutcomeListNote(lead)}
                            </div>
                          ) : null}
                          {leadOutcomeNote(lead) ? <p className="text-sm text-muted-foreground">{leadOutcomeNote(lead)}</p> : null}
                        </div>

                        {(lead.latestMessageThreadId || lead.latestCallId || lead.latestAppointmentRequestId) ? (
                          <div className={`${frontDeskContextPanelClass()} space-y-2 text-sm`}>
                            <p className="page-eyebrow">Related workspaces</p>
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                              {lead.latestMessageThreadId && latestLeadMovementLabel(lead) === "Customer replied" ? (
                                <Button asChild size="sm" className="w-full justify-start">
                                  <Link href={`/app/messages?threadId=${encodeURIComponent(lead.latestMessageThreadId)}`}>Open inbox</Link>
                                </Button>
                              ) : null}
                              {lead.latestAppointmentRequestId ? (
                                <Button
                                  asChild
                                  size="sm"
                                  variant={lead.latestMessageThreadId && latestLeadMovementLabel(lead) === "Customer replied" ? "outline" : "default"}
                                  className="w-full justify-start"
                                >
                                  <Link href={`/app/appointments?requestId=${encodeURIComponent(lead.latestAppointmentRequestId)}`}>Open booking</Link>
                                </Button>
                              ) : null}
                              {lead.latestCallId ? (
                                <Button
                                  asChild
                                  size="sm"
                                  variant={
                                    lead.latestMessageThreadId && latestLeadMovementLabel(lead) === "Customer replied"
                                      ? "outline"
                                      : !lead.latestAppointmentRequestId && lead.frontDesk?.recommendedAction === "Call back now"
                                        ? "default"
                                        : "outline"
                                  }
                                  className="w-full justify-start"
                                >
                                  <Link href={`/app/calls?callId=${encodeURIComponent(lead.latestCallId)}`}>Open call</Link>
                                </Button>
                              ) : null}
                              {lead.latestMessageThreadId && latestLeadMovementLabel(lead) !== "Customer replied" ? (
                                <Button asChild size="sm" variant="outline" className="w-full justify-start">
                                  <Link href={`/app/messages?threadId=${encodeURIComponent(lead.latestMessageThreadId)}`}>Open inbox</Link>
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className={`${frontDeskContextPanelClass()} space-y-4 text-sm`}>
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
                        {lead.classification ? (
                          <p className="text-xs text-muted-foreground">
                            Classified as {lead.classification.toLowerCase()} {typeof lead.classificationConfidence === "number" ? `(${Math.round(lead.classificationConfidence * 100)}%)` : ""}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className={frontDeskEmptyStateClass()}>
              No open requests are waiting right now. Missed calls, SMS replies, and new inquiries will appear here so the office can follow up.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[0, 1].map((item) => (
                <div key={item} className={frontDeskLoadingCardClass()}>
                  <div className="space-y-3">
                    <div className={frontDeskSkeletonLineClass("md")} />
                    <div className={frontDeskSkeletonLineClass("sm")} />
                    <div className={frontDeskSkeletonLineClass("lg")} />
                  </div>
                </div>
              ))}
            </div>
          ) : customerFiltered.length ? (
            customerFiltered.map((customer) => (
              <Card key={customer.phoneNumber} className={frontDeskWorkspaceCardClass("subtle")}>
                <CardContent className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_220px_120px] xl:items-center">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-foreground">{customer.displayName}</p>
                      {customer.flaggedVIP ? <Badge className={clientBadgeClass("booking")}>VIP</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{customer.phoneNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      Last outcome: {customer.lastOutcome || "Unknown"} | Last seen {new Date(customer.lastCallAt).toLocaleDateString()}
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
            <div className={frontDeskEmptyStateClass()}>No known customers yet. Customer memory appears here after repeat calls and follow-up activity.</div>
          )}
        </div>
      )}
    </div>
  );
}

