"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { approveAiAction, fetchAiApprovals, rejectAiAction, retryAiApprovalSend } from "@/lib/api";
import type { ApprovalRequest } from "@/lib/types";
import { PageHeader, PageShell, SectionShell } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";

type DraftEditState = {
  subject: string;
  content: string;
  mode: "SEND_NOW" | "APPROVE_ONLY";
};

function parseDraft(approval: ApprovalRequest): DraftEditState {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = approval.inputSummary ? (JSON.parse(approval.inputSummary) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }

  const subject = approval.approvedSubject || (typeof parsed.subject === "string" ? parsed.subject : "");
  const content =
    approval.approvedContent ||
    (typeof parsed.content === "string"
      ? parsed.content
      : typeof parsed.draft === "string"
        ? parsed.draft
        : typeof parsed.body === "string"
          ? parsed.body
          : approval.inputSummary || "");

  return {
    subject,
    content,
    mode: "SEND_NOW"
  };
}

export default function ApprovalsPage() {
  const [busy, setBusy] = useState(true);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [draftEdits, setDraftEdits] = useState<Record<string, DraftEditState>>({});

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetchAiApprovals();
      setApprovals(response.approvals);
      setDraftEdits((current) => {
        const next = { ...current };
        for (const approval of response.approvals) {
          if (!next[approval.id]) {
            next[approval.id] = parseDraft(approval);
          }
        }
        return next;
      });
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
        const edit = draftEdits[approvalRequestId];
        await approveAiAction(approvalRequestId, {
          note: notes[approvalRequestId] || undefined,
          mode: edit?.mode || "SEND_NOW",
          editedSubject: edit?.subject || undefined,
          editedContent: edit?.content || undefined
        });
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

  async function retrySend(approvalRequestId: string) {
    if (actionBusyId) return;
    setActionBusyId(approvalRequestId);
    try {
      await retryAiApprovalSend(approvalRequestId);
      await load();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Failed to retry send.");
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
                      <p className="text-xs text-slate-500">
                        {approval.actionType} {approval.entityType ? `• ${approval.entityType}` : ""}
                      </p>
                    </div>
                    <StatusBadge
                      kind="feature"
                      state={approval.status === "PENDING" ? "limited" : approval.status === "APPROVED" ? "ready" : "requires_review"}
                      label={approval.status}
                    />
                  </div>

                  {approval.inputSummary ? <p className="mt-3 text-sm text-slate-600">{approval.inputSummary}</p> : null}
                  {approval.reason ? <p className="mt-2 text-xs text-slate-500">{approval.reason}</p> : null}
                  {approval.deliveryStatus ? (
                    <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <p>
                        Delivery: <span className="font-semibold">{approval.deliveryStatus}</span>
                        {approval.deliveryProvider ? ` via ${approval.deliveryProvider}` : ""}
                      </p>
                      {approval.providerMessageId ? <p>Provider ID: {approval.providerMessageId}</p> : null}
                      {approval.failureReason ? <p className="text-red-700">Failure: {approval.failureReason}</p> : null}
                    </div>
                  ) : null}

                  {approval.status === "PENDING" ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={notes[approval.id] || ""}
                        onChange={(event) => setNotes((current) => ({ ...current, [approval.id]: event.target.value }))}
                        placeholder="Optional review note..."
                        className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-700"
                        rows={2}
                      />
                      {approval.toolKey.includes("email") ? (
                        <input
                          type="text"
                          value={draftEdits[approval.id]?.subject || ""}
                          onChange={(event) =>
                            setDraftEdits((current) => ({
                              ...current,
                              [approval.id]: { ...(current[approval.id] || parseDraft(approval)), subject: event.target.value }
                            }))
                          }
                          placeholder="Email subject"
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
                        />
                      ) : null}
                      <textarea
                        value={draftEdits[approval.id]?.content || ""}
                        onChange={(event) =>
                          setDraftEdits((current) => ({
                            ...current,
                            [approval.id]: { ...(current[approval.id] || parseDraft(approval)), content: event.target.value }
                          }))
                        }
                        placeholder="Final approved content..."
                        className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-700"
                        rows={4}
                      />
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={(draftEdits[approval.id]?.mode || "SEND_NOW") === "APPROVE_ONLY"}
                          onChange={(event) =>
                            setDraftEdits((current) => ({
                              ...current,
                              [approval.id]: {
                                ...(current[approval.id] || parseDraft(approval)),
                                mode: event.target.checked ? "APPROVE_ONLY" : "SEND_NOW"
                              }
                            }))
                          }
                        />
                        Approve only (keep queued, do not send yet)
                      </label>
                    </div>
                  ) : null}

                  {approval.status === "PENDING" ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void decide(approval.id, "approve")}
                        disabled={actionBusy}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Approve {draftEdits[approval.id]?.mode === "APPROVE_ONLY" ? "(queue)" : "& send"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void decide(approval.id, "reject")}
                        disabled={actionBusy}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60"
                      >
                        {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                        Reject
                      </button>
                    </div>
                  ) : null}

                  {approval.status === "APPROVED" && (approval.deliveryStatus === "FAILED" || approval.deliveryStatus === "QUEUED") ? (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => void retrySend(approval.id)}
                        disabled={actionBusy}
                        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-60"
                      >
                        {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Retry send now
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
