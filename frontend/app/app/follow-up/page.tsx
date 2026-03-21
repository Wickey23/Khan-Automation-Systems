"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { executeAiTool, fetchFollowUpQueue, getMe, updateAiTask, updateFollowUpQueueItem } from "@/lib/api";
import type { FollowUpQueueItem } from "@/lib/types";
import { PageHeader, PageShell, SectionShell } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";

export default function FollowUpPage() {
  const searchParams = useSearchParams();
  const selectedQueueItemId = searchParams.get("queueItemId") || "";
  const selectedTaskId = searchParams.get("taskId") || "";
  const source = searchParams.get("source") || "";
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<FollowUpQueueItem[]>([]);
  const [filter, setFilter] = useState<"all" | "overdue" | "today" | "soon" | "assigned" | "unassigned">("all");
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  async function loadQueue() {
    setBusy(true);
    setError(null);
    try {
      const [response, me] = await Promise.all([fetchFollowUpQueue(), getMe()]);
      setQueue(response.queue);
      setMeId(me.user.userId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load follow-up queue.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadQueue();
  }, []);

  const visibleQueue = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    return queue.filter((item) => {
      const due = item.task?.dueAt ? new Date(item.task.dueAt).getTime() : null;
      if (filter === "all") return true;
      if (selectedQueueItemId && item.id === selectedQueueItemId) return true;
      if (selectedTaskId && item.task?.id === selectedTaskId) return true;
      if (filter === "assigned") return Boolean(item.task?.assignedToUserId);
      if (filter === "unassigned") return !item.task?.assignedToUserId;
      if (!due) return false;
      if (filter === "overdue") return due < now;
      if (filter === "today") return due >= todayStart.getTime() && due < todayEnd.getTime();
      if (filter === "soon") return due >= now && due < now + 3 * 24 * 60 * 60 * 1000;
      return true;
    });
  }, [filter, queue, selectedQueueItemId, selectedTaskId]);

  useEffect(() => {
    const targetId = selectedQueueItemId || selectedTaskId;
    if (!targetId) return;
    const timeout = setTimeout(() => {
      const element = document.getElementById(`followup-${targetId}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => clearTimeout(timeout);
  }, [busy, selectedQueueItemId, selectedTaskId, visibleQueue.length]);

  async function runQueueAction(item: FollowUpQueueItem, action: "done" | "open" | "assignMe" | "escalate") {
    if (actionBusyId) return;
    setActionBusyId(item.id);
    setError(null);
    try {
      if (action === "done") {
        await updateFollowUpQueueItem(item.id, "DONE");
        if (item.task?.id) await updateAiTask(item.task.id, { status: "DONE" });
      } else if (action === "open") {
        await updateFollowUpQueueItem(item.id, "OPEN");
      } else if (action === "assignMe" && item.task?.id && meId) {
        await updateAiTask(item.task.id, { assignedToUserId: meId, status: "IN_PROGRESS" });
      } else if (action === "escalate" && item.task?.id) {
        await executeAiTool({
          toolKey: "escalate_overdue_item",
          agentKey: "task_followup",
          entityType: "task",
          entityId: item.task.id,
          input: { taskId: item.task.id }
        });
      }
      await loadQueue();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to update queue item.");
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="AI Operations"
        title="Follow-Up Queue"
        description="Operational follow-up items created by AI workflows and human actions."
      />

      <SectionShell>
        {source === "attention" ? (
          <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
            Opened from attention queue.{" "}
            <Link href="/app/attention" className="font-semibold text-blue-700 underline">
              Back to attention
            </Link>
          </div>
        ) : null}
        <div className="mb-3 flex flex-wrap gap-2">
          {(["all", "overdue", "today", "soon", "assigned", "unassigned"] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setFilter(entry)}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold ${filter === entry ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}
            >
              {entry}
            </button>
          ))}
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
            onClick={async () => {
              await executeAiTool({ toolKey: "build_callback_queue", agentKey: "task_followup", entityType: "organization", input: { limit: 30 } });
              await loadQueue();
            }}
          >
            Build callback queue
          </button>
        </div>
        {busy ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading follow-up items...
          </div>
        ) : null}

        {!busy && error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        {!busy && !error && visibleQueue.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No follow-up work is currently queued.</div>
        ) : null}

        {!busy && !error && visibleQueue.length > 0 ? (
          <div className="space-y-3">
            {visibleQueue.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div id={`followup-${item.id}`} />
                {item.task?.id ? <div id={`followup-${item.task.id}`} /> : null}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.task?.title || item.reason}</p>
                    <p className="text-xs text-slate-500">{item.reason}</p>
                  </div>
                  <StatusBadge kind="feature" state={item.status === "OPEN" ? "limited" : "ready"} label={item.status} size="xs" />
                </div>
                {selectedQueueItemId === item.id || (selectedTaskId && item.task?.id === selectedTaskId) ? (
                  <p className="mt-2 text-xs font-semibold text-blue-700">Focused follow-up item from linked workflow</p>
                ) : null}

                {item.task?.description ? <p className="mt-2 text-sm text-slate-600">{item.task.description}</p> : null}

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                  <span>Priority: {item.task?.priority || "n/a"}</span>
                  <span>Created: {new Date(item.createdAt).toLocaleString()}</span>
                  <span>Assigned: {item.task?.assignedToUser?.email || "unassigned"}</span>
                  <span>Due: {item.task?.dueAt ? new Date(item.task.dueAt).toLocaleString() : "not set"}</span>
                  {item.entityType && item.entityId ? (
                    <Link href={`/app/${item.entityType === "message_thread" ? "messages" : item.entityType === "call" ? "calls" : "leads"}`} className="font-semibold text-blue-700 underline">
                      Open related {item.entityType}
                    </Link>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                    disabled={actionBusyId === item.id}
                    onClick={() => void runQueueAction(item, item.status === "OPEN" ? "done" : "open")}
                  >
                    {item.status === "OPEN" ? "Mark done" : "Reopen"}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                    disabled={actionBusyId === item.id || !item.task?.id}
                    onClick={() => void runQueueAction(item, "assignMe")}
                  >
                    Assign to me
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
                    disabled={actionBusyId === item.id || !item.task?.id}
                    onClick={() => void runQueueAction(item, "escalate")}
                  >
                    Escalate overdue
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </SectionShell>
    </PageShell>
  );
}
