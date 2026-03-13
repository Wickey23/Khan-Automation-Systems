"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { OutreachSubnav } from "@/components/admin/outreach-subnav";
import { createAdminOutreachCallerConfig, fetchAdminOutreachCallerConfigs, updateAdminOutreachCallerConfig } from "@/lib/api";
import type { OutreachCallerConfig } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_FORM = {
  name: "Primary Outreach Caller",
  description: "AI caller for live prospecting and intro calls.",
  isActive: true,
  vapiPhoneNumberId: "",
  twilioFromNumber: "",
  timezone: "America/New_York",
  windowStartHour: 9,
  windowEndHour: 17,
  maxCallsPerDay: 20,
  prompt: ""
};

export default function AdminOutreachCallerPage() {
  const { showToast } = useToast();
  const [configs, setConfigs] = useState<OutreachCallerConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const load = useCallback(async () => {
    try {
      const data = await fetchAdminOutreachCallerConfigs();
      const callerConfigs = data.callerConfigs || [];
      setConfigs(callerConfigs);
      const selected = callerConfigs.find((item) => item.id === selectedId) || callerConfigs[0];
      if (selected) {
        setSelectedId(selected.id);
        setForm({
          name: selected.name,
          description: selected.description || "",
          isActive: selected.isActive,
          vapiPhoneNumberId: selected.vapiPhoneNumberId || "",
          twilioFromNumber: selected.twilioFromNumber || "",
          timezone: selected.timezone,
          windowStartHour: selected.windowStartHour,
          windowEndHour: selected.windowEndHour,
          maxCallsPerDay: selected.maxCallsPerDay,
          prompt: selected.prompt || ""
        });
      }
    } catch (error) {
      showToast({
        title: "Could not load Caller AI settings",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }, [selectedId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave() {
    setSaving(true);
    try {
      if (selectedId) {
        await updateAdminOutreachCallerConfig(selectedId, form);
      } else {
        const created = await createAdminOutreachCallerConfig(form);
        setSelectedId(created.callerConfig.id);
      }
      await load();
      showToast({ title: "Caller AI settings saved" });
    } catch (error) {
      showToast({
        title: "Could not save Caller AI settings",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminGuard requireSuperAdmin>
      <div className="container py-10 space-y-6">
        <AdminTopTabs />
        <PageHeader
          eyebrow="Internal growth"
          title="Caller AI"
          description="Configure the phone number, calling window, daily cap, and script used when outreach leads are enrolled for AI calling instead of email."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void load()}>Refresh</Button>
              <Button onClick={() => void onSave()} disabled={saving}>{saving ? "Saving..." : "Save caller setup"}</Button>
            </div>
          }
        />
        <OutreachSubnav />

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Caller profiles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {configs.length ? configs.map((config) => (
                <button
                  key={config.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(config.id);
                    setForm({
                      name: config.name,
                      description: config.description || "",
                      isActive: config.isActive,
                      vapiPhoneNumberId: config.vapiPhoneNumberId || "",
                      twilioFromNumber: config.twilioFromNumber || "",
                      timezone: config.timezone,
                      windowStartHour: config.windowStartHour,
                      windowEndHour: config.windowEndHour,
                      maxCallsPerDay: config.maxCallsPerDay,
                      prompt: config.prompt || ""
                    });
                  }}
                  className={`w-full rounded-lg border px-4 py-3 text-left ${selectedId === config.id ? "border-primary bg-primary/5" : "border-zinc-200 bg-white hover:bg-zinc-50"}`}
                >
                  <div className="font-medium">{config.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{config.description || "No description"}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {config.isActive ? "Active" : "Inactive"} · {config.windowStartHour}:00-{config.windowEndHour}:00 · {config.timezone}
                  </div>
                </button>
              )) : (
                <div className="text-sm text-muted-foreground">No caller AI profiles yet. Create one to enroll leads into AI phone outreach.</div>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSelectedId(null);
                  setForm(DEFAULT_FORM);
                }}
              >
                New caller profile
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{selectedId ? "Edit caller profile" : "Create caller profile"}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Vapi phone number ID</Label>
                <Input value={form.vapiPhoneNumberId} onChange={(e) => setForm((current) => ({ ...current, vapiPhoneNumberId: e.target.value }))} placeholder="pn_xxx" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Twilio caller ID label</Label>
                <Input value={form.twilioFromNumber} onChange={(e) => setForm((current) => ({ ...current, twilioFromNumber: e.target.value }))} placeholder="+15551234567" />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input value={form.timezone} onChange={(e) => setForm((current) => ({ ...current, timezone: e.target.value }))} placeholder="America/New_York" />
              </div>
              <div className="space-y-2">
                <Label>Call window start hour</Label>
                <Input type="number" min={0} max={23} value={form.windowStartHour} onChange={(e) => setForm((current) => ({ ...current, windowStartHour: Number(e.target.value || 9) }))} />
              </div>
              <div className="space-y-2">
                <Label>Call window end hour</Label>
                <Input type="number" min={1} max={24} value={form.windowEndHour} onChange={(e) => setForm((current) => ({ ...current, windowEndHour: Number(e.target.value || 17) }))} />
              </div>
              <div className="space-y-2">
                <Label>Max calls per day</Label>
                <Input type="number" min={1} max={500} value={form.maxCallsPerDay} onChange={(e) => setForm((current) => ({ ...current, maxCallsPerDay: Number(e.target.value || 20) }))} />
              </div>
              <div className="space-y-2 flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.checked }))} />
                  Active caller profile
                </label>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Custom outreach script</Label>
                <Textarea
                  rows={10}
                  value={form.prompt}
                  onChange={(e) => setForm((current) => ({ ...current, prompt: e.target.value }))}
                  placeholder="Optional campaign-specific instructions, offer, target industries, or qualification notes."
                />
              </div>
              <div className="md:col-span-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-muted-foreground">
                Leads enrolled into this caller profile will be called only during the configured daily window. Use the outreach runner to process both email and AI phone enrollments. Keep the prompt short, professional, and focused on gauging interest plus the preferred next step.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminGuard>
  );
}
