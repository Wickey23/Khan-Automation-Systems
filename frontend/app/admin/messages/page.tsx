"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { fetchAdminMessages } from "@/lib/api";
import type { AdminMessageThread } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const threadNeedsReview = (thread: AdminMessageThread) =>
    Boolean(thread.frontDesk?.needsFollowUp || thread.lead?.frontDesk?.needsFollowUp || thread.messages[thread.messages.length - 1]?.direction === "INBOUND");
  const openCount = threads.filter(threadNeedsReview).length;

  return (
    <AdminGuard>
      <div className="page-shell space-y-6">
        <AdminTopTabs />

        <section className="rounded-[18px] border border-slate-300 bg-white px-6 py-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>Investigation Hub</span>
                <span>/</span>
                <span className="text-primary">Global Messages</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">Message Inspector</h1>
              <p className="max-w-3xl text-sm text-slate-600">
                Cross-org SMS and inbox monitoring for escalation, fraud review, and lead lineage tracing.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {openCount} pending investigation
              </div>
              <Button variant="outline" onClick={() => void load()}>
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-[18px] border border-slate-300 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <div className="grid gap-3 lg:grid-cols-[180px_180px_180px_180px_minmax(0,1fr)]">
            <button className="h-10 rounded-lg bg-slate-100 px-3 text-left text-sm text-slate-700">Org: All Organizations</button>
            <button className="h-10 rounded-lg bg-slate-100 px-3 text-left text-sm text-slate-700">Status: Pending</button>
            <button className="h-10 rounded-lg bg-slate-100 px-3 text-left text-sm text-slate-700">Risk: High & Med</button>
            <button className="h-10 rounded-lg bg-slate-100 px-3 text-left text-sm text-slate-700">Time: Last 24 Hours</button>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by thread ID, contact, org, or phone..."
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-[18px] border border-slate-300 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-3">Source Org</th>
                  <th className="px-4 py-3">Investigation Linkage</th>
                  <th className="px-4 py-3">Latest Activity</th>
                  <th className="px-4 py-3">Status / Risk</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {threads.map((thread) => (
                  <tr
                    key={thread.id}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 ${selectedId === thread.id ? "bg-primary/5" : ""}`}
                    onClick={() => setSelectedId(thread.id)}
                  >
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/15 text-xs font-bold text-primary">
                          {(thread.organization?.name || "ORG").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{thread.organization?.name || "Unknown org"}</p>
                          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">ID: {thread.organization?.id || "-"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <span>Thread #{thread.id.slice(0, 8)}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">SMS</span>
                        </div>
                        <div className="border-l-2 border-slate-200 pl-3 text-sm text-slate-500">
                          {thread.contactName || "Unknown contact"} ({thread.contactPhone})
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="max-w-[260px] truncate text-sm text-slate-700">
                        {thread.messages[thread.messages.length - 1]?.body || "No message body"}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">{formatWhen(thread.lastMessageAt)}</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1.5">
                        <span className={`inline-flex w-fit rounded px-2 py-0.5 text-[10px] font-bold ${threadNeedsReview(thread) ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {threadNeedsReview(thread) ? "PENDING_REVIEW" : "RESOLVED"}
                        </span>
                        <span className="inline-flex w-fit rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          {threadNeedsReview(thread) ? "MEDIUM_RISK" : "LOW_RISK"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right align-top">
                      <Button size="sm" variant="outline" onClick={() => setSelectedId(thread.id)}>
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
                {!threads.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                      No global message threads found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <aside className="flex flex-col rounded-[18px] border border-slate-300 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Ops Dashboard</h2>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>

            <div className="mt-6 space-y-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Message Velocity (24h)</p>
                <div className="mt-3 flex h-12 items-end gap-1">
                  {[4, 6, 8, 5, 10, 12, 7].map((value, index) => (
                    <div key={index} className="flex-1 rounded-t-sm bg-primary/70" style={{ height: `${value * 4}px` }} />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                  <span>00:00</span>
                  <span className="font-bold text-slate-700">1.2k / hr avg</span>
                  <span>23:59</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Internal Flags</p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between"><span>Rate Limits</span><span className="font-mono">OK</span></div>
                  <div className="flex items-center justify-between"><span>Deliverability</span><span className="font-mono">98.2%</span></div>
                  <div className="flex items-center justify-between"><span>Open threads</span><span className="font-bold text-primary">{openCount}</span></div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Conversation Detail</p>
                {selected ? (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-semibold text-slate-950">{selected.contactName || selected.contactPhone}</p>
                      <p className="mt-1 text-xs text-slate-500">{selected.organization?.name || "Unknown org"} • {selected.contactPhone}</p>
                    </div>
                    <div className="max-h-[420px] space-y-2 overflow-y-auto">
                      {[...selected.messages].reverse().map((message) => (
                        <div
                          key={message.id}
                          className={`rounded-2xl border px-3 py-2 text-sm ${message.direction === "OUTBOUND" ? "ml-6 border-primary/20 bg-primary/5" : "mr-6 border-slate-200 bg-slate-50"}`}
                        >
                          <p className="whitespace-pre-wrap text-slate-800">{message.body}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                            {message.direction} • {message.status} • {formatWhen(message.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                    Select a thread to inspect.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </AdminGuard>
  );
}
