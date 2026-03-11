"use client";

import { useEffect, useState } from "react";
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
      setDrafts(
        Object.fromEntries(data.recipients.map((recipient) => [recipient.id, toDraft(recipient)]))
      );
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

  function renderCheckbox(
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void
  ) {
    return (
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>{label}</span>
      </label>
    );
  }

  return (
    <AdminGuard requireSuperAdmin>
      <div className="container py-10">
        <AdminTopTabs className="mb-3" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Admin Reports</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Send daily or weekly Khan Systems diagnostics to any internal email address you want.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </div>

        <section className="mt-4 rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold">Add recipient</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This is SUPER_ADMIN only. Reports use the alerts sender and include system, outreach, and billing health sections.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Email</span>
              <input
                className="w-full rounded-md border px-3 py-2"
                value={newRecipient.email}
                onChange={(event) => setNewRecipient((current) => ({ ...current, email: event.target.value }))}
                placeholder="ops@khansystems.com"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Notes</span>
              <input
                className="w-full rounded-md border px-3 py-2"
                value={newRecipient.notes}
                onChange={(event) => setNewRecipient((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Founder inbox, delivery checks, weekly ops digest"
              />
            </label>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {renderCheckbox("Active", newRecipient.isActive, (value) => setNewRecipient((current) => ({ ...current, isActive: value })))}
            {renderCheckbox("Daily", newRecipient.dailyEnabled, (value) => setNewRecipient((current) => ({ ...current, dailyEnabled: value })))}
            {renderCheckbox("Weekly", newRecipient.weeklyEnabled, (value) => setNewRecipient((current) => ({ ...current, weeklyEnabled: value })))}
            {renderCheckbox("System dashboard", newRecipient.includeSystemDashboard, (value) =>
              setNewRecipient((current) => ({ ...current, includeSystemDashboard: value }))
            )}
            {renderCheckbox("System readiness", newRecipient.includeSystemReadiness, (value) =>
              setNewRecipient((current) => ({ ...current, includeSystemReadiness: value }))
            )}
            {renderCheckbox("Scale gate", newRecipient.includeScaleGate, (value) =>
              setNewRecipient((current) => ({ ...current, includeScaleGate: value }))
            )}
            {renderCheckbox("Security + auth", newRecipient.includeSecuritySummary, (value) =>
              setNewRecipient((current) => ({ ...current, includeSecuritySummary: value }))
            )}
            {renderCheckbox("Revenue summary", newRecipient.includeRevenueSummary, (value) =>
              setNewRecipient((current) => ({ ...current, includeRevenueSummary: value }))
            )}
            {renderCheckbox("Outreach overview", newRecipient.includeOutreachOverview, (value) =>
              setNewRecipient((current) => ({ ...current, includeOutreachOverview: value }))
            )}
            {renderCheckbox("Billing diagnostics", newRecipient.includeBillingDiagnostics, (value) =>
              setNewRecipient((current) => ({ ...current, includeBillingDiagnostics: value }))
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button
              onClick={async () => {
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
              }}
              disabled={saving}
            >
              Add recipient
            </Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </section>

        <section className="mt-4 rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Current recipients</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Daily and weekly deliveries run automatically in the backend worker. Use send test to verify an inbox.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
            {!loading && !recipients.length ? <p className="text-sm text-muted-foreground">No report recipients configured yet.</p> : null}
            {recipients.map((recipient) => {
              const draft = drafts[recipient.id] || toDraft(recipient);
              return (
                <div key={recipient.id} className="rounded-lg border p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm">
                      <span className="mb-1 block font-medium">Email</span>
                      <input
                        className="w-full rounded-md border px-3 py-2"
                        value={draft.email}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [recipient.id]: { ...draft, email: event.target.value }
                          }))
                        }
                      />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block font-medium">Notes</span>
                      <input
                        className="w-full rounded-md border px-3 py-2"
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
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {renderCheckbox("Active", draft.isActive, (value) =>
                      setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, isActive: value } }))
                    )}
                    {renderCheckbox("Daily", draft.dailyEnabled, (value) =>
                      setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, dailyEnabled: value } }))
                    )}
                    {renderCheckbox("Weekly", draft.weeklyEnabled, (value) =>
                      setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, weeklyEnabled: value } }))
                    )}
                    {renderCheckbox("System dashboard", draft.includeSystemDashboard, (value) =>
                      setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, includeSystemDashboard: value } }))
                    )}
                    {renderCheckbox("System readiness", draft.includeSystemReadiness, (value) =>
                      setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, includeSystemReadiness: value } }))
                    )}
                    {renderCheckbox("Scale gate", draft.includeScaleGate, (value) =>
                      setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, includeScaleGate: value } }))
                    )}
                    {renderCheckbox("Security + auth", draft.includeSecuritySummary, (value) =>
                      setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, includeSecuritySummary: value } }))
                    )}
                    {renderCheckbox("Revenue summary", draft.includeRevenueSummary, (value) =>
                      setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, includeRevenueSummary: value } }))
                    )}
                    {renderCheckbox("Outreach overview", draft.includeOutreachOverview, (value) =>
                      setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, includeOutreachOverview: value } }))
                    )}
                    {renderCheckbox("Billing diagnostics", draft.includeBillingDiagnostics, (value) =>
                      setDrafts((current) => ({ ...current, [recipient.id]: { ...draft, includeBillingDiagnostics: value } }))
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Last daily: {recipient.lastDailySentAt ? new Date(recipient.lastDailySentAt).toLocaleString() : "never"}</span>
                    <span>Last weekly: {recipient.lastWeeklySentAt ? new Date(recipient.lastWeeklySentAt).toLocaleString() : "never"}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
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
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await sendAdminReportTest(recipient.id);
                          setMessage(`Test report sent to ${recipient.email}.`);
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : "Could not send test report.");
                        }
                      }}
                    >
                      Send test
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
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AdminGuard>
  );
}
