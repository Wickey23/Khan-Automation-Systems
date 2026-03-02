"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchOrgOnboarding, fetchOrgProfile, getBillingStatus } from "@/lib/api";
import type { OnboardingSubmission, Organization, OrgSubscription } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AppOverviewPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [submission, setSubmission] = useState<OnboardingSubmission | null>(null);
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState<string | null>(null);
  const [assignedNumberProvider, setAssignedNumberProvider] = useState<"TWILIO" | "VAPI" | null>(null);

  useEffect(() => {
    void Promise.all([fetchOrgProfile(), fetchOrgOnboarding(), getBillingStatus()])
      .then(([org, onboarding, billing]) => {
        setOrganization(org.organization);
        setAssignedPhoneNumber(org.assignedPhoneNumber);
        setAssignedNumberProvider(org.assignedNumberProvider);
        setSubmission(onboarding.submission);
        setSubscription(billing.subscription);
      })
      .catch(() => null);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Workspace Overview</h1>
        <p className="mt-2 text-sm text-muted-foreground">Track onboarding, subscription, and go-live progress.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{organization?.name || "-"}</p>
            <p className="text-muted-foreground">Status: {organization?.status || "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Onboarding</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{submission?.status || "DRAFT"}</p>
            <p className="text-muted-foreground">Update setup before go-live.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{subscription?.status || "inactive"}</p>
            <p className="text-muted-foreground">Plan: {subscription?.plan || "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assigned Number</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{assignedPhoneNumber || "Not assigned yet"}</p>
            <p className="text-muted-foreground">Provider: {assignedNumberProvider || "-"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/app/onboarding" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Continue onboarding
        </Link>
        <Link href="/pricing" className="rounded-md border px-4 py-2 text-sm font-medium">
          Billing & plans
        </Link>
      </div>
    </div>
  );
}
