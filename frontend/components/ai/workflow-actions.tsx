"use client";

import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { executeAiTool } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AiWorkflowActionConfig = {
  key: string;
  label: string;
  toolKey: string;
  buildInput?: () => Record<string, unknown>;
};

type AiWorkflowActionsProps = {
  title?: string;
  description?: string;
  agentKey: string;
  entityType?: string;
  entityId?: string;
  actions: AiWorkflowActionConfig[];
  className?: string;
  onToolResult?: (toolKey: string, payload: Record<string, unknown> | undefined) => void;
};

export function AiWorkflowActions({
  title = "AI Workflow Actions",
  description,
  agentKey,
  entityType,
  entityId,
  actions,
  className,
  onToolResult
}: AiWorkflowActionsProps) {
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [approvalId, setApprovalId] = useState<string | null>(null);

  const canRun = useMemo(() => Boolean(entityType && entityId), [entityId, entityType]);

  async function runAction(action: AiWorkflowActionConfig) {
    if (!canRun || runningKey) return;
    setRunningKey(action.key);
    setError(null);
    setLastMessage(null);
    setApprovalId(null);
    try {
      const result = await executeAiTool({
        toolKey: action.toolKey,
        input: action.buildInput ? action.buildInput() : {},
        agentKey,
        entityType,
        entityId
      });
      setLastMessage(result.outputSummary || result.message || "Action completed.");
      setApprovalId(result.approvalRequestId || null);
      onToolResult?.(action.toolKey, result.output);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.");
    } finally {
      setRunningKey(null);
    }
  }

  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white p-4 shadow-sm", className)}>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Sparkles className="h-4 w-4 text-blue-600" />
        {title}
      </div>
      {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.key}
            size="sm"
            variant="outline"
            disabled={!canRun || Boolean(runningKey)}
            onClick={() => void runAction(action)}
          >
            {runningKey === action.key ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            {action.label}
          </Button>
        ))}
      </div>
      {!canRun ? <p className="mt-3 text-xs text-slate-500">Select an entity to run workflow actions.</p> : null}
      {lastMessage ? <p className="mt-3 text-xs text-slate-700">{lastMessage}</p> : null}
      {approvalId ? <p className="mt-1 text-xs font-medium text-amber-700">Approval required: {approvalId}</p> : null}
      {error ? <p className="mt-1 text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
