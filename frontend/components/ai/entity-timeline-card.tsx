"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchEntityAiTimeline } from "@/lib/api";
import type { AgentEntityMemory, AgentRun, ApprovalRequest, AuditEvent } from "@/lib/types";

type EntityTimelineCardProps = {
  entityType?: string;
  entityId?: string;
  title?: string;
};

export function EntityTimelineCard({ entityType, entityId, title = "AI Activity Timeline" }: EntityTimelineCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [memory, setMemory] = useState<AgentEntityMemory | null>(null);

  useEffect(() => {
    if (!entityType || !entityId) {
      setRuns([]);
      setApprovals([]);
      setAudit([]);
      setMemory(null);
      return;
    }
    let active = true;
    setBusy(true);
    setError(null);
    void fetchEntityAiTimeline(entityType, entityId)
      .then((result) => {
        if (!active) return;
        setRuns(result.runs || []);
        setApprovals(result.approvals || []);
        setAudit(result.audit || []);
        setMemory(result.memory || null);
      })
      .catch((timelineError) => {
        if (!active) return;
        setError(timelineError instanceof Error ? timelineError.message : "Failed to load timeline.");
      })
      .finally(() => {
        if (!active) return;
        setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [entityId, entityType]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {busy ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading timeline...
        </div>
      ) : null}
      {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}
      {!busy && !error && !entityType ? <p className="mt-3 text-xs text-slate-500">Select an entity to view timeline.</p> : null}
      {!busy && !error && entityType && runs.length === 0 && approvals.length === 0 && audit.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No AI activity recorded yet.</p>
      ) : null}
      {memory ? (
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          {memory.latestRecommendation ? <p className="font-medium">Next action: {memory.latestRecommendation}</p> : null}
          {memory.recommendationWhy ? <p className="mt-1">{memory.recommendationWhy}</p> : null}
          {memory.recommendationPriority ? <p className="mt-1">Priority: {memory.recommendationPriority}</p> : null}
          {memory.riskFlagsJson?.length ? <p className="mt-1">Flags: {memory.riskFlagsJson.join(", ")}</p> : null}
        </div>
      ) : null}
      {!busy && !error && (runs.length > 0 || approvals.length > 0 || audit.length > 0) ? (
        <div className="mt-3 space-y-2">
          {runs.slice(0, 3).map((run) => (
            <div key={`run-${run.id}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              Run {run.routeReason} - {run.status}
            </div>
          ))}
          {approvals.slice(0, 3).map((approval) => (
            <div key={`approval-${approval.id}`} className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p>
                Approval {approval.toolKey} - {approval.status}
                {approval.deliveryStatus ? ` - ${approval.deliveryStatus}` : ""}
              </p>
              {approval.failureReason ? <p className="mt-1 text-red-700">{approval.failureReason}</p> : null}
              {approval.approvedContent ? <p className="mt-1 text-amber-900">{approval.approvedContent.slice(0, 120)}</p> : null}
            </div>
          ))}
          {audit.slice(0, 3).map((entry) => (
            <div key={`audit-${entry.id}`} className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs text-slate-600">
              {entry.action}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
