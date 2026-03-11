"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { OutreachSubnav } from "@/components/admin/outreach-subnav";
import {
  createAdminOutreachEnrollment,
  createAdminOutreachLead,
  fetchAdminOrgs,
  fetchAdminOutreachLeads,
  fetchAdminOutreachSequences,
  importAdminOutreachLeads,
  markAdminOutreachLeadReplied,
  pauseAdminOutreachEnrollment,
  sendNowAdminOutreachEnrollment,
  suppressAdminOutreachLead,
  unsuppressAdminOutreachLead
} from "@/lib/api";
import type { OutreachLead, OutreachSequence } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page";
import { Textarea } from "@/components/ui/textarea";

export default function AdminOutreachLeadsPage() {
  const { showToast } = useToast();
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [orgId, setOrgId] = useState("");
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [selectedSequenceByLead, setSelectedSequenceByLead] = useState<Record<string, string>>({});
  const [bulkText, setBulkText] = useState("");
  const [bulkResults, setBulkResults] = useState<Array<{ lineNumber: number; status: string; reason?: string; email?: string }>>([]);
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
    if (orgId) params.set("orgId", orgId);
    if (status !== "ALL") params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    return `?${params.toString()}`;
  }, [orgId, search, status]);

  async function load(nextOrgId = orgId) {
    try {
      const [orgData, leadData, sequenceData] = await Promise.all([
        fetchAdminOrgs(),
        fetchAdminOutreachLeads(nextOrgId || search || status !== "ALL" ? query : ""),
        fetchAdminOutreachSequences(nextOrgId || undefined)
      ]);
      setOrgs((orgData.orgs || []).map((org) => ({ id: org.id, name: org.name })));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function onCreateLead() {
    if (!orgId) {
      showToast({ title: "Select an organization first", variant: "error" });
      return;
    }
    try {
      await createAdminOutreachLead({ orgId, ...form });
      setForm({ companyName: "", contactName: "", email: "", phone: "", city: "", state: "", industry: "", website: "", notes: "" });
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

  async function onBulkImport() {
    if (!orgId) {
      showToast({ title: "Select an organization first", variant: "error" });
      return;
    }
    try {
      const data = await importAdminOutreachLeads({ orgId, text: bulkText });
      setBulkResults(data.rows || []);
      await load();
    } catch (error) {
      showToast({
        title: "Bulk import failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function onEnroll(lead: OutreachLead) {
    const sequenceId = selectedSequenceByLead[lead.id];
    if (!orgId || !sequenceId) {
      showToast({ title: "Choose an organization and sequence", variant: "error" });
      return;
    }
    try {
      await createAdminOutreachEnrollment({ orgId, leadId: lead.id, sequenceId });
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
        await unsuppressAdminOutreachLead(lead.id, lead.orgId);
      } else {
        await suppressAdminOutreachLead(lead.id, { orgId: lead.orgId, reason: "MANUAL_SUPPRESSION", source: "ADMIN_UI" });
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
      await markAdminOutreachLeadReplied(lead.id, { orgId: lead.orgId });
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
      <div className="container py-10 space-y-6">
        <AdminTopTabs />
        <PageHeader
          eyebrow="Internal growth"
          title="Outreach Leads"
          description="Create leads, import strict pipe-delimited rows, enroll contacts into sequences, and stop sends when needed."
          actions={
            <div className="flex gap-2">
              <select
                value={orgId}
                onChange={(event) => setOrgId(event.target.value)}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
              >
                <option value="">Select organization</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
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
              <CardTitle>Bulk import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">One lead per line. Format: `company | contact | email | phone | city | state | industry | website | notes`</p>
              <Textarea rows={8} value={bulkText} onChange={(event) => setBulkText(event.target.value)} />
              <Button onClick={() => void onBulkImport()}>Import rows</Button>
              {bulkResults.length ? (
                <div className="space-y-2 rounded-lg border p-3 text-sm">
                  {bulkResults.map((row) => (
                    <div key={`${row.lineNumber}-${row.status}`} className="flex flex-wrap justify-between gap-2">
                      <span>Line {row.lineNumber}</span>
                      <span>{row.status}{row.email ? ` · ${row.email}` : ""}{row.reason ? ` · ${row.reason}` : ""}</span>
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
                      <div className="text-sm text-muted-foreground">{lead.contactName || "-"} · {lead.email}</div>
                      <div className="text-sm text-muted-foreground">{lead.organization?.name || lead.orgId}</div>
                    </div>
                    <div className="text-sm">{lead.status}</div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                    <div className="text-sm text-muted-foreground">
                      {(lead.city || lead.state) ? `${lead.city || ""}${lead.city && lead.state ? ", " : ""}${lead.state || ""}` : "Location not set"}
                      {lead.industry ? ` · ${lead.industry}` : ""}
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
                      <Button size="sm" variant="outline" onClick={() => void onSuppress(lead)}>
                        {lead.status === "PAUSED" || lead.status === "UNSUBSCRIBED" ? "Unsuppress" : "Suppress"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void onMarkReplied(lead)}>Mark replied</Button>
                    </div>
                  </div>
                  {lead.enrollments?.length ? (
                    <div className="mt-3 space-y-2 text-sm">
                      {lead.enrollments.map((enrollment) => (
                        <div key={enrollment.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
                          <span>
                            {enrollment.sequence?.name || "Sequence"} · {enrollment.status} · step {enrollment.currentStepNumber}
                            {enrollment.nextSendAt ? ` · next ${new Date(enrollment.nextSendAt).toLocaleString()}` : ""}
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
