"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchOrgMessages, getMe, sendOrgMessage } from "@/lib/api";
import type { OrgMessageThread } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
import { clientBadgeClass } from "@/lib/client-badges";

type ThreadFilter = "ALL" | "needs_follow_up" | "contacted" | "booked" | "closed" | "spam";

function threadFrontDesk(thread: OrgMessageThread) {
  return thread.frontDesk || thread.lead?.frontDesk || null;
}

function threadName(thread: OrgMessageThread) {
  return thread.contactName || thread.lead?.name || thread.contactPhone;
}

function latestPreview(thread: OrgMessageThread) {
  const latest = [...thread.messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (!latest) return "No message preview yet.";
  return latest.body.length > 90 ? `${latest.body.slice(0, 90).trim()}...` : latest.body;
}

function latestDirection(thread: OrgMessageThread) {
  const latest = [...thread.messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (!latest) return "No recent messages";
  return latest.direction === "INBOUND" ? "Customer replied" : "Office sent follow-up";
}

function nextAction(thread: OrgMessageThread) {
  if (thread.latestAppointmentRequestId && latestDirection(thread) === "Customer replied") return "Review reply";
  return threadFrontDesk(thread)?.recommendedAction || "Review thread";
}

function stateTone(thread: OrgMessageThread) {
  const state = threadFrontDesk(thread)?.state;
  if (state === "booked") return "booking" as const;
  if (state === "closed") return "success" as const;
  if (state === "spam") return "neutral" as const;
  if (state === "needs_follow_up") return "warning" as const;
  return "pending" as const;
}

function stateLabel(thread: OrgMessageThread) {
  const state = threadFrontDesk(thread)?.state;
  if (state === "needs_follow_up") return "Action needed";
  if (state === "contacted") return "In progress";
  if (state === "booked") return "Confirmed";
  if (state === "closed") return "Resolved";
  if (state === "spam") return "Spam";
  return "Open";
}

export default function AppMessagesPage() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const deepLinkedThreadId = searchParams.get("threadId") || "";
  const [threads, setThreads] = useState<OrgMessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(deepLinkedThreadId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ThreadFilter>("ALL");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [canSend, setCanSend] = useState(false);

  useEffect(() => {
    void Promise.all([fetchOrgMessages(), getMe()])
      .then(([data, me]) => {
        const rows = data.threads || [];
        setThreads(rows);
        setCanSend(["CLIENT_STAFF", "CLIENT_ADMIN", "ADMIN", "SUPER_ADMIN"].includes(me.user.role));
        setSelectedId((current) => current || rows[0]?.id || "");
      })
      .catch(() => {
        setThreads([]);
        setCanSend(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...threads]
      .filter((thread) => {
        if (filter !== "ALL" && threadFrontDesk(thread)?.state !== filter) return false;
        if (!q) return true;
        return [threadName(thread), thread.contactPhone, latestPreview(thread), nextAction(thread)].join(" ").toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }, [filter, search, threads]);

  const selected = useMemo(
    () => filtered.find((thread) => thread.id === selectedId) || filtered[0] || null,
    [filtered, selectedId]
  );

  async function onSend() {
    if (!selected || !canSend || !body.trim()) return;
    setSending(true);
    try {
      await sendOrgMessage({ to: selected.contactPhone, body: body.trim(), leadId: selected.leadId || undefined });
      showToast({ title: "Message queued" });
      setBody("");
      const refreshed = await fetchOrgMessages();
      setThreads(refreshed.threads || []);
    } catch (error) {
      showToast({ title: "Send failed", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reply workspace"
        title="Inbox"
        description="Use Inbox when the latest customer movement is a text reply and the office needs to continue the conversation without losing lead or booking context."
      />

      <div className="grid gap-0 overflow-hidden rounded-[16px] border border-slate-300 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.07)] xl:grid-cols-[340px_minmax(0,1fr)_300px]">
        <div className="border-r border-slate-200 bg-white">
          <div className="space-y-4 border-b border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-950">Messages</h2>
            </div>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations..." />
            <div className="flex gap-2">
              {[
                { label: "Action Needed", value: "needs_follow_up" },
                { label: "All", value: "ALL" },
                { label: "Resolved", value: "closed" }
              ].map((tab) => (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => setFilter(tab.value as ThreadFilter)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${
                    filter === tab.value ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[720px] overflow-auto">
            {loading ? (
              <div className="p-4 text-sm text-slate-500">Loading threads...</div>
            ) : filtered.length ? (
              filtered.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedId(thread.id)}
                  className={`w-full border-b border-slate-100 p-4 text-left transition-colors hover:bg-slate-50 ${
                    selected?.id === thread.id ? "border-l-4 border-l-blue-700 bg-blue-50/60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950">{threadName(thread)}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-600">{latestPreview(thread)}</p>
                    </div>
                    <span className="text-[10px] font-medium text-slate-500">{new Date(thread.lastMessageAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {thread.lead ? <Badge className={clientBadgeClass("pending")}>Lead: {thread.lead.name}</Badge> : null}
                    {thread.latestAppointmentRequestId ? <Badge className={clientBadgeClass("warning")}>Request linked</Badge> : null}
                    <Badge className={clientBadgeClass(stateTone(thread))}>{stateLabel(thread)}</Badge>
                  </div>
                </button>
              ))
            ) : (
              <div className="empty-state m-4">No active message threads.</div>
            )}
          </div>
        </div>

        <div className="flex min-h-[760px] flex-col bg-slate-50">
          <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
            {selected ? (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">{threadName(selected)}</h3>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">SMS channel • {latestDirection(selected)}</p>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={selected.latestAppointmentRequestId ? `/app/appointments?requestId=${encodeURIComponent(selected.latestAppointmentRequestId)}` : "/app/appointments"}>
                      Book now
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Select a thread</p>
            )}
          </header>

          <div className="flex-1 space-y-6 overflow-auto p-6">
            {selected ? (
              <>
                {[...selected.messages]
                  .reverse()
                  .map((message) => (
                    <div key={message.id} className={`flex ${message.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-[14px] border px-4 py-3 text-sm leading-6 ${
                        message.direction === "OUTBOUND" ? "border-blue-200 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-800"
                      }`}>
                        <p>{message.body}</p>
                        <p className={`mt-2 text-[10px] ${message.direction === "OUTBOUND" ? "text-blue-100" : "text-slate-400"}`}>
                          {new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
              </>
            ) : (
              <div className="empty-state">Open a thread to review the conversation and reply.</div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white p-4">
            <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={selected ? `Type your message to ${threadName(selected)}...` : "Select a thread first"}
                disabled={!selected || !canSend || sending}
                className="min-h-[100px] w-full resize-none border-none bg-transparent p-2 text-sm focus:ring-0"
              />
              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">SMS Channel</span>
                <Button onClick={() => void onSend()} disabled={!selected || !canSend || sending}>
                  {sending ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <aside className="hidden border-l border-slate-200 bg-white xl:flex xl:flex-col">
          {selected ? (
            <>
              <div className="border-b border-slate-200 p-6 text-center">
                <div className="mx-auto mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-2xl font-semibold text-blue-700">
                  {threadName(selected).slice(0, 2).toUpperCase()}
                </div>
                <h2 className="text-base font-semibold text-slate-950">{threadName(selected)}</h2>
                <p className="text-xs text-slate-500">{selected.contactPhone}</p>
              </div>
              <div className="flex-1 space-y-6 overflow-auto p-4">
                <section>
                  <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Lead Details</h4>
                  <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">Status</span>
                        <span className="font-medium text-slate-950">{stateLabel(selected)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">Next action</span>
                        <span className="font-medium text-slate-950">{nextAction(selected)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">Lead</span>
                        <span className="font-medium text-slate-950">{selected.lead?.name || "Not linked"}</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Booking Context</h4>
                  <div className="space-y-3">
                    <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
                        {selected.latestAppointmentRequestId ? "Pending Request" : "No active booking request"}
                      </p>
                      <p className="mt-1 text-xs text-amber-900">
                        {selected.latestAppointmentRequestId ? "This thread is linked to the booking workflow." : "Open Booking Queue if the office needs to schedule work from this conversation."}
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Internal Notes</h4>
                  <div className="rounded-[12px] border-l-2 border-blue-700 bg-slate-50 p-3 text-[11px] italic leading-6 text-slate-600">
                    {threadFrontDesk(selected)?.summary || "No internal summary yet."}
                  </div>
                </section>
              </div>
              <div className="border-t border-slate-200 p-4">
                <Button asChild variant="outline" className="w-full">
                  <Link href={selected.leadId ? `/app/leads?leadId=${encodeURIComponent(selected.leadId)}` : "/app/leads"}>View lead profile</Link>
                </Button>
              </div>
            </>
          ) : (
            <div className="empty-state m-4">Select a thread to inspect lead and booking context.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
