"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { fetchFollowUpQueue } from "@/lib/api";
import type { FollowUpQueueItem } from "@/lib/types";
import { PageHeader, PageShell, SectionShell } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";

export default function FollowUpPage() {
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<FollowUpQueueItem[]>([]);

  useEffect(() => {
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetchFollowUpQueue();
        setQueue(response.queue);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load follow-up queue.");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  return (
    <PageShell>
      <PageHeader
        eyebrow="AI Operations"
        title="Follow-Up Queue"
        description="Operational follow-up items created by AI workflows and human actions."
      />

      <SectionShell>
        {busy ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading follow-up items...
          </div>
        ) : null}

        {!busy && error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        {!busy && !error && queue.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No follow-up work is currently queued.</div>
        ) : null}

        {!busy && !error && queue.length > 0 ? (
          <div className="space-y-3">
            {queue.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.task?.title || item.reason}</p>
                    <p className="text-xs text-slate-500">{item.reason}</p>
                  </div>
                  <StatusBadge kind="feature" state={item.status === "OPEN" ? "limited" : "ready"} label={item.status} size="xs" />
                </div>

                {item.task?.description ? <p className="mt-2 text-sm text-slate-600">{item.task.description}</p> : null}

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                  <span>Priority: {item.task?.priority || "n/a"}</span>
                  <span>Created: {new Date(item.createdAt).toLocaleString()}</span>
                  {item.entityType && item.entityId ? (
                    <Link href={`/app/${item.entityType === "message_thread" ? "messages" : item.entityType === "call" ? "calls" : "leads"}`} className="font-semibold text-blue-700 underline">
                      Open related {item.entityType}
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </SectionShell>
    </PageShell>
  );
}
