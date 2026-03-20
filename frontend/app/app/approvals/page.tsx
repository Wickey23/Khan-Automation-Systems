"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { approveAiAction, fetchAiApprovals, rejectAiAction } from "@/lib/api";
import type { ApprovalRequest } from "@/lib/types";
import { PageHeader, PageShell, SectionShell } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";

export default function ApprovalsPage() {
  const [busy, setBusy] = useState(true);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetchAiApprovals();
      setApprovals(response.approvals);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load approvals.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function decide(approvalRequestId: string, mode: "approve" | "reject") {
    if (actionBusyId) return;
    setActionBusyId(approvalRequestId);
    try {
      if (mode === "approve") {
        await approveAiAction(approvalRequestId, notes[approvalRequestId] || undefined);
      } else {
        await rejectAiAction(approvalRequestId, notes[approvalRequestId] || undefined);
      }
      await load();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Failed to update approval.");
    } finally {
      setActionBusyId(null);
    }
  }

  const pendingCount = useMemo(() => approvals.filter((item) => item.status === "PENDING").length, [approvals]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="AI Operations"
        title="Approval Queue"
        description="Review and approve AI actions before external communication or sensitive mutations execute."
      />

      <SectionShell>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">{pendingCount} requests pending approval.</p>
        </div>
      </SectionShell>

      <SectionShell>
        {busy ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading approval requests...
          </div>
        ) : null}

        {!busy && error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        {!busy && !error && approvals.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No AI approval requests found.</div>
        ) : null}

        {!busy && !error && approvals.length > 0 ? (
          <div className="space-y-3">
            {approvals.map((approval) => {
              const actionBusy = actionBusyId === approval.id;
              return (
                <div key={approval.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{approval.toolKey}</p>
                      <p className="text-xs text-slate-500">{approval.actionType} {approval.entityType ? `• ${approval.entityType}` : ""}</p>
                    </div>
                    <StatusBadge kind="feature" state={approval.status === "PENDING" ? "limited" : approval.status === "APPROVED" ? "ready" : "requires_review"} label={approval.status} />
                  </div>

                  {approval.inputSummary ? <p className="mt-3 text-sm text-slate-600">{approval.inputSummary}</p> : null}
                  {approval.reason ? <p className="mt-2 text-xs text-slate-500">{approval.reason}</p> : null}
                  {approval.status === "PENDING" ? (
                    <textarea
                      value={notes[approval.id] || ""}
                      onChange={(event) => setNotes((current) => ({ ...current, [approval.id]: event.target.value }))}
                      placeholder="Optional edit/review note..."
                      className="mt-3 w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-700"
                      rows={2}
                    />
                  ) : null}

                  {approval.status === "PENDING" ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => decide(approval.id, "approve")}
                        disabled={actionBusy}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(approval.id, "reject")}
                        disabled={actionBusy}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60"
                      >
                        {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </SectionShell>
    </PageShell>
  );
}
