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

  return (
    <AdminGuard>
      <div className="container py-10">
        <AdminTopTabs />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Admin Messages</h1>
            <p className="text-sm text-muted-foreground">SMS visibility across all organizations (Pro feature traffic).</p>
          </div>
          <Button variant="outline" onClick={() => void load()}>{loading ? "Refreshing..." : "Refresh"}</Button>
        </div>

        <div className="mb-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search org, contact name, or phone..."
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-lg border bg-white">
            <div className="border-b p-3 text-sm font-semibold">Threads</div>
            <div className="max-h-[620px] overflow-auto">
              {!threads.length ? (
                <p className="p-3 text-sm text-muted-foreground">No message threads found.</p>
              ) : (
                threads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedId(thread.id)}
                    className={`w-full border-b p-3 text-left hover:bg-muted/40 ${selectedId === thread.id ? "bg-primary/5" : ""}`}
                  >
                    <p className="text-sm font-medium">{thread.organization?.name || "Unknown org"}</p>
                    <p className="text-xs">{thread.contactName || "Unknown contact"} | {thread.contactPhone}</p>
                    <p className="text-xs text-muted-foreground">Last: {formatWhen(thread.lastMessageAt)}</p>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="rounded-lg border bg-white">
            <div className="border-b p-3 text-sm font-semibold">Conversation</div>
            <div className="max-h-[620px] space-y-2 overflow-auto p-3">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Select a thread to inspect messages.</p>
              ) : !selected.messages.length ? (
                <p className="text-sm text-muted-foreground">No messages in this thread.</p>
              ) : (
                [...selected.messages]
                  .reverse()
                  .map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[82%] rounded-lg border px-3 py-2 text-sm ${
                        message.direction === "OUTBOUND" ? "ml-auto bg-blue-50" : "bg-zinc-50"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {message.direction} | {message.status} | {formatWhen(message.createdAt)}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </section>
        </div>
      </div>
    </AdminGuard>
  );
}
