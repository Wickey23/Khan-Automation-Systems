"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchOrgOnboarding, previewOrgOnboarding, saveOrgOnboarding, submitOrgOnboarding } from "@/lib/api";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

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
        bookingMethod: state.bookingMethod
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
      <div>
        <h1 className="text-3xl font-bold">Onboarding Wizard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Status: {status}</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Business Profile</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div><Label>Legal Business Name</Label><Input value={state.legalBusinessName} onChange={(e)=>setState((p)=>({...p,legalBusinessName:e.target.value}))} /></div>
          <div><Label>Display Name</Label><Input value={state.displayName} onChange={(e)=>setState((p)=>({...p,displayName:e.target.value}))} /></div>
          <div><Label>Industry</Label><Input value={state.industry} onChange={(e)=>setState((p)=>({...p,industry:e.target.value}))} /></div>
          <div><Label>Website</Label><Input value={state.website} onChange={(e)=>setState((p)=>({...p,website:e.target.value}))} /></div>
          <div className="sm:col-span-2"><Label>Address</Label><Input value={state.address} onChange={(e)=>setState((p)=>({...p,address:e.target.value}))} /></div>
          <div className="sm:col-span-2"><Label>Service Area</Label><Input value={state.serviceArea} onChange={(e)=>setState((p)=>({...p,serviceArea:e.target.value}))} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Operations Preferences</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div><Label>Services (one per line)</Label><Textarea value={state.services} onChange={(e)=>setState((p)=>({...p,services:e.target.value}))} /></div>
          <div><Label>After-hours instructions</Label><Textarea value={state.afterHoursInstructions} onChange={(e)=>setState((p)=>({...p,afterHoursInstructions:e.target.value}))} /></div>
          <div><Label>Transfer numbers (one per line)</Label><Textarea value={state.transferNumbers} onChange={(e)=>setState((p)=>({...p,transferNumbers:e.target.value}))} /></div>
          <div><Label>Custom intake questions (one per line)</Label><Textarea value={state.customQuestions} onChange={(e)=>setState((p)=>({...p,customQuestions:e.target.value}))} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Policies & Notifications</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div><Label>Warranty policy</Label><Textarea value={state.warrantyPolicy} onChange={(e)=>setState((p)=>({...p,warrantyPolicy:e.target.value}))} /></div>
          <div><Label>Cancellation policy</Label><Textarea value={state.cancellationPolicy} onChange={(e)=>setState((p)=>({...p,cancellationPolicy:e.target.value}))} /></div>
          <div><Label>Manager emails</Label><Textarea value={state.managerEmails} onChange={(e)=>setState((p)=>({...p,managerEmails:e.target.value}))} /></div>
          <div><Label>Manager phones</Label><Textarea value={state.managerPhones} onChange={(e)=>setState((p)=>({...p,managerPhones:e.target.value}))} /></div>
        </CardContent>
      </Card>
      <div className="flex gap-3">
        <Button onClick={onSaveDraft} disabled={saving}>{saving ? "Saving..." : "Save draft"}</Button>
        <Button variant="outline" onClick={onPreview} disabled={saving}>Preview config package</Button>
        <Link href="/app/onboarding/preview">
          <Button type="button" variant="outline">Open build sheet page</Button>
        </Link>
        <Button variant="outline" onClick={onSubmit} disabled={saving}>Submit onboarding</Button>
      </div>
      {previewJson ? (
        <Card>
          <CardHeader><CardTitle>AI Configuration Package Preview</CardTitle></CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs">{previewJson}</pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
