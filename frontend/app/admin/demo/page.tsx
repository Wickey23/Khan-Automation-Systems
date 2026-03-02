"use client";

import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/site/toast-provider";
import { fetchAdminDemoCalls, fetchAdminDemoConfig, fetchAdminVapiResources, updateAdminDemoConfig } from "@/lib/api";
import type { DemoCallLog } from "@/lib/types";

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
  const [callsLoading, setCallsLoading] = useState(true);
  const [calls, setCalls] = useState<DemoCallLog[]>([]);

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

  async function loadDemoCalls() {
    setCallsLoading(true);
    try {
      const data = await fetchAdminDemoCalls(120);
      setCalls(data.calls || []);
    } catch {
      setCalls([]);
    } finally {
      setCallsLoading(false);
    }
  }

  useEffect(() => {
    void loadDemoCalls();
  }, []);

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

        <div className="mt-6 rounded-lg border bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Demo Call Logs</h2>
              <p className="text-sm text-muted-foreground">
                Calls made to the demo assistant/number with summary, transcript, and call metadata.
              </p>
            </div>
            <Button variant="outline" onClick={() => void loadDemoCalls()} disabled={callsLoading}>
              {callsLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          <div className="space-y-3">
            {calls.map((call) => (
              <div key={call.id} className="rounded-md border p-3">
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <p><span className="text-muted-foreground">Started:</span> {new Date(call.startedAt).toLocaleString()}</p>
                  <p><span className="text-muted-foreground">From:</span> {call.fromNumber}</p>
                  <p><span className="text-muted-foreground">To:</span> {call.toNumber}</p>
                  <p><span className="text-muted-foreground">Status:</span> {call.status || "-"}</p>
                  <p><span className="text-muted-foreground">Outcome:</span> {call.outcome || "-"}</p>
                  <p><span className="text-muted-foreground">Duration:</span> {call.durationSec ? `${call.durationSec}s` : "-"}</p>
                  <p><span className="text-muted-foreground">Success:</span> {typeof call.successEvaluation === "number" ? `${call.successEvaluation}` : "-"}</p>
                  <p className="truncate"><span className="text-muted-foreground">Call ID:</span> {call.providerCallId}</p>
                </div>
                <div className="mt-2 grid gap-2 lg:grid-cols-2">
                  <div className="rounded-md border bg-muted/20 p-2">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
                    <p className="whitespace-pre-wrap text-sm">{call.aiSummary || "-"}</p>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-2">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transcript</p>
                    <p className="max-h-36 overflow-auto whitespace-pre-wrap text-sm">{call.transcript || "-"}</p>
                  </div>
                </div>
                {call.recordingUrl ? (
                  <a className="mt-2 inline-block text-sm text-primary underline" href={call.recordingUrl} target="_blank" rel="noreferrer">
                    Open recording
                  </a>
                ) : null}
              </div>
            ))}
            {!callsLoading && !calls.length ? (
              <p className="text-sm text-muted-foreground">No demo calls logged yet.</p>
            ) : null}
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}
