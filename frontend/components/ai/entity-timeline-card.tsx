"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchEntityAiTimeline } from "@/lib/api";
import type { AgentRun, ApprovalRequest, AuditEvent } from "@/lib/types";

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

  useEffect(() => {
    if (!entityType || !entityId) {
      setRuns([]);
      setApprovals([]);
      setAudit([]);
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
      {!busy && !error && (runs.length > 0 || approvals.length > 0 || audit.length > 0) ? (
        <div className="mt-3 space-y-2">
          {runs.slice(0, 3).map((run) => (
            <div key={`run-${run.id}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              Run {run.routeReason} - {run.status}
            </div>
          ))}
          {approvals.slice(0, 3).map((approval) => (
            <div key={`approval-${approval.id}`} className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Approval {approval.toolKey} - {approval.status}
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
