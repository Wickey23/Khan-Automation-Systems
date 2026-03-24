"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { createAiRun } from "@/lib/api";
import { cn } from "@/lib/utils";

type AskAiInlineProps = {
  className?: string;
  page: string;
  entityType?: string;
  entityId?: string;
  defaultAgentKey?: string;
  placeholder?: string;
};

export function AskAiInline({
  className,
  page,
  entityType,
  entityId,
  defaultAgentKey,
  placeholder = "Ask AI to summarize, classify, or suggest next actions..."
}: AskAiInlineProps) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [approvalId, setApprovalId] = useState<string | null>(null);

  async function onSubmit() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setApprovalId(null);
    try {
      const response = await createAiRun({
        prompt: prompt.trim(),
        page,
        entityType,
        entityId,
        agentKey: defaultAgentKey
      });
      setResult(response.summary || "AI run completed.");
      setApprovalId(response.approvalRequestId || null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to run AI request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white p-4 shadow-sm", className)}>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Sparkles className="h-4 w-4 text-blue-600" />
        Ask Copilot
      </div>
      <div className="mt-3 flex flex-col gap-3 md:flex-row">
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={placeholder}
          className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || !prompt.trim()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Run
        </button>
      </div>
      {result ? <p className="mt-3 text-sm text-slate-700">{result}</p> : null}
      {approvalId ? (
        <p className="mt-2 text-xs font-medium text-amber-700">Approval required. Review request {approvalId} in the approvals queue.</p>
      ) : null}
      {error ? <p className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
