"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchEntityAiTimeline } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  AgentRun,
  ApprovalRequest,
  AuditEvent,
  EntityHandoffInspection,
  EntityOperationalMemoryBlock,
  EntityRecommendationInspection,
  EntityAiTimelineResponse
} from "@/lib/types";

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
  const [operationalMemory, setOperationalMemory] = useState<EntityOperationalMemoryBlock | null>(null);
  const [recommendation, setRecommendation] = useState<EntityRecommendationInspection | null>(null);
  const [handoffs, setHandoffs] = useState<EntityHandoffInspection[]>([]);
  const [attention, setAttention] = useState<EntityAiTimelineResponse["attention"]>(null);

  useEffect(() => {
    if (!entityType || !entityId) {
      setRuns([]);
      setApprovals([]);
      setAudit([]);
      setOperationalMemory(null);
      setRecommendation(null);
      setHandoffs([]);
      setAttention(null);
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
        setOperationalMemory(result.operationalMemory || null);
        setRecommendation(result.recommendation || null);
        setHandoffs(result.handoffs || []);
        setAttention(result.attention || null);
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
      {recommendation ? (
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          {recommendation.action ? <p className="font-medium">Next action: {recommendation.action}</p> : null}
          {recommendation.why ? <p className="mt-1">{recommendation.why}</p> : null}
          <div className="mt-1 grid gap-1 text-[11px] text-blue-900 sm:grid-cols-2">
            <p>Priority: {recommendation.priority || "MEDIUM"}</p>
            <p>Approval needed: {recommendation.approvalNeeded ? "yes" : "no"}</p>
            <p>Create follow-up: {recommendation.shouldCreateFollowup ? "yes" : "no"}</p>
            <p>Refreshed: {new Date(recommendation.refreshedAt).toLocaleString()}</p>
          </div>
          {recommendation.blockedReasons.length ? <p className="mt-1">Blocked reasons: {recommendation.blockedReasons.join(", ")}</p> : null}
        </div>
      ) : null}
      {operationalMemory ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p className="font-medium text-slate-900">Operational memory</p>
          {operationalMemory.latestSummary ? <p className="mt-1">Summary: {operationalMemory.latestSummary}</p> : null}
          {operationalMemory.latestClassification ? <p className="mt-1">Classification: {operationalMemory.latestClassification}</p> : null}
          <p className="mt-1">
            Approval: {operationalMemory.approvalSnapshot.lastApprovalStatus || "-"} | Delivery: {operationalMemory.approvalSnapshot.lastDeliveryStatus || "-"}
          </p>
          <p className="mt-1">
            Task: {operationalMemory.taskSnapshot.lastTaskStatus || "-"} | Open follow-up: {operationalMemory.taskSnapshot.openFollowUpCount}
          </p>
          <p className="mt-1">Outbound blocked: {operationalMemory.outboundBlocked ? "yes" : "no"}</p>
          {operationalMemory.riskFlags.length ? <p className="mt-1">Flags: {operationalMemory.riskFlags.join(", ")}</p> : null}
          <p className="mt-1 text-slate-500">Updated: {new Date(operationalMemory.updatedAt).toLocaleString()}</p>
        </div>
      ) : null}
      {attention ? (
        <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          <div className="flex items-center gap-2">
            <p className="font-medium">Attention</p>
            <StatusBadge
              kind="feature"
              state={
                attention.attentionLevel === "CRITICAL"
                  ? "blocked"
                  : attention.attentionLevel === "HIGH"
                    ? "limited"
                    : attention.attentionLevel === "MEDIUM"
                      ? "setup_required"
                      : "ready"
              }
              label={`${attention.attentionLevel || "UNKNOWN"}${typeof attention.attentionScore === "number" ? ` ${attention.attentionScore}` : ""}`}
              size="xs"
            />
          </div>
          {attention.recommendedOwnerAction ? <p className="mt-1">Owner action: {attention.recommendedOwnerAction}</p> : null}
          {attention.topReasons.length ? <p className="mt-1">Reasons: {attention.topReasons.join(" | ")}</p> : null}
          <p className="mt-1 text-rose-700">Updated: {new Date(attention.updatedAt).toLocaleString()}</p>
        </div>
      ) : null}
      {!busy && !error && (runs.length > 0 || approvals.length > 0 || audit.length > 0 || handoffs.length > 0) ? (
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
          {handoffs.slice(0, 3).map((handoff) => (
            <div key={`handoff-${handoff.id}`} className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
              <p className="font-medium">
                Handoff {handoff.sourceAgent || "agent"}
                {" -> "}
                {handoff.targetAgent || "agent"} ({handoff.targetTool || "tool"})
              </p>
              {handoff.reason ? <p className="mt-1">Reason: {handoff.reason}</p> : null}
              {handoff.suppressed ? <p className="mt-1 text-amber-700">Suppressed: {handoff.suppressionReason || "suppressed"}</p> : null}
              {handoff.targetResultSummary ? <p className="mt-1">{handoff.targetResultSummary}</p> : null}
              <p className="mt-1 text-[11px] text-indigo-700">
                Created - approval: {handoff.createdApproval ? "yes" : "no"}, follow-up: {handoff.createdFollowup ? "yes" : "no"}, task:{" "}
                {handoff.createdTask ? "yes" : "no"}
              </p>
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
