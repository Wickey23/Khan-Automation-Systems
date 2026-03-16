"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bolt, Building2, CalendarDays, FileText, Bell } from "lucide-react";
import { fetchOrgOnboarding, previewOrgOnboarding, saveOrgOnboarding, submitOrgOnboarding } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page";
import { Textarea } from "@/components/ui/textarea";
import { clientBadgeClass } from "@/lib/client-badges";

type FormState = {
  legalBusinessName: string;
  displayName: string;
  industry: string;
  address: string;
  serviceArea: string;
  website: string;
  holidayPolicy: string;
  afterHoursInstructions: string;
  services: string;
  bookingMethod: "manual" | "google_calendar" | "manager_notify";
  usesBookingApp: "yes" | "no" | "not_sure";
  bookingAppName: string;
  bookingAppMode: "direct_booking" | "staff_review" | "link_only";
  bookingLink: string;
  bookingAccountEmail: string;
  appointmentDurationMin: string;
  appointmentBufferMin: string;
  transferNumbers: string;
  customQuestions: string;
  warrantyPolicy: string;
  cancellationPolicy: string;
  diagnosticsPolicy: string;
  managerEmails: string;
  managerPhones: string;
  leadSummaryRecipients: string;
  shopManagementSystem: string;
  crm: string;
  websiteForm: string;
  testMode: boolean;
};

const defaultState: FormState = {
  legalBusinessName: "",
  displayName: "",
  industry: "",
  address: "",
  serviceArea: "",
  website: "",
  holidayPolicy: "",
  afterHoursInstructions: "",
  services: "",
  bookingMethod: "manager_notify",
  usesBookingApp: "not_sure",
  bookingAppName: "",
  bookingAppMode: "staff_review",
  bookingLink: "",
  bookingAccountEmail: "",
  appointmentDurationMin: "",
  appointmentBufferMin: "",
  transferNumbers: "",
  customQuestions: "",
  warrantyPolicy: "",
  cancellationPolicy: "",
  diagnosticsPolicy: "",
  managerEmails: "",
  managerPhones: "",
  leadSummaryRecipients: "",
  shopManagementSystem: "",
  crm: "",
  websiteForm: "",
  testMode: true
};

function hasText(value: string) {
  return Boolean(value.trim());
}

function statusTone(status: string) {
  if (status === "SUBMITTED") return "success" as const;
  if (status === "DRAFT") return "pending" as const;
  return "warning" as const;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function AppOnboardingPage() {
  const { showToast } = useToast();
  const [state, setState] = useState<FormState>(defaultState);
  const [status, setStatus] = useState("DRAFT");
  const [saving, setSaving] = useState(false);
  const [buildSheet, setBuildSheet] = useState<string>("");

  useEffect(() => {
    void fetchOrgOnboarding()
      .then((data) => {
        const submission = data.submission;
        if (!submission) return;
        setStatus(submission.status);
        const answers = JSON.parse(submission.answersJson || "{}") as Record<string, unknown>;
        const profile = (answers.businessProfile || {}) as Record<string, unknown>;
        const hours = (answers.hoursAvailability || {}) as Record<string, unknown>;
        const servicesPricing = (answers.servicesPricing || {}) as Record<string, unknown>;
        const booking = (answers.bookingScheduling || {}) as Record<string, unknown>;
        const callPrefs = (answers.callHandlingPreferences || {}) as Record<string, unknown>;
        const intake = (answers.intakeQuestions || {}) as Record<string, unknown>;
        const policies = (answers.policies || {}) as Record<string, unknown>;
        const notifications = (answers.notifications || {}) as Record<string, unknown>;
        const tools = (answers.existingTools || {}) as Record<string, unknown>;
        const demo = (answers.demoTestMode || {}) as Record<string, unknown>;

        setState((prev) => ({
          ...prev,
          legalBusinessName: String(profile.legalBusinessName || ""),
          displayName: String(profile.displayName || ""),
          industry: String(profile.industry || ""),
          address: String(profile.address || ""),
          serviceArea: String(profile.serviceArea || ""),
          website: String(profile.website || ""),
          holidayPolicy: String(hours.holidayPolicy || ""),
          afterHoursInstructions: String(hours.afterHoursInstructions || ""),
          services: Array.isArray(servicesPricing.serviceCategories) ? servicesPricing.serviceCategories.join("\n") : "",
          bookingMethod:
            booking.bookingMethod === "manual" || booking.bookingMethod === "google_calendar" || booking.bookingMethod === "manager_notify"
              ? booking.bookingMethod
              : "manager_notify",
          usesBookingApp:
            booking.usesBookingApp === "yes" || booking.usesBookingApp === "no" || booking.usesBookingApp === "not_sure"
              ? booking.usesBookingApp
              : "not_sure",
          bookingAppName: String(booking.bookingAppName || ""),
          bookingAppMode:
            booking.bookingAppMode === "direct_booking" || booking.bookingAppMode === "staff_review" || booking.bookingAppMode === "link_only"
              ? booking.bookingAppMode
              : "staff_review",
          bookingLink: String(booking.bookingLink || ""),
          bookingAccountEmail: String(booking.bookingAccountEmail || ""),
          appointmentDurationMin: String(booking.appointmentDurationMin || ""),
          appointmentBufferMin: String(booking.appointmentBufferMin || ""),
          transferNumbers: Array.isArray(callPrefs.transferNumbers) ? callPrefs.transferNumbers.join("\n") : "",
          customQuestions: Array.isArray(intake.customQuestions) ? intake.customQuestions.join("\n") : "",
          warrantyPolicy: String(policies.warrantyPolicy || ""),
          cancellationPolicy: String(policies.cancellationPolicy || ""),
          diagnosticsPolicy: String(policies.diagnosticsPolicy || ""),
          managerEmails: Array.isArray(notifications.managerEmails) ? notifications.managerEmails.join("\n") : "",
          managerPhones: Array.isArray(notifications.managerPhones) ? notifications.managerPhones.join("\n") : "",
          leadSummaryRecipients: Array.isArray(notifications.leadSummaryRecipients) ? notifications.leadSummaryRecipients.join("\n") : "",
          shopManagementSystem: String(tools.shopManagementSystem || ""),
          crm: String(tools.crm || ""),
          websiteForm: String(tools.websiteForm || ""),
          testMode: typeof demo.enabled === "boolean" ? demo.enabled : true
        }));
      })
      .catch(() => null);
  }, []);

  const answers = useMemo(
    () => ({
      businessProfile: {
        legalBusinessName: state.legalBusinessName,
        displayName: state.displayName,
        industry: state.industry,
        address: state.address,
        serviceArea: state.serviceArea,
        website: state.website
      },
      hoursAvailability: {
        holidayPolicy: state.holidayPolicy,
        afterHoursInstructions: state.afterHoursInstructions
      },
      servicesPricing: {
        serviceCategories: state.services.split("\n").map((x) => x.trim()).filter(Boolean)
      },
      bookingScheduling: {
        bookingMethod: state.bookingMethod,
        usesBookingApp: state.usesBookingApp,
        bookingAppName: state.bookingAppName,
        bookingAppMode: state.bookingAppMode,
        bookingLink: state.bookingLink,
        bookingAccountEmail: state.bookingAccountEmail,
        appointmentDurationMin: state.appointmentDurationMin ? Number(state.appointmentDurationMin) : undefined,
        appointmentBufferMin: state.appointmentBufferMin ? Number(state.appointmentBufferMin) : undefined
      },
      callHandlingPreferences: {
        transferNumbers: state.transferNumbers.split("\n").map((x) => x.trim()).filter(Boolean)
      },
      intakeQuestions: {
        customQuestions: state.customQuestions.split("\n").map((x) => x.trim()).filter(Boolean)
      },
      policies: {
        warrantyPolicy: state.warrantyPolicy,
        cancellationPolicy: state.cancellationPolicy,
        diagnosticsPolicy: state.diagnosticsPolicy
      },
      notifications: {
        managerEmails: state.managerEmails.split("\n").map((x) => x.trim()).filter(Boolean),
        managerPhones: state.managerPhones.split("\n").map((x) => x.trim()).filter(Boolean),
        leadSummaryRecipients: state.leadSummaryRecipients.split("\n").map((x) => x.trim()).filter(Boolean)
      },
      existingTools: {
        shopManagementSystem: state.shopManagementSystem,
        crm: state.crm,
        websiteForm: state.websiteForm
      },
      demoTestMode: {
        enabled: state.testMode
      }
    }),
    [state]
  );

  const steps = useMemo(
    () => [
      {
        key: "business",
        label: "Business Profile",
        sublabel: "Step 01 / Completed",
        icon: Building2,
        active: false,
        complete: hasText(state.legalBusinessName) && hasText(state.displayName) && hasText(state.industry)
      },
      {
        key: "operations",
        label: "Operations (AI Setup)",
        sublabel: "Step 02 / Active",
        icon: Bolt,
        active: true,
        complete: hasText(state.services) || hasText(state.transferNumbers) || hasText(state.afterHoursInstructions)
      },
      {
        key: "booking",
        label: "Booking Rules",
        sublabel: "Step 03 / In Progress",
        icon: CalendarDays,
        active: false,
        complete: hasText(state.bookingAppName) || hasText(state.bookingLink) || hasText(state.appointmentDurationMin)
      },
      {
        key: "policies",
        label: "Policies",
        sublabel: "Step 04 / In Progress",
        icon: FileText,
        active: false,
        complete: hasText(state.warrantyPolicy) || hasText(state.cancellationPolicy) || hasText(state.diagnosticsPolicy)
      },
      {
        key: "notifications",
        label: "Notifications",
        sublabel: "Step 05 / In Progress",
        icon: Bell,
        active: false,
        complete: hasText(state.managerEmails) || hasText(state.managerPhones) || hasText(state.leadSummaryRecipients)
      }
    ],
    [state]
  );

  const completionPercent = Math.round((steps.filter((step) => step.complete).length / steps.length) * 100);

  async function onSaveDraft() {
    setSaving(true);
    try {
      const res = await saveOrgOnboarding(answers);
      setStatus(res.submission.status);
      showToast({ title: "Draft saved" });
    } catch (error) {
      showToast({ title: "Save failed", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit() {
    setSaving(true);
    try {
      const res = await submitOrgOnboarding(answers);
      setStatus(res.submission.status);
      showToast({ title: "Setup submitted for review" });
    } catch (error) {
      showToast({ title: "Submit failed", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function onPreview() {
    setSaving(true);
    try {
      const res = await previewOrgOnboarding(answers);
      setBuildSheet(JSON.stringify(res.configPackage, null, 2));
      showToast({ title: "Build sheet generated" });
    } catch (error) {
      showToast({ title: "Preview failed", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="Onboarding Wizard"
        description="Configure the receptionist around the office's real booking, routing, policy, and notification workflow before go-live."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onSaveDraft} disabled={saving}>
              {saving ? "Saving..." : "Save progress"}
            </Button>
            <Button onClick={onPreview} disabled={saving}>
              Preview build sheet
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_360px] xl:items-start">
        <aside className="rounded-[16px] border border-slate-300 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
          <div className="p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Configuration</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Onboarding Wizard</h2>
            <div className="mt-8 space-y-1">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-4 rounded-[12px] border px-4 py-3 ${
                      step.active ? "border-blue-200 bg-blue-50" : "border-transparent"
                    }`}
                  >
                    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-[10px] ${
                      step.complete ? "bg-emerald-50 text-emerald-700" : step.active ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-950">{step.label}</p>
                      <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${step.active ? "text-blue-700" : "text-slate-500"}`}>
                        {step.sublabel}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-5">
            <div className="flex items-end justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Progress</span>
              <span className="text-lg font-semibold text-blue-700">{completionPercent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-blue-700" style={{ width: `${completionPercent}%` }} />
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4 rounded-[16px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
            <div>
              <h2 className="text-4xl font-semibold uppercase tracking-[-0.05em] text-slate-950">Operations Setup</h2>
              <p className="mt-2 text-base text-slate-600">Configure the AI-driven front desk routing, booking handoff, and business rules.</p>
            </div>
            <Badge className={clientBadgeClass(statusTone(status))}>{status}</Badge>
          </div>

          <section className="rounded-[16px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
            <div className="mb-6 flex items-center gap-2 border-b border-slate-200 pb-4">
              <Bolt className="h-5 w-5 text-blue-700" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-950">AI Voice Personalization</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Agent Name">
                  <Input value={state.displayName || "Front Desk"} onChange={(e) => setState((p) => ({ ...p, displayName: e.target.value }))} />
                </Field>
              </div>
              <Field label="Legal business name">
                <Input value={state.legalBusinessName} onChange={(e) => setState((p) => ({ ...p, legalBusinessName: e.target.value }))} />
              </Field>
              <Field label="Industry">
                <Input value={state.industry} onChange={(e) => setState((p) => ({ ...p, industry: e.target.value }))} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Service area">
                  <Input value={state.serviceArea} onChange={(e) => setState((p) => ({ ...p, serviceArea: e.target.value }))} />
                </Field>
              </div>
            </div>
          </section>

          <section className="rounded-[16px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
            <div className="mb-6 flex items-center gap-2 border-b border-slate-200 pb-4">
              <CalendarDays className="h-5 w-5 text-blue-700" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-950">Routing Logic</h3>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Booking workflow">
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={state.bookingMethod} onChange={(e) => setState((p) => ({ ...p, bookingMethod: e.target.value as FormState["bookingMethod"] }))}>
                    <option value="manager_notify">Manager notify</option>
                    <option value="manual">Manual booking</option>
                    <option value="google_calendar">Google Calendar</option>
                  </select>
                </Field>
                <Field label="Booking app in use">
                  <Input value={state.bookingAppName} onChange={(e) => setState((p) => ({ ...p, bookingAppName: e.target.value }))} placeholder="Jobber, Housecall Pro, ServiceTitan..." />
                </Field>
              </div>
              <Field label="Services handled by the receptionist" hint="One service or request type per line.">
                <Textarea value={state.services} onChange={(e) => setState((p) => ({ ...p, services: e.target.value }))} className="min-h-[120px]" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="After-hours instructions">
                  <Textarea value={state.afterHoursInstructions} onChange={(e) => setState((p) => ({ ...p, afterHoursInstructions: e.target.value }))} className="min-h-[120px]" />
                </Field>
                <Field label="Transfer numbers">
                  <Textarea value={state.transferNumbers} onChange={(e) => setState((p) => ({ ...p, transferNumbers: e.target.value }))} className="min-h-[120px]" />
                </Field>
              </div>
            </div>
          </section>

          <section className="rounded-[16px] border border-slate-300 bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Booking link">
                <Input value={state.bookingLink} onChange={(e) => setState((p) => ({ ...p, bookingLink: e.target.value }))} placeholder="https://..." />
              </Field>
              <Field label="Calendar/account email">
                <Input value={state.bookingAccountEmail} onChange={(e) => setState((p) => ({ ...p, bookingAccountEmail: e.target.value }))} placeholder="dispatch@company.com" />
              </Field>
              <Field label="Appointment duration (min)">
                <Input type="number" min={0} value={state.appointmentDurationMin} onChange={(e) => setState((p) => ({ ...p, appointmentDurationMin: e.target.value }))} />
              </Field>
              <Field label="Buffer between appointments (min)">
                <Input type="number" min={0} value={state.appointmentBufferMin} onChange={(e) => setState((p) => ({ ...p, appointmentBufferMin: e.target.value }))} />
              </Field>
              <Field label="Policies">
                <Textarea value={state.cancellationPolicy} onChange={(e) => setState((p) => ({ ...p, cancellationPolicy: e.target.value }))} className="min-h-[110px]" />
              </Field>
              <Field label="Notifications">
                <Textarea value={state.managerEmails} onChange={(e) => setState((p) => ({ ...p, managerEmails: e.target.value }))} className="min-h-[110px]" />
              </Field>
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <Button className="min-w-[220px]" onClick={onSubmit} disabled={saving}>
              Submit for review
            </Button>
            <Button variant="outline" asChild>
              <Link href="/app">Back to Front Desk</Link>
            </Button>
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24">
          <div className="rounded-[16px] border border-slate-300 bg-slate-50 p-6 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Build Sheet</h3>
              <button type="button" onClick={() => void onPreview()} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                Refresh
              </button>
            </div>
            <div className="mt-4 rounded-[14px] border border-slate-300 bg-white p-5">
              <div className="border-b border-slate-200 pb-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Status: <span className="text-amber-600">{status === "SUBMITTED" ? "Awaiting Review" : "Awaiting Build"}</span>
                </p>
                <p className="mt-2 text-lg font-semibold tracking-[-0.04em] text-slate-950">FRONT_DESK_CONFIG</p>
              </div>
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Infrastructure</p>
                  <div className="mt-2 space-y-2 text-slate-700">
                    <div className="flex items-center justify-between">
                      <span>Booking mode</span>
                      <span className="font-medium text-slate-950">{state.bookingMethod.replaceAll("_", " ")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Test mode</span>
                      <span className="font-medium text-slate-950">{state.testMode ? "Enabled" : "Disabled"}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Active Logic Modules</p>
                  <ul className="mt-2 space-y-2 text-[12px] font-medium text-slate-700">
                    <li>NLP conversational core</li>
                    <li>Intent detection engine</li>
                    <li>{hasText(state.managerEmails) ? "Notification routing" : "Notification routing pending"}</li>
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Agent Persona</p>
                  <div className="mt-2 rounded-[12px] border border-slate-200 bg-slate-50 p-4 text-xs italic leading-6 text-slate-600">
                    The agent identifies as {state.displayName || "Front Desk"}. Routing is based on {state.bookingMethod.replaceAll("_", " ")} and the current office transfer rules.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {buildSheet ? (
            <div className="rounded-[16px] border border-slate-300 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.07)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Generated package</p>
              <pre className="mt-4 max-h-[420px] overflow-auto rounded-[14px] bg-slate-950 p-4 text-xs leading-6 text-slate-100">{buildSheet}</pre>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
