"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchOrgDataQuality,
  fetchOrgHealth,
  fetchOrgMessagingReadiness,
  fetchOrgOnboarding,
  fetchOrgProfile,
  getBillingStatus
} from "@/lib/api";
import type {
  OnboardingSubmission,
  Organization,
  OrgDataQuality,
  OrgHealth,
  OrgMessagingReadiness,
  OrgSubscription
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AppOverviewPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [submission, setSubmission] = useState<OnboardingSubmission | null>(null);
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState<string | null>(null);
  const [assignedNumberProvider, setAssignedNumberProvider] = useState<"TWILIO" | "VAPI" | null>(null);
  const [health, setHealth] = useState<OrgHealth | null>(null);
  const [dataQuality, setDataQuality] = useState<OrgDataQuality | null>(null);
  const [messagingReadiness, setMessagingReadiness] = useState<OrgMessagingReadiness | null>(null);

  useEffect(() => {
    void Promise.all([
      fetchOrgProfile(),
      fetchOrgOnboarding(),
      getBillingStatus(),
      fetchOrgHealth(),
      fetchOrgDataQuality(),
      fetchOrgMessagingReadiness()
    ])
      .then(([org, onboarding, billing, orgHealth, orgDataQuality, orgMessagingReadiness]) => {
        setOrganization(org.organization);
        setAssignedPhoneNumber(org.assignedPhoneNumber);
        setAssignedNumberProvider(org.assignedNumberProvider);
        setSubmission(onboarding.submission);
        setSubscription(billing.subscription);
        setHealth(orgHealth);
        setDataQuality(orgDataQuality);
        setMessagingReadiness(orgMessagingReadiness);
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
            <CardTitle className="text-base">System Health</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{health?.level === "GREEN" ? "All systems operational" : "Action needed"}</p>
            <p className="text-muted-foreground">{health?.summary || "Loading health status..."}</p>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Quality</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>Unknown names: {Math.round((dataQuality?.unknownNameRate || 0) * 100)}%</p>
            <p className="text-muted-foreground">Missing lead links: {dataQuality?.missingLeadLinkageCount ?? "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Messaging Readiness</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{messagingReadiness?.state || "Unknown"}</p>
            <p className="text-muted-foreground">{messagingReadiness?.reasons?.[0] || "No blocking issues detected."}</p>
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
