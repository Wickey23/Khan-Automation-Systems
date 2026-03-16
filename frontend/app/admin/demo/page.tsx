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

function extractField(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function deriveDemoSummary(call: DemoCallLog) {
  const source = `${call.aiSummary || ""}\n${call.transcript || ""}`;
  const callerName = extractField(source, [/name[:\s-]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i, /this is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i]);
  const serviceRequested = extractField(source, [/service(?: requested)?[:\s-]+([^\n.]+)/i, /issue(?: summary)?[:\s-]+([^\n.]+)/i, /need help with\s+([^\n.]+)/i]);
  const urgency = extractField(source, [/urgency[:\s-]+([^\n.]+)/i, /(urgent|emergency|asap|today)/i]);
  return {
    callerName,
    serviceRequested,
    urgency,
    followUp:
      call.outcome === "MISSED" || call.outcome === "MESSAGE_TAKEN" || call.outcome === "APPOINTMENT_REQUEST"
        ? "Team should follow up"
        : call.outcome === "SPAM"
          ? "No action needed"
          : "Review outcome"
  };
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
  const [demoSubtitle, setDemoSubtitle] = useState("Call the demo line and ask questions naturally. The assistant responds live.");
  const [demoQuestionsText, setDemoQuestionsText] = useState("What services do you offer?\nWhat are your hours?\nCan I schedule an appointment?");
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
        setDemoSubtitle(data.demoSubtitle || "Call the demo line and ask questions naturally. The assistant responds live.");
        setDemoQuestionsText((data.demoQuestions?.length ? data.demoQuestions : ["What services do you offer?", "What are your hours?", "Can I schedule an appointment?"]).join("\n"));
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
        if (active) setLoading(false);
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
      const demoQuestions = demoQuestionsText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12);
      await updateAdminDemoConfig({
        demoNumber: demoNumber.trim(),
        demoVapiAssistantId: demoVapiAssistantId.trim(),
        demoVapiPhoneNumberId: demoVapiPhoneNumberId.trim(),
        demoTitle: demoTitle.trim(),
        demoSubtitle: demoSubtitle.trim(),
        demoQuestions
      });
      showToast({ title: "Demo config saved", description: "Homepage voice demo now uses these settings." });
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
      <div className="page-shell space-y-6">
        <AdminTopTabs />

        <section className="rounded-[18px] border border-slate-300 bg-white px-6 py-5 shadow-[0_14px_32px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                Internal Only
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">Demo Environment Management</h1>
              <p className="max-w-3xl text-sm text-slate-600">
                Configure sandbox instances, AI persona behavior, and the public sales demo line from one admin surface.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => void loadDemoCalls()}>
                Export Logs
              </Button>
              <Button onClick={() => void onSave()} disabled={loading || saving}>
                {saving ? "Saving..." : "Provision New Demo"}
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Active Demo Orgs", value: 42, detail: "+4 this week" },
            { label: "Avg Call Duration", value: "18m 42s", detail: "Stable" },
            { label: "Active Presets", value: 12, detail: "2 need updates" },
            { label: "Success Rate", value: "89%", detail: "+2% from avg" }
          ].map((item) => (
            <div key={item.label} className="rounded-[18px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
              <p className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-slate-950">{item.value}</p>
              <p className="mt-2 text-sm text-slate-500">{item.detail}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[18px] border border-slate-300 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">Live Demo Instances</h2>
                <Button variant="outline" size="sm">View All Instances</Button>
              </div>
              <div className="p-6 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Select Vapi assistant</label>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={demoVapiAssistantId} onChange={(event) => setDemoVapiAssistantId(event.target.value)} disabled={loading || !vapiConfigured}>
                    <option value="">Select assistant</option>
                    {assistants.map((assistant) => (
                      <option key={assistant.id} value={assistant.id}>{assistant.name} ({assistant.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Select Vapi number</label>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={demoVapiPhoneNumberId} onChange={(event) => setDemoVapiPhoneNumberId(event.target.value)} disabled={loading || !vapiConfigured}>
                    <option value="">Select number</option>
                    {phoneNumbers.map((number) => (
                      <option key={number.id} value={number.id}>{number.number} ({number.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Resolved demo number</label>
                  <Input value={demoNumber} readOnly disabled />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Demo title</label>
                  <Input value={demoTitle} onChange={(event) => setDemoTitle(event.target.value)} disabled={loading} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">Demo subtitle</label>
                  <Textarea value={demoSubtitle} onChange={(event) => setDemoSubtitle(event.target.value)} rows={3} disabled={loading} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">Suggested questions</label>
                  <Textarea value={demoQuestionsText} onChange={(event) => setDemoQuestionsText(event.target.value)} rows={5} disabled={loading} />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[18px] border border-slate-300 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">Recent Demo Call Logs</h2>
                <Button variant="outline" size="sm" onClick={() => void loadDemoCalls()}>{callsLoading ? "Refreshing..." : "Refresh"}</Button>
              </div>
              <div className="divide-y divide-slate-100">
                {calls.map((call) => {
                  const structured = deriveDemoSummary(call);
                  return (
                    <div key={call.id} className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-950">{structured.callerName || call.fromNumber}</p>
                          <p className="text-xs text-slate-500">{call.outcome || "UNKNOWN"} • {new Date(call.startedAt).toLocaleString()}</p>
                        </div>
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                          {structured.followUp}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-700">{structured.serviceRequested || call.aiSummary || "Structured summary not available yet."}</p>
                      <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-4">
                        <p>Urgency: {structured.urgency || "Standard"}</p>
                        <p>Duration: {call.durationSec ? `${call.durationSec}s` : "-"}</p>
                        <p>Success: {call.successEvaluation ?? "-"}</p>
                        <p>Call ID: {call.providerCallId}</p>
                      </div>
                    </div>
                  );
                })}
                {!callsLoading && !calls.length ? (
                  <div className="p-6 text-sm text-slate-500">No demo calls logged yet.</div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[18px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">AI Persona Presets</h2>
              <div className="mt-4 space-y-3">
                {[
                  ["Aggressive Booking", "Pushes for next steps in the first 5 minutes."],
                  ["Drunk Simulator", "Tests interruption handling and rational recovery."],
                  ["No-Budget Skeptic", "Stress-tests ROI and price objection flows."],
                  ["The Fanboy", "Checks if reps skip required discovery steps."]
                ].map(([title, body], index) => (
                  <div key={title} className={`rounded-xl border p-3 ${index === 0 ? "border-primary bg-primary/5" : "border-slate-200"}`}>
                    <p className={`text-sm font-semibold ${index === 0 ? "text-primary" : "text-slate-950"}`}>{title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[22px] bg-slate-950 p-6 text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
              <h2 className="text-2xl font-semibold tracking-[-0.04em]">Quick Demo Instance</h2>
              <p className="mt-2 text-sm text-slate-300">
                Deploy a fresh demo environment with pre-populated dummy data and an active sales pipeline in seconds.
              </p>
              <Button className="mt-6 w-full" onClick={() => void onSave()} disabled={loading || saving}>
                {saving ? "Deploying..." : "Deploy Now"}
              </Button>
              {!vapiConfigured ? (
                <p className="mt-3 text-xs text-amber-300">Vapi API key is not configured on backend. Set it first to load assistants and numbers.</p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </AdminGuard>
  );
}
