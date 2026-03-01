"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { submitLead } from "@/lib/api";
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
      industry: "",
      message: "",
      preferredContact: "call",
      urgency: "this_month",
      sourcePage
    }
  });

  async function onSubmit(values: LeadFormInput) {
    try {
      const payload = { ...values, sourcePage };
      const result = await submitLead(payload);
      trackEvent("lead_submitted", { sourcePage, leadId: result.leadId });
      showToast({
        title: "Lead captured",
        description: "Your request is in. We will reach out shortly.",
        variant: "success"
      });
      setSubmitted(true);
      reset({ sourcePage });
    } catch (error) {
      showToast({
        title: "Could not submit",
        description: error instanceof Error ? error.message : "Please try again.",
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
            <p>Next step: book your 15-minute discovery call and download the AI Reception Checklist.</p>
            <div className="flex gap-3">
              <Button asChild size="sm">
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
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
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
                  <SelectItem value="this_week">This week</SelectItem>
                  <SelectItem value="this_month">This month</SelectItem>
                  <SelectItem value="exploring">Just exploring</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${sourcePage}-message`}>Message (optional)</Label>
            <Textarea id={`${sourcePage}-message`} {...register("message")} />
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Lead"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
