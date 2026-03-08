"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { fetchOrgMessages, fetchOrgMessagingReadiness, getBillingStatus, sendOrgMessage } from "@/lib/api";
import { clientBadgeClass } from "@/lib/client-badges";
import { resolvePlanFeatures } from "@/lib/plan-features";
import type { OrgMessageThread, OrgMessagingReadiness } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";

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

export default function AppMessagesPage() {
  const { showToast } = useToast();
  const [threads, setThreads] = useState<OrgMessageThread[]>([]);
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState<string | null>(null);
  const [assignedNumberProvider, setAssignedNumberProvider] = useState<"TWILIO" | "VAPI" | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
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
      setSelectedId((current) => current || data.threads[0]?.id || "");
    } catch {
      setThreads([]);
      setAssignedPhoneNumber(null);
      setAssignedNumberProvider(null);
      setSubscriptionPlan(null);
      setSubscriptionStatus(null);
      setCanSendMessages(false);
      setMessagingReadiness(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => threads.find((thread) => thread.id === selectedId) || null, [threads, selectedId]);

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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Manage SMS threads, automated follow-up, and booking-related text conversations in one inbox.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
        >
          Refresh
        </button>
      </div>

      <div className="rounded-lg border bg-amber-50 p-3 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-medium">
          <Lock className="h-4 w-4" />
          Messaging automation is a <strong>Pro</strong> feature.
        </div>
        {" "}Current plan: <strong>{subscriptionPlan || "NONE"}</strong>
        {" "}({subscriptionStatus || "inactive"}).
        {" "}If sending is disabled, upgrade from <Link className="underline" href="/app/billing">Billing</Link>.
      </div>
      <div className="rounded-lg border bg-white p-3 text-sm">
        Assigned number: <span className="font-medium">{assignedPhoneNumber || "Not assigned"}</span>
        {assignedNumberProvider ? ` (${assignedNumberProvider})` : ""}
      </div>
      <div className="rounded-lg border bg-white p-3 text-sm">
        Messaging readiness: <span className="font-medium">{messagingReadiness?.state || "Unknown"}</span>
        {messagingReadiness?.reasons?.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {messagingReadiness.reasons.slice(0, 3).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-lg border bg-white">
          <div className="border-b p-3 text-sm font-semibold">Threads</div>
          <div className="max-h-[560px] overflow-auto">
            {!threads.length ? (
              <p className="p-3 text-sm text-muted-foreground">No messages yet.</p>
            ) : (
              threads.map((thread) => (
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
                      className={`w-full border-b p-3 text-left hover:bg-muted/40 ${
                        selectedId === thread.id ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{thread.contactName || thread.lead?.name || "Unknown contact"}</p>
                          <p className="text-xs text-muted-foreground">{thread.contactPhone}</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
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
                      <p className="mt-1 text-xs text-muted-foreground">Last: {formatWhen(thread.lastMessageAt)}</p>
                    </button>
                  );
                })()
              ))
            )}
          </div>
        </aside>

        <section className="space-y-3">
          <div className="rounded-lg border bg-white p-3">
            <div className="grid gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">To</label>
              <input
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="+15163067876"
                disabled={!canSendMessages || sending}
                className="rounded-md border px-3 py-2 text-sm"
              />
              <label className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Message</label>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Type an outbound message..."
                disabled={!canSendMessages || sending}
                className="min-h-[92px] rounded-md border px-3 py-2 text-sm"
              />
              <div>
                <button
                  type="button"
                  onClick={() => void onSend()}
                  disabled={sending || !canSendMessages}
                  title={!canSendMessages ? "Upgrade to Pro to enable outbound SMS." : "Send message"}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {!canSendMessages ? "Upgrade to Pro to send" : sending ? "Sending..." : "Send message"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white">
            <div className="border-b p-3 text-sm font-semibold">Conversation</div>
            <div className="max-h-[440px] space-y-2 overflow-auto p-3">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Select a thread to view messages.</p>
              ) : !selected.messages.length ? (
                <p className="text-sm text-muted-foreground">No messages in this thread yet.</p>
              ) : (
                [...selected.messages]
                  .reverse()
                  .map((message) => {
                    const badge = getMessageBadge(message);
                    return (
                      <div
                        key={message.id}
                        className={`max-w-[82%] rounded-lg border px-3 py-2 text-sm ${
                          message.direction === "OUTBOUND" ? "ml-auto bg-blue-50" : "bg-zinc-50"
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${clientBadgeClass(badge.tone)}`}>
                            {badge.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {message.direction === "OUTBOUND" ? "Office -> Customer" : "Customer -> Office"}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{message.body}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {message.status} | {formatWhen(message.createdAt)}
                        </p>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
