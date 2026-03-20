"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { fetchOrgMessages, getMe, sendOrgMessage, updateLeadPipelineStage } from "@/lib/api";
import type { OrgMessageThread } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageShell, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAccessSummary } from "@/context/access-summary";

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

function relativeTime(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 60) return `${mins || 1}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return "Yesterday";
}

function messageBadge(thread: OrgMessageThread) {
  const type = threadType(thread);
  if (type === "Emergency") return "bg-red-50 text-red-600";
  if (type === "Booking Request") return "bg-amber-50 text-amber-600";
  return "bg-slate-100 text-slate-500";
}

export default function AppMessagesPage() {
  const searchParams = useSearchParams();
  const deepLinkedThreadId = searchParams.get("threadId") || "";
  const accessSummary = useAccessSummary();
  const smsAccess = accessSummary?.features.sms;
  const shouldShowMessages = !smsAccess || smsAccess.status === "ready";
  const [threads, setThreads] = useState<OrgMessageThread[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [savingStage, setSavingStage] = useState<PipelineStage | null>(null);

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
  const needsFollowUpThreads = useMemo(
    () => threads.filter((thread) => (thread.frontDesk?.state || thread.lead?.frontDesk?.state) === "needs_follow_up").length,
    [threads]
  );
  const showSoftCapacityNotice = Boolean(
    accessSummary?.plan.name === "STARTER" &&
      (threads.length >= 20 || needsFollowUpThreads >= 6)
  );

  const selectedThread =
    filteredThreads.find((thread) => thread.id === selectedId) ||
    threads.find((thread) => thread.id === selectedId) ||
    filteredThreads[0] ||
    threads[0] ||
    null;

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
    } finally {
      setSavingStage(null);
    }
  }

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
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Messaging Operations</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Operator Inbox</h1>
            <p className="mt-1 text-sm text-slate-600">Handle customer conversations, dispatch follow-up, and keep thread states current.</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge kind="feature" state="ready" label={`${threads.length} threads`} size="xs" />
            <StatusBadge kind="feature" state={needsFollowUpThreads > 0 ? "setup_required" : "ready"} label={`${needsFollowUpThreads} follow-up`} size="xs" />
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-[calc(100vh-15rem)] overflow-hidden bg-white">
        <div className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-slate-50/30">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Inbox className="h-[18px] w-[18px]" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-700">Operator Inbox</h2>
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
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>
          {showSoftCapacityNotice ? (
            <div className="mx-4 mb-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Starter capacity pressure</p>
              <p className="mt-1 text-xs text-amber-900">
                Message queue is growing ({threads.length} threads, {needsFollowUpThreads} needing follow-up). Automation responses may be slower at this volume.
              </p>
              <Link href="/app/upgrade?plan=pro&returnTo=%2Fapp%2Fmessages" className="mt-2 inline-flex text-xs font-semibold text-primary hover:underline">
                Upgrade for faster automation coverage
              </Link>
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="px-6 py-8 text-sm text-slate-500">Loading conversations...</div>
            ) : filteredThreads.length ? (
              filteredThreads.map((thread) => (
                <div
                  key={thread.id}
                  onClick={() => setSelectedId(thread.id)}
                  className={cn(
                    "cursor-pointer border-l-2 px-6 py-4 transition-all",
                    selectedThread?.id === thread.id ? "border-primary bg-white shadow-sm" : "border-transparent hover:bg-slate-100/50"
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{displayName(thread)}</span>
                      {latestMessage(thread)?.direction === "INBOUND" ? (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">1</span>
                      ) : null}
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">{relativeTime(thread.lastMessageAt)}</span>
                  </div>
                  <p className="mb-2 line-clamp-1 text-[11px] leading-relaxed text-slate-500">{threadPreview(thread)}</p>
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest", messageBadge(thread))}>
                      {threadType(thread)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-sm text-slate-500">No threads match this search.</div>
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
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{threadType(selectedThread)} - Active Now</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="rounded-xl border border-transparent p-2.5 text-slate-400 transition-all hover:border-slate-200 hover:bg-slate-100"><Phone className="h-4.5 w-4.5" /></button>
                  <button className="rounded-xl border border-transparent p-2.5 text-slate-400 transition-all hover:border-slate-200 hover:bg-slate-100"><Video className="h-4.5 w-4.5" /></button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto bg-slate-50/20 p-8 space-y-6">
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
                      className="min-h-[44px] w-full resize-none border-none bg-transparent p-2 text-sm outline-none"
                      rows={1}
                    />
                    <div className="flex items-center justify-between px-2 pb-1">
                      <div className="flex items-center gap-1">
                        <button className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-200"><Smile className="h-4.5 w-4.5" /></button>
                        <button className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-200"><Paperclip className="h-4.5 w-4.5" /></button>
                      </div>
                      <button
                        onClick={() => void onSend()}
                        disabled={sending}
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
            <div className="flex h-full items-center justify-center p-10 text-sm text-slate-500">Select a thread to review the conversation.</div>
          )}
        </div>

        <aside className="hidden w-80 shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-slate-50/50 xl:flex">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Patient Context</h2>
            <button className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-100"><Info className="h-[18px] w-[18px]" /></button>
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
                  <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50">View Profile</button>
                  <button className="rounded-xl bg-slate-900 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:bg-slate-800">Edit</button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Related Activity</h4>
                {selectedThread.latestAppointmentRequestId ? (
                  <Link href={`/app/appointments?requestId=${encodeURIComponent(selectedThread.latestAppointmentRequestId)}`} className="group block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-primary">
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
                  <Link href={`/app/calls?callId=${encodeURIComponent(selectedThread.latestCallId)}`} className="group block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-primary">
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
                    <Link href={`/app/leads?leadId=${encodeURIComponent(selectedThread.leadId)}`}>Open lead queue</Link>
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
