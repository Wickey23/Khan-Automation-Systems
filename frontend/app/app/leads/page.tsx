"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Sparkles,
  Tag,
  User
} from "lucide-react";
import { executeAiTool, fetchOrgLeads, getMe, retryAiApprovalSend, updateLeadPipelineStage } from "@/lib/api";
import type { FrontDeskPriority, Lead } from "@/lib/types";
import { AskAiInline } from "@/components/ai/ask-ai-inline";
import { AiWorkflowActions } from "@/components/ai/workflow-actions";
import { EntityTimelineCard } from "@/components/ai/entity-timeline-card";
import { RecommendedNextActionPanel } from "@/components/ai/recommended-next-action-panel";
import { RelatedContextCard } from "@/components/ai/related-context-card";
import { RecentActivityCard } from "@/components/ai/recent-activity-card";
import { useEntityAiState } from "@/lib/hooks/use-entity-ai-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildReturnTo, buildWorkflowHref, normalizeReturnTo, sourceToLabel } from "@/lib/workflow-nav";
import { QueueEmptyState } from "@/components/queue/queue-empty-state";
import { WorkflowReturnBanner } from "@/components/queue/workflow-return-banner";
import { ActionQueueTable, CommandHeader, RiskRailCard, SectionDisclosure, ageFromDate, dueLabel, priorityToSeverity, statusToOperatorState } from "@/components/ops";

type PipelineStage = "NEW_LEAD" | "QUOTED" | "NEEDS_SCHEDULING" | "SCHEDULED" | "COMPLETED";

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "FD";
}

function leadName(lead: Lead) {
  return String(lead.name || lead.phone || lead.email || "Unknown lead").trim();
}

function leadStatus(lead: Lead) {
  if (lead.frontDesk?.state === "needs_follow_up") return "New Inquiry";
  if (lead.frontDesk?.state === "contacted") return "Awaiting Reply";
  if (lead.frontDesk?.state === "booked") return "Qualified";
  if (lead.frontDesk?.state === "closed") return "Resolved";
  if (lead.frontDesk?.state === "spam") return "Spam";
  return lead.status.replaceAll("_", " ");
}

function leadUrgency(priority?: FrontDeskPriority) {
  if (priority === "urgent") return { label: "High", color: "text-red-600", bg: "bg-red-50" };
  if (priority === "high") return { label: "Medium", color: "text-amber-600", bg: "bg-amber-50" };
  if (priority === "normal") return { label: "Medium", color: "text-amber-600", bg: "bg-amber-50" };
  return { label: "Low", color: "text-slate-600", bg: "bg-slate-50" };
}

function leadSummary(lead: Lead) {
  return lead.frontDesk?.summary || lead.serviceRequested || lead.message || "No lead summary available yet.";
}

function leadSource(lead: Lead) {
  if (lead.source === "PHONE_CALL") return "Direct Dial";
  if (lead.source === "SMS") return "SMS";
  if (lead.source === "WEB_FORM") return "Web Form";
  return lead.source || lead.sourcePage || "Lead Queue";
}

function leadRecommendedAction(lead: Lead) {
  return lead.frontDesk?.recommendedAction || (lead.pipelineStage === "NEEDS_SCHEDULING" ? "Book Appointment" : "Review Lead");
}

function activityLabel(lead: Lead) {
  const value = lead.frontDesk?.lastActivityAt || lead.updatedAt || lead.createdAt;
  const mins = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (mins < 60) return `${mins || 1} mins ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hrs ago`;
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function AppLeadsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const highlightedLeadId = searchParams.get("leadId") || "";
  const source = searchParams.get("source") || "";
  const returnTo = normalizeReturnTo(searchParams.get("returnTo"));
  const returnLabel = searchParams.get("returnLabel") || sourceToLabel(source);
  const localReturnTo = useMemo(() => buildReturnTo(pathname, searchParams), [pathname, searchParams]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [canEdit, setCanEdit] = useState(false);
  const [savingStage, setSavingStage] = useState<PipelineStage | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [leadAiState, setLeadAiState] = useState<{
    score?: number;
    scoreReason?: string;
    summary?: string;
    callPrep?: string[];
    emailDraft?: string;
    smsDraft?: string;
  }>({});
  const [csvInput, setCsvInput] = useState("");
  const [importPreview, setImportPreview] = useState<{ totalRows: number; headers: string[] } | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [retryBusy, setRetryBusy] = useState(false);

  useEffect(() => {
    void getMe()
      .then((me) => setCanEdit(["CLIENT_STAFF", "CLIENT_ADMIN", "ADMIN", "SUPER_ADMIN"].includes(me.user.role)))
      .catch(() => setCanEdit(false));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchOrgLeads()
      .then((data) => {
        if (!active) return;
        setLeads(data.leads || []);
        setSelectedLeadId((current) => highlightedLeadId || current || data.leads?.[0]?.id || "");
      })
      .catch(() => {
        if (!active) return;
        setLeads([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [highlightedLeadId]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedLeadId) params.set("leadId", selectedLeadId);
    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    const currentUrl = buildReturnTo(pathname, searchParams);
    if (nextUrl !== currentUrl) router.replace(nextUrl, { scroll: false });
  }, [pathname, query, router, searchParams, selectedLeadId]);

  const filteredLeads = useMemo(() => {
    const term = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (!term) return true;
      return [
        lead.id,
        leadName(lead),
        lead.phone,
        lead.email,
        lead.business,
        leadSource(lead),
        leadSummary(lead),
        leadRecommendedAction(lead)
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [leads, query]);

  const selectedLead =
    filteredLeads.find((lead) => lead.id === selectedLeadId) ||
    leads.find((lead) => lead.id === selectedLeadId) ||
    filteredLeads[0] ||
    leads[0] ||
    null;
  const leadRows = useMemo(
    () =>
      filteredLeads.map((lead) => {
        const status = leadStatus(lead).toLowerCase();
        const severity = priorityToSeverity(lead.frontDesk?.frontDeskPriority || "medium");
        const selectedForBatch = selectedLeadIds.includes(lead.id);
        return {
          id: lead.id,
          item: `${leadName(lead)} - ${lead.phone || lead.email || "No contact"}`,
          owner: lead.latestMessageThreadId ? "Linked thread" : "Unassigned",
          due: dueLabel(lead.updatedAt),
          ageLabel: ageFromDate(lead.frontDesk?.lastActivityAt || lead.updatedAt || lead.createdAt),
          severity,
          status: statusToOperatorState(status),
          primaryActionLabel: leadRecommendedAction(lead),
          onPrimaryAction: () => setSelectedLeadId(lead.id),
          secondaryActions: [
            {
              label: selectedForBatch ? "Remove from batch" : "Select for batch",
              onClick: () =>
                setSelectedLeadIds((current) =>
                  selectedForBatch ? current.filter((id) => id !== lead.id) : [...new Set([...current, lead.id])]
                )
            },
            {
              label: "Open approvals",
              href: buildWorkflowHref(`/app/approvals?status=PENDING&leadId=${encodeURIComponent(lead.id)}`, {
                source: "leads",
                returnTo: localReturnTo,
                returnLabel: "Leads"
              })
            },
            {
              label: "Open follow-up",
              href: buildWorkflowHref("/app/follow-up", { source: "leads", returnTo: localReturnTo, returnLabel: "Leads" })
            },
            ...(lead.latestMessageThreadId
              ? [
                  {
                    label: "Open thread",
                    href: buildWorkflowHref(`/app/messages?threadId=${encodeURIComponent(lead.latestMessageThreadId)}`, {
                      source: "leads",
                      returnTo: localReturnTo,
                      returnLabel: "Leads"
                    })
                  }
                ]
              : [])
          ],
          detail: `${leadStatus(lead)} | ${leadSource(lead)}${selectedForBatch ? " | Selected for batch" : ""}`,
          onRowSelect: () => setSelectedLeadId(lead.id),
          onRowFocus: () => setSelectedLeadId(lead.id),
          rowAriaLabel: `${leadName(lead)}. ${leadStatus(lead)}.`
        };
      }),
    [filteredLeads, localReturnTo, selectedLeadIds]
  );
  const leadRiskItems = useMemo(
    () => [
      {
        id: "needs-follow-up",
        title: "Needs follow-up",
        detail: `${filteredLeads.filter((lead) => lead.frontDesk?.state === "needs_follow_up").length} leads awaiting first response.`,
        level: "warning" as const
      },
      {
        id: "dnc-blocked",
        title: "Outbound blocked",
        detail: `${filteredLeads.filter((lead) => lead.dnc).length} leads marked DNC/blocked.`,
        level: "critical" as const
      }
    ],
    [filteredLeads]
  );

  useEffect(() => {
    if (!selectedLead) {
      setLeadAiState({});
      return;
    }
    setLeadAiState((current) => ({
      ...current,
      summary: leadSummary(selectedLead)
    }));
  }, [selectedLead]);

  const { data: entityState, loading: entityStateBusy, error: entityStateError, refresh: refreshEntityState } = useEntityAiState(
    selectedLead ? "lead" : undefined,
    selectedLead?.id
  );

  async function setStage(stage: PipelineStage) {
    if (!selectedLead || !canEdit) return;
    setSavingStage(stage);
    try {
      await updateLeadPipelineStage(selectedLead.id, stage);
      setLeads((current) => current.map((lead) => (lead.id === selectedLead.id ? { ...lead, pipelineStage: stage } : lead)));
      await refreshEntityState();
    } finally {
      setSavingStage(null);
    }
  }

  async function runBatchSmsDraft() {
    if (!selectedLeadIds.length || batchBusy) return;
    setBatchBusy(true);
    try {
      for (const leadId of selectedLeadIds.slice(0, 25)) {
        await executeAiTool({
          toolKey: "draft_outreach_sms",
          agentKey: "lead_ops",
          entityType: "lead",
          entityId: leadId,
          input: { leadId }
        });
      }
    } finally {
      setBatchBusy(false);
    }
  }

  const latestApproval = useMemo(() => entityState?.approvals?.[0] || null, [entityState?.approvals]);
  const pendingApproval = useMemo(() => entityState?.approvals?.find((item) => item.status === "PENDING") || null, [entityState?.approvals]);
  const failedRetryableApproval = useMemo(
    () => entityState?.approvals?.find((item) => item.deliveryStatus === "FAILED" && item.retryable) || null,
    [entityState?.approvals]
  );
  const contextSnapshot = useMemo(() => entityState?.memory?.contextJson || {}, [entityState?.memory?.contextJson]);
  const followUpHref = useMemo(() => {
    const queueItemId = typeof contextSnapshot.latestFollowUpItemId === "string" ? contextSnapshot.latestFollowUpItemId : "";
    const taskId = typeof contextSnapshot.latestTaskId === "string" ? contextSnapshot.latestTaskId : "";
    if (queueItemId) return buildWorkflowHref(`/app/follow-up?queueItemId=${encodeURIComponent(queueItemId)}`, { source: "leads", returnTo: localReturnTo, returnLabel: "Leads" });
    if (taskId) return buildWorkflowHref(`/app/follow-up?taskId=${encodeURIComponent(taskId)}`, { source: "leads", returnTo: localReturnTo, returnLabel: "Leads" });
    return buildWorkflowHref("/app/follow-up", { source: "leads", returnTo: localReturnTo, returnLabel: "Leads" });
  }, [contextSnapshot.latestFollowUpItemId, contextSnapshot.latestTaskId, localReturnTo]);
  const approvalHref = useMemo(() => {
    if (pendingApproval?.id) return buildWorkflowHref(`/app/approvals?approvalId=${encodeURIComponent(pendingApproval.id)}&status=PENDING`, { source: "leads", returnTo: localReturnTo, returnLabel: "Leads" });
    if (latestApproval?.id) return buildWorkflowHref(`/app/approvals?approvalId=${encodeURIComponent(latestApproval.id)}`, { source: "leads", returnTo: localReturnTo, returnLabel: "Leads" });
    return buildWorkflowHref("/app/approvals", { source: "leads", returnTo: localReturnTo, returnLabel: "Leads" });
  }, [latestApproval?.id, localReturnTo, pendingApproval?.id]);

  const onRetryFailedApproval = useCallback(async () => {
    if (!failedRetryableApproval?.id || retryBusy) return;
    setRetryBusy(true);
    try {
      await retryAiApprovalSend(failedRetryableApproval.id);
      await refreshEntityState();
    } finally {
      setRetryBusy(false);
    }
  }, [failedRetryableApproval?.id, refreshEntityState, retryBusy]);

  const recommendationActions = useMemo(() => {
    const actions: Array<{
      key: string;
      label: string;
      href?: string;
      onClick?: () => void;
      disabled?: boolean;
      variant?: "default" | "outline";
      tone?: "default" | "warning";
    }> = [];
    const blockedReasons = entityState?.recommendation?.blockedReasons || [];
    const riskFlags = entityState?.operationalMemory?.riskFlags || [];
    const outboundBlocked = entityState?.operationalMemory?.outboundBlocked || false;
    const hasOpenFollowUp = (entityState?.operationalMemory?.taskSnapshot.openFollowUpCount || 0) > 0;
    const noAiOutput = !entityState?.operationalMemory?.latestSummary && !entityState?.operationalMemory?.latestClassification;
    const hasOptOut = outboundBlocked || blockedReasons.some((reason) => /dnc|opt[_\s-]?out/i.test(reason)) || riskFlags.some((flag) => /dnc|opt[_\s-]?out/i.test(flag));
    const overdueFollowUp = riskFlags.some((flag) => /overdue/i.test(flag));

    if (failedRetryableApproval?.id) {
      actions.push({ key: "retry-send", label: retryBusy ? "Retrying send..." : "Retry failed send", onClick: () => void onRetryFailedApproval(), disabled: retryBusy, variant: "default", tone: "warning" });
    }
    if (pendingApproval?.id) {
      actions.push({ key: "open-pending-approval", label: "Open pending approval", href: approvalHref, variant: "default" });
    }
    if (overdueFollowUp || hasOpenFollowUp) {
      actions.push({ key: "open-follow-up", label: overdueFollowUp ? "Resolve overdue follow-up" : "Open follow-up", href: followUpHref, variant: "default" });
    }
    if (hasOptOut) {
      actions.push({ key: "review-dnc", label: "Review DNC / opt-out", href: followUpHref, tone: "warning" });
    } else if (!pendingApproval?.id) {
      actions.push({ key: "queue-outreach", label: "Queue first-touch approval", href: "#lead-ai-workflow", variant: "outline" });
    }
    if (selectedLead?.latestMessageThreadId) {
      actions.push({ key: "open-thread", label: "Open inbox thread", href: buildWorkflowHref(`/app/messages?threadId=${encodeURIComponent(selectedLead.latestMessageThreadId)}`, { source: "leads", returnTo: localReturnTo, returnLabel: "Leads" }) });
    }
    if (noAiOutput) {
      actions.push({ key: "run-ai", label: "Run lead AI workflow", href: "#lead-ai-workflow", variant: "outline" });
    }
    if (!actions.length) {
      actions.push({ key: "refresh-state", label: "Refresh recommendation state", onClick: () => void refreshEntityState() });
    }
    return actions;
  }, [
    approvalHref,
    entityState?.operationalMemory?.latestClassification,
    entityState?.operationalMemory?.latestSummary,
    entityState?.operationalMemory?.outboundBlocked,
    entityState?.operationalMemory?.riskFlags,
    entityState?.operationalMemory?.taskSnapshot.openFollowUpCount,
    entityState?.recommendation?.blockedReasons,
    failedRetryableApproval?.id,
    followUpHref,
    refreshEntityState,
    onRetryFailedApproval,
    pendingApproval?.id,
    retryBusy,
    selectedLead?.latestMessageThreadId,
    localReturnTo
  ]);

  const relatedContext = useMemo(() => {
    if (!selectedLead) return null;
    const stats = [
      {
        label: "Thread linkage",
        value: selectedLead.latestMessageThreadId ? "Linked" : "None",
        tone: selectedLead.latestMessageThreadId ? ("success" as const) : ("default" as const)
      },
      {
        label: "Recent call",
        value: selectedLead.latestCallId ? "Linked" : "None",
        tone: selectedLead.latestCallId ? ("success" as const) : ("default" as const)
      },
      {
        label: "Approval state",
        value: pendingApproval ? "Pending review" : latestApproval?.deliveryStatus || latestApproval?.status || "None",
        tone: pendingApproval ? ("warning" as const) : latestApproval?.deliveryStatus === "FAILED" ? ("critical" as const) : ("default" as const)
      },
      {
        label: "Follow-up",
        value: `${entityState?.operationalMemory?.taskSnapshot.openFollowUpCount || 0} open`,
        tone: (entityState?.operationalMemory?.taskSnapshot.openFollowUpCount || 0) > 0 ? ("warning" as const) : ("default" as const)
      }
    ];
    const links: Array<{ label: string; href: string }> = [];
    if (selectedLead.latestMessageThreadId) {
      links.push({
        label: "Open inbox thread",
        href: buildWorkflowHref(`/app/messages?threadId=${encodeURIComponent(selectedLead.latestMessageThreadId)}`, { source: "leads", returnTo: localReturnTo, returnLabel: "Leads" })
      });
    }
    if (selectedLead.latestCallId) {
      links.push({
        label: "Open recent call",
        href: buildWorkflowHref(`/app/calls?callId=${encodeURIComponent(selectedLead.latestCallId)}`, { source: "leads", returnTo: localReturnTo, returnLabel: "Leads" })
      });
    }
    if (selectedLead.latestAppointmentRequestId) {
      links.push({
        label: "Open booking request",
        href: buildWorkflowHref(`/app/appointments?requestId=${encodeURIComponent(selectedLead.latestAppointmentRequestId)}`, { source: "leads", returnTo: localReturnTo, returnLabel: "Leads" })
      });
    }
    links.push({ label: "Open approvals", href: approvalHref });
    links.push({ label: "Open follow-up", href: followUpHref });
    const flags = [
      ...(selectedLead.dnc || entityState?.operationalMemory?.outboundBlocked ? [{ label: "Outbound blocked / DNC", tone: "critical" as const }] : []),
      ...(entityState?.attention?.attentionLevel ? [{ label: `Attention ${entityState.attention.attentionLevel}`, tone: entityState.attention.attentionLevel === "CRITICAL" ? ("critical" as const) : entityState.attention.attentionLevel === "HIGH" ? ("warning" as const) : ("default" as const) }] : [])
    ];
    return { stats, links, flags };
  }, [
    approvalHref,
    entityState?.attention,
    entityState?.operationalMemory?.outboundBlocked,
    entityState?.operationalMemory?.taskSnapshot.openFollowUpCount,
    followUpHref,
    latestApproval?.deliveryStatus,
    latestApproval?.status,
    localReturnTo,
    pendingApproval,
    selectedLead
  ]);

  return (
    <div className="space-y-5">
      <CommandHeader
        eyebrow="AI Operations"
        title="Leads"
        description="Prioritize lead outreach, ownership, and next actions from one triage queue."
      />
      <WorkflowReturnBanner returnTo={returnTo} returnLabel={returnLabel} />
      <AskAiInline page="leads" entityType={selectedLead ? "lead" : undefined} entityId={selectedLead?.id} defaultAgentKey="lead_ops" />
      <div className="overflow-hidden rounded-[28px] border border-white/75 bg-white/82 shadow-[0_24px_46px_-30px_rgba(15,23,42,0.48)] backdrop-blur">
      <div className="flex min-h-[calc(100vh-15rem)] overflow-hidden bg-white/55">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-6">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-slate-900">Lead Queue</h1>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button className="rounded-md bg-white px-3 py-1 text-xs font-bold text-primary shadow-sm">Active Leads ({filteredLeads.length})</button>
                <button type="button" disabled title="Archived view not available in this release" className="cursor-not-allowed px-3 py-1 text-xs font-medium text-slate-400">Archived</button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search leads..."
                  className="h-8 w-72 rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </div>
              <button type="button" disabled title="Use CSV import preview below to add leads in this release" className="flex h-8 cursor-not-allowed items-center gap-2 rounded-lg bg-slate-300 px-3 text-xs font-bold text-white">
                <Plus className="h-3.5 w-3.5" />
                Add Lead
              </button>
            </div>
          </div>
          {selectedLeadIds.length ? (
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-2">
              <p className="text-xs text-slate-600">{selectedLeadIds.length} selected for outreach drafting.</p>
              <button
                type="button"
                disabled={batchBusy}
                onClick={() => void runBatchSmsDraft()}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
              >
                {batchBusy ? "Generating..." : "Generate batch SMS drafts"}
              </button>
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">Loading leads...</div>
            ) : filteredLeads.length ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <ActionQueueTable title="Lead Queue" rows={leadRows} />
                <RiskRailCard title="Lead Risk" items={leadRiskItems} />
              </div>
            ) : (
              <QueueEmptyState
                title="No Leads Match This Search"
                description="Try a broader term or clear the query to view the full lead queue."
              />
            )}
          </div>
        </div>

        <aside className="hidden w-96 shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-slate-50/30 xl:flex">
          {selectedLead ? (
            <>
              <div className="border-b border-slate-200 bg-white p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-xl font-extrabold text-primary shadow-sm">
                    {initials(leadName(selectedLead))}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled title="Direct dial not available in this release" className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-300 shadow-sm"><Phone className="h-4 w-4" /></button>
                    <button type="button" disabled title="Direct messaging not available in this release" className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-300 shadow-sm"><MessageSquare className="h-4 w-4" /></button>
                  </div>
                </div>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{leadName(selectedLead)}</h2>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Lead via {leadSource(selectedLead)} - {activityLabel(selectedLead)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", leadUrgency(selectedLead.frontDesk?.frontDeskPriority).bg, leadUrgency(selectedLead.frontDesk?.frontDeskPriority).color)}>
                    <AlertCircle className="h-2.5 w-2.5" />
                    {leadUrgency(selectedLead.frontDesk?.frontDeskPriority).label} Urgency
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    <Tag className="h-2.5 w-2.5" />
                    {leadStatus(selectedLead)}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto p-6">
                <div className="px-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Primary</p>
                </div>
                <RecommendedNextActionPanel
                  title="Recommended Next Action"
                  source={source}
                  loading={entityStateBusy}
                  error={entityStateError}
                  recommendation={entityState?.recommendation || null}
                  operationalMemory={entityState?.operationalMemory || null}
                  attention={entityState?.attention || null}
                  latestApproval={latestApproval}
                  quickActions={recommendationActions}
                  onRefresh={() => {
                    if (!selectedLead?.id) return;
                    void refreshEntityState();
                  }}
                  refreshing={entityStateBusy}
                />
                <SectionDisclosure title="Secondary Operational Context" storageKey="leads-secondary-context" defaultCollapsed>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {relatedContext ? (
                      <RelatedContextCard
                        title="Related Context"
                        description="Nearby linked records and operational state for this lead."
                        stats={relatedContext.stats}
                        links={relatedContext.links}
                        flags={relatedContext.flags}
                      />
                    ) : null}
                    <RecentActivityCard timelineData={entityState} loading={entityStateBusy} error={entityStateError} />
                  </div>
                </SectionDisclosure>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Operator Context</h4>
                  </div>
                  <p className="text-sm font-medium italic leading-relaxed text-slate-700">&ldquo;{leadSummary(selectedLead)}&rdquo;</p>
                </div>

                <div id="lead-ai-workflow">
                  <AiWorkflowActions
                    title="Lead Ops Workflow"
                    description="Run lead scoring, summary, outreach drafts, and follow-up scheduling."
                    agentKey="lead_ops"
                    entityType="lead"
                    entityId={selectedLead.id}
                    actions={[
                      { key: "score", label: "Score Lead", toolKey: "score_lead", buildInput: () => ({ leadId: selectedLead.id }) },
                      { key: "summary", label: "Summarize Lead", toolKey: "summarize_lead", buildInput: () => ({ leadId: selectedLead.id }) },
                      { key: "email", label: "Draft Outreach Email", toolKey: "draft_outreach_email", buildInput: () => ({ leadId: selectedLead.id }) },
                      { key: "sms", label: "Draft Outreach SMS", toolKey: "draft_outreach_sms", buildInput: () => ({ leadId: selectedLead.id }) },
                      { key: "prep", label: "Generate Call Prep", toolKey: "generate_call_prep", buildInput: () => ({ leadId: selectedLead.id }) },
                      { key: "reply", label: "Classify Reply", toolKey: "classify_lead_reply", buildInput: () => ({ leadId: selectedLead.id }) },
                      { key: "followup", label: "Schedule Follow-up", toolKey: "schedule_lead_followup", buildInput: () => ({ leadId: selectedLead.id }) },
                      { key: "approve", label: "Queue First-touch Approval", toolKey: "queue_sms", buildInput: () => ({ content: leadAiState.smsDraft || `Follow up with ${leadName(selectedLead)}` }) }
                    ]}
                    onToolResult={(toolKey, payload) => {
                      setLeadAiState((current) => ({
                        ...current,
                        score: toolKey === "score_lead" ? Number(payload?.score || current.score || 0) : current.score,
                        scoreReason: toolKey === "score_lead" ? `Confidence ${(Number(payload?.confidence || 0) * 100).toFixed(0)}%` : current.scoreReason,
                        summary: toolKey === "summarize_lead" ? String(payload?.summary || current.summary || "") : current.summary,
                        emailDraft: toolKey === "draft_outreach_email" ? String(payload?.body || current.emailDraft || "") : current.emailDraft,
                        smsDraft: toolKey === "draft_outreach_sms" ? String(payload?.draft || current.smsDraft || "") : current.smsDraft,
                        callPrep: toolKey === "generate_call_prep" ? ((payload?.checklist as string[]) || current.callPrep || []) : current.callPrep
                      }));
                      void refreshEntityState();
                    }}
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">Lead score and reasoning</p>
                  <p className="mt-1">Score: {leadAiState.score ?? "n/a"} {leadAiState.scoreReason ? `- ${leadAiState.scoreReason}` : ""}</p>
                  {leadAiState.callPrep?.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {leadAiState.callPrep.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="px-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Deep detail</p>
                </div>
                <EntityTimelineCard
                  entityType="lead"
                  entityId={selectedLead.id}
                  timelineData={entityState}
                  loading={entityStateBusy}
                  error={entityStateError}
                />

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-900">CSV Import Preview</p>
                  <textarea
                    value={csvInput}
                    onChange={(event) => setCsvInput(event.target.value)}
                    placeholder="name,email,phone,business"
                    className="mt-2 h-24 w-full rounded-xl border border-slate-200 p-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold"
                      onClick={async () => {
                        const response = await executeAiTool({ toolKey: "preview_import", agentKey: "lead_ops", input: { csv: csvInput }, entityType: "organization" });
                        setImportPreview({ totalRows: Number(response.output?.totalRows || 0), headers: (response.output?.headers as string[]) || [] });
                      }}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white"
                      onClick={async () => {
                        await executeAiTool({ toolKey: "import_leads", agentKey: "lead_ops", input: { csv: csvInput }, entityType: "organization" });
                        const data = await fetchOrgLeads();
                        setLeads(data.leads || []);
                        await refreshEntityState();
                      }}
                    >
                      Import
                    </button>
                  </div>
                  {importPreview ? <p className="mt-2 text-xs text-slate-600">Rows: {importPreview.totalRows}, headers: {importPreview.headers.join(", ")}</p> : null}
                </div>

                <div>
                  <h3 className="mb-4 px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Lead Details</h3>
                  <div className="space-y-4 px-1">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-400 shadow-sm"><Phone className="h-3.5 w-3.5" /></div>
                      <div>
                        <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Phone</p>
                        <p className="text-xs font-bold text-slate-900">{selectedLead.phone || "N/A"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-400 shadow-sm"><Mail className="h-3.5 w-3.5" /></div>
                      <div>
                        <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Email</p>
                        <p className="text-xs font-bold text-slate-900">{selectedLead.email || "N/A"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-400 shadow-sm"><User className="h-3.5 w-3.5" /></div>
                      <div>
                        <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Source</p>
                        <p className="text-xs font-bold text-slate-900">{leadSource(selectedLead)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <h3 className="mb-4 px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Primary Action</h3>
                  <div className="space-y-3">
                    <button
                      type="button"
                      disabled
                      title="Use Lead Ops Workflow actions above for this release"
                      className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-300 py-3.5 text-xs font-bold uppercase tracking-widest text-white"
                    >
                      <Phone className="h-4 w-4" />
                      {leadRecommendedAction(selectedLead)}
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Use booking request links and scheduling workflow in this release"
                      className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold uppercase tracking-widest text-slate-400"
                    >
                      <Calendar className="h-4 w-4" />
                      Book Appointment
                    </button>
                    {selectedLead.latestMessageThreadId ? (
                      <Button asChild variant="outline" className="w-full">
                        <Link href={buildWorkflowHref(`/app/messages?threadId=${encodeURIComponent(selectedLead.latestMessageThreadId)}`, { source: "leads", returnTo: localReturnTo, returnLabel: "Leads" })}>Open inbox thread</Link>
                      </Button>
                    ) : null}
                    {selectedLead.latestAppointmentRequestId ? (
                      <Button asChild variant="outline" className="w-full">
                        <Link href={buildWorkflowHref(`/app/appointments?requestId=${encodeURIComponent(selectedLead.latestAppointmentRequestId)}`, { source: "leads", returnTo: localReturnTo, returnLabel: "Leads" })}>Open booking request</Link>
                      </Button>
                    ) : null}
                    {canEdit ? (
                      <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" disabled={savingStage === "NEEDS_SCHEDULING"} onClick={() => void setStage("NEEDS_SCHEDULING")}>
                          Schedule
                        </Button>
                        <Button variant="outline" disabled={savingStage === "COMPLETED"} onClick={() => void setStage("COMPLETED")}>
                          Resolve
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8">
              <QueueEmptyState
                title="No Lead Selected"
                description="Select a lead to review context, AI recommendations, and follow-up actions."
              />
            </div>
          )}
        </aside>
      </div>
      </div>
    </div>
  );
}


