"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Mail,
  Play,
  Plus,
  RefreshCw,
  Send,
  Shield,
  Trash2
} from "lucide-react";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import {
  createAdminReportRecipient,
  deleteAdminReportRecipient,
  fetchAdminReportRecipients,
  sendAdminReportTest,
  updateAdminReportRecipient
} from "@/lib/api";
import type { AdminReportRecipient } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RecipientDraft = {
  email: string;
  isActive: boolean;
  dailyEnabled: boolean;
  weeklyEnabled: boolean;
  includeSystemDashboard: boolean;
  includeSystemReadiness: boolean;
  includeScaleGate: boolean;
  includeSecuritySummary: boolean;
  includeRevenueSummary: boolean;
  includeOutreachOverview: boolean;
  includeBillingDiagnostics: boolean;
  notes: string;
};

const emptyDraft: RecipientDraft = {
  email: "",
  isActive: true,
  dailyEnabled: true,
  weeklyEnabled: false,
  includeSystemDashboard: true,
  includeSystemReadiness: true,
  includeScaleGate: true,
  includeSecuritySummary: true,
  includeRevenueSummary: true,
  includeOutreachOverview: true,
  includeBillingDiagnostics: true,
  notes: ""
};

function toDraft(recipient: AdminReportRecipient): RecipientDraft {
  return {
    email: recipient.email,
    isActive: recipient.isActive,
    dailyEnabled: recipient.dailyEnabled,
    weeklyEnabled: recipient.weeklyEnabled,
    includeSystemDashboard: recipient.includeSystemDashboard,
    includeSystemReadiness: recipient.includeSystemReadiness,
    includeScaleGate: recipient.includeScaleGate,
    includeSecuritySummary: recipient.includeSecuritySummary,
    includeRevenueSummary: recipient.includeRevenueSummary,
    includeOutreachOverview: recipient.includeOutreachOverview,
    includeBillingDiagnostics: recipient.includeBillingDiagnostics,
    notes: recipient.notes || ""
  };
}

function formatLastSent(value: string | null | undefined) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleString();
}

function recipientFrequencyLabel(recipient: RecipientDraft) {
  if (recipient.dailyEnabled && recipient.weeklyEnabled) return "Daily + Weekly";
  if (recipient.dailyEnabled) return "Daily";
  if (recipient.weeklyEnabled) return "Weekly";
  return "Manual only";
}

function recipientScopeLabels(recipient: RecipientDraft) {
  const labels: string[] = [];
  if (recipient.includeSystemDashboard) labels.push("Daily Health");
  if (recipient.includeBillingDiagnostics) labels.push("Billing Diagnostics");
  if (recipient.includeSystemReadiness) labels.push("Readiness");
  if (recipient.includeScaleGate) labels.push("Scale Gate");
  if (recipient.includeSecuritySummary) labels.push("Security");
  if (recipient.includeRevenueSummary) labels.push("Revenue");
  if (recipient.includeOutreachOverview) labels.push("Outreach");
  return labels;
}

function DefinitionCard({
  title,
  code,
  description
}: {
  title: string;
  code: string;
  description: string;
}) {
  return (
    <div className="flex h-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-primary">
          <Activity className="h-5 w-5" />
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          {code}
        </span>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="text-xs leading-6 text-slate-500">{description}</p>
      </div>
      <div className="mt-auto flex gap-2">
        <button className="flex-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm shadow-sky-200/70 transition hover:bg-sky-500">
          Configure
        </button>
        <button className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
          Preview
        </button>
      </div>
    </div>
  );
}

export default function AdminReportsPage() {
  const [recipients, setRecipients] = useState<AdminReportRecipient[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RecipientDraft>>({});
  const [newRecipient, setNewRecipient] = useState<RecipientDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchAdminReportRecipients();
      setRecipients(data.recipients);
      setDrafts(Object.fromEntries(data.recipients.map((recipient) => [recipient.id, toDraft(recipient)])));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load report recipients.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeRecipients = useMemo(() => recipients.filter((recipient) => recipient.isActive), [recipients]);
  const inactiveRecipients = Math.max(0, recipients.length - activeRecipients.length);

  function renderCheckbox(label: string, checked: boolean, onChange: (checked: boolean) => void) {
    return (
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>{label}</span>
      </label>
    );
  }

  return (
    <AdminGuard requireSuperAdmin>
      <div className="page-shell space-y-6">
        <AdminTopTabs className="mb-3" />

        <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-950 px-8 py-6 text-white">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Global Control Plane</span>
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">Reporting Engine & Diagnostics</h1>
                <p className="mt-1 text-sm text-slate-400">Internal distribution rules, batch health, and diagnostic delivery controls.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-emerald-400">Engine Online</span>
              </div>
              <Button type="button" className="rounded-2xl bg-primary px-5 shadow-lg shadow-sky-200/70 hover:bg-sky-500">
                <Play className="mr-2 h-4 w-4" />
                Run global batch
              </Button>
            </div>
          </div>

          <div className="space-y-8 px-8 py-8">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-primary">
                    <Activity className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600">Healthy</span>
                </div>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Reporting engine</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{activeRecipients.length} active recipients</p>
                <p className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Batch delivery rules are ready to run.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Watch</span>
                </div>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Quarantine queue</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{inactiveRecipients}</p>
                <p className="mt-3 text-xs text-slate-500">
                  Inactive or manual-only recipients remain out of the automated send path until re-enabled.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Database className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Schedule</span>
                </div>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Last global batch</p>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {recipients.some((recipient) => recipient.lastDailySentAt || recipient.lastWeeklySentAt) ? "Recently sent" : "Pending first run"}
                </p>
                <p className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500">
                  <RefreshCw className="h-4 w-4" />
                  Daily and weekly diagnostics can be tested from each recipient row.
                </p>
              </div>
            </div>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Available report definitions</h2>
                  <p className="text-sm text-slate-500">Diagnostics modules that can be included in daily and weekly internal mailers.</p>
                </div>
                <button className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:underline">
                  <Plus className="h-4 w-4" />
                  Create report definition
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DefinitionCard title="Daily Operational Health" code="LATENCY-A" description="Call handling, delivery health, and cluster-wide latency diagnostics for operations." />
                <DefinitionCard title="Billing & Subscription Audit" code="FIN-AUDIT" description="Failed payments, card expiry, and organization billing blocks requiring intervention." />
                <DefinitionCard title="System Readiness Baseline" code="VELOCITY-1" description="Provisioning completion, testing pass rates, and launch-readiness tracking across tenants." />
                <DefinitionCard title="Security & Auth Summary" code="AUTH-SEC" description="Verification health, auth drift, and access anomalies captured for internal review." />
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Add recipient</h2>
                  <p className="text-sm text-slate-500">Create a new internal destination for daily or weekly diagnostic distribution.</p>
                </div>
                {message ? <p className="text-sm text-slate-500">{message}</p> : null}
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Recipient email</span>
                    <input
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm"
                      value={newRecipient.email}
                      onChange={(event) => setNewRecipient((current) => ({ ...current, email: event.target.value }))}
                      placeholder="ops@khansystems.com"
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Notes</span>
                    <input
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm"
                      value={newRecipient.notes}
                      onChange={(event) => setNewRecipient((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="Founder inbox, delivery checks, weekly digest"
                    />
                  </label>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {renderCheckbox("Active", newRecipient.isActive, (value) => setNewRecipient((current) => ({ ...current, isActive: value })))}
                  {renderCheckbox("Daily", newRecipient.dailyEnabled, (value) => setNewRecipient((current) => ({ ...current, dailyEnabled: value })))}
                  {renderCheckbox("Weekly", newRecipient.weeklyEnabled, (value) => setNewRecipient((current) => ({ ...current, weeklyEnabled: value })))}
                  {renderCheckbox("System dashboard", newRecipient.includeSystemDashboard, (value) => setNewRecipient((current) => ({ ...current, includeSystemDashboard: value })))}
                  {renderCheckbox("System readiness", newRecipient.includeSystemReadiness, (value) => setNewRecipient((current) => ({ ...current, includeSystemReadiness: value })))}
                  {renderCheckbox("Scale gate", newRecipient.includeScaleGate, (value) => setNewRecipient((current) => ({ ...current, includeScaleGate: value })))}
                  {renderCheckbox("Security", newRecipient.includeSecuritySummary, (value) => setNewRecipient((current) => ({ ...current, includeSecuritySummary: value })))}
                  {renderCheckbox("Revenue", newRecipient.includeRevenueSummary, (value) => setNewRecipient((current) => ({ ...current, includeRevenueSummary: value })))}
                  {renderCheckbox("Outreach", newRecipient.includeOutreachOverview, (value) => setNewRecipient((current) => ({ ...current, includeOutreachOverview: value })))}
                  {renderCheckbox("Billing diagnostics", newRecipient.includeBillingDiagnostics, (value) => setNewRecipient((current) => ({ ...current, includeBillingDiagnostics: value })))}
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    className="rounded-2xl bg-primary px-5 shadow-lg shadow-sky-200/70 hover:bg-sky-500"
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await createAdminReportRecipient({ ...newRecipient, notes: newRecipient.notes || null });
                        setNewRecipient(emptyDraft);
                        setMessage("Report recipient added.");
                        await load();
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : "Could not add report recipient.");
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add recipient
                  </Button>
                  <p className="text-xs text-slate-500">Recipients can receive daily, weekly, or manual test runs from this page.</p>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Report recipients</h2>
                  <p className="text-sm text-slate-500">Manage distribution scope, send tests, and disable recipients without removing history.</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_150px_140px_180px] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  <span>Recipient</span>
                  <span>Scope</span>
                  <span>Frequency</span>
                  <span>Status</span>
                  <span className="text-right">Actions</span>
                </div>
                {loading ? (
                  <div className="px-6 py-6 text-sm text-slate-500">Loading recipients...</div>
                ) : !recipients.length ? (
                  <div className="px-6 py-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <Mail className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-slate-900">No report recipients configured</h3>
                    <p className="mt-1 text-sm text-slate-500">Add an internal inbox above to enable daily and weekly reporting distribution.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {recipients.map((recipient) => {
                      const draft = drafts[recipient.id] || toDraft(recipient);
                      const scopes = recipientScopeLabels(draft);
                      return (
                        <div key={recipient.id} className="space-y-4 px-6 py-5">
                          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_150px_140px_180px] items-start gap-4">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900">{recipient.email}</p>
                              <p className="mt-1 text-xs text-slate-500">{draft.notes || "No internal notes"}</p>
                              <p className="mt-2 text-[11px] text-slate-400">
                                Daily: {formatLastSent(recipient.lastDailySentAt)} | Weekly: {formatLastSent(recipient.lastWeeklySentAt)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {scopes.length ? scopes.map((scope) => (
                                <span key={scope} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                                  {scope}
                                </span>
                              )) : (
                                <span className="text-xs text-slate-400">No modules selected</span>
                              )}
                            </div>
                            <div className="text-sm font-medium text-slate-700">{recipientFrequencyLabel(draft)}</div>
                            <div>
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                                  draft.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                                )}
                              >
                                {draft.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-xl"
                                onClick={async () => {
                                  try {
                                    await sendAdminReportTest(recipient.id);
                                    setMessage(`Test report sent to ${recipient.email}.`);
                                  } catch (error) {
                                    setMessage(error instanceof Error ? error.message : "Could not send test report.");
                                  }
                                }}
                              >
                                <Send className="mr-1.5 h-3.5 w-3.5" />
                                Send test
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-xl"
                                onClick={async () => {
                                  if (!window.confirm(`Delete ${recipient.email}?`)) return;
                                  try {
                                    await deleteAdminReportRecipient(recipient.id);
                                    setMessage("Recipient deleted.");
                                    await load();
                                  } catch (error) {
                                    setMessage(error instanceof Error ? error.message : "Could not delete recipient.");
                                  }
                                }}
                              >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                Delete
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="grid gap-2 text-sm">
                              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Email</span>
                              <input
                                className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm"
                                value={draft.email}
                                onChange={(event) =>
                                  setDrafts((current) => ({
                                    ...current,
                                    [recipient.id]: { ...draft, email: event.target.value }
                                  }))
                                }
                              />
                            </label>
                            <label className="grid gap-2 text-sm">
                              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Notes</span>
                              <input
                                className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm"
                                value={draft.notes}
                                onChange={(event) =>
                                  setDrafts((current) => ({
                                    ...current,
                                    [recipient.id]: { ...draft, notes: event.target.value }
                                  }))
                                }
                              />
                            </label>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                            {renderCheckbox("Active", draft.isActive, (value) => setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, isActive: value } })))}
                            {renderCheckbox("Daily", draft.dailyEnabled, (value) => setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, dailyEnabled: value } })))}
                            {renderCheckbox("Weekly", draft.weeklyEnabled, (value) => setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, weeklyEnabled: value } })))}
                            {renderCheckbox("System dashboard", draft.includeSystemDashboard, (value) => setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, includeSystemDashboard: value } })))}
                            {renderCheckbox("System readiness", draft.includeSystemReadiness, (value) => setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, includeSystemReadiness: value } })))}
                            {renderCheckbox("Scale gate", draft.includeScaleGate, (value) => setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, includeScaleGate: value } })))}
                            {renderCheckbox("Security", draft.includeSecuritySummary, (value) => setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, includeSecuritySummary: value } })))}
                            {renderCheckbox("Revenue", draft.includeRevenueSummary, (value) => setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, includeRevenueSummary: value } })))}
                            {renderCheckbox("Outreach", draft.includeOutreachOverview, (value) => setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, includeOutreachOverview: value } })))}
                            {renderCheckbox("Billing diagnostics", draft.includeBillingDiagnostics, (value) => setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, includeBillingDiagnostics: value } })))}
                          </div>

                          <div className="flex justify-end">
                            <Button
                              type="button"
                              className="rounded-2xl bg-primary px-5 shadow-lg shadow-sky-200/70 hover:bg-sky-500"
                              onClick={async () => {
                                try {
                                  await updateAdminReportRecipient(recipient.id, { ...draft, notes: draft.notes || null });
                                  setMessage("Recipient updated.");
                                  await load();
                                } catch (error) {
                                  setMessage(error instanceof Error ? error.message : "Could not update recipient.");
                                }
                              }}
                            >
                              Save recipient
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border-2 border-dashed border-slate-200 bg-slate-50/60 p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-900">No reports currently in quarantine</h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Validation failures and blocked report runs will appear here when payloads fail pre-send checks. The current engine state indicates no quarantined reports.
              </p>
            </section>
          </div>
        </section>
      </div>
    </AdminGuard>
  );
}
