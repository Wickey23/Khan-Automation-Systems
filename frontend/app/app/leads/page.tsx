"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchCustomerBase, fetchOrgLeads, getBillingStatus, getMe, updateLeadPipelineStage } from "@/lib/api";
import { resolvePlanFeatures } from "@/lib/plan-features";
import { clientBadgeClass } from "@/lib/client-badges";
import type { CustomerBaseRecord, FrontDeskPriority, Lead } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
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
      <PageHeader
        eyebrow="Follow-up queue"
        title="Lead Queue"
        description="Use this page to work open requests that still need office follow-up. It is the clearest view of who needs a callback, a reply, scheduling, or resolution next."
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

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.label} className={frontDeskMetricCardClass()}>
            <CardContent className="p-5">
              <p className="page-eyebrow">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className={frontDeskWorkspaceCardClass("hero")}>
        <CardContent className="grid gap-4 p-6 xl:grid-cols-[minmax(0,1fr)_220px_auto] xl:items-end">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={view === "OPEN_LEADS" ? "Search by name, business, phone, email, or source" : "Search customers by name or phone"}
          />
          {view === "OPEN_LEADS" ? (
            <select
              value={queueFilter}
              onChange={(event) => setQueueFilter(event.target.value as (typeof queueStates)[number])}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
            >
              {queueStates.map((state) => (
                <option key={state} value={state}>
                  {queueStateLabel(state)}
                </option>
              ))}
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
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className={frontDeskLoadingCardClass()}>
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_220px_220px] xl:items-start">
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
                <CardContent className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1.2fr)_220px_220px] xl:items-start">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-foreground">{lead.name}</p>
                        <p className="text-sm text-muted-foreground">{lead.business}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={clientBadgeClass(frontDeskTone(lead))}>{leadWorkTypeLabel(lead)}</Badge>
                        <Badge className={clientBadgeClass(frontDeskTone(lead))}>{frontDeskStateLabel(lead)}</Badge>
                        <Badge className={frontDeskPriorityBadgeClass(lead.frontDesk?.frontDeskPriority)}>{frontDeskPriorityLabel(lead)}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${frontDeskActionBadgeClass(leadNextActionLabel(lead))}`}>
                        {leadNextActionLabel(lead)}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>{lead.phone || lead.email || "No contact info"}</p>
                      <p className="mt-1 line-clamp-2">{summarizeLead(lead)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span>{lead.urgency || lead.frontDesk?.frontDeskPriority || "normal"}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{latestLeadMovementLabel(lead)}</span>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:flex sm:flex-wrap">
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
                    {leadOutcomeBadge(lead) ? (
                      <div className="flex flex-wrap gap-2">
                        <Badge className={clientBadgeClass(leadOutcomeBadge(lead)!.tone)}>{leadOutcomeBadge(lead)!.label}</Badge>
                      </div>
                    ) : null}
                    {leadOutcomeListNote(lead) ? (
                      <p className={`${frontDeskContextPanelClass()} text-xs text-muted-foreground`}>{leadOutcomeListNote(lead)}</p>
                    ) : null}
                  </div>

                  <div className={`${frontDeskContextPanelClass()} space-y-2`}>
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

                  <div className={`${frontDeskContextPanelClass()} space-y-2 text-sm`}>
                    <p className="page-eyebrow">Customer context</p>
                    <p className="font-medium text-foreground">{lead.name || "Unknown customer"}</p>
                    <p className="text-muted-foreground">{lead.phone || lead.email || "No contact info"}</p>
                    <p className="text-muted-foreground">{summarizeLead(lead)}</p>
                    <p className="text-muted-foreground">Urgency: {lead.urgency || lead.frontDesk?.frontDeskPriority || "normal"}</p>
                    <p className="text-muted-foreground">Latest movement: {latestLeadMovementLabel(lead)}</p>
                    <p className="text-muted-foreground">Source: {lead.source || "-"}</p>
                    <p className="text-muted-foreground">Pipeline: {prettyStage(lead.pipelineStage || "NEW_LEAD")}</p>
                    {leadOutcomeNote(lead) ? (
                      <p className={`${frontDeskContextPanelClass()} text-muted-foreground`}>{leadOutcomeNote(lead)}</p>
                    ) : null}
                    {(lead.latestMessageThreadId || lead.latestCallId || lead.latestAppointmentRequestId) ? (
                      <div className="space-y-2 pt-1">
                        <p className="page-eyebrow">Jump to follow-up</p>
                        <div className="grid gap-2 sm:flex sm:flex-wrap">
                          {lead.latestMessageThreadId && latestLeadMovementLabel(lead) === "Customer replied" ? (
                            <Button asChild size="sm" className="w-full sm:w-auto">
                              <Link href={`/app/messages?threadId=${encodeURIComponent(lead.latestMessageThreadId)}`}>Open inbox</Link>
                            </Button>
                          ) : null}
                          {lead.latestAppointmentRequestId ? (
                            <Button
                              asChild
                              size="sm"
                              variant={lead.latestMessageThreadId && latestLeadMovementLabel(lead) === "Customer replied" ? "outline" : "default"}
                              className="w-full sm:w-auto"
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
                              className="w-full sm:w-auto"
                            >
                              <Link href={`/app/calls?callId=${encodeURIComponent(lead.latestCallId)}`}>Open call</Link>
                            </Button>
                          ) : null}
                          {lead.latestMessageThreadId && latestLeadMovementLabel(lead) !== "Customer replied" ? (
                            <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                              <Link href={`/app/messages?threadId=${encodeURIComponent(lead.latestMessageThreadId)}`}>Open inbox</Link>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
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
            <div className={frontDeskEmptyStateClass()}>No known customers yet. Customer memory appears here after repeat calls and follow-up activity.</div>
          )}
        </div>
      )}
    </div>
  );
}
