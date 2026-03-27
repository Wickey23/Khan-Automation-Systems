"use client";

import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, PageShell, SectionHeading, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/site/toast-provider";
import { fetchAdminDemoCalls, fetchAdminDemoConfig, fetchAdminVapiResources, updateAdminDemoConfig } from "@/lib/api";
import type { DemoCallLog } from "@/lib/types";

function extractField(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function deriveDemoSummary(call: DemoCallLog) {
  const source = `${call.aiSummary || ""}\n${call.transcript || ""}`;
  const callerName = extractField(source, [
    /name[:\s-]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i,
    /this is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i
  ]);
  const serviceRequested = extractField(source, [
    /service(?: requested)?[:\s-]+([^\n.]+)/i,
    /issue(?: summary)?[:\s-]+([^\n.]+)/i,
    /need help with\s+([^\n.]+)/i
  ]);
  const urgency = extractField(source, [/urgency[:\s-]+([^\n.]+)/i, /(urgent|emergency|asap|today)/i]);
  const serviceLocation = extractField(source, [/address[:\s-]+([^\n.]+)/i, /located at\s+([^\n.]+)/i]);
  const appointmentRequested =
    /appointment requested[:\s-]+yes/i.test(source) ||
    /schedule|book|appointment/i.test(source) ||
    call.outcome === "APPOINTMENT_REQUEST";
  const summary = call.aiSummary || serviceRequested || "Structured summary not available yet.";
  const followUp =
    call.outcome === "MISSED" || call.outcome === "MESSAGE_TAKEN" || call.outcome === "APPOINTMENT_REQUEST"
      ? "Team should follow up"
      : call.outcome === "SPAM"
        ? "No action needed"
        : "Review outcome";
  return { callerName, serviceRequested, urgency, serviceLocation, appointmentRequested, summary, followUp };
}

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

  const demoStats = [
    { label: "Assistants", value: assistants.length },
    { label: "Phone numbers", value: phoneNumbers.length },
    { label: "Demo calls", value: calls.length },
    { label: "Appointment intent", value: calls.filter((call) => call.outcome === "APPOINTMENT_REQUEST").length }
  ];

  return (
    <AdminGuard>
      <PageShell className="space-y-5">
        <AdminTopTabs />
        <PageHeader
          eyebrow="Demo operations"
          title="Public voice demo configuration"
          description="Manage assistant and number bindings for the public demo experience and review structured demo call outcomes."
          actions={
            <Button variant="outline" onClick={() => void loadDemoCalls()} disabled={callsLoading}>
              {callsLoading ? "Refreshing..." : "Refresh calls"}
            </Button>
          }
        />

        <div className="grid gap-3 md:grid-cols-4">
          {demoStats.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>

        <SectionShell className="surface-panel space-y-4">
          <SectionHeading title="Demo setup" description="Bind Vapi resources and configure visitor-facing copy." />
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
        </SectionShell>

        <SectionShell className="surface-panel space-y-4">
          <SectionHeading
            title="Demo call logs"
            description="Calls made to the demo assistant or number, with structured intake summaries."
            actions={
              <Button variant="outline" onClick={() => void loadDemoCalls()} disabled={callsLoading}>
                {callsLoading ? "Refreshing..." : "Refresh"}
              </Button>
            }
          />

          <div className="space-y-3">
            {calls.map((call) => (
              <div key={call.id} className="rounded-md border p-3">
                {(() => {
                  const structured = deriveDemoSummary(call);
                  return (
                    <>
                      <div className="mb-3 rounded-md border bg-muted/20 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Structured intake result</p>
                        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                          <p><span className="text-muted-foreground">Caller:</span> {structured.callerName || call.fromNumber}</p>
                          <p><span className="text-muted-foreground">Service:</span> {structured.serviceRequested || "Not captured"}</p>
                          <p><span className="text-muted-foreground">Urgency:</span> {structured.urgency || "Standard"}</p>
                          <p><span className="text-muted-foreground">Location:</span> {structured.serviceLocation || "Not captured"}</p>
                          <p><span className="text-muted-foreground">Appointment requested:</span> {structured.appointmentRequested ? "Yes" : "No"}</p>
                          <p><span className="text-muted-foreground">Next step:</span> {structured.followUp}</p>
                        </div>
                        <p className="mt-2 text-sm">{structured.summary}</p>
                      </div>
                    </>
                  );
                })()}
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
              <StateCard variant="empty" title="No demo calls logged yet" />
            ) : null}
          </div>
        </SectionShell>
      </PageShell>
    </AdminGuard>
  );
}

