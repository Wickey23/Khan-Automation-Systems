"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { OutreachSubnav } from "@/components/admin/outreach-subnav";
import {
  createAdminOutreachSequence,
  deleteAdminOutreachSequence,
  fetchAdminOutreachSequences,
  replaceAdminOutreachSequenceSteps,
  updateAdminOutreachSequence
} from "@/lib/api";
import type { OutreachSequence, OutreachSequenceStep } from "@/lib/types";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page";
import { Textarea } from "@/components/ui/textarea";

type SequenceTemplate = {
  id: string;
  name: string;
  description: string;
  fit: string;
  steps: Array<{
    delayHours: number;
    subject: string;
    bodyText: string;
  }>;
};

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

const PREMADE_TEMPLATES: SequenceTemplate[] = [
  {
    id: "local-service-intro",
    name: "Local Service Intro",
    description: "A direct cold outreach sequence for local operators like plumbers, HVAC, electrical, and other service businesses.",
    fit: "Best for owner-led local service businesses.",
    steps: [
      {
        delayHours: 0,
        subject: "{{companyName}}: quick idea to capture more calls",
        bodyText:
          "Hi {{firstName}},\n\nI came across {{companyName}} and noticed businesses like yours often lose good jobs when calls, texts, and follow-up happen manually.\n\nKhan Automation helps service companies respond faster, qualify leads, and keep more booked work without adding admin overhead.\n\nIf useful, I can send a short breakdown of how this could work for {{companyName}}.\n\nSameer"
      },
      {
        delayHours: 48,
        subject: "Following up on {{companyName}}",
        bodyText:
          "Hi {{firstName}},\n\nWanted to follow up in case my last note got buried.\n\nWe built Khan Automation for businesses that want fewer missed opportunities, better follow-up, and less manual work around inbound leads.\n\nIf you're open to it, I can send a few concrete ideas tailored to {{companyName}}.\n\nSameer"
      },
      {
        delayHours: 96,
        subject: "Close the loop?",
        bodyText:
          "Hi {{firstName}},\n\nI'll keep this short.\n\nIf improving lead response and follow-up is a priority at {{companyName}}, I think Khan Automation could be worth a look.\n\nIf now isn't the right time, no problem and I won't keep nudging.\n\nSameer"
      }
    ]
  },
  {
    id: "missed-call-angle",
    name: "Missed Call Recovery",
    description: "Frames the product around lost revenue from unanswered calls and inconsistent follow-up.",
    fit: "Best when the pain is missed calls, after-hours lead loss, or manual callback workflows.",
    steps: [
      {
        delayHours: 0,
        subject: "{{companyName}} may be losing jobs after missed calls",
        bodyText:
          "Hi {{firstName}},\n\nQuick observation: service businesses often lose real revenue when missed calls do not get an immediate follow-up.\n\nKhan Automation helps capture those opportunities with faster response, better intake, and cleaner handoff for the team.\n\nIf you'd like, I can show what that could look like for {{companyName}}.\n\nSameer"
      },
      {
        delayHours: 72,
        subject: "Worth a look for {{companyName}}?",
        bodyText:
          "Hi {{firstName}},\n\nFollowing up on my note about missed call recovery.\n\nIf {{companyName}} is handling callbacks manually, there is usually a quick operational win in automating the first response and lead capture flow.\n\nHappy to send over a short example.\n\nSameer"
      },
      {
        delayHours: 144,
        subject: "Last follow-up from me",
        bodyText:
          "Hi {{firstName}},\n\nLast note from me here.\n\nIf missed calls, follow-up speed, or lead capture are active issues for {{companyName}}, I can outline how Khan Automation would approach it.\n\nIf not, all good.\n\nSameer"
      }
    ]
  },
  {
    id: "website-conversion-angle",
    name: "Lead Response + Conversion",
    description: "A broader outbound sequence for businesses with inquiry volume but weak response systems.",
    fit: "Best for businesses getting form leads, calls, and messages that need better conversion.",
    steps: [
      {
        delayHours: 0,
        subject: "Idea for improving response time at {{companyName}}",
        bodyText:
          "Hi {{firstName}},\n\nI work on automation systems for businesses that want to convert more inbound demand without hiring more admin overhead.\n\nFor teams like {{companyName}}, the usual gains come from faster lead response, cleaner qualification, and fewer dropped follow-ups.\n\nIf you're curious, I can send a quick overview of how Khan Automation handles that.\n\nSameer"
      },
      {
        delayHours: 48,
        subject: "Re: response time at {{companyName}}",
        bodyText:
          "Hi {{firstName}},\n\nCircling back on this.\n\nIf lead response and follow-up are still mostly manual at {{companyName}}, there is usually low-hanging value in tightening that workflow.\n\nHappy to send a short walkthrough.\n\nSameer"
      },
      {
        delayHours: 120,
        subject: "Should I close this out?",
        bodyText:
          "Hi {{firstName}},\n\nShould I close this out for now?\n\nIf improving lead handling is relevant for {{companyName}}, I can send over a tailored summary. If not, I’ll leave it there.\n\nSameer"
      }
    ]
  }
];

function buildSteps(steps?: SequenceTemplate["steps"]): OutreachSequenceStep[] {
  if (!steps?.length) {
    return [
      { stepNumber: 1, delayHours: 0, subject: "", bodyText: "", bodyHtml: "" },
      { stepNumber: 2, delayHours: 48, subject: "", bodyText: "", bodyHtml: "" },
      { stepNumber: 3, delayHours: 96, subject: "", bodyText: "", bodyHtml: "" }
    ];
  }
  return steps.map((step, index) => ({
    stepNumber: index + 1,
    delayHours: step.delayHours,
    subject: step.subject,
    bodyText: step.bodyText,
    bodyHtml: ""
  }));
}

function emptyForm() {
  return {
    name: "",
    description: "",
    isActive: true,
    steps: buildSteps()
  };
}

function hoursLabel(hours: number) {
  if (hours === 0) return "Immediately";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} later`;
  const days = hours / 24;
  if (Number.isInteger(days)) return `${days} day${days === 1 ? "" : "s"} later`;
  return `${hours} hours later`;
}

function snippet(text: string | null | undefined) {
  const compact = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  return compact.length > 140 ? `${compact.slice(0, 137)}...` : compact || "No body copy yet.";
}

export default function AdminOutreachSequencesPage() {
  const { showToast } = useToast();
  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const cadencePreview = useMemo(() => {
    let cumulative = 0;
    return form.steps.map((step) => {
      cumulative += Number(step.delayHours || 0);
      return {
        stepNumber: step.stepNumber,
        delayHours: Number(step.delayHours || 0),
        cumulativeHours: cumulative,
        subject: step.subject
      };
    });
  }, [form.steps]);

  async function load() {
    try {
      const sequenceData = await fetchAdminOutreachSequences();
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
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function applyTemplate(template: SequenceTemplate) {
    setEditingId(null);
    setForm({
      name: template.name,
      description: template.description,
      isActive: true,
      steps: buildSteps(template.steps)
    });
  }

  async function createFromTemplate(template: SequenceTemplate) {
    try {
      await createAdminOutreachSequence({
        name: template.name,
        description: template.description,
        isActive: true,
        steps: buildSteps(template.steps).map((step) => ({
          stepNumber: step.stepNumber,
          delayHours: Number(step.delayHours),
          subject: step.subject,
          bodyText: step.bodyText || "",
          bodyHtml: step.bodyHtml || ""
        }))
      });
      await load();
      showToast({ title: "Template sequence created", description: template.name });
    } catch (error) {
      showToast({
        title: "Could not create template sequence",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  async function onCreate() {
    try {
      await createAdminOutreachSequence({
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
      resetForm();
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

  async function onSave() {
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
        steps: form.steps.map((step, index) => ({
          ...step,
          stepNumber: index + 1,
          delayHours: Number(step.delayHours || 0)
        }))
      });
      resetForm();
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

  async function removeSequence(sequence: OutreachSequence) {
    try {
      await deleteAdminOutreachSequence(sequence.id);
      await load();
      if (editingId === sequence.id) {
        resetForm();
      }
      showToast({ title: "Sequence deleted" });
    } catch (error) {
      showToast({
        title: "Could not delete sequence",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error"
      });
    }
  }

  function updateStep(index: number, patch: Partial<OutreachSequenceStep>) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...patch } : step
      )
    }));
  }

  function addStep() {
    setForm((current) => ({
      ...current,
      steps: [
        ...current.steps,
        {
          stepNumber: current.steps.length + 1,
          delayHours: 48,
          subject: "",
          bodyText: "",
          bodyHtml: ""
        }
      ]
    }));
  }

  function removeStep(index: number) {
    setForm((current) => ({
      ...current,
      steps: current.steps
        .filter((_, stepIndex) => stepIndex !== index)
        .map((step, stepIndex) => ({
          ...step,
          stepNumber: stepIndex + 1
        }))
    }));
  }

  return (
    <AdminGuard requireSuperAdmin>
      <div className="container space-y-6 py-10">
        <AdminTopTabs />
        <PageHeader
          eyebrow="Internal growth"
          title="Outreach Sequences"
          description="Build reusable cold outreach campaigns, start from proven templates, and preview the timing before you enroll leads."
        />
        <OutreachSubnav />

        <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Premade sequences</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-3">
                {PREMADE_TEMPLATES.map((template) => (
                  <div key={template.id} className="rounded-lg border p-4">
                    <div className="font-semibold">{template.name}</div>
                    <div className="mt-2 text-sm text-muted-foreground">{template.description}</div>
                    <div className="mt-3 text-xs text-muted-foreground">{template.fit}</div>
                    <div className="mt-4 text-xs text-muted-foreground">
                      {template.steps.length} steps • {template.steps.map((step) => step.delayHours).join("h / ")}h
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => applyTemplate(template)}>
                        Use in editor
                      </Button>
                      <Button size="sm" onClick={() => void createFromTemplate(template)}>
                        Create now
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{editingId ? "Edit sequence" : "Create sequence"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
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
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Example: Local service intro"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Who this sequence is for and what angle it uses"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {form.steps.map((step, index) => (
                    <div key={`${step.stepNumber}-${index}`} className="rounded-lg border p-4 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">Step {index + 1}</div>
                          <div className="text-sm text-muted-foreground">
                            {hoursLabel(Number(step.delayHours || 0))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={form.steps.length <= 1}
                            onClick={() => removeStep(index)}
                          >
                            Remove step
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[140px_1fr]">
                        <div>
                          <Label>Delay hours</Label>
                          <Input
                            type="number"
                            min="0"
                            value={String(step.delayHours)}
                            onChange={(event) => updateStep(index, { delayHours: Number(event.target.value || 0) })}
                          />
                        </div>
                        <div>
                          <Label>Subject</Label>
                          <Input
                            value={step.subject}
                            placeholder="Example: Quick idea for {{companyName}}"
                            onChange={(event) => updateStep(index, { subject: event.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Body text</Label>
                        <Textarea
                          rows={7}
                          value={step.bodyText || ""}
                          placeholder="Write the cold outreach message for this step."
                          onChange={(event) => updateStep(index, { bodyText: event.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={addStep}>
                    Add step
                  </Button>
                  <Button onClick={() => void onSave()}>{editingId ? "Save sequence" : "Create sequence"}</Button>
                  {editingId ? (
                    <Button variant="outline" onClick={resetForm}>
                      Cancel edit
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cadence preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cadencePreview.map((step) => (
                  <div key={step.stepNumber} className="rounded-lg border p-3">
                    <div className="font-medium">Step {step.stepNumber}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Delay: {hoursLabel(step.delayHours)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Sequence age: {hoursLabel(step.cumulativeHours)}
                    </div>
                    <div className="mt-2 text-sm">{step.subject || "No subject yet."}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Writing notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div>Keep step 1 short and specific to the business problem you solve.</div>
                <div>Use steps 2 and 3 to follow up, not to rewrite the same message louder.</div>
                <div>Personalization variables are strongest in the subject line and first sentence.</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Saved sequences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sequences.length ? (
              sequences.map((sequence) => (
                <div key={sequence.id} className="rounded-lg border p-4 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{sequence.name}</div>
                      <div className="text-sm text-muted-foreground">{sequence.description || "No description."}</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {sequence.isActive ? "Active" : "Paused"} • {sequence.steps.length} steps •{" "}
                        {sequence._count?.enrollments || 0} enrollment{sequence._count?.enrollments === 1 ? "" : "s"}
                      </div>
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
                            steps: sequence.steps.map((step, index) => ({
                              stepNumber: index + 1,
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

                  <div className="grid gap-3 lg:grid-cols-3">
                    {sequence.steps.map((step) => (
                      <div key={step.stepNumber} className="rounded-lg border p-3">
                        <div className="font-medium">Step {step.stepNumber}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{hoursLabel(step.delayHours)}</div>
                        <div className="mt-2 text-sm font-medium">{step.subject || "No subject yet."}</div>
                        <div className="mt-2 text-sm text-muted-foreground">{snippet(step.bodyText)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="space-y-4 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                <div>No sequences created yet.</div>
                <div>Start with one of the premade sequences above or build a custom cadence from scratch.</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminGuard>
  );
}
