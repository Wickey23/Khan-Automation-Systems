"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { OutreachSubnav } from "@/components/admin/outreach-subnav";
import {
  confirmAdminOutreachLeadsImport,
  createAdminOutreachEnrollment,
  createAdminOutreachLead,
  deleteAdminOutreachLead,
  deleteAllAdminOutreachData,
  fetchAdminOutreachLeads,
  fetchAdminOutreachSequences,
  markAdminOutreachLeadReplied,
  pauseAdminOutreachEnrollment,
  previewAdminOutreachLeadsImport,
  sendNowAdminOutreachEnrollment,
  startAdminOutreachAiCall,
  suppressAdminOutreachLead,
  unsuppressAdminOutreachLead
} from "@/lib/api";
import type { OutreachBulkImportRowResult, OutreachLead, OutreachSequence } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page";
import { Textarea } from "@/components/ui/textarea";

const CSV_TEMPLATE = `companyName,contactName,email,phone,city,state,industry,website,notes
Acme Truck Repair,Sam Rivera,sam@acmetruckrepair.com,555-111-2222,Dallas,TX,Truck Repair,https://acmetruckrepair.com,Imported from list
Metro HVAC,Jamie Cole,jamie@metrohvac.com,555-333-4444,Austin,TX,HVAC,https://metrohvac.com,Priority batch`;

export default function AdminOutreachLeadsPage() {
  const { showToast } = useToast();
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [selectedSequenceByLead, setSelectedSequenceByLead] = useState<Record<string, string>>({});
  const [bulkText, setBulkText] = useState(CSV_TEMPLATE);
  const [bulkSequenceId, setBulkSequenceId] = useState("");
  const [bulkResults, setBulkResults] = useState<OutreachBulkImportRowResult[]>([]);
  const [bulkPreviewReady, setBulkPreviewReady] = useState(false);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [callingLeadId, setCallingLeadId] = useState<string | null>(null);
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    industry: "",
    website: "",
    notes: ""
  });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    return `?${params.toString()}`;
  }, [search, status]);

  async function load() {
    try {
      const [leadData, sequenceData] = await Promise.all([
        fetchAdminOutreachLeads(search || status !== "ALL" ? query : ""),
        fetchAdminOutreachSequences()
      ]);
      setLeads(leadData.leads || []);
      setSequences(sequenceData.sequences || []);
    } catch (error) {
      showToast({
        title: "Could not load outreach leads",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  useEffect(() => {
    void load();
  }, [query]);

  async function onCreateLead() {
    try {
      await createAdminOutreachLead(form);
      setForm({
        companyName: "",
        contactName: "",
        email: "",
        phone: "",
        city: "",
        state: "",
        industry: "",
        website: "",
        notes: ""
      });
      await load();
      showToast({ title: "Lead created" });
    } catch (error) {
      showToast({
        title: "Could not create lead",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function onPreviewImport() {
    if (!bulkSequenceId) {
      showToast({
        title: "Choose a sequence",
        description: "Pick the sequence that would be used if you start outreach.",
        variant: "error"
      });
      return;
    }
    try {
      const data = await previewAdminOutreachLeadsImport({ text: bulkText, sequenceId: bulkSequenceId });
      setBulkResults(data.rows || []);
      setBulkPreviewReady(true);
      const validRows = (data.rows || []).filter((row) => row.status === "created").length;
      showToast({
        title: "Preview ready",
        description: `${validRows} valid rows are ready to import.`
      });
    } catch (error) {
      setBulkPreviewReady(false);
      showToast({
        title: "Could not preview CSV",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function onBulkImport() {
    if (!bulkSequenceId) {
      showToast({
        title: "Choose a sequence",
        description: "CSV imports require a sequence so outreach can start automatically.",
        variant: "error"
      });
      return;
    }
    if (!bulkPreviewReady) {
      showToast({
        title: "Preview required",
        description: "Preview the CSV before starting outreach.",
        variant: "error"
      });
      return;
    }
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Start outreach for the valid rows in this CSV preview?");
      if (!confirmed) return;
    }

    try {
      setBulkImportLoading(true);
      const data = await confirmAdminOutreachLeadsImport({ text: bulkText, sequenceId: bulkSequenceId });
      setBulkResults(data.rows || []);
      setBulkPreviewReady(false);
      await load();
      const started = (data.rows || []).filter((row) => row.status === "created" && row.enrollmentId).length;
      showToast({
        title: "CSV imported",
        description: started ? `${started} contacts were enrolled and queued to start emailing.` : "Import completed."
      });
    } catch (error) {
      showToast({
        title: "CSV import failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setBulkImportLoading(false);
    }
  }

  async function onCsvFileSelected(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      setBulkText(text);
      setBulkPreviewReady(false);
      setBulkResults([]);
      showToast({ title: "CSV loaded", description: `${file.name} is ready to preview.` });
    } catch {
      showToast({ title: "Could not read CSV file", variant: "error" });
    }
  }

  async function onEnroll(lead: OutreachLead) {
    const sequenceId = selectedSequenceByLead[lead.id];
    if (!sequenceId) {
      showToast({ title: "Choose a sequence first", variant: "error" });
      return;
    }
    try {
      await createAdminOutreachEnrollment({ leadId: lead.id, sequenceId });
      await load();
      showToast({ title: "Lead enrolled" });
    } catch (error) {
      showToast({
        title: "Could not enroll lead",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function onSuppress(lead: OutreachLead) {
    try {
      if (lead.status === "UNSUBSCRIBED" || lead.status === "PAUSED") {
        await unsuppressAdminOutreachLead(lead.id);
      } else {
        await suppressAdminOutreachLead(lead.id, { reason: "MANUAL_SUPPRESSION", source: "ADMIN_UI" });
      }
      await load();
      showToast({ title: "Lead status updated" });
    } catch (error) {
      showToast({
        title: "Could not update suppression",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function onMarkReplied(lead: OutreachLead) {
    try {
      await markAdminOutreachLeadReplied(lead.id, {});
      await load();
      showToast({ title: "Lead marked replied" });
    } catch (error) {
      showToast({
        title: "Could not mark replied",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function onDeleteLead(lead: OutreachLead) {
    const label = lead.companyName || lead.contactName || lead.email;
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Delete ${label} from outreach? This will remove its enrollments and outreach history.`);
      if (!confirmed) return;
    }

    try {
      await deleteAdminOutreachLead(lead.id);
      await load();
      showToast({ title: "Lead deleted" });
    } catch (error) {
      showToast({
        title: "Could not delete lead",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function onAiCall(lead: OutreachLead) {
    if (!lead.phone?.trim()) {
      showToast({
        title: "Phone number required",
        description: "Add a valid phone number before starting an AI outreach call.",
        variant: "error"
      });
      return;
    }

    try {
      setCallingLeadId(lead.id);
      const result = await startAdminOutreachAiCall(lead.id);
      await load();
      showToast({
        title: "AI call started",
        description: `${lead.companyName || lead.contactName || lead.email} is being called at ${result.toNumber}.`
      });
    } catch (error) {
      showToast({
        title: "Could not start AI call",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setCallingLeadId(null);
    }
  }

  async function onDeleteAllOutreachData() {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Delete all outreach leads, sequences, enrollments, suppressions, and events?");
      if (!confirmed) return;
    }

    try {
      await deleteAllAdminOutreachData();
      setBulkResults([]);
      setBulkPreviewReady(false);
      await load();
      showToast({ title: "Outreach data cleared" });
    } catch (error) {
      showToast({
        title: "Could not clear outreach data",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function onPauseEnrollment(enrollmentId: string) {
    try {
      await pauseAdminOutreachEnrollment(enrollmentId);
      await load();
      showToast({ title: "Enrollment paused" });
    } catch (error) {
      showToast({
        title: "Could not pause enrollment",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function onSendNow(enrollmentId: string) {
    try {
      await sendNowAdminOutreachEnrollment(enrollmentId);
      await load();
      showToast({ title: "Send triggered" });
    } catch (error) {
      showToast({
        title: "Could not send now",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  return (
    <AdminGuard requireSuperAdmin>
      <div className="container space-y-6 py-10">
        <AdminTopTabs />
        <PageHeader
          eyebrow="Internal growth"
          title="Outreach Leads"
          description="Preview CSV contact lists before import, then explicitly confirm before any outreach enrollments begin."
          actions={
            <div className="flex gap-2">
              <Input placeholder="Search leads" value={search} onChange={(event) => setSearch(event.target.value)} />
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
              >
                <option value="ALL">All statuses</option>
                <option value="NEW">NEW</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PAUSED">PAUSED</option>
                <option value="REPLIED">REPLIED</option>
                <option value="UNSUBSCRIBED">UNSUBSCRIBED</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>
            </div>
          }
        />
        <OutreachSubnav />

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Add lead</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div><Label>Company</Label><Input value={form.companyName} onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} /></div>
              <div><Label>Contact</Label><Input value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></div>
              <div><Label>City</Label><Input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} /></div>
              <div><Label>State</Label><Input value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} /></div>
              <div><Label>Industry</Label><Input value={form.industry} onChange={(event) => setForm((current) => ({ ...current, industry: event.target.value }))} /></div>
              <div><Label>Website</Label><Input value={form.website} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} /></div>
              <div className="sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></div>
              <div className="sm:col-span-2"><Button onClick={() => void onCreateLead()}>Create lead</Button></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CSV import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload or paste a CSV with headers like `companyName, contactName, email, phone, city, state, industry, website, notes`.
                Preview rows first, then explicitly confirm before outreach starts.
              </p>
              <div>
                <Label>Sequence to start</Label>
                <select
                  value={bulkSequenceId}
                  onChange={(event) => {
                    setBulkSequenceId(event.target.value);
                    setBulkPreviewReady(false);
                  }}
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
                >
                  <option value="">Choose sequence</option>
                  {sequences.map((sequence) => (
                    <option key={sequence.id} value={sequence.id}>
                      {sequence.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>CSV file</Label>
                <Input type="file" accept=".csv,text/csv" onChange={(event) => void onCsvFileSelected(event.target.files?.[0] || null)} />
              </div>
              <div>
                <Label>CSV contents</Label>
                <Textarea
                  rows={10}
                  value={bulkText}
                  onChange={(event) => {
                    setBulkText(event.target.value);
                    setBulkPreviewReady(false);
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void onPreviewImport()}>
                  Preview import
                </Button>
                <Button disabled={!bulkPreviewReady || bulkImportLoading} onClick={() => void onBulkImport()}>
                  {bulkImportLoading ? "Starting outreach..." : "Confirm import and start outreach"}
                </Button>
                <Button variant="outline" onClick={() => void onDeleteAllOutreachData()}>
                  Clear all outreach data
                </Button>
              </div>
              {bulkResults.length ? (
                <div className="space-y-2 rounded-lg border p-3 text-sm">
                  {bulkResults.map((row) => (
                    <div key={`${row.lineNumber}-${row.status}-${"email" in row ? row.email : row.raw}`} className="flex flex-wrap justify-between gap-2">
                      <span>Line {row.lineNumber}</span>
                      <span>
                        {row.status}
                        {"email" in row ? ` • ${row.email}` : ""}
                        {"enrollmentId" in row && row.enrollmentId ? " • enrolled" : ""}
                        {"reason" in row ? ` • ${row.reason}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Leads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {leads.length ? (
              leads.map((lead) => (
                <div key={lead.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{lead.companyName || lead.contactName || lead.email}</div>
                      <div className="text-sm text-muted-foreground">{lead.contactName || "-"} • {lead.email}</div>
                    </div>
                    <div className="text-sm">{lead.status}</div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                    <div className="text-sm text-muted-foreground">
                      {(lead.city || lead.state) ? `${lead.city || ""}${lead.city && lead.state ? ", " : ""}${lead.state || ""}` : "Location not set"}
                      {lead.industry ? ` • ${lead.industry}` : ""}
                    </div>
                    <select
                      value={selectedSequenceByLead[lead.id] || ""}
                      onChange={(event) => setSelectedSequenceByLead((current) => ({ ...current, [lead.id]: event.target.value }))}
                      className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
                    >
                      <option value="">Choose sequence</option>
                      {sequences.map((sequence) => (
                        <option key={sequence.id} value={sequence.id}>
                          {sequence.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void onEnroll(lead)}>Enroll</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={callingLeadId === lead.id || !lead.phone?.trim()}
                        onClick={() => void onAiCall(lead)}
                      >
                        {callingLeadId === lead.id ? "Calling..." : "AI call"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void onSuppress(lead)}>
                        {lead.status === "PAUSED" || lead.status === "UNSUBSCRIBED" ? "Unsuppress" : "Suppress"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void onMarkReplied(lead)}>Mark replied</Button>
                      <Button size="sm" variant="outline" onClick={() => void onDeleteLead(lead)}>Delete</Button>
                    </div>
                  </div>
                  {lead.enrollments?.length ? (
                    <div className="mt-3 space-y-2 text-sm">
                      {lead.enrollments.map((enrollment) => (
                        <div key={enrollment.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
                          <span>
                            {enrollment.sequence?.name || "Sequence"} • {enrollment.status} • step {enrollment.currentStepNumber}
                            {enrollment.nextSendAt ? ` • next ${new Date(enrollment.nextSendAt).toLocaleString()}` : ""}
                          </span>
                          {enrollment.status === "ACTIVE" ? (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => void onSendNow(enrollment.id)}>
                                Send now
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => void onPauseEnrollment(enrollment.id)}>
                                Pause
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No outreach leads found.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminGuard>
  );
}
