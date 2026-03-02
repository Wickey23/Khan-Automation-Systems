"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { siteConfig } from "@/lib/config";
import { trackEvent } from "@/lib/tracking";
import type { LeadFormInput } from "@/lib/validation";
import { leadFormSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/site/toast-provider";

const industries = ["Truck Repair", "Auto Repair", "HVAC", "Equipment Service", "Local Manufacturing Services"];
const urgencyOptions = [
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "exploring", label: "Just exploring" }
] as const;
const preferredContactOptions = [
  { value: "call", label: "Call" },
  { value: "text", label: "Text" },
  { value: "email", label: "Email" }
] as const;

async function submitLeadWithRetry(apiBase: string, payload: Record<string, unknown>) {
  const run = async () =>
    fetch(`${apiBase}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

  try {
    return await run();
  } catch {
    // Render cold starts or transient edge/network issues.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return run();
  }
}

export function LeadCaptureForm({
  sourcePage,
  title = "Request a Custom Walkthrough",
  compact = false
}: {
  sourcePage: string;
  title?: string;
  compact?: boolean;
}) {
  const { showToast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<LeadFormInput>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      name: "",
      business: "",
      email: "",
      phone: "",
      accountPassword: "",
      confirmPassword: "",
      industry: "",
      message: "",
      preferredContact: "call",
      urgency: "this_month",
      sourcePage
    }
  });

  async function onSubmit(values: LeadFormInput) {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || siteConfig.apiBase;
      if (!apiBase) {
        throw new Error("Lead API is not configured. Set NEXT_PUBLIC_API_BASE.");
      }

      const response = await submitLeadWithRetry(apiBase, {
        ...values,
        accountPassword: values.accountPassword,
        sourcePage: window.location.pathname,
        createAccount: true
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            data?: { leadId?: string; accountCreated?: boolean };
            errors?: { fieldErrors?: Record<string, string[] | undefined> };
          }
        | null;

      if (!response.ok || !payload?.ok) {
        const firstFieldError = payload?.errors?.fieldErrors
          ? Object.values(payload.errors.fieldErrors).flat().find(Boolean)
          : null;
        throw new Error(
          firstFieldError ||
            payload?.message ||
            "Could not reach API. If this is a fresh deploy, wait 30-60 seconds and retry."
        );
      }

      trackEvent("lead_submitted", {
        sourcePage: window.location.pathname,
        leadId: payload.data?.leadId
      });
      setSubmittedEmail(values.email);
      showToast({
        title: "Lead captured",
        description: payload?.data?.accountCreated
          ? "Your request is in and your account was created. Log in with the email + password you just entered."
          : "Your request is in. We will reach out shortly.",
        variant: "success"
      });
      setSubmitted(true);
      reset({
        name: "",
        business: "",
        email: "",
        phone: "",
        accountPassword: "",
        confirmPassword: "",
        industry: "",
        message: "",
        preferredContact: "call",
        urgency: "this_month",
        sourcePage: window.location.pathname
      });
    } catch (error) {
      showToast({
        title: "Could not submit",
        description:
          error instanceof Error ? error.message : "Could not reach API. Wait a moment and try again.",
        variant: "error"
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Thanks, your lead was submitted.</p>
            <p>Next step: log in with the same email and password you created in this form.</p>
            <p className="text-xs text-emerald-800">
              Login URL: <span className="font-medium">/auth/login</span>
              {submittedEmail ? ` (email: ${submittedEmail})` : ""}
            </p>
            <div className="flex gap-3">
              <Button asChild size="sm">
                <Link href={`/auth/login${submittedEmail ? `?email=${encodeURIComponent(submittedEmail)}` : ""}`}>
                  Log In
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/book">Book a Call</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/resources/ai-reception-checklist">Download Checklist</Link>
              </Button>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <input type="hidden" {...register("sourcePage")} value={sourcePage} />
          <div className={compact ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
            <div className="space-y-1.5">
              <Label htmlFor={`${sourcePage}-name`}>Name</Label>
              <Input id={`${sourcePage}-name`} {...register("name")} />
              {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${sourcePage}-business`}>Business</Label>
              <Input id={`${sourcePage}-business`} {...register("business")} />
              {errors.business ? <p className="text-xs text-red-600">{errors.business.message}</p> : null}
            </div>
          </div>

          <div className={compact ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
            <div className="space-y-1.5">
              <Label htmlFor={`${sourcePage}-email`}>Email</Label>
              <Input id={`${sourcePage}-email`} type="email" {...register("email")} />
              {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${sourcePage}-phone`}>Phone</Label>
              <Input id={`${sourcePage}-phone`} {...register("phone")} />
              {errors.phone ? <p className="text-xs text-red-600">{errors.phone.message}</p> : null}
            </div>
          </div>

          <div className={compact ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
            <div className="space-y-1.5">
              <Label htmlFor={`${sourcePage}-accountPassword`}>Create account password</Label>
              <Input id={`${sourcePage}-accountPassword`} type="password" {...register("accountPassword")} />
              <p className="text-xs text-muted-foreground">You will use this password to log in at /auth/login.</p>
              {errors.accountPassword ? <p className="text-xs text-red-600">{errors.accountPassword.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${sourcePage}-confirmPassword`}>Confirm password</Label>
              <Input id={`${sourcePage}-confirmPassword`} type="password" {...register("confirmPassword")} />
              {errors.confirmPassword ? <p className="text-xs text-red-600">{errors.confirmPassword.message}</p> : null}
            </div>
          </div>

          <div className={compact ? "grid gap-4" : "grid gap-4 sm:grid-cols-3"}>
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Select onValueChange={(value) => setValue("industry", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((item) => (
                    <SelectItem value={item} key={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Preferred contact</Label>
              <Select onValueChange={(value) => setValue("preferredContact", value as LeadFormInput["preferredContact"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Call" />
                </SelectTrigger>
                <SelectContent>
                  {preferredContactOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Urgency</Label>
              <Select onValueChange={(value) => setValue("urgency", value as LeadFormInput["urgency"])}>
                <SelectTrigger>
                  <SelectValue placeholder="This month" />
                </SelectTrigger>
                <SelectContent>
                  {urgencyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${sourcePage}-message`}>Message (optional)</Label>
            <Textarea id={`${sourcePage}-message`} {...register("message")} />
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Create Account & Submit Lead"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
