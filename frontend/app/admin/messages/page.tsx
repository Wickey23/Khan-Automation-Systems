"use client";

import { Bot, MessageSquare, Search, Shield, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
import { fetchAdminMessages } from "@/lib/api";
import type { AdminMessageThread } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatWhen(value: string) {
  return new Date(value).toLocaleString();
}

export default function AdminMessagesPage() {
  const [threads, setThreads] = useState<AdminMessageThread[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminMessages(query);
      setThreads(data.threads);
      setSelectedId((current) => current || data.threads[0]?.id || "");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => threads.find((thread) => thread.id === selectedId) || null, [threads, selectedId]);
  const stats = useMemo(() => {
    const allMessages = threads.flatMap((thread) => thread.messages);
    const inbound = allMessages.filter((message) => message.direction === "INBOUND").length;
    const outbound = allMessages.filter((message) => message.direction === "OUTBOUND").length;
    const failed = allMessages.filter((message) => message.status === "FAILED").length;
    return [
      { label: "Threads loaded", value: threads.length, note: "Cross-org SMS traffic" },
      { label: "Inbound", value: inbound, note: "Customer replies and confirmations" },
      { label: "Outbound", value: outbound, note: "AI and operator sends" },
      { label: "Failures", value: failed, note: "Delivery issues needing audit" }
    ];
  }, [threads]);

  return (
    <AdminGuard>
      <div className="page-shell space-y-6">
        <AdminTopTabs />

        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 bg-slate-950 px-6 py-5 text-white sm:px-8">
            <div>
              <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                <Shield className="h-3.5 w-3.5" />
                Global Control Plane
              </p>
              <h1 className="mt-2 text-[30px] font-black tracking-[-0.04em]">Global Message Logs</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-400">
                Audit SMS traffic across organizations, isolate delivery failures, and inspect customer threads with linked lead context.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Messages in scope</p>
              <p className="mt-1 text-2xl font-black text-white">{threads.reduce((total, thread) => total + thread.messages.length, 0)}</p>
            </div>
          </div>
          <div className="grid gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{stat.label}</p>
                <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">{stat.value}</p>
                <p className="mt-1 text-xs text-slate-500">{stat.note}</p>
              </div>
            ))}
          </div>
        </div>

        <PageHeader
          eyebrow="Message diagnostics"
          title="Trace delivery health, operator replies, and AI-generated conversations"
          description="Search across organizations, inspect thread-level history, and verify how message activity ties back to captured leads and recent calls."
          actions={
            <Button variant="outline" onClick={() => void load()}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          }
        />

        <div className="data-toolbar grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search org, contact, phone, or thread content..."
            />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            Audit review
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)_320px]">
          <aside className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Threads</p>
            </div>
            <div className="max-h-[860px] overflow-auto">
              {!threads.length ? (
                <p className="px-5 py-8 text-sm text-slate-500">No message threads found.</p>
              ) : (
                threads.map((thread) => {
                  const latest = thread.messages[thread.messages.length - 1];
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => setSelectedId(thread.id)}
                      className={cn(
                        "w-full border-b border-slate-100 px-5 py-4 text-left transition-colors hover:bg-slate-50",
                        selectedId === thread.id ? "bg-primary/5" : "bg-white"
                      )}
                    >
                      <p className="text-sm font-bold text-slate-950">{thread.organization?.name || "Unknown org"}</p>
                      <p className="mt-1 text-xs text-slate-600">{thread.contactName || "Unknown contact"} | {thread.contactPhone}</p>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{latest?.body || "No messages yet."}</p>
                      <p className="mt-2 text-[11px] text-slate-400">Last activity {formatWhen(thread.lastMessageAt)}</p>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Conversation log</p>
            </div>
            <div className="max-h-[860px] space-y-3 overflow-auto px-5 py-5">
              {!selected ? (
                <p className="text-sm text-slate-500">Select a thread to inspect messages.</p>
              ) : !selected.messages.length ? (
                <p className="text-sm text-slate-500">No messages in this thread.</p>
              ) : (
                [...selected.messages].reverse().map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[85%] rounded-2xl border px-4 py-3 text-sm shadow-sm",
                      message.direction === "OUTBOUND"
                        ? "ml-auto border-sky-200 bg-sky-50"
                        : "border-slate-200 bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      {message.direction === "OUTBOUND" ? <Bot className="h-3.5 w-3.5 text-primary" /> : <User className="h-3.5 w-3.5 text-slate-500" />}
                      <span>{message.direction === "OUTBOUND" ? "Outbound" : "Inbound"}</span>
                      <span>{message.status}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">{message.body}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatWhen(message.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <aside className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Context</p>
            </div>
            {!selected ? (
              <div className="px-5 py-8 text-sm text-slate-500">Choose a thread to inspect lead linkage and recent message behavior.</div>
            ) : (
              <div className="space-y-5 px-5 py-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-950">{selected.contactName || "Unknown contact"}</p>
                  <p className="mt-1 text-xs text-slate-500">{selected.contactPhone}</p>
                  <p className="mt-1 text-xs text-slate-500">{selected.organization?.name || "Unknown organization"}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Thread summary</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <p>Total messages: {selected.messages.length}</p>
                    <p>Last message: {formatWhen(selected.lastMessageAt)}</p>
                    <p>Channel: {selected.channel}</p>
                    <p>Latest call: {selected.latestCallId || "-"}</p>
                    <p>Latest appointment request: {selected.latestAppointmentRequestId || "-"}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Linked lead</p>
                  {selected.lead ? (
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <p>Name: {selected.lead.name || "-"}</p>
                      <p>Business: {selected.lead.business || "-"}</p>
                      <p>Phone: {selected.lead.phone || "-"}</p>
                      <p>Recommended action: {selected.lead.frontDesk?.recommendedAction || "-"}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No linked lead record.</p>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </AdminGuard>
  );
}

