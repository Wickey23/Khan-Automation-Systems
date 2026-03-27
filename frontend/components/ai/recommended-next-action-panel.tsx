"use client";

import Link from "next/link";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import type {
  ApprovalRequest,
  EntityAiTimelineResponse,
  EntityOperationalMemoryBlock,
  EntityRecommendationInspection
} from "@/lib/types";

type QuickAction = {
  key: string;
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "outline";
  tone?: "default" | "warning";
};

type RecommendedNextActionPanelProps = {
  title?: string;
  source?: string;
  loading: boolean;
  error: string | null;
  recommendation: EntityRecommendationInspection | null;
  operationalMemory: EntityOperationalMemoryBlock | null;
  attention: EntityAiTimelineResponse["attention"];
  latestApproval: ApprovalRequest | null;
  quickActions: QuickAction[];
  onRefresh: () => void;
  refreshing?: boolean;
};

function sourceLabel(source: string) {
  if (source === "attention") return "Opened from Needs Attention";
  if (source === "approvals") return "Opened from Approval Queue";
  if (source === "follow-up") return "Opened from Follow-up Queue";
  return null;
}

function stateForPriority(priority: string | null | undefined) {
  if (!priority) return "ready";
  if (priority === "URGENT") return "blocked";
  if (priority === "HIGH") return "limited";
  if (priority === "MEDIUM") return "setup_required";
  return "ready";
}

function stateForAttention(level: string | null | undefined) {
  if (!level) return "ready";
  if (level === "CRITICAL") return "blocked";
  if (level === "HIGH") return "limited";
  if (level === "MEDIUM") return "setup_required";
  return "ready";
}

function normalizeBlockedReason(reason: string) {
  const normalized = reason.trim().toLowerCase();
  if (normalized === "ai ops is disabled." || normalized === "ai ops is disabled") {
    return "AI workflow is currently unavailable for this workspace.";
  }
  return reason;
}

export function RecommendedNextActionPanel({
  title = "Recommended Next Action",
  source,
  loading,
  error,
  recommendation,
  operationalMemory,
  attention,
  latestApproval,
  quickActions,
  onRefresh,
  refreshing = false
}: RecommendedNextActionPanelProps) {
  const sourceTag = sourceLabel(source || "");
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-4 shadow-sm",
        sourceTag ? "ring-1 ring-blue-100" : ""
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {sourceTag ? <p className="text-xs font-medium text-blue-700">{sourceTag}</p> : null}
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={refreshing || loading}>
          {refreshing || loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {loading ? <p className="mt-3 text-xs text-slate-500">Loading current recommendation...</p> : null}
      {error ? <p className="mt-3 text-xs font-medium text-red-700">{error}</p> : null}

      {!loading && !error ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <p className="text-xs font-semibold text-slate-900">{recommendation?.action || "No recommendation yet"}</p>
            <p className="mt-1 text-xs text-slate-600">
              {recommendation?.why || "Run the relevant AI workflow tools to generate a recommendation for this record."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge
                kind="feature"
                state={stateForPriority(recommendation?.priority)}
                label={`Needs action ${recommendation?.priority || "MEDIUM"}`}
                size="xs"
              />
              <StatusBadge
                kind="feature"
                state={recommendation?.approvalNeeded ? "limited" : "ready"}
                label={recommendation?.approvalNeeded ? "Blocked approval needed" : "Resolved no approval gate"}
                size="xs"
              />
              <StatusBadge
                kind="feature"
                state={operationalMemory?.taskSnapshot.openFollowUpCount ? "setup_required" : "ready"}
                label={operationalMemory?.taskSnapshot.openFollowUpCount ? "At risk follow-up open" : "Resolved no follow-up open"}
                size="xs"
              />
            </div>
          </div>

          {recommendation?.blockedReasons?.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-800">
              <p className="flex items-center gap-1 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                Blocked reasons
              </p>
              <p className="mt-1">{recommendation.blockedReasons.map((reason) => normalizeBlockedReason(reason)).join(" | ")}</p>
            </div>
          ) : null}

          <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 sm:grid-cols-2">
            <p>Last recommendation refresh: {recommendation ? new Date(recommendation.refreshedAt).toLocaleString() : "-"}</p>
            <p>Attention: {attention?.attentionLevel || "-"}{typeof attention?.attentionScore === "number" ? ` (${attention.attentionScore})` : ""}</p>
            <p>
              Approval / delivery: {operationalMemory?.approvalSnapshot.lastApprovalStatus || "-"} /{" "}
              {operationalMemory?.approvalSnapshot.lastDeliveryStatus || "-"}
            </p>
            <p>
              Follow-up / task: {operationalMemory?.taskSnapshot.openFollowUpCount || 0} open /{" "}
              {operationalMemory?.taskSnapshot.lastTaskStatus || "-"}
            </p>
            <p>Outbound blocked: {operationalMemory?.outboundBlocked ? "yes" : "no"}</p>
            <p>Memory updated: {operationalMemory ? new Date(operationalMemory.updatedAt).toLocaleString() : "-"}</p>
            {latestApproval ? <p className="sm:col-span-2">Latest approval state: {latestApproval.status}{latestApproval.deliveryStatus ? ` / ${latestApproval.deliveryStatus}` : ""}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {quickActions.map((action) =>
              action.href ? (
                <Button key={action.key} size="sm" variant={action.variant || "outline"} asChild disabled={action.disabled}>
                  <Link
                    href={action.href}
                    className={action.tone === "warning" ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100" : ""}
                  >
                    {action.label}
                  </Link>
                </Button>
              ) : (
                <Button
                  key={action.key}
                  size="sm"
                  variant={action.variant || "outline"}
                  disabled={action.disabled}
                  onClick={action.onClick}
                  className={action.tone === "warning" ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100" : ""}
                >
                  {action.label}
                </Button>
              )
            )}
          </div>
          {attention ? (
            <div className="text-xs text-slate-500">
              <StatusBadge kind="feature" state={stateForAttention(attention.attentionLevel)} label={attention.attentionLevel || "LOW"} size="xs" />{" "}
              {attention.topReasons?.length ? `Top reasons: ${attention.topReasons.join(" | ")}` : ""}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
