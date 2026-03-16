"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";

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

function scopesForRecipient(recipient: RecipientDraft) {
  const scopes: string[] = [];
  if (recipient.includeSystemDashboard) scopes.push("Daily Health");
  if (recipient.includeBillingDiagnostics) scopes.push("Billing Diagnostics");
  if (recipient.includeOutreachOverview) scopes.push("Outreach Stats");
  if (recipient.includeSystemReadiness) scopes.push("Readiness");
  if (recipient.includeScaleGate) scopes.push("Scale Gate");
  return scopes;
}

function frequencyLabel(recipient: RecipientDraft) {
  if (recipient.dailyEnabled && recipient.weeklyEnabled) return "Daily + Weekly";
  if (recipient.dailyEnabled) return "Daily";
  if (recipient.weeklyEnabled) return "Weekly";
  return "Manual only";
}

export default function AdminReportsPage() {
  const [recipients, setRecipients] = useState<AdminReportRecipient[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RecipientDraft>>({});
  const [newRecipient, setNewRecipient] = useState<RecipientDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  const filteredRecipients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter((recipient) => {
      const draft = drafts[recipient.id] || toDraft(recipient);
      return recipient.email.toLowerCase().includes(q) || (draft.notes || "").toLowerCase().includes(q);
    });
  }, [drafts, recipients, search]);

  async function addRecipient() {
    setSaving(true);
    try {
      await createAdminReportRecipient({
        ...newRecipient,
        notes: newRecipient.notes || null
      });
      setNewRecipient(emptyDraft);
      setMessage("Report recipient added.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add report recipient.");
    } finally {
      setSaving(false);
    }
  }

  async function saveRecipient(recipient: AdminReportRecipient) {
    const draft = drafts[recipient.id] || toDraft(recipient);
    try {
      await updateAdminReportRecipient(recipient.id, {
        ...draft,
        notes: draft.notes || null
      });
      setMessage("Recipient updated.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update recipient.");
    }
  }

  return (
    <AdminGuard requireSuperAdmin>
      <div className="page-shell space-y-6">
        <AdminTopTabs />

        <section className="rounded-[18px] border border-slate-300 bg-white px-6 py-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                Internal Only
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">Reports & Diagnostics</h1>
              <p className="mt-2 text-sm text-slate-600">
                Internal system reporting and automated diagnostic distribution for core operators.
              </p>
            </div>
            <div className="flex gap-4">
              <div className="min-w-[180px] rounded-xl border border-slate-200 bg-white px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Reporting Engine</span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm font-bold text-slate-900">Healthy</span>
                </div>
              </div>
              <div className="min-w-[180px] rounded-xl border border-slate-200 bg-white px-4 py-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Last Global Batch</span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    {recipients.some((item) => item.lastDailySentAt) ? "Recently sent" : "No recent batch"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          {message ? <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div> : null}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Available Internal Reports</h2>
            <Button variant="ghost" size="sm">Create New Report Definition</Button>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                code: "LATENCY-A",
                title: "Daily Operational Health",
                body: "Call handling stats, drop-off rates, and cluster-wide latency metrics."
              },
              {
                code: "FIN-AUDIT",
                title: "Billing & Subscription Audit",
                body: "Tracks failed payments, card expiries, and automated organization blocks."
              },
              {
                code: "VELOCITY-1",
                title: "System Readiness Baseline",
                body: "Measures onboarding velocity and provisioning success for new instances."
              }
            ].map((report) => (
              <div key={report.code} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">{report.code.slice(0, 2)}</div>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold">{report.code}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-950">{report.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{report.body}</p>
                </div>
                <div className="mt-auto flex gap-2">
                  <Button className="flex-1" size="sm">Configure</Button>
                  <Button className="flex-1" size="sm" variant="outline">Preview</Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Report Recipients</h2>
            <Button size="sm">Add Recipient</Button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <Input
                placeholder="ops@frontdeskos.com"
                value={newRecipient.email}
                onChange={(event) => setNewRecipient((current) => ({ ...current, email: event.target.value }))}
              />
              <Input
                placeholder="Founder inbox, delivery checks, weekly ops digest"
                value={newRecipient.notes}
                onChange={(event) => setNewRecipient((current) => ({ ...current, notes: event.target.value }))}
              />
              <Button onClick={() => void addRecipient()} disabled={saving}>
                {saving ? "Adding..." : "Create"}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
              {[
                ["Active", "isActive"],
                ["Daily", "dailyEnabled"],
                ["Weekly", "weeklyEnabled"],
                ["System Dashboard", "includeSystemDashboard"],
                ["System Readiness", "includeSystemReadiness"],
                ["Scale Gate", "includeScaleGate"],
                ["Security Summary", "includeSecuritySummary"],
                ["Revenue Summary", "includeRevenueSummary"],
                ["Outreach Overview", "includeOutreachOverview"],
                ["Billing Diagnostics", "includeBillingDiagnostics"]
              ].map(([label, key]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newRecipient[key as keyof RecipientDraft] as boolean}
                    onChange={(event) =>
                      setNewRecipient((current) => ({ ...current, [key]: event.target.checked }))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <Input placeholder="Search recipients or notes..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  <th className="px-6 py-4">Recipient</th>
                  <th className="px-6 py-4">Report Scope</th>
                  <th className="px-6 py-4">Frequency</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">Loading recipients...</td>
                  </tr>
                ) : null}
                {!loading && !filteredRecipients.length ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">No report recipients configured yet.</td>
                  </tr>
                ) : null}
                {filteredRecipients.map((recipient) => {
                  const draft = drafts[recipient.id] || toDraft(recipient);
                  const scopes = scopesForRecipient(draft);
                  return (
                    <tr key={recipient.id} className={!draft.isActive ? "opacity-60" : ""}>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{draft.email}</p>
                          <p className="text-[10px] uppercase text-slate-500">{draft.notes || "Internal distribution"}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {scopes.slice(0, 3).map((scope) => (
                            <span key={scope} className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                              {scope}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{frequencyLabel(draft)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded px-2 py-1 text-[10px] font-bold ${draft.isActive ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}>
                          {draft.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await sendAdminReportTest(recipient.id);
                                setMessage(`Test report sent to ${recipient.email}.`);
                              } catch (error) {
                                setMessage(error instanceof Error ? error.message : "Could not send test report.");
                              }
                            }}
                          >
                            Send Test
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void saveRecipient(recipient)}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
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
                            Delete
                          </Button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                          <span>Last daily: {recipient.lastDailySentAt ? new Date(recipient.lastDailySentAt).toLocaleString() : "never"}</span>
                          <span>Last weekly: {recipient.lastWeeklySentAt ? new Date(recipient.lastWeeklySentAt).toLocaleString() : "never"}</span>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <Input
                            value={draft.email}
                            onChange={(event) =>
                              setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, email: event.target.value } }))
                            }
                          />
                          <Input
                            value={draft.notes}
                            onChange={(event) =>
                              setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, notes: event.target.value } }))
                            }
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                          {[
                            ["Active", "isActive"],
                            ["Daily", "dailyEnabled"],
                            ["Weekly", "weeklyEnabled"],
                            ["System Dashboard", "includeSystemDashboard"],
                            ["System Readiness", "includeSystemReadiness"],
                            ["Scale Gate", "includeScaleGate"],
                            ["Security Summary", "includeSecuritySummary"],
                            ["Revenue Summary", "includeRevenueSummary"],
                            ["Outreach Overview", "includeOutreachOverview"],
                            ["Billing Diagnostics", "includeBillingDiagnostics"]
                          ].map(([label, key]) => (
                            <label key={key} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={draft[key as keyof RecipientDraft] as boolean}
                                onChange={(event) =>
                                  setDrafts((current) => ({
                                    ...current,
                                    [recipient.id]: { ...draft, [key]: event.target.checked }
                                  }))
                                }
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-950">Quarantined Reports</h2>
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
            <h3 className="font-semibold text-slate-950">No reports currently in quarantine</h3>
            <p className="mt-1 text-sm text-slate-500">
              All diagnostic processes are operating within normal baseline parameters. Quarantined reports appear here if validation fails.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-between border-t border-slate-200 pt-8 text-slate-400">
          <div className="flex gap-4 text-xs">
            <span>API Node: report-worker-01</span>
            <span>DB Status: Synced</span>
          </div>
          <Button variant="outline" onClick={() => void load()}>
            Force Global Batch Run
          </Button>
        </section>
      </div>
    </AdminGuard>
  );
}
