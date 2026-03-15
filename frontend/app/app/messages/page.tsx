"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, SendHorizontal } from "lucide-react";
import { fetchOrgMessages, fetchOrgMessagingReadiness, getBillingStatus, getMe, sendOrgMessage, updateLeadPipelineStage } from "@/lib/api";
import { clientBadgeClass } from "@/lib/client-badges";
import { resolvePlanFeatures } from "@/lib/plan-features";
import type { OrgMessageThread, OrgMessagingReadiness } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientGateCard, ClientModuleTabs, ClientStatusGrid } from "@/components/ui/client-module";
import { PageHeader, WorkflowHint } from "@/components/ui/page";
import { connectedNumberProviderDetail, connectedNumberProviderLabel, messagingReadinessLabel, messagingReadinessTone, subscriptionStatusLabel } from "@/lib/client-status-language";
import {
  frontDeskActionBadgeClass,
  frontDeskContextPanelClass,
  frontDeskEmptyStateClass,
  frontDeskLoadingCardClass,
  frontDeskOutcomeSurfaceClass,
  frontDeskOutcomeBadgeMeta,
  frontDeskPriorityMeta,
  frontDeskWorkspaceCardClass,
  frontDeskSkeletonLineClass
} from "@/lib/front-desk-ui";

type ThreadFilter = "ALL" | "needs_follow_up" | "contacted" | "booked" | "closed" | "spam";
type PipelineStage = "NEEDS_SCHEDULING" | "SCHEDULED" | "COMPLETED";

function normalizePhoneMatch(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function isPlaceholderName(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return !normalized || normalized === "unknown contact" || normalized === "unknown caller" || normalized === "not provided";
}

function extractNameFromSummary(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return null;
  const calledMatch = text.match(/^(.+?) called\b/i);
  if (calledMatch?.[1]) return calledMatch[1].trim();
  const quoteMatch = text.match(/^["']?([^"']{2,60})["']?\s+(?:requested|needs|asked)/i);
  if (quoteMatch?.[1]) return quoteMatch[1].trim();
  return null;
}

function frontDeskPriorityWeight(thread: OrgMessageThread) {
  const priority = thread.frontDesk?.frontDeskPriority || thread.lead?.frontDesk?.frontDeskPriority;
  if (priority === "urgent") return 0;
  if (priority === "high") return 1;
  if (priority === "normal") return 2;
  return 3;
}

function threadFrontDesk(thread: OrgMessageThread) {
  return thread.frontDesk || thread.lead?.frontDesk || null;
}

function threadDisplayName(thread: OrgMessageThread) {
  if (!isPlaceholderName(thread.contactName)) return String(thread.contactName).trim();
  if (!isPlaceholderName(thread.lead?.name)) return String(thread.lead?.name).trim();
  return extractNameFromSummary(threadFrontDesk(thread)?.summary) || "Unknown contact";
}

function threadDisplayAction(thread: OrgMessageThread) {
  const action = threadNextActionLabel(thread);
  if ((action === "No action needed" || action === "Ignore") && threadQuickActions(thread).length) {
    return threadQuickActions(thread)[0].label;
  }
  return action;
}

function threadDisplaySummary(thread: OrgMessageThread) {
  return threadFrontDesk(thread)?.summary || getLatestMessagePreview(thread);
}

function threadStateWeight(thread: OrgMessageThread) {
  const state = threadFrontDesk(thread)?.state;
  if (state === "needs_follow_up") return 0;
  if (state === "contacted") return 1;
  if (state === "booked") return 2;
  if (state === "closed") return 3;
  if (state === "spam") return 4;
  return 1;
}

function getThreadStateBadge(thread: OrgMessageThread) {
  const frontDesk = threadFrontDesk(thread);
  if (frontDesk?.state === "needs_follow_up") return { label: "Needs follow-up", tone: "warning" as const };
  if (frontDesk?.state === "contacted") return { label: "Contacted", tone: "pending" as const };
  if (frontDesk?.state === "booked") return { label: "Booked", tone: "booking" as const };
  if (frontDesk?.state === "closed") return { label: "Resolved", tone: "success" as const };
  if (frontDesk?.state === "spam") return { label: "Spam", tone: "neutral" as const };
  return null;
}

function threadFilterLabel(value: ThreadFilter) {
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
      return "All";
  }
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString();
}

function containsBookingLanguage(value: string) {
  return /appointment|slot|schedule|opening|reply with|confirm|book/i.test(value);
}

function containsAutomationLanguage(value: string) {
  return /thanks for calling|team will|follow up|request received|next available|service update/i.test(value);
}

function getThreadPrimaryBadge(thread: OrgMessageThread) {
  const messages = thread.messages || [];
  const hasBookingLanguage = messages.some((message) => containsBookingLanguage(message.body));
  const hasAutomationLanguage = messages.some((message) => message.direction === "OUTBOUND" && containsAutomationLanguage(message.body));

  if (hasBookingLanguage) return { label: "Booking", tone: "booking" as const };
  if (hasAutomationLanguage) return { label: "Automated", tone: "automated" as const };
  return { label: "Manual", tone: "manual" as const };
}

function getThreadDeliveryBadge(thread: OrgMessageThread) {
  const outboundMessages = [...thread.messages].filter((message) => message.direction === "OUTBOUND");
  if (!outboundMessages.length) return null;
  if (outboundMessages.some((message) => message.status === "FAILED")) {
    return { label: "Failed", tone: "failed" as const };
  }
  const latestOutbound = outboundMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (latestOutbound.status === "QUEUED" || latestOutbound.status === "SENT") {
    return { label: "Pending", tone: "pending" as const };
  }
  return null;
}

function getMessageBadge(message: OrgMessageThread["messages"][number]) {
  if (message.status === "FAILED") return { label: "Failed", tone: "failed" as const };
  if (message.status === "QUEUED" || message.status === "SENT") return { label: "Pending", tone: "pending" as const };
  if (message.direction === "OUTBOUND" && containsBookingLanguage(message.body)) return { label: "Booking", tone: "booking" as const };
  if (message.direction === "OUTBOUND" && containsAutomationLanguage(message.body)) return { label: "Automated", tone: "automated" as const };
  if (message.direction === "OUTBOUND") return { label: "Manual", tone: "manual" as const };
  return { label: "Reply", tone: "neutral" as const };
}

function getLatestMessagePreview(thread: OrgMessageThread) {
  const latest = [...thread.messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (!latest?.body) return "No message preview yet.";
  return latest.body.length > 88 ? `${latest.body.slice(0, 88).trim()}...` : latest.body;
}

function latestThreadDirection(thread: OrgMessageThread) {
  const latest = [...thread.messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (!latest) return "No recent messages";
  return latest.direction === "INBOUND" ? "Customer replied" : "Office sent follow-up";
}

function threadNextActionLabel(thread: OrgMessageThread) {
  if (thread.latestAppointmentRequestId && latestThreadDirection(thread) === "Customer replied") {
    return "Review reply";
  }
  return threadFrontDesk(thread)?.recommendedAction || "Review thread";
}

function threadWorkTypeLabel(thread: OrgMessageThread) {
  const action = threadFrontDesk(thread)?.recommendedAction;
  const state = threadFrontDesk(thread)?.state;
  if (action === "Call back now") return "Callback";
  if (action === "Offer times") return "Scheduling";
  if (state === "booked") return "Booked work";
  if (state === "closed") return "Resolved";
  if (state === "spam") return "Spam";
  return "General follow-up";
}

function threadPriorityLabel(thread: OrgMessageThread) {
  return frontDeskPriorityMeta(threadFrontDesk(thread)?.frontDeskPriority).label;
}

function threadStateLabel(thread: OrgMessageThread) {
  return getThreadStateBadge(thread)?.label || "Open";
}

function threadQuickActions(thread: OrgMessageThread | null): Array<{ label: string; stage: PipelineStage; tone: "default" | "outline" }> {
  if (!thread?.leadId) return [];
  const state = threadFrontDesk(thread)?.state;
  const action = threadFrontDesk(thread)?.recommendedAction;
  if (state === "booked") {
    return [
      { label: "Mark booked", stage: "SCHEDULED", tone: "default" },
      { label: "Mark resolved", stage: "COMPLETED", tone: "outline" }
    ];
  }
  if (state === "contacted" || action === "Offer times") {
    return [
      { label: "Schedule appointment", stage: "NEEDS_SCHEDULING", tone: "default" },
      { label: "Mark booked", stage: "SCHEDULED", tone: "outline" }
    ];
  }
  return [
    { label: "Schedule appointment", stage: "NEEDS_SCHEDULING", tone: "default" },
    { label: "Mark resolved", stage: "COMPLETED", tone: "outline" }
  ];
}

function threadOutcomeNote(thread: OrgMessageThread | null) {
  if (!thread) return null;
  const state = threadFrontDesk(thread)?.state;
  if (state === "booked") {
    return "This conversation is already tied to booked work. Review the thread only if the office needs to confirm the appointment details.";
  }
  if (state === "closed") {
    return "This conversation is already resolved. Review it only if the office needs to revisit the outcome.";
  }
  return null;
}

function threadOutcomeListNote(thread: OrgMessageThread) {
  const state = threadFrontDesk(thread)?.state;
  if (state === "booked") return "Booked work already confirmed.";
  if (state === "closed") return "Handled and resolved by the office.";
  if (latestThreadDirection(thread) === "Customer replied") return "Saved lead with a live customer reply.";
  return null;
}

function threadOutcomeBadge(thread: OrgMessageThread) {
  const state = threadFrontDesk(thread)?.state;
  if (state === "booked") return frontDeskOutcomeBadgeMeta("booked");
  if (state === "closed") return frontDeskOutcomeBadgeMeta("resolved");
  if (latestThreadDirection(thread) === "Customer replied") return frontDeskOutcomeBadgeMeta("saved");
  return null;
}

export default function AppMessagesPage() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const deepLinkedThreadId = searchParams.get("threadId") || "";
  const deepLinkedContactPhone = searchParams.get("contactPhone") || "";
  const [threads, setThreads] = useState<OrgMessageThread[]>([]);
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState<string | null>(null);
  const [assignedNumberProvider, setAssignedNumberProvider] = useState<"TWILIO" | "VAPI" | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [threadFilter, setThreadFilter] = useState<ThreadFilter>("ALL");
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [canSendMessages, setCanSendMessages] = useState(false);
  const [messagingReadiness, setMessagingReadiness] = useState<OrgMessagingReadiness | null>(null);
  const [canEditPipeline, setCanEditPipeline] = useState(false);
  const [savingLeadStage, setSavingLeadStage] = useState<PipelineStage | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [messagesData, billingData, readinessData, me] = await Promise.all([
        fetchOrgMessages(),
        getBillingStatus(),
        fetchOrgMessagingReadiness(),
        getMe()
      ]);
      const subscription = billingData.subscription;
      const featureAccess = resolvePlanFeatures({
        plan: subscription?.plan,
        status: subscription?.status
      });

      setSubscriptionPlan(featureAccess.plan);
      setSubscriptionStatus(subscription?.status || null);
      setCanSendMessages(featureAccess.messaging);
      setMessagingReadiness(readinessData);
      setCanEditPipeline(["CLIENT_STAFF", "CLIENT_ADMIN", "ADMIN", "SUPER_ADMIN"].includes(me.user.role));

      const data = messagesData;
      setThreads(data.threads);
      setAssignedPhoneNumber(data.assignedPhoneNumber);
      setAssignedNumberProvider(data.assignedNumberProvider);
      setSelectedId((current) => {
        if (deepLinkedThreadId) {
          return data.threads.some((thread) => thread.id === deepLinkedThreadId) ? deepLinkedThreadId : current || data.threads[0]?.id || "";
        }
        if (deepLinkedContactPhone) {
          const matchedThread = data.threads.find(
            (thread) => normalizePhoneMatch(thread.contactPhone) === normalizePhoneMatch(deepLinkedContactPhone)
          );
          if (matchedThread) return matchedThread.id;
        }
        return current || data.threads[0]?.id || "";
      });
    } catch {
      setThreads([]);
      setAssignedPhoneNumber(null);
      setAssignedNumberProvider(null);
      setSubscriptionPlan(null);
      setSubscriptionStatus(null);
      setCanSendMessages(false);
      setMessagingReadiness(null);
      setCanEditPipeline(false);
    } finally {
      setLoading(false);
    }
  }, [deepLinkedContactPhone, deepLinkedThreadId]);

  useEffect(() => {
    if (deepLinkedThreadId) {
      setSelectedId(deepLinkedThreadId);
      return;
    }
    if (!deepLinkedContactPhone) return;
    setSelectedId((current) => {
      const matchedThread = threads.find(
        (thread) => normalizePhoneMatch(thread.contactPhone) === normalizePhoneMatch(deepLinkedContactPhone)
      );
      return matchedThread?.id || current;
    });
  }, [deepLinkedContactPhone, deepLinkedThreadId, threads]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => threads.find((thread) => thread.id === selectedId) || null, [threads, selectedId]);
  const filteredThreads = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matched = !query
      ? threads
      : threads.filter((thread) =>
          [
            thread.contactName,
            thread.lead?.name,
            thread.contactPhone,
            getLatestMessagePreview(thread),
            threadFrontDesk(thread)?.summary || "",
            threadNextActionLabel(thread)
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        );
    return [...matched]
      .filter((thread) => {
        if (threadFilter === "ALL") return true;
        return (threadFrontDesk(thread)?.state || "closed") === threadFilter;
      })
      .sort((a, b) => {
        const stateDelta = threadStateWeight(a) - threadStateWeight(b);
        if (stateDelta !== 0) return stateDelta;
        const priorityDelta = frontDeskPriorityWeight(a) - frontDeskPriorityWeight(b);
        if (priorityDelta !== 0) return priorityDelta;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
  }, [search, threadFilter, threads]);
  const threadsWithActionNeeded = useMemo(
    () =>
      threads.filter(
        (thread) =>
          getThreadDeliveryBadge(thread)?.tone === "failed" ||
          getThreadPrimaryBadge(thread).tone === "booking" ||
          threadFrontDesk(thread)?.needsFollowUp
      ).length,
    [threads]
  );

  async function onSend() {
    if (!canSendMessages) {
      showToast({
        title: "Pro required",
        description: "Outbound messaging is available on Pro with an active subscription.",
        variant: "error"
      });
      return;
    }
    if (!to.trim() || !body.trim()) {
      showToast({ title: "Missing fields", description: "Add recipient and message body.", variant: "error" });
      return;
    }
    setSending(true);
    try {
      await sendOrgMessage({
        to: to.trim(),
        body: body.trim(),
        leadId: selected?.leadId || undefined
      });
      setBody("");
      await load();
      showToast({ title: "Message queued" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send message.";
      showToast({
        title: "Send failed",
        description: message,
        variant: "error"
      });
    } finally {
      setSending(false);
    }
  }

  async function onQuickAction(stage: PipelineStage) {
    if (!selected?.leadId || !canEditPipeline) return;
    setSavingLeadStage(stage);
    try {
      await updateLeadPipelineStage(selected.leadId, stage);
      await load();
      showToast({ title: "Follow-up state updated" });
    } catch (error) {
      showToast({
        title: "Could not update lead state",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSavingLeadStage(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reply workspace"
        title="Inbox"
        description="Use this page when the newest customer movement is a text reply. Review the thread, send follow-up, and move booking conversations forward without losing context."
        actions={
          <Button type="button" variant="outline" onClick={() => void load()}>
            Refresh inbox
          </Button>
        }
      />

      <ClientModuleTabs
        items={[
          { value: "ALL", label: "All threads", badge: threads.length },
          { value: "needs_follow_up", label: "Needs reply", badge: threads.filter((thread) => (threadFrontDesk(thread)?.state || "closed") === "needs_follow_up").length },
          { value: "contacted", label: "Contacted", badge: threads.filter((thread) => (threadFrontDesk(thread)?.state || "closed") === "contacted").length },
          { value: "booked", label: "Booked", badge: threads.filter((thread) => (threadFrontDesk(thread)?.state || "closed") === "booked").length },
          { value: "closed", label: "Resolved", badge: threads.filter((thread) => (threadFrontDesk(thread)?.state || "closed") === "closed").length }
        ]}
        value={threadFilter}
        onChange={setThreadFilter}
      />

      <WorkflowHint
        items={[
          { label: "Use this page", text: "Stay in Inbox when the newest customer movement is a text reply or a manual follow-up conversation." },
          { label: "Start here", text: "Open the thread, confirm the customer case and next step, then reply from the composer on the right." },
          { label: "Go next", text: "Jump to Lead Queue or Booking Queue only when this reply needs broader follow-up or scheduling." }
        ]}
      />

      <ClientStatusGrid
        items={[
          {
            label: "Outbound messaging",
            value: canSendMessages ? "Active" : "Locked",
            detail: canSendMessages ? "Manual replies and outbound follow-up are available in this workspace." : "Upgrade the workspace plan before the office can send outbound texts.",
            tone: canSendMessages ? "success" : "warning"
          },
          {
            label: connectedNumberProviderLabel(assignedNumberProvider),
            value: assignedPhoneNumber || "Not assigned",
            detail: connectedNumberProviderDetail(assignedNumberProvider),
            tone: assignedPhoneNumber ? "success" : "warning"
          },
          {
            label: "Messaging readiness",
            value: messagingReadinessLabel(messagingReadiness?.state),
            detail: messagingReadiness?.reasons?.[0] || "No delivery blockers are currently surfaced.",
            tone: messagingReadinessTone(messagingReadiness?.state)
          },
          {
            label: "Subscription",
            value: subscriptionPlan || "No plan",
            detail: subscriptionStatusLabel(subscriptionStatus),
            tone: canSendMessages ? "success" : "pending"
          }
        ]}
      />

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_320px]">
        {canSendMessages ? (
          <Card className={`${frontDeskWorkspaceCardClass("hero")} border-emerald-200/90 bg-[linear-gradient(135deg,rgba(236,253,245,0.98)_0%,rgba(209,250,229,0.92)_100%)]`}>
            <CardContent className="px-5 py-6 text-sm text-emerald-950 sm:px-6 sm:py-5">
              <div className="flex items-start gap-3">
                <SendHorizontal className="mt-1 h-4 w-4 shrink-0" />
                <div className="space-y-2">
                  <p className="font-semibold">Outbound messaging is live.</p>
                  <p className="text-emerald-900/90">
                    Use this inbox to review replies, send manual follow-up, and keep booking conversations moving without losing the customer context.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-black/5 bg-white/[0.65] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Threads</p>
                  <p className="mt-2 text-2xl font-semibold">{threads.length}</p>
                </div>
                <div className="rounded-xl border border-black/5 bg-white/[0.65] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Needs attention</p>
                  <p className="mt-2 text-2xl font-semibold">{threadsWithActionNeeded}</p>
                </div>
                <div className="rounded-xl border border-black/5 bg-white/[0.65] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selected thread</p>
                  <p className="mt-2 truncate text-sm font-semibold">{selected ? threadDisplayName(selected) || selected.contactPhone : "No thread selected"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ClientGateCard
            title="Outbound texting is locked on the current plan."
            description="You can still review customer replies here, but the office cannot send outbound texts until messaging is unlocked in Billing."
            badgeLabel="Locked"
            badgeTone="warning"
            actions={[{ href: "/app/billing", label: "Open Billing" }]}
          />
        )}
        <Card className={frontDeskWorkspaceCardClass("subtle")}>
          <CardContent className="grid gap-3 p-5 text-sm">
            <div>
              <p className="page-eyebrow">Connected number</p>
              <p className="mt-2 font-semibold text-foreground">{assignedPhoneNumber || "Not assigned"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{assignedNumberProvider ? "Ready for live customer threads." : "Connect a business number before relying on this inbox for live follow-up."}</p>
            </div>
            <div className="border-t pt-3">
              <p className="page-eyebrow">Messaging readiness</p>
              <p className="mt-2 font-semibold text-foreground">{messagingReadinessLabel(messagingReadiness?.state)}</p>
              {messagingReadiness?.reasons?.length ? (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {messagingReadiness.reasons.slice(0, 2).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">No blocking issues detected.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)] 2xl:gap-5">
        <Card className={`${frontDeskWorkspaceCardClass("default")} self-start overflow-hidden`}>
          <CardHeader className="pb-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Threads</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Customer replies and follow-up conversations.</p>
                </div>
                <span className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {filteredThreads.length}
                </span>
              </div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search contact or message"
                  className="h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm"
                />
              </label>
              <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-slate-700">
                {threadFilter === "ALL"
                  ? "Showing every active and resolved conversation in one inbox view."
                  : `${threadFilterLabel(threadFilter)} threads only. Use the subtab row above to jump between work modes quickly.`}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[620px] overflow-auto">
            {loading ? (
              <div className="m-5 space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className={frontDeskLoadingCardClass()}>
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
                      <div className="h-6 w-32 animate-pulse rounded-full bg-slate-200/90" />
                      <div className={frontDeskSkeletonLineClass()} />
                    </div>
                  </div>
                ))}
              </div>
            ) : !filteredThreads.length ? (
              <div className={`${frontDeskEmptyStateClass()} m-5`}>
                No SMS conversations are active yet. Missed-call recovery texts, booking replies, and customer follow-up threads will appear here when the office needs to respond.
              </div>
            ) : (
              filteredThreads.map((thread) => (
                (() => {
                  const deliveryBadge = getThreadDeliveryBadge(thread);
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(thread.id);
                        setTo(thread.contactPhone || "");
                      }}
                      className={`w-full border-t px-5 py-4 text-left transition-colors first:border-t-0 hover:bg-muted/30 ${
                        threadFrontDesk(thread)?.state === "closed"
                          ? frontDeskOutcomeSurfaceClass("resolved")
                          : threadFrontDesk(thread)?.state === "booked"
                            ? frontDeskOutcomeSurfaceClass("booked")
                            : latestThreadDirection(thread) === "Customer replied"
                              ? frontDeskOutcomeSurfaceClass("saved")
                              : frontDeskOutcomeSurfaceClass("active")
                      } ${
                        selectedId === thread.id ? "bg-primary/[0.06]" : ""
                      } ${selectedId === thread.id ? "shadow-[inset_0_0_0_1px_rgba(31,58,138,0.14)]" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">{threadDisplayName(thread)}</p>
                            {threadOutcomeBadge(thread) ? (
                              <Badge className={clientBadgeClass(threadOutcomeBadge(thread)!.tone)}>{threadOutcomeBadge(thread)!.label}</Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{thread.contactPhone}</p>
                          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Next step</p>
                          <p className="mt-1 text-sm font-semibold text-slate-950">{threadDisplayAction(thread)}</p>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-800">{threadDisplaySummary(thread)}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{threadWorkTypeLabel(thread)}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span>{threadPriorityLabel(thread)}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span>{threadStateLabel(thread)}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span>{latestThreadDirection(thread)}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span>Updated {formatWhen(thread.lastMessageAt)}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${frontDeskActionBadgeClass(threadDisplayAction(thread))}`}>
                            {threadDisplayAction(thread)}
                          </span>
                          {deliveryBadge ? (
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${clientBadgeClass(deliveryBadge.tone)}`}>
                              {deliveryBadge.label}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {threadOutcomeListNote(thread) ? (
                        <p className="mt-3 text-[12px] text-muted-foreground">{threadOutcomeListNote(thread)}</p>
                      ) : null}
                    </button>
                  );
                })()
              ))
            )}
            </div>
          </CardContent>
        </Card>

        <div className="min-w-0">
          <Card className={`${frontDeskWorkspaceCardClass("default")} min-w-0 overflow-hidden`}>
            <CardHeader className="pb-3">
              <div className="space-y-2">
                <CardTitle className="text-lg">Active thread workspace</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {selected ? `${threadDisplayName(selected)} • ${selected.contactPhone}` : "Select a thread to inspect the full conversation."}
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
              {loading ? (
                <div className="space-y-4">
                  <div className={frontDeskLoadingCardClass()}>
                    <div className="space-y-3">
                      <div className={frontDeskSkeletonLineClass("sm")} />
                      <div className={frontDeskSkeletonLineClass("md")} />
                      <div className={frontDeskSkeletonLineClass()} />
                    </div>
                  </div>
                  {[0, 1].map((item) => (
                    <div key={item} className={frontDeskLoadingCardClass()}>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="h-5 w-20 animate-pulse rounded-full bg-slate-200/90" />
                          <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200/90" />
                        </div>
                        <div className={frontDeskSkeletonLineClass()} />
                        <div className={frontDeskSkeletonLineClass("lg")} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !selected ? (
                <div className={frontDeskEmptyStateClass()}>Select a thread to review the customer context first, then decide whether the office should reply, schedule, or resolve the request.</div>
              ) : !selected.messages.length ? (
                <div className={frontDeskEmptyStateClass()}>This thread has no messages yet. New inbound replies and outbound follow-up will appear here when the conversation starts.</div>
              ) : (
                <>
                {threadFrontDesk(selected) ? (
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="space-y-4">
                      <div className={frontDeskContextPanelClass()}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-2">
                            <p className="page-eyebrow">Customer case</p>
                            <div>
                              <p className="text-xl font-semibold text-slate-950">{threadDisplayName(selected)}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{selected.contactPhone}</p>
                            </div>
                          </div>
                          <div className="min-w-[240px] rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Next step</p>
                            <p className="mt-2 text-base font-semibold text-slate-950">{threadDisplayAction(selected)}</p>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {latestThreadDirection(selected) === "Customer replied"
                                ? "Reply here first, then move to booking or lead follow-up only if the thread needs a larger action."
                                : "Review the latest office message and decide whether this thread needs another reply or can be resolved."}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Service request</p>
                            <p className="mt-2 text-sm leading-6 text-slate-900">{threadDisplaySummary(selected)}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Current status</p>
                            <dl className="mt-2 space-y-2 text-sm">
                              <div className="flex items-center justify-between gap-4">
                                <dt className="text-muted-foreground">Priority</dt>
                                <dd className="font-medium text-slate-950">{threadPriorityLabel(selected)}</dd>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <dt className="text-muted-foreground">Follow-up</dt>
                                <dd className="font-medium text-slate-950">{threadStateLabel(selected)}</dd>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <dt className="text-muted-foreground">Latest movement</dt>
                                <dd className="font-medium text-slate-950">{latestThreadDirection(selected)}</dd>
                              </div>
                              {selected.latestAppointmentRequestId ? (
                                <div className="flex items-center justify-between gap-4">
                                  <dt className="text-muted-foreground">Booking</dt>
                                  <dd className="font-medium text-slate-950">
                                    {latestThreadDirection(selected) === "Customer replied" ? "Reply in progress" : "Booking follow-up linked"}
                                  </dd>
                                </div>
                              ) : null}
                            </dl>
                          </div>
                        </div>

                        {threadOutcomeNote(selected) ? (
                          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
                            {threadOutcomeNote(selected)}
                          </div>
                        ) : null}
                      </div>

                      <div className={frontDeskWorkspaceCardClass("subtle")}>
                        <div className="border-b border-border/60 px-5 py-4">
                          <p className="page-eyebrow">Conversation timeline</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Read the actual text exchange after you confirm the customer context and next step.
                          </p>
                        </div>
                        <div className="max-h-[620px] space-y-3 overflow-auto px-5 py-4 pr-4">
                          {[...selected.messages]
                            .reverse()
                            .map((message) => {
                              const badge = getMessageBadge(message);
                              return (
                                <div
                                  key={message.id}
                                  className={`max-w-full sm:max-w-[85%] rounded-2xl border px-4 py-3 text-sm ${
                                    message.direction === "OUTBOUND" ? "ml-auto bg-blue-50/70" : "bg-zinc-50/70"
                                  }`}
                                >
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${clientBadgeClass(badge.tone)}`}>
                                      {badge.label}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {message.direction === "OUTBOUND" ? "Office to customer" : "Customer to office"}
                                    </span>
                                  </div>
                                  <p className="whitespace-pre-wrap leading-6">{message.body}</p>
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {message.status} | {formatWhen(message.createdAt)}
                                  </p>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {selected.leadId && canEditPipeline ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                          <p className="page-eyebrow">Quick actions</p>
                          <div className="mt-3 grid gap-2">
                            {threadQuickActions(selected).map((action) => (
                              <Button
                                key={`${selected.id}-${action.stage}`}
                                size="sm"
                                variant={action.tone}
                                className="justify-start"
                                disabled={savingLeadStage === action.stage}
                                onClick={() => void onQuickAction(action.stage)}
                              >
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {(selected.latestAppointmentRequestId || selected.leadId || selected.latestCallId) ? (
                        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                          <p className="page-eyebrow">Open related workspace</p>
                          <div className="mt-3 grid gap-2">
                            {selected.latestAppointmentRequestId ? (
                              <Button asChild size="sm" variant={latestThreadDirection(selected) === "Customer replied" ? "default" : "outline"} className="justify-start">
                                <Link href={`/app/appointments?requestId=${encodeURIComponent(selected.latestAppointmentRequestId)}`}>Open booking queue</Link>
                              </Button>
                            ) : null}
                            {selected.leadId ? (
                              <Button asChild size="sm" variant={!selected.latestAppointmentRequestId ? "default" : "outline"} className="justify-start">
                                <Link href={`/app/leads?leadId=${encodeURIComponent(selected.leadId)}`}>Open lead queue</Link>
                              </Button>
                            ) : null}
                            {selected.latestCallId ? (
                              <Button asChild size="sm" variant="outline" className="justify-start">
                                <Link href={`/app/calls?callId=${encodeURIComponent(selected.latestCallId)}`}>Open call queue</Link>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                        <div className="space-y-1">
                          <p className="page-eyebrow">Reply from inbox</p>
                          <p className="text-sm text-muted-foreground">Send a manual follow-up to the selected contact.</p>
                        </div>
                        <div className="mt-4 space-y-3">
                          <label className="grid gap-1.5 text-sm">
                            <span className="page-eyebrow">To</span>
                            <input
                              value={to}
                              onChange={(event) => setTo(event.target.value)}
                              placeholder="+15163067876"
                              disabled={!canSendMessages || sending}
                              className="h-11 rounded-xl border bg-background px-3 text-sm"
                            />
                          </label>
                          <label className="grid gap-1.5 text-sm">
                            <span className="page-eyebrow">Message</span>
                            <textarea
                              value={body}
                              onChange={(event) => setBody(event.target.value)}
                              placeholder="Type an outbound message..."
                              disabled={!canSendMessages || sending}
                              className="min-h-[220px] rounded-xl border bg-background px-3 py-3 text-sm"
                            />
                          </label>
                          <Button
                            type="button"
                            onClick={() => void onSend()}
                            disabled={sending || !canSendMessages}
                            title={!canSendMessages ? "Upgrade to Pro to enable outbound SMS." : "Send message"}
                            className="w-full"
                          >
                            {!canSendMessages ? "Upgrade to Pro to send" : sending ? "Sending..." : "Send message"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                </>
              )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
