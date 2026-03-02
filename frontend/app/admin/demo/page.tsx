"use client";

import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/site/toast-provider";
import { fetchAdminDemoConfig, fetchAdminVapiResources, updateAdminDemoConfig } from "@/lib/api";

export default function AdminDemoPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [demoNumber, setDemoNumber] = useState("");
  const [demoVapiAssistantId, setDemoVapiAssistantId] = useState("");
  const [demoVapiPhoneNumberId, setDemoVapiPhoneNumberId] = useState("");
  const [vapiConfigured, setVapiConfigured] = useState(false);
  const [assistants, setAssistants] = useState<Array<{ id: string; name: string }>>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<Array<{ id: string; number: string; provider: string }>>([]);
  const [demoTitle, setDemoTitle] = useState("Voice Demo (Call From Your Phone)");
  const [demoSubtitle, setDemoSubtitle] = useState(
    "Call the demo line and ask questions naturally. The assistant responds live."
  );
  const [demoQuestionsText, setDemoQuestionsText] = useState(
    "What services do you offer?\nWhat are your hours?\nCan I schedule an appointment?"
  );

  useEffect(() => {
    let active = true;
    void fetchAdminDemoConfig()
      .then((data) => {
        if (!active) return;
        setDemoNumber(data.demoNumber || "");
        setDemoVapiAssistantId(data.demoVapiAssistantId || "");
        setDemoVapiPhoneNumberId(data.demoVapiPhoneNumberId || "");
        setDemoTitle(data.demoTitle || "Voice Demo (Call From Your Phone)");
        setDemoSubtitle(
          data.demoSubtitle || "Call the demo line and ask questions naturally. The assistant responds live."
        );
        setDemoQuestionsText(
          (data.demoQuestions?.length
            ? data.demoQuestions
            : ["What services do you offer?", "What are your hours?", "Can I schedule an appointment?"]
          ).join("\n")
        );
      })
      .catch((error) => {
        if (!active) return;
        showToast({
          title: "Failed to load demo settings",
          description: error instanceof Error ? error.message : "Try again.",
          variant: "error"
        });
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    void fetchAdminVapiResources()
      .then((resources) => {
        if (!active) return;
        setVapiConfigured(Boolean(resources.configured));
        setAssistants(resources.assistants || []);
        setPhoneNumbers(resources.phoneNumbers || []);
      })
      .catch(() => {
        if (!active) return;
        setVapiConfigured(false);
        setAssistants([]);
        setPhoneNumbers([]);
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  useEffect(() => {
    if (!demoVapiPhoneNumberId) return;
    const selected = phoneNumbers.find((item) => item.id === demoVapiPhoneNumberId);
    if (selected?.number) setDemoNumber(selected.number);
  }, [demoVapiPhoneNumberId, phoneNumbers]);

  async function onSave() {
    setSaving(true);
    try {
      const demoQuestions = demoQuestionsText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 12);

      await updateAdminDemoConfig({
        demoNumber: demoNumber.trim(),
        demoVapiAssistantId: demoVapiAssistantId.trim(),
        demoVapiPhoneNumberId: demoVapiPhoneNumberId.trim(),
        demoTitle: demoTitle.trim(),
        demoSubtitle: demoSubtitle.trim(),
        demoQuestions
      });

      showToast({
        title: "Demo config saved",
        description: "Homepage voice demo now uses these settings."
      });
    } catch (error) {
      showToast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminGuard>
      <div className="container py-10">
        <AdminTopTabs className="mb-3" />
        <h1 className="text-3xl font-bold">Demo Configuration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the public voice demo block shown on the landing page.
        </p>

        <div className="mt-5 rounded-lg border bg-white p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Select Vapi assistant</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={demoVapiAssistantId}
                onChange={(event) => setDemoVapiAssistantId(event.target.value)}
                disabled={loading || !vapiConfigured}
              >
                <option value="">Select assistant</option>
                {assistants.map((assistant) => (
                  <option key={assistant.id} value={assistant.id}>
                    {assistant.name} ({assistant.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Select Vapi number</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={demoVapiPhoneNumberId}
                onChange={(event) => setDemoVapiPhoneNumberId(event.target.value)}
                disabled={loading || !vapiConfigured}
              >
                <option value="">Select number</option>
                {phoneNumbers.map((number) => (
                  <option key={number.id} value={number.id}>
                    {number.number} ({number.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Resolved demo number (E.164)</label>
              <Input value={demoNumber} readOnly disabled />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Demo title</label>
              <Input value={demoTitle} onChange={(event) => setDemoTitle(event.target.value)} disabled={loading} />
            </div>
          </div>
          {!vapiConfigured ? (
            <p className="mt-2 text-xs text-amber-600">
              Vapi API key is not configured on backend. Set it first to load assistants and numbers.
            </p>
          ) : null}

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">Demo subtitle</label>
            <Textarea
              value={demoSubtitle}
              onChange={(event) => setDemoSubtitle(event.target.value)}
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">Suggested questions (one per line)</label>
            <Textarea
              value={demoQuestionsText}
              onChange={(event) => setDemoQuestionsText(event.target.value)}
              rows={5}
              disabled={loading}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              These are shown as prompts to help visitors test the call demo.
            </p>
          </div>

          <div className="mt-5">
            <Button onClick={() => void onSave()} disabled={loading || saving}>
              {saving ? "Saving..." : "Save demo config"}
            </Button>
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}
