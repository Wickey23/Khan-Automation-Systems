"use client";

import { useEffect, useState } from "react";
import { fetchOrgSettings, updateOrgSettings } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FormState = {
  hoursJson: string;
  afterHoursMode: "TAKE_MESSAGE" | "TRANSFER" | "VOICEMAIL";
  transferNumbersJson: string;
  notificationEmailsJson: string;
  notificationPhonesJson: string;
  languagesJson: string;
  recordingConsentEnabled: boolean;
  smsConsentText: string;
  timezone: string;
  servicesJson: string;
  policiesJson: string;
};

const defaults: FormState = {
  hoursJson: '{"timezone":"America/New_York","schedule":{}}',
  afterHoursMode: "TAKE_MESSAGE",
  transferNumbersJson: "[]",
  notificationEmailsJson: "[]",
  notificationPhonesJson: "[]",
  languagesJson: '["English"]',
  recordingConsentEnabled: false,
  smsConsentText: "",
  timezone: "America/New_York",
  servicesJson: "[]",
  policiesJson: "{}"
};

export default function AppSettingsPage() {
  const { showToast } = useToast();
  const [state, setState] = useState<FormState>(defaults);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchOrgSettings()
      .then(({ settings }) =>
        setState({
          hoursJson: settings.hoursJson,
          afterHoursMode: settings.afterHoursMode,
          transferNumbersJson: settings.transferNumbersJson,
          notificationEmailsJson: settings.notificationEmailsJson,
          notificationPhonesJson: settings.notificationPhonesJson,
          languagesJson: settings.languagesJson,
          recordingConsentEnabled: settings.recordingConsentEnabled,
          smsConsentText: settings.smsConsentText,
          timezone: settings.timezone,
          servicesJson: settings.servicesJson,
          policiesJson: settings.policiesJson
        })
      )
      .catch((error) =>
        showToast({
          title: "Could not load settings",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "error"
        })
      );
  }, [showToast]);

  async function onSave() {
    setSaving(true);
    try {
      await updateOrgSettings(state);
      showToast({ title: "Business settings saved" });
    } catch (error) {
      showToast({ title: "Save failed", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Business Settings</h1>
      <p className="text-sm text-muted-foreground">These settings affect AI behavior, transfer logic, and notification routing.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Timezone</Label>
          <Input value={state.timezone} onChange={(e) => setState((p) => ({ ...p, timezone: e.target.value }))} />
        </div>
        <div>
          <Label>After-hours Mode</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            value={state.afterHoursMode}
            onChange={(e) => setState((p) => ({ ...p, afterHoursMode: e.target.value as FormState["afterHoursMode"] }))}
          >
            <option value="TAKE_MESSAGE">Take message</option>
            <option value="TRANSFER">Transfer</option>
            <option value="VOICEMAIL">Voicemail</option>
          </select>
        </div>
      </div>

      <div>
        <Label>Business Hours JSON</Label>
        <Textarea value={state.hoursJson} onChange={(e) => setState((p) => ({ ...p, hoursJson: e.target.value }))} />
      </div>
      <div>
        <Label>Transfer Numbers JSON</Label>
        <Textarea value={state.transferNumbersJson} onChange={(e) => setState((p) => ({ ...p, transferNumbersJson: e.target.value }))} />
      </div>
      <div>
        <Label>Notification Emails JSON</Label>
        <Textarea value={state.notificationEmailsJson} onChange={(e) => setState((p) => ({ ...p, notificationEmailsJson: e.target.value }))} />
      </div>
      <div>
        <Label>Notification Phones JSON</Label>
        <Textarea value={state.notificationPhonesJson} onChange={(e) => setState((p) => ({ ...p, notificationPhonesJson: e.target.value }))} />
      </div>
      <div>
        <Label>Languages JSON</Label>
        <Textarea value={state.languagesJson} onChange={(e) => setState((p) => ({ ...p, languagesJson: e.target.value }))} />
      </div>
      <div>
        <Label>Services JSON</Label>
        <Textarea value={state.servicesJson} onChange={(e) => setState((p) => ({ ...p, servicesJson: e.target.value }))} />
      </div>
      <div>
        <Label>Policies JSON</Label>
        <Textarea value={state.policiesJson} onChange={(e) => setState((p) => ({ ...p, policiesJson: e.target.value }))} />
      </div>
      <div>
        <Label>SMS Consent Text</Label>
        <Textarea value={state.smsConsentText} onChange={(e) => setState((p) => ({ ...p, smsConsentText: e.target.value }))} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.recordingConsentEnabled}
          onChange={(e) => setState((p) => ({ ...p, recordingConsentEnabled: e.target.checked }))}
        />
        Recording consent required
      </label>
      <Button onClick={onSave} disabled={saving}>
        {saving ? "Saving..." : "Save business settings"}
      </Button>
    </div>
  );
}
