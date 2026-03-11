"use client";

import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { OutreachSubnav } from "@/components/admin/outreach-subnav";
import {
  createAdminOutreachSequence,
  deleteAdminOutreachSequence,
  fetchAdminOrgs,
  replaceAdminOutreachSequenceSteps,
  fetchAdminOutreachSequences,
  updateAdminOutreachSequence
} from "@/lib/api";
import type { OutreachSequenceStep, OutreachSequence } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page";
import { Textarea } from "@/components/ui/textarea";

function defaultSteps(): OutreachSequenceStep[] {
  return [
    { stepNumber: 1, delayHours: 0, subject: "", bodyText: "", bodyHtml: "" },
    { stepNumber: 2, delayHours: 48, subject: "", bodyText: "", bodyHtml: "" },
    { stepNumber: 3, delayHours: 96, subject: "", bodyText: "", bodyHtml: "" }
  ];
}

const TEMPLATE_VARIABLES = [
  "{{contactName}}",
  "{{firstName}}",
  "{{companyName}}",
  "{{email}}",
  "{{phone}}",
  "{{city}}",
  "{{state}}",
  "{{industry}}",
  "{{website}}",
  "{{notes}}",
  "{{orgName}}"
];

export default function AdminOutreachSequencesPage() {
  const { showToast } = useToast();
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [orgId, setOrgId] = useState("");
  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    isActive: true,
    steps: defaultSteps()
  });

  async function load(nextOrgId = orgId) {
    try {
      const [orgData, sequenceData] = await Promise.all([
        fetchAdminOrgs(),
        fetchAdminOutreachSequences(nextOrgId || undefined)
      ]);
      setOrgs((orgData.orgs || []).map((org) => ({ id: org.id, name: org.name })));
      setSequences(sequenceData.sequences || []);
    } catch (error) {
      showToast({
        title: "Could not load sequences",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function onCreate() {
    if (!orgId) {
      showToast({ title: "Select an organization first", variant: "error" });
      return;
    }
    try {
      await createAdminOutreachSequence({
        orgId,
        name: form.name,
        description: form.description,
        isActive: form.isActive,
        steps: form.steps.map((step) => ({
          stepNumber: step.stepNumber,
          delayHours: Number(step.delayHours),
          subject: step.subject,
          bodyText: step.bodyText || "",
          bodyHtml: step.bodyHtml || ""
        }))
      });
      setEditingId(null);
      setForm({ name: "", description: "", isActive: true, steps: defaultSteps() });
      await load();
      showToast({ title: "Sequence created" });
    } catch (error) {
      showToast({
        title: "Could not create sequence",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function toggleSequence(sequence: OutreachSequence) {
    try {
      await updateAdminOutreachSequence(sequence.id, { isActive: !sequence.isActive });
      await load();
    } catch (error) {
      showToast({
        title: "Could not update sequence",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function onSave() {
    if (!orgId) {
      showToast({ title: "Select an organization first", variant: "error" });
      return;
    }
    if (!editingId) {
      await onCreate();
      return;
    }
    try {
      await updateAdminOutreachSequence(editingId, {
        name: form.name,
        description: form.description,
        isActive: form.isActive
      });
      await replaceAdminOutreachSequenceSteps(editingId, {
        steps: form.steps
      });
      setEditingId(null);
      setForm({ name: "", description: "", isActive: true, steps: defaultSteps() });
      await load();
      showToast({ title: "Sequence updated" });
    } catch (error) {
      showToast({
        title: "Could not update sequence",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function removeSequence(sequence: OutreachSequence) {
    try {
      await deleteAdminOutreachSequence(sequence.id);
      await load();
      showToast({ title: "Sequence deleted" });
    } catch (error) {
      showToast({
        title: "Could not delete sequence",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  return (
    <AdminGuard>
      <div className="container py-10 space-y-6">
        <AdminTopTabs />
        <PageHeader
          eyebrow="Internal growth"
          title="Outreach Sequences"
          description="Create reusable email sequences and preview the timing cadence before enrolling leads."
          actions={
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
          }
        />
        <OutreachSubnav />

        <Card>
          <CardHeader>
            <CardTitle>Create sequence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="font-medium">Personalization variables</div>
              <div className="mt-2 text-muted-foreground">
                Sequence subjects and bodies support lead-based placeholders that render at send time.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {TEMPLATE_VARIABLES.map((variable) => (
                  <code key={variable} className="rounded bg-background px-2 py-1 text-xs">
                    {variable}
                  </code>
                ))}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Name</Label><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></div>
            </div>
            <div className="space-y-3">
              {form.steps.map((step, index) => (
                <div key={step.stepNumber} className="rounded-lg border p-4 space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div><Label>Step</Label><Input value={String(step.stepNumber)} readOnly /></div>
                    <div><Label>Delay hours</Label><Input type="number" value={String(step.delayHours)} onChange={(event) => setForm((current) => ({ ...current, steps: current.steps.map((item, itemIndex) => itemIndex === index ? { ...item, delayHours: Number(event.target.value) } : item) }))} /></div>
                    <div><Label>Subject</Label><Input value={step.subject} onChange={(event) => setForm((current) => ({ ...current, steps: current.steps.map((item, itemIndex) => itemIndex === index ? { ...item, subject: event.target.value } : item) }))} /></div>
                  </div>
                  <div><Label>Body text</Label><Textarea rows={4} value={step.bodyText || ""} onChange={(event) => setForm((current) => ({ ...current, steps: current.steps.map((item, itemIndex) => itemIndex === index ? { ...item, bodyText: event.target.value } : item) }))} /></div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void onSave()}>{editingId ? "Save sequence" : "Create sequence"}</Button>
              {editingId ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setForm({ name: "", description: "", isActive: true, steps: defaultSteps() });
                  }}
                >
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved sequences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sequences.length ? (
              sequences.map((sequence) => (
                <div key={sequence.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{sequence.name}</div>
                      <div className="text-sm text-muted-foreground">{sequence.organization?.name || sequence.orgId}</div>
                      <div className="text-sm text-muted-foreground">{sequence.description || "No description."}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(sequence.id);
                          setForm({
                            name: sequence.name,
                            description: sequence.description || "",
                            isActive: sequence.isActive,
                            steps: sequence.steps.map((step) => ({
                              stepNumber: step.stepNumber,
                              delayHours: step.delayHours,
                              subject: step.subject,
                              bodyText: step.bodyText || "",
                              bodyHtml: step.bodyHtml || ""
                            }))
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void toggleSequence(sequence)}>
                        {sequence.isActive ? "Pause" : "Activate"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void removeSequence(sequence)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {sequence.steps.map((step) => (
                      <div key={step.stepNumber} className="rounded border p-2">
                        Step {step.stepNumber} · send after {step.delayHours}h · {step.subject}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No sequences created yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminGuard>
  );
}
