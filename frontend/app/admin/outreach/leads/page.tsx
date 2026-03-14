"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { OutreachSubnav } from "@/components/admin/outreach-subnav";
import { OutreachPhoneEventDetailCard } from "@/components/admin/outreach-phone-event-detail";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, WorkflowHint } from "@/components/ui/page";
import { Textarea } from "@/components/ui/textarea";
import {
  confirmAdminOutreachLeadsImport,
  createAdminOutreachEnrollment,
  createAdminOutreachLead,
  createAdminOutreachPhoneEnrollment,
  deleteAdminOutreachLead,
  deleteAllAdminOutreachData,
  fetchAdminOutreachPhoneEvent,
  fetchAdminOutreachCallerConfigs,
  fetchAdminOutreachLeads,
  fetchAdminOutreachSequences,
  markAdminOutreachLeadReplied,
  pauseAdminOutreachEnrollment,
  pauseAdminOutreachPhoneEnrollment,
  previewAdminOutreachLeadsImport,
  sendNowAdminOutreachEnrollment,
  sendNowAdminOutreachPhoneEnrollment,
  startAdminOutreachAiCall,
  suppressAdminOutreachLead,
  unsuppressAdminOutreachLead
} from "@/lib/api";
import type { OutreachBulkImportRowResult, OutreachCallerConfig, OutreachLead, OutreachPhoneEventDetail, OutreachSequence } from "@/lib/types";

const CSV_TEMPLATE = `companyName,contactName,email,phone,city,state,industry,website,angle,painPoint,offer,sourceList,notes
Acme Truck Repair,Sam Rivera,sam@acmetruckrepair.com,555-111-2222,Dallas,TX,Truck Repair,https://acmetruckrepair.com,Missed calls,After-hours calls go unanswered,Offer a short missed-call recovery demo,Lead Finder Batch 1,Imported from list
Metro HVAC,Jamie Cole,jamie@metrohvac.com,555-333-4444,Austin,TX,HVAC,https://metrohvac.com,Faster follow-up,Slow callback times,Offer a quick callback review,Lead Finder Batch 1,Priority batch`;

function hasRealOutreachEmail(email: string | null | undefined) {
  const normalized = String(email || "").trim().toLowerCase();
  return Boolean(normalized && !normalized.endsWith("@no-email.khan.local"));
}

function formatLeadHeadline(lead: OutreachLead) {
  return lead.companyName || lead.contactName || lead.email;
}

function formatLeadSubline(lead: OutreachLead) {
  return [lead.contactName || "-", hasRealOutreachEmail(lead.email) ? lead.email : null, lead.phone || "No phone"].filter(Boolean).join(" - ");
}

function hasBeenCalled(lead: OutreachLead) {
  return Boolean((lead.phoneEvents || []).find((event) => event.eventType === "STARTED" || event.eventType === "COMPLETED"));
}

function hasActiveEmailLane(lead: OutreachLead) {
  return Boolean((lead.enrollments || []).find((enrollment) => enrollment.status === "ACTIVE"));
}

function hasActivePhoneLane(lead: OutreachLead) {
  return Boolean((lead.phoneEnrollments || []).find((enrollment) => enrollment.status === "ACTIVE"));
}

function getLeadLaneSummary(lead: OutreachLead) {
  const emailLive = hasActiveEmailLane(lead);
  const phoneLive = hasActivePhoneLane(lead);
  if (emailLive && phoneLive) return "Email and Caller AI are both active. Pick a primary lane to avoid messy outreach.";
  if (phoneLive) return "Caller AI is the active lane for this lead.";
  if (emailLive) return "Email sequence is the active lane for this lead.";
  if (hasBeenCalled(lead)) return "Caller AI has already placed at least one live call to this lead.";
  if (hasRealOutreachEmail(lead.email) && lead.phone) return "Both lanes are available. Choose the primary lane before starting outreach.";
  if (hasRealOutreachEmail(lead.email)) return "Email lane is available. Add Caller AI only if you also want phone outreach.";
  if (lead.phone) return "Phone lane is available. This lead does not currently have a real email for sequence-based outreach.";
  return "This lead needs valid contact data before outreach can start.";
}

function getLeadNextStep(lead: OutreachLead) {
  const latestPhoneFailure = (lead.phoneEvents || []).find((event) => event.eventType === "FAILED");
  if (lead.status === "REPLIED") return "Review the reply and move the lead into a real follow-up path.";
  if (latestPhoneFailure) return "Review the failed call reason before retrying Caller AI.";
  if (hasActiveEmailLane(lead) && hasActivePhoneLane(lead)) return "Pause one lane or decide which channel should stay primary.";
  if (hasActivePhoneLane(lead)) return "Monitor the next call attempt in Events.";
  if (hasActiveEmailLane(lead)) return "Wait for the next email step or stop the sequence if the lead is no longer a fit.";
  if (lead.phone && !hasBeenCalled(lead)) return "Assign Caller AI and run one test call or queue the phone lane.";
  if (hasRealOutreachEmail(lead.email)) return "Assign a sequence if email is the right starting lane.";
  return "Add a real email or valid phone number before starting outreach.";
}

function buildLeadActivity(lead: OutreachLead) {
  const emailItems = (lead.emailEvents || []).map((event) => ({
    id: `email-${event.id}`,
    eventId: event.id,
    channel: "EMAIL" as const,
    createdAt: event.createdAt,
    label:
      event.eventType === "REPLIED"
        ? "Email reply received"
        : event.eventType === "FAILED"
          ? "Email send failed"
          : `Email ${event.eventType.toLowerCase()}`,
    detail: event.subject || event.toEmail || "Email event"
  }));
  const phoneItems = Array.from(
    (lead.phoneEvents || []).reduce((map, event) => {
      const key = event.providerCallId || event.id;
      const current = map.get(key);
      const currentScore = current ? (current.eventType === "COMPLETED" || current.eventType === "FAILED" ? 2 : 1) : 0;
      const nextScore = event.eventType === "COMPLETED" || event.eventType === "FAILED" ? 2 : 1;
      if (!current || nextScore > currentScore || new Date(event.createdAt).getTime() > new Date(current.createdAt).getTime()) {
        map.set(key, event);
      }
      return map;
    }, new Map<string, NonNullable<OutreachLead["phoneEvents"]>[number]>()).values()
  ).map((event) => ({
    id: `phone-${event.id}`,
    eventId: event.id,
    channel: "PHONE" as const,
    createdAt: event.createdAt,
    label:
      event.eventType === "FAILED"
        ? "AI call failed"
        : event.eventType === "COMPLETED"
          ? "AI call completed"
          : event.eventType === "STARTED"
            ? "AI call queued"
            : "AI call queued",
    detail:
      event.errorMessage ||
      event.summary ||
      String((event.metadata as { transcript?: string } | undefined)?.transcript || "").trim() ||
      event.status ||
      event.toPhone ||
      "Phone event"
  }));

  return [...phoneItems, ...emailItems]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);
}

export default function AdminOutreachLeadsPage() {
  const { showToast } = useToast();
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [callerConfigs, setCallerConfigs] = useState<OutreachCallerConfig[]>([]);
  const [selectedSequenceByLead, setSelectedSequenceByLead] = useState<Record<string, string>>({});
  const [selectedCallerConfigByLead, setSelectedCallerConfigByLead] = useState<Record<string, string>>({});
  const [bulkText, setBulkText] = useState(CSV_TEMPLATE);
  const [bulkMode, setBulkMode] = useState<"EMAIL" | "PHONE">("EMAIL");
  const [bulkSequenceId, setBulkSequenceId] = useState("");
  const [bulkCallerConfigId, setBulkCallerConfigId] = useState("");
  const [bulkResults, setBulkResults] = useState<OutreachBulkImportRowResult[]>([]);
  const [bulkPreviewReady, setBulkPreviewReady] = useState(false);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [callingLeadId, setCallingLeadId] = useState<string | null>(null);
  const [selectedPhoneEvent, setSelectedPhoneEvent] = useState<OutreachPhoneEventDetail | null>(null);
  const [loadingPhoneEventId, setLoadingPhoneEventId] = useState<string | null>(null);
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    industry: "",
    website: "",
    angle: "",
    painPoint: "",
    offer: "",
    sourceList: "",
    notes: ""
  });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    const queryText = params.toString();
    return queryText ? `?${queryText}` : "";
  }, [search, status]);

  const load = useCallback(async () => {
    try {
      const [leadData, sequenceData, callerConfigData] = await Promise.all([
        fetchAdminOutreachLeads(query),
        fetchAdminOutreachSequences(),
        fetchAdminOutreachCallerConfigs()
      ]);
      setLeads(leadData.leads || []);
      setSequences(sequenceData.sequences || []);
      setCallerConfigs(callerConfigData.callerConfigs || []);
    } catch (error) {
      showToast({
        title: "Could not load outreach leads",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }, [query, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

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
        angle: "",
        painPoint: "",
        offer: "",
        sourceList: "",
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
    if (bulkMode === "EMAIL" && !bulkSequenceId) {
      showToast({ title: "Choose a sequence", description: "Pick the sequence used for email outreach.", variant: "error" });
      return;
    }
    if (bulkMode === "PHONE" && !bulkCallerConfigId) {
      showToast({ title: "Choose Caller AI", description: "Pick the caller profile used for AI calls.", variant: "error" });
      return;
    }
    try {
      const data = await previewAdminOutreachLeadsImport({
        text: bulkText,
        sequenceId: bulkMode === "EMAIL" ? bulkSequenceId : undefined,
        callerConfigId: bulkMode === "PHONE" ? bulkCallerConfigId : undefined,
        mode: bulkMode
      });
      setBulkResults(data.rows || []);
      setBulkPreviewReady(true);
      const validRows = (data.rows || []).filter((row) => row.status === "created").length;
      showToast({ title: "Preview ready", description: `${validRows} valid rows are ready to import.` });
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
    if (bulkMode === "EMAIL" && !bulkSequenceId) {
      showToast({ title: "Choose a sequence", description: "CSV imports require a sequence to start email outreach.", variant: "error" });
      return;
    }
    if (bulkMode === "PHONE" && !bulkCallerConfigId) {
      showToast({ title: "Choose Caller AI", description: "CSV imports require a Caller AI profile.", variant: "error" });
      return;
    }
    if (!bulkPreviewReady) {
      showToast({ title: "Preview required", description: "Preview the CSV before starting outreach.", variant: "error" });
      return;
    }
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        bulkMode === "PHONE"
          ? "Queue Caller AI outreach for the valid rows in this preview?"
          : "Start email outreach for the valid rows in this preview?"
      );
      if (!confirmed) return;
    }

    try {
      setBulkImportLoading(true);
      const data = await confirmAdminOutreachLeadsImport({
        text: bulkText,
        sequenceId: bulkMode === "EMAIL" ? bulkSequenceId : undefined,
        callerConfigId: bulkMode === "PHONE" ? bulkCallerConfigId : undefined,
        mode: bulkMode
      });
      setBulkResults(data.rows || []);
      setBulkPreviewReady(false);
      await load();
      const started = (data.rows || []).filter((row) => row.status === "created" && row.enrollmentId).length;
      showToast({
        title: "CSV imported",
        description:
          bulkMode === "PHONE"
            ? started
              ? `${started} contacts were queued for AI calling.`
              : "Import completed."
            : started
              ? `${started} contacts were enrolled for email outreach.`
              : "Import completed."
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

  async function onStartEmailOutreach(lead: OutreachLead) {
    if (!hasRealOutreachEmail(lead.email)) {
      showToast({ title: "Real email required", description: "Add a real email before starting email outreach for this lead.", variant: "error" });
      return;
    }
    const sequenceId = selectedSequenceByLead[lead.id];
    if (!sequenceId) {
      showToast({ title: "Choose a sequence first", variant: "error" });
      return;
    }
    try {
      await createAdminOutreachEnrollment({ leadId: lead.id, sequenceId });
      await load();
      showToast({ title: "Email outreach started" });
    } catch (error) {
      showToast({
        title: "Could not start email outreach",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  function confirmCallOverride(lead: OutreachLead) {
    if (typeof window === "undefined") return true;
    const label = formatLeadHeadline(lead);
    return window.confirm(`Caller AI has already placed a live call to ${label}. Start another call anyway?`);
  }

  async function onStartPhoneOutreach(lead: OutreachLead, options?: { force?: boolean }) {
    const callerConfigId = selectedCallerConfigByLead[lead.id];
    if (!callerConfigId) {
      showToast({ title: "Choose Caller AI first", variant: "error" });
      return;
    }
    if (!lead.phone?.trim()) {
      showToast({ title: "Valid phone required", description: "Add a valid phone number before starting Caller AI outreach.", variant: "error" });
      return;
    }
    if (hasBeenCalled(lead) && !options?.force) {
      showToast({ title: "Already called once", description: "Caller AI is limited to one live call per lead.", variant: "error" });
      return;
    }
    if (options?.force && !confirmCallOverride(lead)) {
      return;
    }
    try {
      await createAdminOutreachPhoneEnrollment({ leadId: lead.id, callerConfigId, force: options?.force });
      await load();
      showToast({ title: options?.force ? "Caller AI outreach restarted" : "Caller AI outreach started" });
    } catch (error) {
      showToast({
        title: "Could not start Caller AI outreach",
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
      const confirmed = window.confirm(`Delete ${label} from outreach? This removes enrollments and outreach history.`);
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

  async function onAiCall(lead: OutreachLead, options?: { force?: boolean }) {
    const callerConfigId = selectedCallerConfigByLead[lead.id] || lead.phoneEnrollments?.[0]?.callerConfig?.id || "";
    if (!callerConfigId) {
      showToast({ title: "Choose Caller AI first", description: "Pick the caller profile that should place this call.", variant: "error" });
      return;
    }
    if (!lead.phone?.trim()) {
      showToast({ title: "Phone number required", description: "Add a valid phone number before starting an AI outreach call.", variant: "error" });
      return;
    }
    if (hasBeenCalled(lead) && !options?.force) {
      showToast({ title: "Already called once", description: "Caller AI is limited to one live call per lead.", variant: "error" });
      return;
    }
    if (options?.force && !confirmCallOverride(lead)) {
      return;
    }
    try {
      setCallingLeadId(lead.id);
      const result = await startAdminOutreachAiCall(lead.id, { force: options?.force, callerConfigId });
      await load();
      showToast({
        title: options?.force ? "AI call started again" : "AI call started",
        description: `${formatLeadHeadline(lead)} is being called at ${result.toNumber}.`
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

  async function onOpenPhoneEvent(id: string) {
    try {
      setLoadingPhoneEventId(id);
      const data = await fetchAdminOutreachPhoneEvent(id);
      setSelectedPhoneEvent(data.event);
    } catch (error) {
      showToast({
        title: "Could not load outreach call detail",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    } finally {
      setLoadingPhoneEventId(null);
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
      showToast({ title: "Email send triggered" });
    } catch (error) {
      showToast({
        title: "Could not send now",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function onPausePhoneEnrollment(enrollmentId: string) {
    try {
      await pauseAdminOutreachPhoneEnrollment(enrollmentId);
      await load();
      showToast({ title: "AI calling enrollment paused" });
    } catch (error) {
      showToast({
        title: "Could not pause AI calling enrollment",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function onSendPhoneNow(enrollmentId: string, lead?: OutreachLead, options?: { force?: boolean }) {
    if (options?.force && lead && !confirmCallOverride(lead)) {
      return;
    }
    try {
      await sendNowAdminOutreachPhoneEnrollment(enrollmentId, { force: options?.force });
      await load();
      showToast({ title: options?.force ? "AI call triggered again" : "AI call triggered" });
    } catch (error) {
      showToast({
        title: "Could not trigger AI call",
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
          description="Load prospect lists, choose whether outreach starts by email or Caller AI, and keep a single activity timeline per lead."
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
        <WorkflowHint
          title="How to work outreach leads"
          items={[
            { label: "Choose a lane", text: "Email sequences and Caller AI are both available, but most leads should have one primary lane at a time so the workflow stays controlled." },
            { label: "Do first", text: "Confirm the lead has usable contact data, then assign either a sequence or a Caller AI profile before starting outreach." },
            { label: "If something fails", text: "Use the recent activity row on the lead to open the exact failed call or email context before retrying. Do not blindly rerun broken outreach." }
          ]}
        />

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
              <div><Label>Angle</Label><Input value={form.angle} onChange={(event) => setForm((current) => ({ ...current, angle: event.target.value }))} placeholder="Missed calls, after-hours coverage, more booked jobs" /></div>
              <div><Label>Pain point</Label><Input value={form.painPoint} onChange={(event) => setForm((current) => ({ ...current, painPoint: event.target.value }))} placeholder="What problem should the caller focus on?" /></div>
              <div><Label>Offer</Label><Input value={form.offer} onChange={(event) => setForm((current) => ({ ...current, offer: event.target.value }))} placeholder="Short demo, callback, text details" /></div>
              <div><Label>Source list</Label><Input value={form.sourceList} onChange={(event) => setForm((current) => ({ ...current, sourceList: event.target.value }))} placeholder="Lead Finder Batch 1" /></div>
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
                Upload or paste CSV rows with `companyName, contactName, email, phone, city, state, industry, website, angle, painPoint, offer, sourceList, notes`.
                Preview first, then explicitly confirm whether the import should start email outreach or queue Caller AI calls automatically.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={bulkMode === "EMAIL" ? "default" : "outline"} onClick={() => { setBulkMode("EMAIL"); setBulkPreviewReady(false); }}>
                  Email sequence
                </Button>
                <Button type="button" variant={bulkMode === "PHONE" ? "default" : "outline"} onClick={() => { setBulkMode("PHONE"); setBulkPreviewReady(false); }}>
                  Caller AI
                </Button>
              </div>
              <div>
                <Label>{bulkMode === "EMAIL" ? "Sequence to start" : "Caller AI profile"}</Label>
                {bulkMode === "EMAIL" ? (
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
                      <option key={sequence.id} value={sequence.id}>{sequence.name}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={bulkCallerConfigId}
                    onChange={(event) => {
                      setBulkCallerConfigId(event.target.value);
                      setBulkPreviewReady(false);
                    }}
                    className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
                  >
                    <option value="">Choose Caller AI profile</option>
                    {callerConfigs.map((config) => (
                      <option key={config.id} value={config.id}>{config.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <Label>CSV file</Label>
                <Input type="file" accept=".csv,text/csv" onChange={(event) => void onCsvFileSelected(event.target.files?.[0] || null)} />
              </div>
              <div>
                <Label>CSV contents</Label>
                <Textarea rows={10} value={bulkText} onChange={(event) => { setBulkText(event.target.value); setBulkPreviewReady(false); }} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void onPreviewImport()}>Preview import</Button>
                <Button disabled={!bulkPreviewReady || bulkImportLoading} onClick={() => void onBulkImport()}>
                  {bulkImportLoading ? "Starting outreach..." : bulkMode === "PHONE" ? "Confirm import and queue AI calls" : "Confirm import and start outreach"}
                </Button>
                <Button variant="outline" onClick={() => void onDeleteAllOutreachData()}>Clear all outreach data</Button>
              </div>
              {bulkResults.length ? (
                <div className="space-y-2 rounded-lg border p-3 text-sm">
                  {bulkResults.map((row) => (
                    <div key={`${row.lineNumber}-${row.status}-${"email" in row ? row.email : row.raw}`} className="flex flex-wrap justify-between gap-2">
                      <span>Line {row.lineNumber}</span>
                      <span>
                        {row.status}
                        {"email" in row ? ` - ${row.email}` : ""}
                        {"enrollmentId" in row && row.enrollmentId ? " - enrolled" : ""}
                        {"reason" in row ? ` - ${row.reason}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className={`grid gap-4 ${selectedPhoneEvent ? "xl:grid-cols-[minmax(0,1.05fr)_minmax(460px,0.95fr)]" : ""}`}>
          <Card>
            <CardHeader>
              <CardTitle>Leads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {leads.length ? leads.map((lead) => {
                const called = hasBeenCalled(lead);
                const activity = buildLeadActivity(lead);
                const laneSummary = getLeadLaneSummary(lead);
                const nextStep = getLeadNextStep(lead);
                const laneConflict = hasActiveEmailLane(lead) && hasActivePhoneLane(lead);
                return (
                  <div key={lead.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{formatLeadHeadline(lead)}</div>
                      <div className="text-sm text-muted-foreground">{formatLeadSubline(lead)}</div>
                    </div>
                    <div className="text-sm font-medium">{lead.status}</div>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
                    <div className={`rounded-lg border p-3 text-sm ${laneConflict ? "border-amber-200 bg-amber-50" : "bg-muted/20"}`}>
                      <div className="font-medium">Current lane status</div>
                      <div className="mt-2 text-muted-foreground">{laneSummary}</div>
                    </div>
                    <div className="rounded-lg border bg-white p-3 text-sm">
                      <div className="font-medium">Recommended next step</div>
                      <div className="mt-2 text-muted-foreground">{nextStep}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)_minmax(260px,0.9fr)]">
                    <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                      <div className="font-medium">Lead details</div>
                      <div className="mt-2 text-muted-foreground">
                        {(lead.city || lead.state) ? `${lead.city || ""}${lead.city && lead.state ? ", " : ""}${lead.state || ""}` : "Location not set"}
                        {lead.industry ? ` - ${lead.industry}` : ""}
                      </div>
                      {lead.angle ? <div className="mt-2 text-muted-foreground"><span className="font-medium text-foreground">Angle:</span> {lead.angle}</div> : null}
                      {lead.painPoint ? <div className="mt-1 text-muted-foreground"><span className="font-medium text-foreground">Pain point:</span> {lead.painPoint}</div> : null}
                      {lead.offer ? <div className="mt-1 text-muted-foreground"><span className="font-medium text-foreground">Offer:</span> {lead.offer}</div> : null}
                      {lead.sourceList ? <div className="mt-1 text-muted-foreground"><span className="font-medium text-foreground">Source list:</span> {lead.sourceList}</div> : null}
                      {lead.notes ? <div className="mt-2 text-muted-foreground">{lead.notes}</div> : null}
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Assign sequence to start</div>
                      <select
                        value={selectedSequenceByLead[lead.id] || ""}
                        onChange={(event) => setSelectedSequenceByLead((current) => ({ ...current, [lead.id]: event.target.value }))}
                        className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
                      >
                        <option value="">Choose sequence</option>
                        {sequences.map((sequence) => (
                          <option key={sequence.id} value={sequence.id}>{sequence.name}</option>
                        ))}
                      </select>
                      <Button className="mt-3 w-full" size="sm" disabled={!hasRealOutreachEmail(lead.email)} onClick={() => void onStartEmailOutreach(lead)}>Start email outreach</Button>
                      {!hasRealOutreachEmail(lead.email) ? <p className="mt-2 text-xs text-muted-foreground">Add a real email to use the email sequence lane. Phone-only leads can still use Caller AI.</p> : null}
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Assign call to start</div>
                      <select
                        value={selectedCallerConfigByLead[lead.id] || ""}
                        onChange={(event) => setSelectedCallerConfigByLead((current) => ({ ...current, [lead.id]: event.target.value }))}
                        className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
                      >
                        <option value="">Choose Caller AI</option>
                        {callerConfigs.map((config) => (
                          <option key={config.id} value={config.id}>{config.name}</option>
                        ))}
                      </select>
                      <Button className="mt-3 w-full" size="sm" disabled={!lead.phone?.trim()} onClick={() => void onStartPhoneOutreach(lead, called ? { force: true } : undefined)}>
                        {called ? "Queue AI call outreach again" : "Queue AI call outreach"}
                      </Button>
                      {!lead.phone?.trim() ? <p className="mt-2 text-xs text-muted-foreground">Add a valid phone number to enable Caller AI.</p> : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Once enrolled, Caller AI will call automatically in queue order during the profile&apos;s allowed calling window.
                      </p>
                      {called ? <p className="mt-2 text-xs text-muted-foreground">This lead has already been called once. Use the button again only when you want to deliberately retry.</p> : null}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={callingLeadId === lead.id || !lead.phone?.trim()} onClick={() => void onAiCall(lead, called ? { force: true } : undefined)}>
                      {callingLeadId === lead.id ? "Calling..." : called ? "Call again" : "Call now once"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void onSuppress(lead)}>
                      {lead.status === "PAUSED" || lead.status === "UNSUBSCRIBED" ? "Unsuppress" : "Suppress"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void onMarkReplied(lead)}>Mark replied</Button>
                    <Button size="sm" variant="outline" onClick={() => void onDeleteLead(lead)}>Delete</Button>
                  </div>

                  {lead.enrollments?.length ? (
                    <div className="mt-3 space-y-2 text-sm">
                      {lead.enrollments.map((enrollment) => (
                        <div key={enrollment.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
                          <span>
                            {enrollment.sequence?.name || "Sequence"} - {enrollment.status} - step {enrollment.currentStepNumber}
                            {enrollment.nextSendAt ? ` - next ${new Date(enrollment.nextSendAt).toLocaleString()}` : ""}
                          </span>
                          {enrollment.status === "ACTIVE" ? (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => void onSendNow(enrollment.id)}>Send now</Button>
                              <Button size="sm" variant="outline" onClick={() => void onPauseEnrollment(enrollment.id)}>Pause</Button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {lead.phoneEnrollments?.length ? (
                    <div className="mt-3 space-y-2 text-sm">
                      {lead.phoneEnrollments.map((enrollment) => (
                        <div key={enrollment.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
                          <span>
                            {enrollment.callerConfig?.name || "Caller AI"} - {enrollment.status}
                            {enrollment.nextCallAt ? ` - next ${new Date(enrollment.nextCallAt).toLocaleString()}` : ""}
                          </span>
                          {enrollment.status === "ACTIVE" ? (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => void onSendPhoneNow(enrollment.id, lead, called ? { force: true } : undefined)}>
                                {called ? "Call again" : "Call now"}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => void onPausePhoneEnrollment(enrollment.id)}>Pause</Button>
                            </div>
                          ) : null}
                          {enrollment.stopReason ? (
                            <div className="w-full text-xs text-red-700">{enrollment.stopReason}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {activity.length ? (
                    <div className="mt-3 rounded-lg border bg-muted/10 p-3">
                      <div className="text-sm font-medium">Recent outreach activity</div>
                      <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                        {activity.map((item) => (
                          <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 bg-background px-3 py-2">
                            <div>
                              <div className="font-medium text-foreground">{item.label}</div>
                              <div>{item.detail}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.channel === "PHONE" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={loadingPhoneEventId === item.eventId}
                                  onClick={() => void onOpenPhoneEvent(item.eventId)}
                                >
                                  {loadingPhoneEventId === item.eventId ? "Loading..." : "View call"}
                                </Button>
                              ) : null}
                              <div className="text-xs">{new Date(item.createdAt).toLocaleString()}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  </div>
                );
              }) : <div className="text-sm text-muted-foreground">No outreach leads found.</div>}
            </CardContent>
          </Card>

          {selectedPhoneEvent ? (
            <div className="xl:sticky xl:top-6 xl:self-start">
              <OutreachPhoneEventDetailCard
                event={selectedPhoneEvent}
                onClose={() => setSelectedPhoneEvent(null)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </AdminGuard>
  );
}
