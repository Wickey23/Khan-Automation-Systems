"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchOrgOnboarding, previewOrgOnboarding, saveOrgOnboarding, submitOrgOnboarding } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientStatusGrid } from "@/components/ui/client-module";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, SectionHeading, WorkflowHint } from "@/components/ui/page";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { clientBadgeClass } from "@/lib/client-badges";
import { frontDeskContextPanelClass, frontDeskEmptyStateClass, frontDeskWorkspaceCardClass } from "@/lib/front-desk-ui";

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

function sectionReady(values: string[], mode: "all" | "any" = "all") {
  return mode === "all" ? values.every(hasText) : values.some(hasText);
}

function statusTone(status: string) {
  if (status === "SUBMITTED") return "success" as const;
  if (status === "DRAFT") return "pending" as const;
  return "warning" as const;
}

function OnboardingField({
  label,
  children,
  hint
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
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
  const [status, setStatus] = useState<string>("DRAFT");
  const [saving, setSaving] = useState(false);
  const [previewJson, setPreviewJson] = useState<string>("");

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
            booking.bookingAppMode === "direct_booking" ||
            booking.bookingAppMode === "staff_review" ||
            booking.bookingAppMode === "link_only"
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
          leadSummaryRecipients: Array.isArray(notifications.leadSummaryRecipients)
            ? notifications.leadSummaryRecipients.join("\n")
            : "",
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

  const setupSections = useMemo(
    () => [
      {
        label: "Business profile",
        detail: "Identity, address, and service area.",
        complete: sectionReady([state.legalBusinessName, state.displayName, state.industry, state.address, state.serviceArea])
      },
      {
        label: "Operations and booking",
        detail: "Services, booking flow, after-hours, and transfers.",
        complete: sectionReady([state.services, state.afterHoursInstructions, state.transferNumbers], "any")
      },
      {
        label: "Policies and alerts",
        detail: "Policies and who gets notified.",
        complete: sectionReady([state.warrantyPolicy, state.cancellationPolicy, state.managerEmails], "any")
      },
      {
        label: "Existing systems",
        detail: "CRM, shop system, and forms.",
        complete: sectionReady([state.shopManagementSystem, state.crm, state.websiteForm], "any")
      }
    ],
    [state]
  );

  const completedSections = setupSections.filter((section) => section.complete).length;
  const completionPercent = Math.round((completedSections / setupSections.length) * 100);

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
      showToast({ title: "Onboarding submitted", description: "Our team will review and configure your AI system." });
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
      setPreviewJson(JSON.stringify(res.configPackage, null, 2));
      showToast({ title: "Configuration package preview generated" });
    } catch (error) {
      showToast({ title: "Preview failed", description: error instanceof Error ? error.message : "Try again.", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace setup"
        title="Setup Wizard"
        description={`Status: ${status}. Teach the receptionist how your office operates before live calls, texts, and booking requests start flowing into the front desk.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onPreview} disabled={saving}>Preview build sheet</Button>
            <Button onClick={onSaveDraft} disabled={saving}>{saving ? "Saving..." : "Save draft"}</Button>
          </div>
        }
      />

      <WorkflowHint
        items={[
          {
            label: "Use this page",
            text: "Use Setup Wizard before going live so calls, texts, and booking requests follow the same rules your office already uses."
          },
          {
            label: "Start here",
            text: "Complete the business profile and operations sections first, then review the build sheet preview to confirm the receptionist understands the business."
          },
          {
            label: "Go next",
            text: "After setup is complete, move into Front Desk, Call Queue, Inbox, and Booking Queue to work the live requests that start coming in."
          }
        ]}
      />

      <ClientStatusGrid
        items={[
          {
            label: "Setup status",
            value: status.replaceAll("_", " "),
            detail: status === "SUBMITTED" ? "The setup package has been submitted for review." : "Keep filling this out until the receptionist rules match how the office actually operates.",
            tone: statusTone(status)
          },
          {
            label: "Call mode",
            value: state.testMode ? "Testing" : "Live-ready",
            detail: state.testMode ? "Use testing while validating flows and wording before go-live." : "This setup is aimed at live production behavior.",
            tone: state.testMode ? "pending" : "success"
          },
          {
            label: "Business profile",
            value: sectionReady([state.legalBusinessName, state.displayName, state.industry], "all") ? "Ready" : "In progress",
            detail: "Legal name, display name, and industry are the minimum business identity fields for launch.",
            tone: sectionReady([state.legalBusinessName, state.displayName, state.industry], "all") ? "success" : "pending"
          },
          {
            label: "Booking setup",
            value: sectionReady([state.bookingMethod, state.services], "all") ? "In progress" : "Not configured",
            detail: "Booking details determine whether requests move cleanly into scheduling work.",
            tone: sectionReady([state.bookingMethod, state.services], "all") ? "pending" : "warning"
          }
        ]}
      />

      <Card className={frontDeskWorkspaceCardClass("hero")}>
        <CardContent className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.1fr)_360px] xl:items-start">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="page-eyebrow">How setup works</p>
              <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-slate-950 sm:text-[34px]">
                Build the receptionist around how your office already operates.
              </h2>
              <p className="max-w-3xl text-[15px] leading-7 text-slate-600">
                Complete the sections below once so live calls, text follow-up, and booking requests land in the right queues with the right business rules from day one.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className={frontDeskContextPanelClass()}>
                <p className="page-eyebrow">Current status</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge className={clientBadgeClass(statusTone(status))}>{status.replaceAll("_", " ")}</Badge>
                  <Badge className={clientBadgeClass(state.testMode ? "automated" : "neutral")}>
                    {state.testMode ? "Test mode on" : "Live mode"}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {status === "SUBMITTED"
                    ? "Your setup package has been submitted for review."
                    : "Keep saving as you go, then preview the build sheet before submitting."}
                </p>
              </div>
              <div className={frontDeskContextPanelClass()}>
                <p className="page-eyebrow">Completion</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{completionPercent}%</p>
                <p className="mt-1 text-sm text-slate-600">
                  {completedSections} of {setupSections.length} setup sections are materially filled in.
                </p>
              </div>
              <div className={frontDeskContextPanelClass()}>
                <p className="page-eyebrow">What this affects</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Front Desk, Call Queue, Inbox, and Booking Queue all rely on this setup to summarize calls correctly and route follow-up work to the right place.
                </p>
              </div>
            </div>
          </div>

          <div className={`${frontDeskContextPanelClass()} space-y-4`}>
            <div className="space-y-1">
              <p className="page-eyebrow">Setup checklist</p>
              <p className="text-sm text-slate-600">Use this panel to see what still needs office input before go-live.</p>
            </div>
            <div className="space-y-3">
              {setupSections.map((section) => (
                <div key={section.label} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-950">{section.label}</p>
                    <p className="text-xs leading-5 text-slate-600">{section.detail}</p>
                  </div>
                  <Badge className={clientBadgeClass(section.complete ? "success" : "pending")}>
                    {section.complete ? "Ready" : "Needs input"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="space-y-6">
          <Card className={frontDeskWorkspaceCardClass("default")}>
            <CardHeader className="pb-3">
              <SectionHeading eyebrow="Section 1" title="Business Profile" description="Set the core business identity the receptionist should use on every request." />
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <OnboardingField label="Legal business name"><Input value={state.legalBusinessName} onChange={(e)=>setState((p)=>({...p,legalBusinessName:e.target.value}))} /></OnboardingField>
              <OnboardingField label="Display name"><Input value={state.displayName} onChange={(e)=>setState((p)=>({...p,displayName:e.target.value}))} /></OnboardingField>
              <OnboardingField label="Industry"><Input value={state.industry} onChange={(e)=>setState((p)=>({...p,industry:e.target.value}))} /></OnboardingField>
              <OnboardingField label="Website"><Input value={state.website} onChange={(e)=>setState((p)=>({...p,website:e.target.value}))} /></OnboardingField>
              <div className="sm:col-span-2"><OnboardingField label="Business address"><Input value={state.address} onChange={(e)=>setState((p)=>({...p,address:e.target.value}))} /></OnboardingField></div>
              <div className="sm:col-span-2"><OnboardingField label="Service area" hint="List cities, counties, or neighborhoods the office actually serves."><Input value={state.serviceArea} onChange={(e)=>setState((p)=>({...p,serviceArea:e.target.value}))} /></OnboardingField></div>
            </CardContent>
          </Card>

          <Card className={frontDeskWorkspaceCardClass("default")}>
            <CardHeader className="pb-3">
              <SectionHeading eyebrow="Section 2" title="Operations and Booking" description="Tell the receptionist how services, scheduling, transfers, and after-hours follow-up should work." />
            </CardHeader>
            <CardContent className="space-y-4">
              <OnboardingField label="Services offered (one per line)" hint="Use the same language the office uses when categorizing requests.">
                <Textarea value={state.services} onChange={(e)=>setState((p)=>({...p,services:e.target.value}))} className="min-h-[140px]" />
              </OnboardingField>
              <div className="grid gap-4 sm:grid-cols-2">
                <OnboardingField label="Do you currently use a booking app?">
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={state.usesBookingApp} onChange={(e) => setState((p) => ({ ...p, usesBookingApp: e.target.value as FormState["usesBookingApp"] }))}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="not_sure">Not sure</option>
                  </select>
                </OnboardingField>
                <OnboardingField label="Booking app" hint="Examples: Jobber, Housecall Pro, ServiceTitan, Calendly.">
                  <Input value={state.bookingAppName} onChange={(e) => setState((p) => ({ ...p, bookingAppName: e.target.value }))} />
                </OnboardingField>
                <OnboardingField label="How should AI handle bookings?">
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={state.bookingAppMode} onChange={(e) => setState((p) => ({ ...p, bookingAppMode: e.target.value as FormState["bookingAppMode"] }))}>
                    <option value="staff_review">Create booking request for staff review</option>
                    <option value="direct_booking">Book directly in existing app or calendar</option>
                    <option value="link_only">Send booking link only</option>
                  </select>
                </OnboardingField>
                <OnboardingField label="Booking workflow">
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={state.bookingMethod} onChange={(e) => setState((p) => ({ ...p, bookingMethod: e.target.value as FormState["bookingMethod"] }))}>
                    <option value="manager_notify">Manager notify</option>
                    <option value="manual">Manual booking</option>
                    <option value="google_calendar">Google Calendar</option>
                  </select>
                </OnboardingField>
                <OnboardingField label="Booking link"><Input value={state.bookingLink} onChange={(e) => setState((p) => ({ ...p, bookingLink: e.target.value }))} placeholder="https://..." /></OnboardingField>
                <OnboardingField label="Calendar or account email"><Input value={state.bookingAccountEmail} onChange={(e) => setState((p) => ({ ...p, bookingAccountEmail: e.target.value }))} placeholder="scheduler@company.com" /></OnboardingField>
                <OnboardingField label="Default appointment duration (minutes)"><Input type="number" min={0} value={state.appointmentDurationMin} onChange={(e) => setState((p) => ({ ...p, appointmentDurationMin: e.target.value }))} placeholder="60" /></OnboardingField>
                <OnboardingField label="Buffer between appointments (minutes)"><Input type="number" min={0} value={state.appointmentBufferMin} onChange={(e) => setState((p) => ({ ...p, appointmentBufferMin: e.target.value }))} placeholder="15" /></OnboardingField>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <OnboardingField label="After-hours instructions"><Textarea value={state.afterHoursInstructions} onChange={(e)=>setState((p)=>({...p,afterHoursInstructions:e.target.value}))} className="min-h-[130px]" /></OnboardingField>
                <OnboardingField label="Holiday policy"><Textarea value={state.holidayPolicy} onChange={(e)=>setState((p)=>({...p,holidayPolicy:e.target.value}))} className="min-h-[130px]" /></OnboardingField>
                <OnboardingField label="Transfer numbers (one per line)"><Textarea value={state.transferNumbers} onChange={(e)=>setState((p)=>({...p,transferNumbers:e.target.value}))} className="min-h-[130px]" /></OnboardingField>
                <OnboardingField label="Custom intake questions (one per line)"><Textarea value={state.customQuestions} onChange={(e)=>setState((p)=>({...p,customQuestions:e.target.value}))} className="min-h-[130px]" /></OnboardingField>
              </div>
            </CardContent>
          </Card>

          <Card className={frontDeskWorkspaceCardClass("default")}>
            <CardHeader className="pb-3">
              <SectionHeading eyebrow="Section 3" title="Policies and Notifications" description="Set the policies and alert recipients that guide follow-up once requests start landing in the queues." />
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <OnboardingField label="Warranty policy"><Textarea value={state.warrantyPolicy} onChange={(e)=>setState((p)=>({...p,warrantyPolicy:e.target.value}))} className="min-h-[130px]" /></OnboardingField>
              <OnboardingField label="Cancellation policy"><Textarea value={state.cancellationPolicy} onChange={(e)=>setState((p)=>({...p,cancellationPolicy:e.target.value}))} className="min-h-[130px]" /></OnboardingField>
              <OnboardingField label="Diagnostics policy"><Textarea value={state.diagnosticsPolicy} onChange={(e)=>setState((p)=>({...p,diagnosticsPolicy:e.target.value}))} className="min-h-[130px]" /></OnboardingField>
              <OnboardingField label="Lead summary recipients"><Textarea value={state.leadSummaryRecipients} onChange={(e)=>setState((p)=>({...p,leadSummaryRecipients:e.target.value}))} className="min-h-[130px]" /></OnboardingField>
              <OnboardingField label="Manager emails"><Textarea value={state.managerEmails} onChange={(e)=>setState((p)=>({...p,managerEmails:e.target.value}))} className="min-h-[130px]" /></OnboardingField>
              <OnboardingField label="Manager phones"><Textarea value={state.managerPhones} onChange={(e)=>setState((p)=>({...p,managerPhones:e.target.value}))} className="min-h-[130px]" /></OnboardingField>
            </CardContent>
          </Card>

          <Card className={frontDeskWorkspaceCardClass("default")}>
            <CardHeader className="pb-3">
              <SectionHeading eyebrow="Section 4" title="Existing Systems" description="Document the tools and channels your office already uses so the receptionist fits into the current workflow." />
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <OnboardingField label="Shop management system"><Input value={state.shopManagementSystem} onChange={(e)=>setState((p)=>({...p,shopManagementSystem:e.target.value}))} placeholder="Housecall Pro, Jobber, ServiceTitan, etc." /></OnboardingField>
              <OnboardingField label="CRM"><Input value={state.crm} onChange={(e)=>setState((p)=>({...p,crm:e.target.value}))} placeholder="HubSpot, Salesforce, custom CRM, etc." /></OnboardingField>
              <div className="lg:col-span-2"><OnboardingField label="Website form or lead-source notes"><Textarea value={state.websiteForm} onChange={(e)=>setState((p)=>({...p,websiteForm:e.target.value}))} className="min-h-[120px]" /></OnboardingField></div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 xl:sticky xl:top-24">
          <div className={`${frontDeskContextPanelClass()} space-y-4`}>
            <div className="space-y-1">
              <p className="page-eyebrow">Submit and review</p>
              <p className="text-sm text-slate-600">Save progress, preview the generated build sheet, then submit the package when the office rules are ready for review.</p>
            </div>
            <div className="grid gap-3">
              <Button className="w-full" onClick={onSaveDraft} disabled={saving}>{saving ? "Saving..." : "Save draft"}</Button>
              <Button className="w-full" variant="outline" onClick={onPreview} disabled={saving}>Preview build sheet</Button>
              <Link href="/app/onboarding/preview"><Button className="w-full" type="button" variant="outline">Open build sheet page</Button></Link>
              <Button className="w-full" variant="outline" onClick={onSubmit} disabled={saving}>Submit setup package</Button>
            </div>
          </div>

          <div className={`${frontDeskContextPanelClass()} space-y-3`}>
            <p className="page-eyebrow">Go-live checklist</p>
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3">
                <p className="text-sm font-semibold text-slate-950">1. Business profile is accurate</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">Business name, address, website, and service area should match how the office represents itself publicly.</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3">
                <p className="text-sm font-semibold text-slate-950">2. Booking workflow is realistic</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">Choose the booking approach the office can actually support so requests land in the right queue.</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3">
                <p className="text-sm font-semibold text-slate-950">3. Alert recipients are ready</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">Manager emails and phones should route live follow-up to the right people on day one.</p>
              </div>
            </div>
          </div>

          {previewJson ? (
            <Card className={frontDeskWorkspaceCardClass("subtle")}>
              <CardHeader className="pb-3">
                <CardTitle>Build sheet preview</CardTitle>
                <p className="text-sm text-muted-foreground">Review the generated setup package before submitting it for configuration.</p>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[28rem] overflow-auto rounded-2xl border bg-slate-950 p-4 text-xs text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">{previewJson}</pre>
              </CardContent>
            </Card>
          ) : (
            <div className={frontDeskEmptyStateClass()}>
              Build sheet preview will appear here after you run a preview. Use it to review what the office configuration package will look like before submission.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
