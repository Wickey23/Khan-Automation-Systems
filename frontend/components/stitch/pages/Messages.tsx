"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCheck, Phone, Search, Send } from "lucide-react";
import { fetchOrgMessages, sendOrgMessage } from "@/lib/api";
import type { OrgMessageThread } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StateCard } from "@/components/stitch/components/app/StateCard";
import { StatusBadge } from "@/components/stitch/components/app/StatusBadge";

function formatWhen(value: string | null | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export default function MessagesPage() {
  const [threads, setThreads] = useState<OrgMessageThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);

  const loadThreads = () => {
    setLoading(true);
    setError(null);
    fetchOrgMessages()
      .then((payload) => {
        setThreads(payload.threads || []);
        if (!selectedThreadId && payload.threads?.length) {
          setSelectedThreadId(payload.threads[0].id);
        } else if (selectedThreadId && !payload.threads.some((item) => item.id === selectedThreadId)) {
          setSelectedThreadId(payload.threads[0]?.id || null);
        }
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Unable to load message threads.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadThreads();
    const interval = setInterval(loadThreads, 20_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredThreads = useMemo(
    () =>
      threads.filter((thread) => {
        const haystack = `${thread.contactName || ""} ${thread.contactPhone} ${thread.lead?.name || ""}`.toLowerCase();
        return haystack.includes(query.trim().toLowerCase());
      }),
    [query, threads]
  );

  const selectedThread = useMemo(
    () => filteredThreads.find((item) => item.id === selectedThreadId) || filteredThreads[0] || null,
    [filteredThreads, selectedThreadId]
  );

  const onSend = async () => {
    const trimmed = messageBody.trim();
    if (!selectedThread || !trimmed || sending) return;
    setSending(true);
    try {
      await sendOrgMessage({ to: selectedThread.contactPhone, body: trimmed, leadId: selectedThread.leadId || undefined });
      setMessageBody("");
      loadThreads();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-160px)] overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
      <div className="flex w-80 flex-col border-r border-outline-variant/10">
        <div className="border-b border-outline-variant/10 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60" size={16} />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search threads..."
              className="w-full rounded-xl border-none bg-surface-container-low py-2 pl-9 pr-4 text-sm outline-none ring-primary/20 focus:ring-2"
            />
          </div>
        </div>

        {loading ? <div className="p-4"><StateCard type="loading" title="Loading threads" description="Fetching recent SMS conversations." /></div> : null}
        {!loading && error ? <div className="p-4"><StateCard type="error" title="Messages unavailable" description={error} /></div> : null}

        <div className="flex-1 overflow-y-auto">
          {filteredThreads.map((thread) => {
            const active = selectedThread?.id === thread.id;
            const lastMessage = thread.messages?.[thread.messages.length - 1];
            const unread = thread.messages?.filter((item) => item.direction === "INBOUND" && item.status === "RECEIVED").length || 0;
            return (
              <button
                key={thread.id}
                onClick={() => setSelectedThreadId(thread.id)}
                className={cn(
                  "w-full border-b border-outline-variant/5 px-4 py-3 text-left transition-colors hover:bg-surface-container-low",
                  active && "bg-primary/5"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-on-surface">{thread.contactName || thread.contactPhone}</p>
                  <span className="text-[10px] text-on-surface-variant">{formatWhen(thread.lastMessageAt)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-on-surface-variant">{lastMessage?.body || "No messages yet."}</p>
                  {unread > 0 ? <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span> : null}
                </div>
              </button>
            );
          })}
          {!loading && !error && filteredThreads.length === 0 ? (
            <div className="p-4">
              <StateCard type="empty" title="No matching threads" description="Try a different search or wait for new SMS activity." />
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        {!selectedThread ? (
          <div className="p-6">
            <StateCard type="empty" title="No thread selected" description="Choose a message thread to inspect and reply." />
          </div>
        ) : (
          <>
            <div className="flex h-16 items-center justify-between border-b border-outline-variant/10 px-6">
              <div>
                <h3 className="text-sm font-bold text-on-surface">{selectedThread.contactName || selectedThread.contactPhone}</h3>
                <p className="text-[11px] text-on-surface-variant">{selectedThread.contactPhone}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge type="sms" state="active" />
                <button className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low">
                  <Phone size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-surface-container-low/20 p-6">
              {selectedThread.messages?.length ? (
                selectedThread.messages.map((message) => (
                  <div key={message.id} className={cn("flex", message.direction === "OUTBOUND" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl p-4 text-sm shadow-sm",
                        message.direction === "OUTBOUND"
                          ? "rounded-tr-none bg-primary text-on-primary"
                          : "rounded-tl-none border border-outline-variant/10 bg-white text-on-surface"
                      )}
                    >
                      <p className="leading-relaxed">{message.body}</p>
                      <div
                        className={cn(
                          "mt-2 flex items-center gap-1 text-[10px]",
                          message.direction === "OUTBOUND" ? "justify-end text-on-primary/80" : "text-on-surface-variant"
                        )}
                      >
                        <span>{formatWhen(message.createdAt)}</span>
                        {message.direction === "OUTBOUND" ? (
                          message.status === "DELIVERED" || message.status === "SENT" ? <CheckCheck size={12} /> : <Check size={12} />
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <StateCard type="empty" title="No messages yet" description="This thread has not exchanged messages yet." />
              )}
            </div>

            <div className="border-t border-outline-variant/10 p-4">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void onSend();
                    }
                  }}
                  placeholder="Type your message..."
                  className="flex-1 rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm outline-none ring-primary/20 focus:ring-2"
                />
                <button
                  onClick={() => void onSend()}
                  disabled={!messageBody.trim() || sending}
                  className="rounded-xl bg-primary p-3 text-white shadow-lg shadow-primary/20 transition-all enabled:hover:scale-[1.02] disabled:opacity-60"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
