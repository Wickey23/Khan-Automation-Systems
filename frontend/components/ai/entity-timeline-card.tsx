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
  timelineData?: EntityAiTimelineResponse | null;
  loading?: boolean;
  error?: string | null;
};

export function EntityTimelineCard({ entityType, entityId, title = "AI Activity Timeline", timelineData, loading, error }: EntityTimelineCardProps) {
  const controlled = timelineData !== undefined;
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [operationalMemory, setOperationalMemory] = useState<EntityOperationalMemoryBlock | null>(null);
  const [recommendation, setRecommendation] = useState<EntityRecommendationInspection | null>(null);
  const [handoffs, setHandoffs] = useState<EntityHandoffInspection[]>([]);
  const [attention, setAttention] = useState<EntityAiTimelineResponse["attention"]>(null);

  useEffect(() => {
    if (controlled) return;
    if (!entityType || !entityId) {
      setRuns([]);
      setApprovals([]);
      setAudit([]);
      setOperationalMemory(null);
      setRecommendation(null);
      setHandoffs([]);
      setAttention(null);
      setLocalError(null);
      return;
    }
    let active = true;
    setBusy(true);
    setLocalError(null);
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
        setLocalError(timelineError instanceof Error ? timelineError.message : "Failed to load timeline.");
      })
      .finally(() => {
        if (!active) return;
        setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [controlled, entityId, entityType]);

  const effectiveBusy = controlled ? Boolean(loading) : busy;
  const effectiveError = controlled ? error || null : localError;
  const effectiveRuns = controlled ? timelineData?.runs || [] : runs;
  const effectiveApprovals = controlled ? timelineData?.approvals || [] : approvals;
  const effectiveAudit = controlled ? timelineData?.audit || [] : audit;
  const effectiveOperationalMemory = controlled ? timelineData?.operationalMemory || null : operationalMemory;
  const effectiveRecommendation = controlled ? timelineData?.recommendation || null : recommendation;
  const effectiveHandoffs = controlled ? timelineData?.handoffs || [] : handoffs;
  const effectiveAttention = controlled ? timelineData?.attention || null : attention;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">AI Timeline</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{title}</p>
      {effectiveBusy ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading timeline...
        </div>
      ) : null}
      {effectiveError ? <p className="mt-3 text-xs text-red-700">{effectiveError}</p> : null}
      {!effectiveBusy && !effectiveError && !entityType ? <p className="mt-3 text-xs text-slate-500">Select an entity to view timeline.</p> : null}
      {!effectiveBusy && !effectiveError && entityType && effectiveRuns.length === 0 && effectiveApprovals.length === 0 && effectiveAudit.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No AI activity recorded yet.</p>
      ) : null}
      {effectiveRecommendation ? (
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          {effectiveRecommendation.action ? <p className="font-medium">Next action: {effectiveRecommendation.action}</p> : null}
          {effectiveRecommendation.why ? <p className="mt-1">{effectiveRecommendation.why}</p> : null}
          <div className="mt-1 grid gap-1 text-[11px] text-blue-900 sm:grid-cols-2">
            <p>Priority: {effectiveRecommendation.priority || "MEDIUM"}</p>
            <p>Approval needed: {effectiveRecommendation.approvalNeeded ? "yes" : "no"}</p>
            <p>Create follow-up: {effectiveRecommendation.shouldCreateFollowup ? "yes" : "no"}</p>
            <p>Refreshed: {new Date(effectiveRecommendation.refreshedAt).toLocaleString()}</p>
          </div>
          {effectiveRecommendation.blockedReasons.length ? <p className="mt-1">Blocked reasons: {effectiveRecommendation.blockedReasons.join(", ")}</p> : null}
        </div>
      ) : null}
      {effectiveOperationalMemory ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p className="font-medium text-slate-900">Operational memory</p>
          {effectiveOperationalMemory.latestSummary ? <p className="mt-1">Summary: {effectiveOperationalMemory.latestSummary}</p> : null}
          {effectiveOperationalMemory.latestClassification ? <p className="mt-1">Classification: {effectiveOperationalMemory.latestClassification}</p> : null}
          <p className="mt-1">
            Approval: {effectiveOperationalMemory.approvalSnapshot.lastApprovalStatus || "-"} | Delivery: {effectiveOperationalMemory.approvalSnapshot.lastDeliveryStatus || "-"}
          </p>
          <p className="mt-1">
            Task: {effectiveOperationalMemory.taskSnapshot.lastTaskStatus || "-"} | Open follow-up: {effectiveOperationalMemory.taskSnapshot.openFollowUpCount}
          </p>
          <p className="mt-1">Outbound blocked: {effectiveOperationalMemory.outboundBlocked ? "yes" : "no"}</p>
          {effectiveOperationalMemory.riskFlags.length ? <p className="mt-1">Flags: {effectiveOperationalMemory.riskFlags.join(", ")}</p> : null}
          <p className="mt-1 text-slate-500">Updated: {new Date(effectiveOperationalMemory.updatedAt).toLocaleString()}</p>
        </div>
      ) : null}
      {effectiveAttention ? (
        <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          <div className="flex items-center gap-2">
            <p className="font-medium">Attention</p>
            <StatusBadge
              kind="feature"
              state={
                effectiveAttention.attentionLevel === "CRITICAL"
                  ? "blocked"
                  : effectiveAttention.attentionLevel === "HIGH"
                    ? "limited"
                    : effectiveAttention.attentionLevel === "MEDIUM"
                      ? "setup_required"
                      : "ready"
              }
              label={`${effectiveAttention.attentionLevel || "UNKNOWN"}${typeof effectiveAttention.attentionScore === "number" ? ` ${effectiveAttention.attentionScore}` : ""}`}
              size="xs"
            />
          </div>
          {effectiveAttention.recommendedOwnerAction ? <p className="mt-1">Owner action: {effectiveAttention.recommendedOwnerAction}</p> : null}
          {effectiveAttention.topReasons.length ? <p className="mt-1">Reasons: {effectiveAttention.topReasons.join(" | ")}</p> : null}
          <p className="mt-1 text-rose-700">Updated: {new Date(effectiveAttention.updatedAt).toLocaleString()}</p>
        </div>
      ) : null}
      {!effectiveBusy && !effectiveError && (effectiveRuns.length > 0 || effectiveApprovals.length > 0 || effectiveAudit.length > 0 || effectiveHandoffs.length > 0) ? (
        <div className="mt-3 space-y-2">
          {effectiveRuns.slice(0, 3).map((run) => (
            <div key={`run-${run.id}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              Run {run.routeReason} - {run.status}
            </div>
          ))}
          {effectiveApprovals.slice(0, 3).map((approval) => (
            <div key={`approval-${approval.id}`} className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p>
                Approval {approval.toolKey} - {approval.status}
                {approval.deliveryStatus ? ` - ${approval.deliveryStatus}` : ""}
              </p>
              {approval.failureReason ? <p className="mt-1 text-red-700">{approval.failureReason}</p> : null}
              {approval.approvedContent ? <p className="mt-1 text-amber-900">{approval.approvedContent.slice(0, 120)}</p> : null}
            </div>
          ))}
          {effectiveHandoffs.slice(0, 3).map((handoff) => (
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
          {effectiveAudit.slice(0, 3).map((entry) => (
            <div key={`audit-${entry.id}`} className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs text-slate-600">
              {entry.action}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
