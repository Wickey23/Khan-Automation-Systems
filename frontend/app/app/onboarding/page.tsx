"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchOrgOnboarding, previewOrgOnboarding, saveOrgOnboarding, submitOrgOnboarding } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { frontDeskContextPanelClass, frontDeskWorkspaceCardClass } from "@/lib/front-desk-ui";

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
    <div className="space-y-4">
      <PageHeader
        eyebrow="Workspace setup"
        title="Setup Wizard"
        description={`Status: ${status}. Use this page to teach the system how your office works before calls, texts, and bookings start flowing into the front desk.`}
        actions={
          <Button variant="outline" onClick={onPreview} disabled={saving}>Preview config package</Button>
        }
      />
      <div className={`${frontDeskContextPanelClass()} text-sm text-slate-700`}>
        <p className="page-eyebrow">How setup works</p>
        <p className="mt-2 font-medium text-slate-950">Complete this once so the front desk starts with the right business rules.</p>
        <p className="mt-1 leading-6 text-slate-600">
          Setup Wizard happens before live work begins. Once calls, texts, and booking requests start arriving, your team will spend most of its time in Front Desk, Call Queue, Inbox, and Booking Queue instead.
        </p>
      </div>
      <Card className={frontDeskWorkspaceCardClass("hero")}>
        <CardHeader className="pb-3">
          <CardTitle>Business Profile</CardTitle>
          <p className="text-sm text-muted-foreground">
            Start with the business details your office and assistant need on every request.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div><Label>Legal Business Name</Label><Input value={state.legalBusinessName} onChange={(e)=>setState((p)=>({...p,legalBusinessName:e.target.value}))} /></div>
          <div><Label>Display Name</Label><Input value={state.displayName} onChange={(e)=>setState((p)=>({...p,displayName:e.target.value}))} /></div>
          <div><Label>Industry</Label><Input value={state.industry} onChange={(e)=>setState((p)=>({...p,industry:e.target.value}))} /></div>
          <div><Label>Website</Label><Input value={state.website} onChange={(e)=>setState((p)=>({...p,website:e.target.value}))} /></div>
          <div className="sm:col-span-2"><Label>Address</Label><Input value={state.address} onChange={(e)=>setState((p)=>({...p,address:e.target.value}))} /></div>
          <div className="sm:col-span-2"><Label>Service Area</Label><Input value={state.serviceArea} onChange={(e)=>setState((p)=>({...p,serviceArea:e.target.value}))} /></div>
        </CardContent>
      </Card>
      <Card className={frontDeskWorkspaceCardClass("default")}>
        <CardHeader className="pb-3">
          <CardTitle>Operations Preferences</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tell the system how bookings, after-hours handling, and intake questions should work.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div><Label>Services (one per line)</Label><Textarea value={state.services} onChange={(e)=>setState((p)=>({...p,services:e.target.value}))} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Do you currently use a booking app?</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={state.usesBookingApp}
                onChange={(e) => setState((p) => ({ ...p, usesBookingApp: e.target.value as FormState["usesBookingApp"] }))}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="not_sure">Not sure</option>
              </select>
            </div>
            <div>
              <Label>Booking app</Label>
              <Input
                value={state.bookingAppName}
                onChange={(e) => setState((p) => ({ ...p, bookingAppName: e.target.value }))}
                placeholder="Jobber, Housecall Pro, ServiceTitan, Calendly, etc."
              />
            </div>
            <div>
              <Label>How should AI handle bookings?</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={state.bookingAppMode}
                onChange={(e) => setState((p) => ({ ...p, bookingAppMode: e.target.value as FormState["bookingAppMode"] }))}
              >
                <option value="staff_review">Create booking request for staff review</option>
                <option value="direct_booking">Book directly in existing app/calendar</option>
                <option value="link_only">Send booking link only</option>
              </select>
            </div>
            <div>
              <Label>Booking workflow</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={state.bookingMethod}
                onChange={(e) => setState((p) => ({ ...p, bookingMethod: e.target.value as FormState["bookingMethod"] }))}
              >
                <option value="manager_notify">Manager notify</option>
                <option value="manual">Manual booking</option>
                <option value="google_calendar">Google Calendar</option>
              </select>
            </div>
            <div>
              <Label>Booking link (if applicable)</Label>
              <Input
                value={state.bookingLink}
                onChange={(e) => setState((p) => ({ ...p, bookingLink: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Calendar/account email</Label>
              <Input
                value={state.bookingAccountEmail}
                onChange={(e) => setState((p) => ({ ...p, bookingAccountEmail: e.target.value }))}
                placeholder="scheduler@company.com"
              />
            </div>
            <div>
              <Label>Default appointment duration (minutes)</Label>
              <Input
                type="number"
                min={0}
                value={state.appointmentDurationMin}
                onChange={(e) => setState((p) => ({ ...p, appointmentDurationMin: e.target.value }))}
                placeholder="60"
              />
            </div>
            <div>
              <Label>Buffer between appointments (minutes)</Label>
              <Input
                type="number"
                min={0}
                value={state.appointmentBufferMin}
                onChange={(e) => setState((p) => ({ ...p, appointmentBufferMin: e.target.value }))}
                placeholder="15"
              />
            </div>
          </div>
          <div><Label>After-hours instructions</Label><Textarea value={state.afterHoursInstructions} onChange={(e)=>setState((p)=>({...p,afterHoursInstructions:e.target.value}))} /></div>
          <div><Label>Transfer numbers (one per line)</Label><Textarea value={state.transferNumbers} onChange={(e)=>setState((p)=>({...p,transferNumbers:e.target.value}))} /></div>
          <div><Label>Custom intake questions (one per line)</Label><Textarea value={state.customQuestions} onChange={(e)=>setState((p)=>({...p,customQuestions:e.target.value}))} /></div>
        </CardContent>
      </Card>
      <Card className={frontDeskWorkspaceCardClass("default")}>
        <CardHeader className="pb-3">
          <CardTitle>Policies & Notifications</CardTitle>
          <p className="text-sm text-muted-foreground">
            Set the policies and alert contacts that help your team follow up correctly once requests start arriving.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div><Label>Warranty policy</Label><Textarea value={state.warrantyPolicy} onChange={(e)=>setState((p)=>({...p,warrantyPolicy:e.target.value}))} /></div>
          <div><Label>Cancellation policy</Label><Textarea value={state.cancellationPolicy} onChange={(e)=>setState((p)=>({...p,cancellationPolicy:e.target.value}))} /></div>
          <div><Label>Manager emails</Label><Textarea value={state.managerEmails} onChange={(e)=>setState((p)=>({...p,managerEmails:e.target.value}))} /></div>
          <div><Label>Manager phones</Label><Textarea value={state.managerPhones} onChange={(e)=>setState((p)=>({...p,managerPhones:e.target.value}))} /></div>
        </CardContent>
      </Card>
      <div className={`${frontDeskContextPanelClass()} flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between`}>
        <div className="space-y-1">
          <p className="page-eyebrow">Onboarding actions</p>
          <p className="text-sm text-muted-foreground">Save progress, preview the generated build sheet, or submit the onboarding package for review.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
        <Button className="sm:min-w-[10rem]" onClick={onSaveDraft} disabled={saving}>{saving ? "Saving..." : "Save draft"}</Button>
        <Button className="sm:min-w-[10rem]" variant="outline" onClick={onPreview} disabled={saving}>Preview config package</Button>
        <Link href="/app/onboarding/preview" className="sm:min-w-[10rem]">
          <Button className="w-full" type="button" variant="outline">Open build sheet page</Button>
        </Link>
        <Button className="sm:min-w-[10rem]" variant="outline" onClick={onSubmit} disabled={saving}>Submit onboarding</Button>
        </div>
      </div>
      {previewJson ? (
        <Card className={frontDeskWorkspaceCardClass("subtle")}>
          <CardHeader className="pb-3">
            <CardTitle>AI Configuration Package Preview</CardTitle>
            <p className="text-sm text-muted-foreground">
              This is the generated build sheet your team can review before the receptionist goes live.
            </p>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded-2xl border bg-slate-950 p-4 text-xs text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">{previewJson}</pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
