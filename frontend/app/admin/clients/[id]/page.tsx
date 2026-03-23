"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  assignClientNumber,
  fetchAdminClientById,
  fetchAdminClientCalls,
  fetchAdminClientLeads,
  replaceClientNumber,
  updateAdminClientStatus,
  updateClientAiConfig
} from "@/lib/api";
import type { AIConfig, CallRecord, Client, Lead } from "@/lib/types";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, PageShell, SectionHeading, SectionShell } from "@/components/ui/page";
import { StateCard } from "@/components/ui/state-card";

function parseJsonValue<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function AdminClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [status, setStatus] = useState<Client["status"]>("NEEDS_CONFIGURATION");
  const [areaCode, setAreaCode] = useState("");
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiConfig, setAiConfig] = useState<Partial<AIConfig>>({
    greetingText: "",
    afterHoursMessage: "",
    transferRulesJson: "{}",
    intakeQuestionsJson: "[]",
    systemPrompt: "",
    smsEnabled: false,
    testMode: true
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [clientData, leadsData, callsData] = await Promise.all([
      fetchAdminClientById(id),
      fetchAdminClientLeads(id),
      fetchAdminClientCalls(id)
    ]);
    setClient(clientData.client);
    setLeads(leadsData.leads);
    setCalls(callsData.calls);
    setStatus(clientData.client.status);
    setAiConfig({
      greetingText: clientData.client.aiConfig?.greetingText || "",
      afterHoursMessage: clientData.client.aiConfig?.afterHoursMessage || "",
      transferRulesJson: clientData.client.aiConfig?.transferRulesJson || "{}",
      intakeQuestionsJson: clientData.client.aiConfig?.intakeQuestionsJson || "[]",
      systemPrompt: clientData.client.aiConfig?.systemPrompt || "",
      smsEnabled: clientData.client.aiConfig?.smsEnabled || false,
      testMode: clientData.client.aiConfig?.testMode ?? true
    });
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load().catch(() => setLoading(false));
  }, [load]);

  const services = useMemo(
    () => parseJsonValue<string[]>(client?.setting?.servicesJson, []),
    [client?.setting?.servicesJson]
  );

  async function onAssign() {
    try {
      await assignClientNumber(id, { areaCode: areaCode || undefined, sms: smsEnabled });
      showToast({ title: "Phone number assigned" });
      await load();
    } catch (error) {
      showToast({
        title: "Assign failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function onReplace() {
    try {
      await replaceClientNumber(id, { areaCode: areaCode || undefined, sms: smsEnabled });
      showToast({ title: "Phone number replaced" });
      await load();
    } catch (error) {
      showToast({
        title: "Replace failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function onSaveStatus() {
    try {
      await updateAdminClientStatus(id, status);
      showToast({ title: "Status updated" });
      await load();
    } catch (error) {
      showToast({
        title: "Status update failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function onSaveAiConfig() {
    try {
      await updateClientAiConfig(id, aiConfig);
      showToast({ title: "AI config saved" });
      await load();
    } catch (error) {
      showToast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  return (
    <AdminGuard>
      <PageShell className="space-y-6">
        <PageHeader
          eyebrow="Client workspace"
          title={client?.name || "Client detail"}
          description="Manage status, telephony provisioning, and AI assistant behavior for this client account."
          actions={
            <Link href="/admin/clients">
              <Button variant="outline">Back to clients</Button>
            </Link>
          }
        />

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Status</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{client?.status || "-"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Leads</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{leads.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Calls</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{calls.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Phone line</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{client?.phoneLine?.phoneNumber || "Not assigned"}</p>
          </div>
        </div>

        {loading ? (
          <SectionShell className="surface-panel">
            <StateCard variant="loading" title="Loading client workspace" />
          </SectionShell>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <SectionShell className="surface-panel">
                <SectionHeading title="Client setup intake" description="Current business context that powers call handling and follow-up." />
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div><p className="text-xs uppercase tracking-wide text-slate-500">Business Name</p><p className="text-sm font-medium">{client?.name || "-"}</p></div>
                  <div><p className="text-xs uppercase tracking-wide text-slate-500">Transfer Number</p><p className="text-sm font-medium">{client?.setting?.transferNumber || "-"}</p></div>
                  <div className="sm:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Booking Link</p>
                    {client?.setting?.bookingLink ? (
                      <a href={client.setting.bookingLink} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                        {client.setting.bookingLink}
                      </a>
                    ) : (
                      <p className="text-sm font-medium">-</p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Services</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {services.length ? services.map((service) => (
                        <span key={service} className="rounded-full border px-2.5 py-1 text-xs">{service}</span>
                      )) : <p className="text-sm font-medium">-</p>}
                    </div>
                  </div>
                </div>
              </SectionShell>

              <Card>
                <CardHeader><CardTitle>AI Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div><Label>Greeting Text</Label><Textarea value={aiConfig.greetingText || ""} onChange={(event) => setAiConfig((prev) => ({ ...prev, greetingText: event.target.value }))} /></div>
                  <div><Label>After-hours Message</Label><Textarea value={aiConfig.afterHoursMessage || ""} onChange={(event) => setAiConfig((prev) => ({ ...prev, afterHoursMessage: event.target.value }))} /></div>
                  <div><Label>Transfer Rules JSON</Label><Textarea value={aiConfig.transferRulesJson || "{}"} onChange={(event) => setAiConfig((prev) => ({ ...prev, transferRulesJson: event.target.value }))} /></div>
                  <div><Label>Intake Questions JSON</Label><Textarea value={aiConfig.intakeQuestionsJson || "[]"} onChange={(event) => setAiConfig((prev) => ({ ...prev, intakeQuestionsJson: event.target.value }))} /></div>
                  <div><Label>System Prompt</Label><Textarea value={aiConfig.systemPrompt || ""} onChange={(event) => setAiConfig((prev) => ({ ...prev, systemPrompt: event.target.value }))} /></div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(aiConfig.smsEnabled)} onChange={(event) => setAiConfig((prev) => ({ ...prev, smsEnabled: event.target.checked }))} />SMS enabled</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(aiConfig.testMode)} onChange={(event) => setAiConfig((prev) => ({ ...prev, testMode: event.target.checked }))} />Test mode</label>
                  <Button onClick={onSaveAiConfig}>Save AI config</Button>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Client Status</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <select className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as Client["status"])}>
                    <option value="NEEDS_CONFIGURATION">NEEDS_CONFIGURATION</option>
                    <option value="LIVE">LIVE</option>
                    <option value="PAUSED">PAUSED</option>
                    <option value="CANCELED">CANCELED</option>
                  </select>
                  <Button onClick={onSaveStatus}>Save status</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Phone Number</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-500">Current: {client?.phoneLine?.phoneNumber || "Not assigned"}</p>
                  <div><Label>Preferred area code (optional)</Label><Input value={areaCode} onChange={(event) => setAreaCode(event.target.value)} placeholder="516" /></div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={smsEnabled} onChange={(event) => setSmsEnabled(event.target.checked)} />SMS enabled</label>
                  <div className="flex gap-2">
                    <Button onClick={onAssign}>Assign number</Button>
                    <Button variant="outline" onClick={onReplace}>Replace number</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </PageShell>
    </AdminGuard>
  );
}
