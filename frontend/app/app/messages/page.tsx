"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, Search, SendHorizontal } from "lucide-react";
import { fetchOrgMessages, fetchOrgMessagingReadiness, getBillingStatus, sendOrgMessage } from "@/lib/api";
import { clientBadgeClass } from "@/lib/client-badges";
import { resolvePlanFeatures } from "@/lib/plan-features";
import type { OrgMessageThread, OrgMessagingReadiness } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";

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

function getThreadStateBadge(thread: OrgMessageThread) {
  const frontDesk = threadFrontDesk(thread);
  if (frontDesk?.state === "needs_follow_up") return { label: "Needs follow-up", tone: "warning" as const };
  if (frontDesk?.state === "contacted") return { label: "Contacted", tone: "pending" as const };
  if (frontDesk?.state === "booked") return { label: "Booked", tone: "booking" as const };
  if (frontDesk?.state === "closed") return { label: "Closed", tone: "success" as const };
  if (frontDesk?.state === "spam") return { label: "Spam", tone: "neutral" as const };
  return null;
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

export default function AppMessagesPage() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const deepLinkedThreadId = searchParams.get("threadId") || "";
  const [threads, setThreads] = useState<OrgMessageThread[]>([]);
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState<string | null>(null);
  const [assignedNumberProvider, setAssignedNumberProvider] = useState<"TWILIO" | "VAPI" | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [canSendMessages, setCanSendMessages] = useState(false);
  const [messagingReadiness, setMessagingReadiness] = useState<OrgMessagingReadiness | null>(null);

  const load = useCallback(async () => {
    try {
      const [messagesData, billingData, readinessData] = await Promise.all([
        fetchOrgMessages(),
        getBillingStatus(),
        fetchOrgMessagingReadiness()
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

      const data = messagesData;
      setThreads(data.threads);
      setAssignedPhoneNumber(data.assignedPhoneNumber);
      setAssignedNumberProvider(data.assignedNumberProvider);
      setSelectedId((current) => {
        if (deepLinkedThreadId) {
          return data.threads.some((thread) => thread.id === deepLinkedThreadId) ? deepLinkedThreadId : current || data.threads[0]?.id || "";
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
    }
  }, [deepLinkedThreadId]);

  useEffect(() => {
    if (!deepLinkedThreadId) return;
    setSelectedId(deepLinkedThreadId);
  }, [deepLinkedThreadId]);

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
            threadFrontDesk(thread)?.recommendedAction || ""
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        );
    return [...matched].sort((a, b) => {
      const priorityDelta = frontDeskPriorityWeight(a) - frontDeskPriorityWeight(b);
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
  }, [search, threads]);
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client inbox"
        title="Messages"
        description="Review SMS threads, send manual follow-up when needed, and keep booking conversations in one clear inbox."
        actions={
          <Button type="button" variant="outline" onClick={() => void load()}>
            Refresh inbox
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_320px]">
        <Card className={canSendMessages ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70"}>
          <CardContent className={`px-5 py-6 text-sm sm:px-6 sm:py-5 ${canSendMessages ? "text-emerald-950" : "text-amber-950"}`}>
            <div className="flex items-start gap-3">
              {canSendMessages ? <SendHorizontal className="mt-1 h-4 w-4 shrink-0" /> : <Lock className="mt-1 h-4 w-4 shrink-0" />}
              <div className="space-y-2">
                <p className="font-semibold">{canSendMessages ? "Outbound messaging is live." : "Messaging automation is a Pro feature."}</p>
                <p className={canSendMessages ? "text-emerald-900/90" : "text-amber-900/90"}>
                  Current plan: <strong>{subscriptionPlan || "NONE"}</strong> ({subscriptionStatus || "inactive"}).{" "}
                  {canSendMessages ? (
                    <>Use this inbox to review threads, reply manually, and keep booking conversations moving.</>
                  ) : (
                    <>
                      If sending is disabled, upgrade from <Link className="underline" href="/app/billing">Billing</Link>.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-black/5 bg-white/65 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Threads</p>
                <p className="mt-2 text-2xl font-semibold">{threads.length}</p>
              </div>
              <div className="rounded-xl border border-black/5 bg-white/65 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Action needed</p>
                <p className="mt-2 text-2xl font-semibold">{threadsWithActionNeeded}</p>
              </div>
              <div className="rounded-xl border border-black/5 bg-white/65 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selected</p>
                <p className="mt-2 truncate text-sm font-semibold">{selected?.contactName || selected?.contactPhone || "No thread selected"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-3 p-5 text-sm">
            <div>
              <p className="page-eyebrow">Assigned number</p>
              <p className="mt-2 font-semibold text-foreground">{assignedPhoneNumber || "Not assigned"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{assignedNumberProvider ? `Provider: ${assignedNumberProvider}` : "No provider connected yet."}</p>
            </div>
            <div className="border-t pt-3">
              <p className="page-eyebrow">Messaging readiness</p>
              <p className="mt-2 font-semibold text-foreground">{messagingReadiness?.state || "Unknown"}</p>
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

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] xl:gap-5">
        <Card className="self-start overflow-hidden">
          <CardHeader className="pb-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg">Threads</CardTitle>
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
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[620px] overflow-auto">
            {!filteredThreads.length ? (
              <div className="empty-state m-5">
                SMS follow-up threads will appear here after missed-call recovery, appointment offers, or customer replies.
              </div>
            ) : (
              filteredThreads.map((thread) => (
                (() => {
                  const primaryBadge = getThreadPrimaryBadge(thread);
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
                        selectedId === thread.id ? "bg-primary/[0.06]" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{thread.contactName || thread.lead?.name || "Unknown contact"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{thread.contactPhone}</p>
                          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{getLatestMessagePreview(thread)}</p>
                          {threadFrontDesk(thread)?.summary ? (
                            <p className="mt-2 line-clamp-2 text-xs text-foreground/80">{threadFrontDesk(thread)?.summary}</p>
                          ) : null}
                          <p className="mt-2 text-[11px] text-muted-foreground">Last update {formatWhen(thread.lastMessageAt)}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                          {getThreadStateBadge(thread) ? (
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${clientBadgeClass(getThreadStateBadge(thread)!.tone)}`}>
                              {getThreadStateBadge(thread)!.label}
                            </span>
                          ) : null}
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${clientBadgeClass(primaryBadge.tone)}`}>
                            {primaryBadge.label}
                          </span>
                          {deliveryBadge ? (
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${clientBadgeClass(deliveryBadge.tone)}`}>
                              {deliveryBadge.label}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {threadFrontDesk(thread)?.recommendedAction ? (
                        <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                          Next action: {threadFrontDesk(thread)?.recommendedAction}
                        </p>
                      ) : null}
                    </button>
                  );
                })()
              ))
            )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <Card className="self-start">
            <CardHeader className="pb-3">
              <div className="space-y-1">
                <CardTitle className="text-lg">Compose message</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Send a manual follow-up to the selected contact or type any number directly.
                  </p>
                  {selected && threadFrontDesk(selected)?.recommendedAction ? (
                    <p className="text-xs text-muted-foreground">
                      Recommended action: {threadFrontDesk(selected)?.recommendedAction}
                    </p>
                  ) : null}
                </div>
            </CardHeader>
            <CardContent className="grid gap-3">
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
                  className="min-h-[148px] rounded-xl border bg-background px-3 py-3 text-sm"
              />
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  onClick={() => void onSend()}
                  disabled={sending || !canSendMessages}
                  title={!canSendMessages ? "Upgrade to Pro to enable outbound SMS." : "Send message"}
                >
                  {!canSendMessages ? "Upgrade to Pro to send" : sending ? "Sending..." : "Send message"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="pb-3">
              <div className="space-y-1">
                <CardTitle className="text-lg">Conversation</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {selected ? `${selected.contactName || selected.lead?.name || "Unknown contact"} • ${selected.contactPhone}` : "Select a thread to inspect the full conversation."}
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-h-[620px] space-y-3 overflow-auto pr-1">
              {!selected ? (
                <div className="empty-state">Select a thread to review the conversation and decide the next follow-up action.</div>
              ) : !selected.messages.length ? (
                <div className="empty-state">This thread has no messages yet. New inbound replies or outbound follow-up will appear here.</div>
              ) : (
                <>
                {threadFrontDesk(selected) ? (
                  <div className="rounded-2xl border bg-slate-50/80 p-4">
                    <p className="page-eyebrow">Front-desk summary</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Request</p>
                        <p className="mt-1 text-sm text-foreground">{threadFrontDesk(selected)?.summary || "No structured summary yet."}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Next action</p>
                        <p className="mt-1 text-sm text-foreground">{threadFrontDesk(selected)?.recommendedAction || "Review thread"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Follow-up state</p>
                        <p className="mt-1 text-sm text-foreground">{getThreadStateBadge(selected)?.label || "Open"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Priority</p>
                        <p className="mt-1 text-sm text-foreground">{threadFrontDesk(selected)?.frontDeskPriority || "normal"}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
                {[...selected.messages]
                  .reverse()
                  .map((message) => {
                    const badge = getMessageBadge(message);
                    return (
                      <div
                        key={message.id}
                        className={`max-w-[85%] rounded-2xl border px-4 py-3 text-sm ${
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
