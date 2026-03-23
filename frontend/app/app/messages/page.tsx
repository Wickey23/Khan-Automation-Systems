"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Calendar,
  CheckCheck,
  Filter,
  Inbox,
  Info,
  Paperclip,
  Phone,
  PhoneCall,
  Plus,
  Search,
  Send,
  Smile,
  Sparkles,
  Tag,
  Video
} from "lucide-react";
import { fetchOrgMessages, getMe, retryAiApprovalSend, sendOrgMessage, updateLeadPipelineStage } from "@/lib/api";
import type { OrgMessageThread } from "@/lib/types";
import { AskAiInline } from "@/components/ai/ask-ai-inline";
import { AiWorkflowActions } from "@/components/ai/workflow-actions";
import { EntityTimelineCard } from "@/components/ai/entity-timeline-card";
import { RecommendedNextActionPanel } from "@/components/ai/recommended-next-action-panel";
import { RelatedContextCard } from "@/components/ai/related-context-card";
import { RecentActivityCard } from "@/components/ai/recent-activity-card";
import { useEntityAiState } from "@/lib/hooks/use-entity-ai-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageShell, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAccessSummary } from "@/context/access-summary";
import { buildReturnTo, buildWorkflowHref, normalizeReturnTo, sourceToLabel } from "@/lib/workflow-nav";
import { QueueEmptyState } from "@/components/queue/queue-empty-state";
import { WorkflowReturnBanner } from "@/components/queue/workflow-return-banner";
import { ActionQueueTable, CommandHeader, RiskRailCard, SectionDisclosure, ageFromDate, dueLabel, priorityToSeverity, statusToOperatorState } from "@/components/ops";

type PipelineStage = "NEEDS_SCHEDULING" | "SCHEDULED" | "COMPLETED";

function displayName(thread: OrgMessageThread) {
  return String(thread.contactName || thread.lead?.name || thread.contactPhone || "Unknown contact").trim();
}

function avatar(thread: OrgMessageThread) {
  return displayName(thread)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "FD";
}

function latestMessage(thread: OrgMessageThread) {
  return [...thread.messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
}

function threadPreview(thread: OrgMessageThread) {
  return latestMessage(thread)?.body || thread.frontDesk?.summary || thread.lead?.frontDesk?.summary || "No message preview yet.";
}

function threadType(thread: OrgMessageThread) {
  if (thread.latestAppointmentRequestId) return "Booking Request";
  if ((thread.frontDesk || thread.lead?.frontDesk)?.recommendedAction?.toLowerCase().includes("offer")) return "Confirmation";
  if ((thread.frontDesk || thread.lead?.frontDesk)?.frontDeskPriority === "urgent") return "Emergency";
  return "Follow-up";
}

function threadStatus(thread: OrgMessageThread) {
  const state = thread.frontDesk?.state || thread.lead?.frontDesk?.state;
  if (state === "needs_follow_up") return "active";
  if (state === "contacted") return "online";
  if (state === "booked") return "online";
  if (state === "closed") return "offline";
  return "away";
}

function threadStatusLabel(thread: OrgMessageThread) {
  const status = threadStatus(thread);
  if (status === "online") return "Online";
  if (status === "offline") return "Offline";
  if (status === "active") return "Active";
  return "Away";
}

export default function AppMessagesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const deepLinkedThreadId = searchParams.get("threadId") || "";
  const source = searchParams.get("source") || "";
  const returnTo = normalizeReturnTo(searchParams.get("returnTo"));
  const returnLabel = searchParams.get("returnLabel") || sourceToLabel(source);
  const localReturnTo = useMemo(() => buildReturnTo(pathname, searchParams), [pathname, searchParams]);
  const accessSummary = useAccessSummary();
  const smsAccess = accessSummary?.features.sms;
  const shouldShowMessages = !smsAccess || smsAccess.status === "ready";
  const [threads, setThreads] = useState<OrgMessageThread[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [savingStage, setSavingStage] = useState<PipelineStage | null>(null);
  const [retryBusy, setRetryBusy] = useState(false);
  const [threadAiState, setThreadAiState] = useState<{
    summary?: string;
    classification?: string;
    nextAction?: string;
    replyDraft?: string;
    optOut?: boolean;
  }>({});

  const load = useCallback(async () => {
    const data = await fetchOrgMessages();
    setThreads(data.threads || []);
    setSelectedId((current) => deepLinkedThreadId || current || data.threads?.[0]?.id || "");
  }, [deepLinkedThreadId]);

  useEffect(() => {
    void getMe()
      .then((me) => setCanEdit(["CLIENT_STAFF", "CLIENT_ADMIN", "ADMIN", "SUPER_ADMIN"].includes(me.user.role)))
      .catch(() => setCanEdit(false));
  }, []);

  useEffect(() => {
    if (!shouldShowMessages) {
      setThreads([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void load()
      .catch(() => {
        if (!active) return;
        setThreads([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load, shouldShowMessages]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedId) params.set("threadId", selectedId);
    if (search.trim()) params.set("q", search.trim());
    else params.delete("q");
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    const currentUrl = buildReturnTo(pathname, searchParams);
    if (nextUrl !== currentUrl) router.replace(nextUrl, { scroll: false });
  }, [pathname, router, search, searchParams, selectedId]);

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return threads.filter((thread) => {
      if (!term) return true;
      return [displayName(thread), thread.contactPhone, threadPreview(thread), threadType(thread)]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [search, threads]);

  const selectedThread =
    filteredThreads.find((thread) => thread.id === selectedId) ||
    threads.find((thread) => thread.id === selectedId) ||
    filteredThreads[0] ||
    threads[0] ||
    null;

  useEffect(() => {
    if (!filteredThreads.length) {
      setSelectedId("");
      return;
    }
    if (!selectedId || !filteredThreads.some((thread) => thread.id === selectedId)) {
      setSelectedId(filteredThreads[0].id);
    }
  }, [filteredThreads, selectedId]);

  const threadRows = useMemo(
    () =>
      filteredThreads.map((thread) => {
        const threadState = thread.frontDesk?.state || thread.lead?.frontDesk?.state || "contacted";
        const severity = priorityToSeverity(
          thread.frontDesk?.frontDeskPriority || thread.lead?.frontDesk?.frontDeskPriority || (threadType(thread) === "Emergency" ? "critical" : "medium")
        );
        const status =
          threadState === "needs_follow_up"
            ? "pending"
            : threadState === "contacted"
              ? "in_progress"
              : threadState === "closed"
                ? "done"
                : threadType(thread) === "Emergency"
                  ? "blocked"
                  : "in_progress";
        return {
          id: thread.id,
          item: `${displayName(thread)} - ${threadType(thread)}`,
          owner: thread.leadId ? "Linked lead" : "Unlinked",
          due: dueLabel(thread.lastMessageAt),
          ageLabel: ageFromDate(thread.lastMessageAt),
          severity,
          status: statusToOperatorState(status),
          primaryActionLabel: "Open",
          onPrimaryAction: () => setSelectedId(thread.id),
          secondaryActions: [
            {
              label: "Open approvals",
              href: buildWorkflowHref(`/app/approvals?status=PENDING&threadId=${encodeURIComponent(thread.id)}`, {
                source: "messages",
                returnTo: localReturnTo,
                returnLabel: "Messages"
              })
            },
            {
              label: "Open follow-up",
              href: buildWorkflowHref("/app/follow-up", { source: "messages", returnTo: localReturnTo, returnLabel: "Messages" })
            },
            ...(thread.leadId
              ? [
                  {
                    label: "Open lead",
                    href: buildWorkflowHref(`/app/leads?leadId=${encodeURIComponent(thread.leadId)}`, {
                      source: "messages",
                      returnTo: localReturnTo,
                      returnLabel: "Messages"
                    })
                  }
                ]
              : [])
          ],
          detail: threadPreview(thread),
          isActive: selectedId === thread.id,
          onRowSelect: () => setSelectedId(thread.id),
          onRowFocus: () => setSelectedId(thread.id),
          rowAriaLabel: `${displayName(thread)}. ${threadType(thread)}.`
        };
      }),
    [filteredThreads, localReturnTo, selectedId]
  );
  const threadRiskItems = useMemo(
    () => [
      {
        id: "urgent-threads",
        title: "Urgent threads",
        detail: `${filteredThreads.filter((thread) => threadType(thread) === "Emergency").length} threads marked urgent.`,
        level: "critical" as const
      },
      {
        id: "needs-reply",
        title: "Needs reply",
        detail: `${filteredThreads.filter((thread) => (thread.frontDesk?.state || thread.lead?.frontDesk?.state) === "needs_follow_up").length} threads need operator response.`,
        level: "warning" as const
      }
    ],
    [filteredThreads]
  );

  useEffect(() => {
    if (!selectedThread) {
      setThreadAiState({});
      return;
    }
    setThreadAiState((current) => ({
      ...current,
      summary: selectedThread.frontDesk?.summary || selectedThread.lead?.frontDesk?.summary || current.summary
    }));
  }, [selectedThread]);

  const { data: entityState, loading: entityStateBusy, error: entityStateError, refresh: refreshEntityState } = useEntityAiState(
    selectedThread ? "message_thread" : undefined,
    selectedThread?.id
  );

  useEffect(() => {
    if (selectedThread) {
      setTo(selectedThread.contactPhone || "");
    }
  }, [selectedThread]);

  async function onSend() {
    if (!selectedThread || !to.trim() || !body.trim()) return;
    setSending(true);
    try {
      await sendOrgMessage({ to: to.trim(), body: body.trim(), leadId: selectedThread.leadId || undefined });
      setBody("");
      await load();
      await refreshEntityState();
    } finally {
      setSending(false);
    }
  }

  async function setStage(stage: PipelineStage) {
    if (!selectedThread?.leadId || !canEdit) return;
    setSavingStage(stage);
    try {
      await updateLeadPipelineStage(selectedThread.leadId, stage);
      await load();
      await refreshEntityState();
    } finally {
      setSavingStage(null);
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
    if (queueItemId) return buildWorkflowHref(`/app/follow-up?queueItemId=${encodeURIComponent(queueItemId)}`, { source: "messages", returnTo: localReturnTo, returnLabel: "Messages" });
    if (taskId) return buildWorkflowHref(`/app/follow-up?taskId=${encodeURIComponent(taskId)}`, { source: "messages", returnTo: localReturnTo, returnLabel: "Messages" });
    return buildWorkflowHref("/app/follow-up", { source: "messages", returnTo: localReturnTo, returnLabel: "Messages" });
  }, [contextSnapshot.latestFollowUpItemId, contextSnapshot.latestTaskId, localReturnTo]);
  const approvalHref = useMemo(() => {
    if (pendingApproval?.id) return buildWorkflowHref(`/app/approvals?approvalId=${encodeURIComponent(pendingApproval.id)}&status=PENDING`, { source: "messages", returnTo: localReturnTo, returnLabel: "Messages" });
    if (latestApproval?.id) return buildWorkflowHref(`/app/approvals?approvalId=${encodeURIComponent(latestApproval.id)}`, { source: "messages", returnTo: localReturnTo, returnLabel: "Messages" });
    return buildWorkflowHref("/app/approvals", { source: "messages", returnTo: localReturnTo, returnLabel: "Messages" });
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
    const optOutDetected = outboundBlocked || blockedReasons.some((reason) => /dnc|opt[_\s-]?out/i.test(reason)) || riskFlags.some((flag) => /dnc|opt[_\s-]?out/i.test(flag));
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
    if (optOutDetected) {
      actions.push({ key: "internal-review", label: "Review opt-out block", href: followUpHref, tone: "warning" });
    } else if (!pendingApproval?.id) {
      actions.push({ key: "queue-reply-approval", label: "Queue reply approval", href: "#message-ai-workflow", variant: "outline" });
    }
    if (selectedThread?.leadId) {
      actions.push({ key: "open-lead", label: "Open linked lead", href: buildWorkflowHref(`/app/leads?leadId=${encodeURIComponent(selectedThread.leadId)}`, { source: "messages", returnTo: localReturnTo, returnLabel: "Messages" }) });
    }
    if (noAiOutput) {
      actions.push({ key: "run-ai", label: "Run message AI workflow", href: "#message-ai-workflow", variant: "outline" });
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
    selectedThread?.leadId,
    localReturnTo
  ]);

  const relatedContext = useMemo(() => {
    if (!selectedThread) return null;
    const stats = [
      {
        label: "Linked lead",
        value: selectedThread.leadId ? "Linked" : "Not linked",
        tone: selectedThread.leadId ? ("success" as const) : ("default" as const)
      },
      {
        label: "Recent call",
        value: selectedThread.latestCallId ? "Linked" : "None",
        tone: selectedThread.latestCallId ? ("success" as const) : ("default" as const)
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
    if (selectedThread.leadId) {
      links.push({
        label: "Open linked lead",
        href: buildWorkflowHref(`/app/leads?leadId=${encodeURIComponent(selectedThread.leadId)}`, { source: "messages", returnTo: localReturnTo, returnLabel: "Messages" })
      });
    }
    if (selectedThread.latestCallId) {
      links.push({
        label: "Open recent call",
        href: buildWorkflowHref(`/app/calls?callId=${encodeURIComponent(selectedThread.latestCallId)}`, { source: "messages", returnTo: localReturnTo, returnLabel: "Messages" })
      });
    }
    if (selectedThread.latestAppointmentRequestId) {
      links.push({
        label: "Open booking request",
        href: buildWorkflowHref(`/app/appointments?requestId=${encodeURIComponent(selectedThread.latestAppointmentRequestId)}`, { source: "messages", returnTo: localReturnTo, returnLabel: "Messages" })
      });
    }
    links.push({ label: "Open approvals", href: approvalHref });
    links.push({ label: "Open follow-up", href: followUpHref });
    const dncLike = entityState?.operationalMemory?.outboundBlocked;
    const flags = [
      ...(dncLike ? [{ label: "Outbound blocked / DNC", tone: "critical" as const }] : []),
      ...(threadAiState.optOut ? [{ label: "Opt-out detected", tone: "warning" as const }] : []),
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
    selectedThread,
    threadAiState.optOut
  ]);

  if (smsAccess && smsAccess.status !== "ready") {
    const cardVariant = smsAccess.status === "setup_required" ? "setup" : "locked";
    const actionHref = smsAccess.status === "blocked" ? "/app/billing" : "/app/settings#settings-telephony";
    const actionLabel = smsAccess.status === "blocked" ? "Open billing" : "Open telephony settings";
    return (
      <PageShell className="space-y-6">
        <SectionShell className="surface-panel space-y-4">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Messaging access</p>
              <h1 className="text-3xl font-black text-slate-900">{smsAccess.label} unavailable</h1>
              <p className="text-sm text-slate-500">{smsAccess.reason}</p>
            </div>
            <StatusBadge kind="feature" state={smsAccess.status} size="sm" />
          </div>
          <StateCard
            variant={cardVariant}
            title="Messaging functions limited"
            description={smsAccess.reason}
            action={
              <Link href={actionHref}>
                <Button variant="outline">{actionLabel}</Button>
              </Link>
            }
          />
        </SectionShell>
      </PageShell>
    );
  }

  return (
    <div className="space-y-5">
      <CommandHeader
        eyebrow="AI Operations"
        title="Messages"
        description="Manage customer threads, approvals, and follow-up from the operator inbox."
      />
      <WorkflowReturnBanner returnTo={returnTo} returnLabel={returnLabel} />
      <AskAiInline
        page="messages"
        entityType={selectedThread ? "message_thread" : undefined}
        entityId={selectedThread?.id}
        defaultAgentKey="communications"
      />
      <div className="overflow-hidden rounded-[28px] border border-white/75 bg-white/82 shadow-[0_24px_46px_-30px_rgba(15,23,42,0.48)] backdrop-blur">
      <div className="flex min-h-[calc(100vh-15rem)] overflow-hidden bg-white/55">
        <div className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-slate-50/30">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Inbox className="h-[18px] w-[18px]" />
              </div>
              <h1 className="text-sm font-bold uppercase tracking-widest text-slate-900">Operator Inbox</h1>
            </div>
            <button className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-100">
              <Filter className="h-[18px] w-[18px]" />
            </button>
          </header>

          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversations..."
                className="h-9 w-full rounded-xl border border-slate-200 bg-white/95 pl-9 pr-4 text-xs outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="px-6 py-8 text-sm text-slate-500">Loading conversations...</div>
            ) : filteredThreads.length ? (
              <div className="space-y-4 p-3">
                <ActionQueueTable title="Operator Inbox" rows={threadRows} />
                <RiskRailCard title="Thread Risk" items={threadRiskItems} />
              </div>
            ) : (
              <div className="px-6 py-6">
                <QueueEmptyState
                  title="No Threads Match This Search"
                  description="Try another term or clear the query to show all conversation threads."
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
          {selectedThread ? (
            <>
              <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-8 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-xs font-bold text-slate-500 shadow-sm">
                      {avatar(selectedThread)}
                    </div>
                    <div
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
                        threadStatus(selectedThread) === "online"
                          ? "bg-emerald-500"
                          : threadStatus(selectedThread) === "away"
                            ? "bg-amber-500"
                            : "bg-slate-300"
                      )}
                    />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">{displayName(selectedThread)}</h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{threadType(selectedThread)} - {threadStatusLabel(selectedThread)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" disabled title="Direct call not available in this release" className="cursor-not-allowed rounded-xl border border-transparent p-2.5 text-slate-300"><Phone className="h-4.5 w-4.5" /></button>
                  <button type="button" disabled title="Video call not available in this release" className="cursor-not-allowed rounded-xl border border-transparent p-2.5 text-slate-300"><Video className="h-4.5 w-4.5" /></button>
                </div>
              </header>

              <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50/20 p-8">
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
                    if (!selectedThread?.id) return;
                    void refreshEntityState();
                  }}
                  refreshing={entityStateBusy}
                />
                <div id="message-ai-workflow">
                  <AiWorkflowActions
                    title="Communications Workflow"
                    description="Classify thread, detect opt-outs, draft replies, and route follow-up."
                    agentKey="communications"
                    entityType="message_thread"
                    entityId={selectedThread.id}
                    actions={[
                      { key: "summary", label: "Summarize Thread", toolKey: "summarize_thread", buildInput: () => ({ threadId: selectedThread.id }) },
                      { key: "classify", label: "Classify Message", toolKey: "classify_message", buildInput: () => ({ threadId: selectedThread.id }) },
                      { key: "optout", label: "Detect Opt-out", toolKey: "detect_opt_out", buildInput: () => ({ threadId: selectedThread.id }) },
                      { key: "draft", label: "Draft Reply", toolKey: "draft_reply", buildInput: () => ({ threadId: selectedThread.id }) },
                      { key: "route", label: "Route Thread", toolKey: "route_thread", buildInput: () => ({ threadId: selectedThread.id, routeTo: "unresolved-inbox" }) },
                      { key: "status", label: "Mark Pending", toolKey: "mark_thread_status", buildInput: () => ({ threadId: selectedThread.id, status: "PENDING" }) },
                      { key: "task", label: "Create Follow-up Task", toolKey: "create_message_followup_task", buildInput: () => ({ threadId: selectedThread.id }) },
                      { key: "approval", label: "Queue Reply Approval", toolKey: "queue_sms", buildInput: () => ({ content: threadAiState.replyDraft || body }) }
                    ]}
                    onToolResult={(toolKey, payload) => {
                      setThreadAiState((current) => ({
                        ...current,
                        summary: toolKey === "summarize_thread" ? String(payload?.summary || current.summary || "") : current.summary,
                        classification:
                          toolKey === "classify_message" ? String(payload?.classification || current.classification || "") : current.classification,
                        nextAction: toolKey === "route_thread" ? `Routed to ${String(payload?.routeTo || "queue")}` : current.nextAction,
                        replyDraft: toolKey === "draft_reply" ? String(payload?.draft || current.replyDraft || "") : current.replyDraft,
                        optOut: toolKey === "detect_opt_out" ? Boolean(payload?.optedOut) : current.optOut
                      }));
                      void refreshEntityState();
                    }}
                  />
                </div>
                <SectionDisclosure title="Secondary Operational Context" storageKey="messages-secondary-context" defaultCollapsed>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {relatedContext ? (
                      <RelatedContextCard
                        title="Related Context"
                        description="Linked records and nearby operational state for this thread."
                        stats={relatedContext.stats}
                        links={relatedContext.links}
                        flags={relatedContext.flags}
                      />
                    ) : null}
                    <RecentActivityCard timelineData={entityState} loading={entityStateBusy} error={entityStateError} />
                  </div>
                </SectionDisclosure>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">Thread AI state</p>
                  <p className="mt-1">Classification: {threadAiState.classification || "n/a"}</p>
                  <p>Opt-out: {threadAiState.optOut ? "Detected" : "Not detected"}</p>
                  <p>Next action: {threadAiState.nextAction || "Run route/action tool"}</p>
                  {threadAiState.replyDraft ? <p className="mt-1">Draft: {threadAiState.replyDraft}</p> : null}
                </div>
                <div className="px-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Deep detail</p>
                </div>
                <EntityTimelineCard
                  entityType="message_thread"
                  entityId={selectedThread.id}
                  timelineData={entityState}
                  loading={entityStateBusy}
                  error={entityStateError}
                />

                {[...selectedThread.messages].map((message) => (
                  <div key={message.id} className={cn("flex", message.direction === "OUTBOUND" ? "justify-end" : "justify-start")}>
                    <div className="max-w-[70%] space-y-1">
                      <div className={cn(
                        "rounded-2xl px-5 py-3.5 text-sm shadow-sm",
                        message.direction === "OUTBOUND"
                          ? "rounded-tr-none bg-slate-900 text-white"
                          : "rounded-tl-none border border-slate-200 bg-white text-slate-700"
                      )}>
                        {message.body}
                      </div>
                      <div className="flex items-center gap-1.5 px-1">
                        <span className="text-[10px] font-medium text-slate-400">
                          {new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </span>
                        {message.direction === "OUTBOUND" ? <CheckCheck className="h-3 w-3 text-primary" /> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <footer className="border-t border-slate-200 bg-white p-6">
                <div className="mx-auto flex max-w-4xl items-end gap-3">
                  <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                    <textarea
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      placeholder="Type a message..."
                      className="min-h-[44px] w-full resize-none border-none bg-transparent p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      rows={1}
                    />
                    <div className="flex items-center justify-between px-2 pb-1">
                      <div className="flex items-center gap-1">
                        <button className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-200"><Smile className="h-4.5 w-4.5" /></button>
                        <button className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-200"><Paperclip className="h-4.5 w-4.5" /></button>
                      </div>
                      <button
                        onClick={() => void onSend()}
                        disabled={sending || !to.trim() || !body.trim()}
                        title={!to.trim() ? "No recipient on this thread" : !body.trim() ? "Enter a message to send" : undefined}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-60"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </footer>
            </>
          ) : (
            <div className="p-8">
              <QueueEmptyState
                title="No Thread Selected"
                description="Select a thread to review messages, AI guidance, and follow-up options."
              />
            </div>
          )}
        </div>

        <aside className="hidden w-80 shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-slate-50/50 xl:flex">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-6">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Thread Context</h2>
            <button type="button" disabled title="Context help not available in this release" className="cursor-not-allowed rounded-lg p-2 text-slate-300"><Info className="h-[18px] w-[18px]" /></button>
          </header>

          {selectedThread ? (
            <div className="flex-1 space-y-8 overflow-y-auto p-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-2xl font-extrabold text-primary shadow-inner">
                  {avatar(selectedThread)}
                </div>
                <h3 className="text-lg font-bold tracking-tight text-slate-900">{displayName(selectedThread)}</h3>
                <p className="mt-1 text-xs font-medium text-slate-500">{selectedThread.contactPhone}</p>
                <div className="mt-4 flex justify-center gap-2">
                  <button type="button" disabled title="Profile view not available in this release" className="cursor-not-allowed rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">View Profile</button>
                  <button type="button" disabled title="Profile edit not available in this release" className="cursor-not-allowed rounded-xl bg-slate-300 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white">Edit</button>
                </div>
              </div>

              <div className="space-y-5">
                <h4 className="px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Related Activity</h4>
                {selectedThread.latestAppointmentRequestId ? (
                  <Link href={buildWorkflowHref(`/app/appointments?requestId=${encodeURIComponent(selectedThread.latestAppointmentRequestId)}`, { source: "messages", returnTo: localReturnTo, returnLabel: "Messages" })} className="group block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-primary">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-600"><Calendar className="h-3 w-3" /></div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-900">Booking Request</span>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-slate-700">Open booking queue</p>
                    <p className="mt-1 text-[10px] font-medium text-slate-400">Scheduling follow-up linked to this thread</p>
                  </Link>
                ) : null}
                {selectedThread.latestCallId ? (
                  <Link href={buildWorkflowHref(`/app/calls?callId=${encodeURIComponent(selectedThread.latestCallId)}`, { source: "messages", returnTo: localReturnTo, returnLabel: "Messages" })} className="group block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-primary">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600"><PhoneCall className="h-3 w-3" /></div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-900">Recent Call</span>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-slate-700">Open call queue</p>
                    <p className="mt-1 text-[10px] font-medium text-slate-400">Latest call linked to this customer thread</p>
                  </Link>
                ) : null}
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-primary/5 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary/70">AI Sentiment</h4>
                </div>
                <p className="text-xs font-medium italic leading-relaxed text-slate-700">
                  &ldquo;{selectedThread.frontDesk?.summary || selectedThread.lead?.frontDesk?.summary || "Customer context is available here for operator review."}&rdquo;
                </p>
              </div>

              <div className="space-y-2">
                {canEdit && selectedThread.leadId ? (
                  <>
                    <Button className="w-full justify-between" variant="outline" disabled={savingStage === "NEEDS_SCHEDULING"} onClick={() => void setStage("NEEDS_SCHEDULING")}>
                      <span className="flex items-center gap-3"><Tag className="h-4 w-4" /> Schedule appointment</span>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button className="w-full justify-between" variant="outline" disabled={savingStage === "COMPLETED"} onClick={() => void setStage("COMPLETED")}>
                      <span className="flex items-center gap-3"><Archive className="h-4 w-4" /> Archive thread</span>
                    </Button>
                  </>
                ) : null}
                {selectedThread.leadId ? (
                  <Button asChild className="w-full justify-start" variant="outline">
                    <Link href={buildWorkflowHref(`/app/leads?leadId=${encodeURIComponent(selectedThread.leadId)}`, { source: "messages", returnTo: localReturnTo, returnLabel: "Messages" })}>Open lead queue</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
      </div>
    </div>
  );
}


