"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  approveOnboarding,
  assignOrgTwilioNumber,
  completeOrgTesting,
  fetchAdminConfigPackage,
  fetchAdminConfigPackageVersions,
  fetchAdminAiConfigVersions,
  fetchAdminOrgHealth,
  fetchAdminOrgReadiness,
  fetchAdminVapiResources,
  fetchAdminOrgById,
  generateAdminConfigPackage,
  generateAiConfigFromPackage,
  goLiveOrg,
  pauseOrg,
  resetOrgUserPassword,
  setOrgTesting,
  saveAdminOrgNotes,
  revertAdminAiConfigVersion,
  revertAdminConfigPackageVersion,
  updateProvisioningStep,
  updateAdminOrgStatus,
  updateOrgAiConfig
} from "@/lib/api";
import { AdminGuard } from "@/components/dashboard/admin-guard";
import { AdminTopTabs } from "@/components/admin/admin-top-tabs";
import { useToast } from "@/components/site/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AiAgentConfigVersion, ConfigPackage, ConfigPackageVersion, OrgHealth, ReadinessReport } from "@/lib/types";

type OrgDetail = {
  id: string;
  name: string;
  status: "NEW" | "ONBOARDING" | "SUBMITTED" | "NEEDS_CHANGES" | "APPROVED" | "PROVISIONING" | "TESTING" | "LIVE" | "PAUSED";
  live: boolean;
  onboardingSubmissions?: Array<{ answersJson: string; status: string; notesFromAdmin?: string | null }>;
  phoneNumbers?: Array<{ e164Number: string; status: string; provider?: "TWILIO" | "VAPI" }>;
  subscriptions?: Array<{ plan: "STARTER" | "PRO"; status: string }>;
  aiAgentConfigs?: Array<{
    provider: string;
    agentId?: string | null;
    vapiAgentId?: string | null;
    vapiPhoneNumberId?: string | null;
    transferRulesJson?: string | null;
    voice?: string | null;
    model?: string | null;
    systemPrompt?: string | null;
    status: string;
    updatedAt: string;
  }>;
  users?: Array<{ id: string; email: string; role: string; createdAt: string }>;
  messageThreads?: Array<{
    id: string;
    contactName?: string | null;
    contactPhone: string;
    lastMessageAt: string;
    messages?: Array<{
      id: string;
      direction: "INBOUND" | "OUTBOUND";
      status: "RECEIVED" | "QUEUED" | "SENT" | "FAILED" | "DELIVERED";
      body: string;
      createdAt: string;
    }>;
  }>;
  checklistSteps?: Array<{ key: string; label: string; status: string; notes?: string }>;
};

export default function AdminOrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [status, setStatus] = useState<OrgDetail["status"]>("ONBOARDING");
  const [notes, setNotes] = useState("");
  const [e164Number, setE164Number] = useState("");
  const [numberProvider, setNumberProvider] = useState<"TWILIO" | "VAPI">("VAPI");
  const [autoPurchaseTwilio, setAutoPurchaseTwilio] = useState(false);
  const [areaCode, setAreaCode] = useState("");
  const [twilioPhoneSid, setTwilioPhoneSid] = useState("");
  const [agentId, setAgentId] = useState("");
  const [vapiPhoneNumberId, setVapiPhoneNumberId] = useState("");
  const [voice, setVoice] = useState("");
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [urgentKeywords, setUrgentKeywords] = useState("towing,no brakes,accident,stranded,smoke");
  const [urgentTransferTo, setUrgentTransferTo] = useState("");
  const [alwaysNotifyManagerOnUrgent, setAlwaysNotifyManagerOnUrgent] = useState(true);
  const [transferRulesJson, setTransferRulesJson] = useState("");
  const [vapiConfigured, setVapiConfigured] = useState(false);
  const [vapiAssistants, setVapiAssistants] = useState<Array<{ id: string; name: string }>>([]);
  const [vapiPhoneNumbers, setVapiPhoneNumbers] = useState<Array<{ id: string; number: string; provider: string }>>([]);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [testNotes, setTestNotes] = useState("");
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [health, setHealth] = useState<OrgHealth | null>(null);
  const [configPackage, setConfigPackage] = useState<ConfigPackage | null>(null);
  const [configPackageVersions, setConfigPackageVersions] = useState<ConfigPackageVersion[]>([]);
  const [aiConfigVersions, setAiConfigVersions] = useState<AiAgentConfigVersion[]>([]);

  async function load() {
    const [orgData, readinessData, healthData, configData, configVersionsData, aiVersionsData] = await Promise.all([
      fetchAdminOrgById(id),
      fetchAdminOrgReadiness(id),
      fetchAdminOrgHealth(id),
      fetchAdminConfigPackage(id),
      fetchAdminConfigPackageVersions(id),
      fetchAdminAiConfigVersions(id)
    ]);
    const next = orgData.org as OrgDetail;
    setOrg(next);
    setReadiness(readinessData);
    setHealth(healthData);
    setConfigPackage(configData.configPackage);
    setConfigPackageVersions(configVersionsData.versions || []);
    setAiConfigVersions(aiVersionsData.versions || []);
    setStatus(next.status);
    const latestAi = next.aiAgentConfigs?.[0];
    const activePhone = next.phoneNumbers?.find((phone) => phone.status === "ACTIVE");
    setE164Number(activePhone?.e164Number || next.phoneNumbers?.[0]?.e164Number || "");
    setNumberProvider(
      (activePhone?.provider as "TWILIO" | "VAPI" | undefined) ||
        (next.subscriptions?.[0]?.plan === "PRO" ? "TWILIO" : "VAPI")
    );
    setAgentId(latestAi?.vapiAgentId || latestAi?.agentId || "");
    setVapiPhoneNumberId(latestAi?.vapiPhoneNumberId || "");
    setVoice(latestAi?.voice || "");
    setModel(latestAi?.model || "");
    setSystemPrompt(latestAi?.systemPrompt || "");
    const rulesRaw = latestAi?.transferRulesJson || "";
    setTransferRulesJson(rulesRaw);
    if (rulesRaw) {
      try {
        const rules = JSON.parse(rulesRaw) as {
          urgentKeywords?: string[];
          urgentTransferTo?: string;
          alwaysNotifyManagerOnUrgent?: boolean;
        };
        if (Array.isArray(rules.urgentKeywords) && rules.urgentKeywords.length) {
          setUrgentKeywords(rules.urgentKeywords.join(","));
        }
        if (rules.urgentTransferTo) {
          setUrgentTransferTo(rules.urgentTransferTo);
        }
        if (typeof rules.alwaysNotifyManagerOnUrgent === "boolean") {
          setAlwaysNotifyManagerOnUrgent(rules.alwaysNotifyManagerOnUrgent);
        }
      } catch {
        // keep defaults if existing json is malformed
      }
    }
  }

  useEffect(() => {
    void load().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    void fetchAdminVapiResources()
      .then((data) => {
        setVapiConfigured(Boolean(data.configured));
        setVapiAssistants(data.assistants || []);
        setVapiPhoneNumbers(data.phoneNumbers || []);
      })
      .catch(() => {
        setVapiConfigured(false);
        setVapiAssistants([]);
        setVapiPhoneNumbers([]);
      });
  }, []);

  const onboardingAnswers = useMemo(() => {
    const raw = org?.onboardingSubmissions?.[0]?.answersJson;
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }, [org]);
  const stepStatus = useMemo(() => {
    const map = new Map<string, string>();
    for (const step of org?.checklistSteps || []) {
      map.set(step.key, step.status);
    }
    return map;
  }, [org]);
  const nextAction = useMemo(() => {
    const ordered = [
      { key: "paid", label: "Confirm subscription is paid" },
      { key: "onboarding_approved", label: "Approve onboarding submission" },
      { key: "business_settings_confirmed", label: "Generate and confirm AI config package" },
      { key: "twilio_number_assigned", label: "Assign Twilio phone number" },
      { key: "webhooks_verified", label: "Mark webhooks verified" },
      { key: "vapi_agent_configured", label: "Save Vapi agent configuration" },
      { key: "test_calls_completed", label: "Run test call and mark complete" },
      { key: "notifications_verified", label: "Verify notifications" },
      { key: "go_live", label: "Enable Go Live" }
    ];
    return ordered.find((item) => stepStatus.get(item.key) !== "DONE")?.label || "All setup steps complete.";
  }, [stepStatus]);

  const readinessFixLinkMap: Record<string, string> = {
    billingActive: "/app/billing",
    onboardingSubmitted: "/app/onboarding",
    onboardingApproved: `/admin/orgs/${id}`,
    businessSettingsValid: "/app/settings",
    providerLineAssigned: `/admin/orgs/${id}`,
    toolSecretConfigured: `/admin/orgs/${id}`,
    webhooksVerified: `/admin/orgs/${id}`,
    notificationsVerified: `/admin/orgs/${id}`,
    testCallsPassed: `/admin/orgs/${id}/testing`
  };
  const readinessEntries = useMemo(
    () =>
      Object.entries(readiness?.checks || {}).sort((a, b) => {
        if (a[1].ok === b[1].ok) return a[0].localeCompare(b[0]);
        return a[1].ok ? 1 : -1;
      }),
    [readiness]
  );
  const missingReadinessCount = useMemo(() => readinessEntries.filter(([, check]) => !check.ok).length, [readinessEntries]);
  const completedChecklistCount = useMemo(
    () => (org?.checklistSteps || []).filter((step) => step.status === "DONE").length,
    [org?.checklistSteps]
  );
  const onboardingSummary = useMemo(() => {
    const businessProfile =
      onboardingAnswers.businessProfile && typeof onboardingAnswers.businessProfile === "object"
        ? (onboardingAnswers.businessProfile as Record<string, unknown>)
        : {};
    const notifications =
      onboardingAnswers.notifications && typeof onboardingAnswers.notifications === "object"
        ? (onboardingAnswers.notifications as Record<string, unknown>)
        : {};
    const services =
      onboardingAnswers.servicesPricing && typeof onboardingAnswers.servicesPricing === "object"
        ? (onboardingAnswers.servicesPricing as Record<string, unknown>)
        : {};
    const serviceCategories = Array.isArray(services.serviceCategories) ? services.serviceCategories : [];
    const managerEmails = Array.isArray(notifications.managerEmails) ? notifications.managerEmails : [];
    const managerPhones = Array.isArray(notifications.managerPhones) ? notifications.managerPhones : [];
    return {
      displayName: String(businessProfile.displayName || businessProfile.legalBusinessName || "-"),
      industry: String(businessProfile.industry || "-"),
      serviceCount: serviceCategories.length,
      emailCount: managerEmails.length,
      phoneCount: managerPhones.length
    };
  }, [onboardingAnswers]);

  function formatReadinessKey(key: string) {
    const map: Record<string, string> = {
      billingActive: "Billing Active",
      onboardingSubmitted: "Onboarding Submitted",
      onboardingApproved: "Onboarding Approved",
      businessSettingsValid: "Business Settings",
      providerLineAssigned: "Provider Line Assigned",
      toolSecretConfigured: "Tool Secret Configured",
      webhooksVerified: "Webhooks Verified",
      notificationsVerified: "Notifications Verified",
      testCallsPassed: "Test Calls Passed"
    };
    return map[key] || key;
  }

  async function updateStatus() {
    await updateAdminOrgStatus(id, status);
    showToast({ title: "Organization status updated" });
    await load();
  }

  async function saveNotes(statusType: "NEEDS_CHANGES" | "APPROVED") {
    await saveAdminOrgNotes(id, notes, statusType);
    showToast({ title: "Review note saved" });
    await load();
  }

  async function assignNumber() {
    await assignOrgTwilioNumber(id, {
      provider: numberProvider,
      e164Number: e164Number || undefined,
      twilioPhoneSid: twilioPhoneSid || undefined,
      autoPurchase: numberProvider === "TWILIO" ? autoPurchaseTwilio : false,
      areaCode: numberProvider === "TWILIO" ? areaCode || undefined : undefined
    });
    showToast({ title: "Phone number assigned" });
    await load();
  }

  async function saveAiConfig() {
    const computedTransferRules = {
      urgentKeywords: urgentKeywords
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean),
      urgentTransferTo: urgentTransferTo.trim() || null,
      alwaysNotifyManagerOnUrgent
    };
    const rawTransferRules = transferRulesJson.trim() || JSON.stringify(computedTransferRules, null, 2);

    await updateOrgAiConfig(id, {
      provider: "VAPI",
      vapiAgentId: agentId,
      vapiPhoneNumberId,
      voice,
      model,
      systemPrompt,
      transferRulesJson: rawTransferRules,
      status: "ACTIVE"
    });
    showToast({ title: "AI config saved" });
    await load();
  }

  async function resetUserPassword(userId: string) {
    const password = passwordDrafts[userId] || "";
    if (password.length < 8) {
      showToast({ title: "Password too short", description: "Use at least 8 characters.", variant: "error" });
      return;
    }
    await resetOrgUserPassword(id, userId, password);
    showToast({ title: "Password reset", description: "Client user password updated." });
    setPasswordDrafts((current) => ({ ...current, [userId]: "" }));
  }

  async function setStep(key: string, stepStatus: "TODO" | "DONE" | "BLOCKED", stepNotes?: string) {
    await updateProvisioningStep(id, key, stepStatus, stepNotes);
    await load();
  }

  return (
    <AdminGuard>
      <div className="container py-10">
        <AdminTopTabs className="mb-3" backFallbackHref="/admin/orgs" />
        <Link href="/admin/orgs" className="text-sm text-primary">
          Back to organizations
        </Link>
        <h1 className="mt-3 text-3xl font-bold">{org?.name || "Organization"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Live: {org?.live ? "Yes" : "No"}</p>
        <p className="mt-1 text-sm text-amber-700">Next required action: {nextAction}</p>
        {org?.status === "TESTING" ? (
          <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            Testing Mode. Complete test runs and notifications before go-live.
          </div>
        ) : null}
        {org?.status === "PAUSED" ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Paused mode. Runtime is limited until billing and readiness are restored.
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
            <p className="mt-1 text-lg font-semibold">{org?.status || "-"}</p>
          </div>
          <div className="rounded-md border bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Readiness Missing</p>
            <p className="mt-1 text-lg font-semibold">{missingReadinessCount}</p>
          </div>
          <div className="rounded-md border bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Checklist Done</p>
            <p className="mt-1 text-lg font-semibold">
              {completedChecklistCount}/{org?.checklistSteps?.length || 0}
            </p>
          </div>
          <div className="rounded-md border bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Client Users</p>
            <p className="mt-1 text-lg font-semibold">{org?.users?.length || 0}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6">
          <section className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Readiness</h2>
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${readiness?.canGoLive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                {readiness?.canGoLive ? "Ready to Go Live" : "Not Ready"}
              </span>
            </div>
            {missingReadinessCount > 0 ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {missingReadinessCount} blocking item{missingReadinessCount === 1 ? "" : "s"} must be fixed before Go Live.
              </div>
            ) : null}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {readinessEntries.map(([key, check]) => (
                <div key={key} className="rounded-md border p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{formatReadinessKey(key)}</p>
                    <span className={`rounded px-2 py-0.5 text-xs ${check.ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {check.ok ? "OK" : "Missing"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{check.reason}</p>
                  {!check.ok ? (
                    <Link href={readinessFixLinkMap[key] || `/admin/orgs/${id}`} className="mt-1 inline-block text-xs font-medium text-primary underline">
                      Fix
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Org Health</h2>
              <span
                className={`rounded-md px-2 py-1 text-xs font-semibold ${
                  health?.level === "GREEN"
                    ? "bg-emerald-100 text-emerald-700"
                    : health?.level === "YELLOW"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-700"
                }`}
              >
                {health?.level || "RED"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{health?.summary || "Health report unavailable."}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.entries(health?.checks || {}).map(([key, check]) => (
                <div key={key} className="rounded border p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{formatReadinessKey(key)}</p>
                    <span className={`rounded px-2 py-0.5 text-xs ${check.ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {check.ok ? "PASS" : "FAIL"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{check.reason}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-lg font-semibold">Onboarding Answers</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded border bg-muted/20 p-2 text-sm">
                <p className="text-xs text-muted-foreground">Business</p>
                <p className="font-medium">{onboardingSummary.displayName}</p>
              </div>
              <div className="rounded border bg-muted/20 p-2 text-sm">
                <p className="text-xs text-muted-foreground">Industry</p>
                <p className="font-medium">{onboardingSummary.industry}</p>
              </div>
              <div className="rounded border bg-muted/20 p-2 text-sm">
                <p className="text-xs text-muted-foreground">Services</p>
                <p className="font-medium">{onboardingSummary.serviceCount}</p>
              </div>
              <div className="rounded border bg-muted/20 p-2 text-sm">
                <p className="text-xs text-muted-foreground">Notif Emails</p>
                <p className="font-medium">{onboardingSummary.emailCount}</p>
              </div>
              <div className="rounded border bg-muted/20 p-2 text-sm">
                <p className="text-xs text-muted-foreground">Notif Phones</p>
                <p className="font-medium">{onboardingSummary.phoneCount}</p>
              </div>
            </div>
            <details className="mt-3 rounded border">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">View raw onboarding JSON</summary>
              <pre className="max-h-72 overflow-auto border-t bg-muted p-3 text-xs">{JSON.stringify(onboardingAnswers, null, 2)}</pre>
            </details>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Canonical AI Build Sheet</h2>
              <Button
                variant="outline"
                onClick={() =>
                  void generateAdminConfigPackage(id).then(async () => {
                    showToast({ title: "Config package regenerated" });
                    await load();
                  })
                }
              >
                Regenerate
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Version: {configPackage?.version || "-"} | Generated:{" "}
              {configPackage?.generatedAt ? new Date(configPackage.generatedAt).toLocaleString() : "-"}
            </p>
            <details className="mt-3 rounded border">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">View full build sheet JSON</summary>
              <pre className="max-h-80 overflow-auto border-t bg-muted p-3 text-xs">
                {JSON.stringify(configPackage?.json || {}, null, 2)}
              </pre>
            </details>
            <div className="mt-3 rounded border p-3">
              <p className="text-sm font-medium">Config Package Versions</p>
              <div className="mt-2 space-y-2">
                {configPackageVersions.slice(0, 8).map((versionRow) => (
                  <div key={versionRow.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-muted/20 px-2 py-1 text-xs">
                    <span>
                      v{versionRow.version} | {new Date(versionRow.createdAt).toLocaleString()}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void revertAdminConfigPackageVersion(id, versionRow.id).then(async () => {
                          showToast({ title: `Config package reverted to snapshot v${versionRow.version}` });
                          await load();
                        })
                      }
                    >
                      Revert
                    </Button>
                  </div>
                ))}
                {!configPackageVersions.length ? (
                  <p className="text-xs text-muted-foreground">No versions found yet.</p>
                ) : null}
              </div>
            </div>
            <div className="mt-3">
              <Link href={`/admin/orgs/${id}/testing`} className="text-sm font-medium text-primary underline">
                Open testing tab
              </Link>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-lg font-semibold">Review + Status</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Status</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OrgDetail["status"])}
                >
                  <option value="NEW">NEW</option>
                  <option value="ONBOARDING">ONBOARDING</option>
                  <option value="SUBMITTED">SUBMITTED</option>
                  <option value="NEEDS_CHANGES">NEEDS_CHANGES</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="PROVISIONING">PROVISIONING</option>
                  <option value="TESTING">TESTING</option>
                  <option value="LIVE">LIVE</option>
                  <option value="PAUSED">PAUSED</option>
                </select>
              </div>
            </div>
            <Button className="mt-3" onClick={() => void updateStatus()}>
              Save status
            </Button>
            <div className="mt-4">
              <Label>Notes to client</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="mt-2 flex gap-2">
                <Button variant="outline" onClick={() => void saveNotes("NEEDS_CHANGES")}>
                  Mark needs changes
                </Button>
                <Button onClick={() => void saveNotes("APPROVED")}>Mark approved</Button>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-lg font-semibold">Provisioning</h2>
            <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-semibold">Admin Setup Runbook (do in order)</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Confirm the client has an active paid subscription.</li>
                <li>Review onboarding answers and click <span className="font-medium">Approve onboarding</span>.</li>
                <li>Click <span className="font-medium">Generate AI package</span> to build prompt + intake schema.</li>
                <li>Assign number provider: <span className="font-medium">Vapi</span> (default for Starter) or <span className="font-medium">Twilio</span> (optional for area code control).</li>
                <li>Save Vapi config: Agent ID + Phone Bridge number + model/voice + prompt.</li>
                <li>Set Testing mode, place a real test call, record notes, then mark test complete.</li>
                <li>Verify manager notifications and call summaries are being written.</li>
                <li>Click <span className="font-medium">Go Live</span> and confirm org status becomes LIVE.</li>
              </ol>
              <div className="mt-3 rounded border border-blue-200 bg-white p-2 text-xs">
                Required external setup:
                <div>1. Twilio voice webhook: <span className="font-mono">{`/api/twilio/voice`}</span></div>
                <div>2. Twilio SMS webhook: <span className="font-mono">{`/api/twilio/sms`}</span></div>
                <div>3. Vapi tools: <span className="font-mono">{`/api/tools/*`}</span> with <span className="font-mono">x-vapi-tool-secret</span></div>
                <div>4. Vapi webhook: <span className="font-mono">{`/api/vapi/webhook`}</span></div>
              </div>
            </div>
            <div className="mb-3 grid gap-2 rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Checklist</p>
              {(org?.checklistSteps || []).map((step) => (
                <div key={step.key} className="flex items-center justify-between gap-2">
                  <span>{step.label}</span>
                  <span className="rounded bg-white px-2 py-0.5 text-xs">{step.status}</span>
                </div>
              ))}
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void approveOnboarding(id).then(load)}>
                Approve onboarding
              </Button>
              <Button variant="outline" onClick={() => void generateAiConfigFromPackage(id).then(load)}>
                Generate AI Prompt
              </Button>
              <Button variant="outline" onClick={() => void setOrgTesting(id).then(load)}>
                Set testing mode
              </Button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Number Provider</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                  value={numberProvider}
                  onChange={(e) => setNumberProvider(e.target.value as "TWILIO" | "VAPI")}
                >
                  <option value="VAPI">Vapi (default for Starter)</option>
                  <option value="TWILIO">Twilio (optional, area-code control)</option>
                </select>
              </div>
              <div>
                <Label>E164 Number {numberProvider === "TWILIO" && autoPurchaseTwilio ? "(optional)" : ""}</Label>
                <Input placeholder="+15165551234" value={e164Number} onChange={(e) => setE164Number(e.target.value)} />
              </div>
              <div className={numberProvider === "TWILIO" ? "" : "opacity-50"}>
                <Label>Twilio SID (optional)</Label>
                <Input value={twilioPhoneSid} onChange={(e) => setTwilioPhoneSid(e.target.value)} disabled={numberProvider !== "TWILIO"} />
              </div>
              <div className={numberProvider === "TWILIO" ? "" : "opacity-50"}>
                <Label>Twilio area code (optional)</Label>
                <Input value={areaCode} onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))} disabled={numberProvider !== "TWILIO"} />
              </div>
              <div className={numberProvider === "TWILIO" ? "" : "opacity-50"}>
                <Label className="mb-2 block">Twilio auto-purchase</Label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoPurchaseTwilio}
                    onChange={(e) => setAutoPurchaseTwilio(e.target.checked)}
                    disabled={numberProvider !== "TWILIO"}
                  />
                  Purchase a Twilio number automatically (uses area code if available)
                </label>
              </div>
            </div>
            <Button className="mt-3" onClick={() => void assignNumber()}>
              Save number assignment
            </Button>
            <Button className="mt-3 ml-2" variant="outline" onClick={() => void setStep("twilio_number_assigned", "DONE")}>
              Mark number assigned
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Assigned: {org?.phoneNumbers?.[0]?.e164Number || "none"} ({org?.phoneNumbers?.[0]?.provider || "N/A"})
            </p>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-lg font-semibold">AI Agent Config</h2>
            {vapiConfigured ? (
              <div className="mt-3 grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                <div>
                  <Label>Pick Vapi Assistant</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                  >
                    <option value="">Select assistant</option>
                    {vapiAssistants.map((assistant) => (
                      <option key={assistant.id} value={assistant.id}>
                        {assistant.name} ({assistant.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Pick Vapi Number</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                    value={vapiPhoneNumberId}
                    onChange={(e) => setVapiPhoneNumberId(e.target.value)}
                  >
                    <option value="">Select number</option>
                    {vapiPhoneNumbers.map((phone) => (
                      <option key={`${phone.id}-${phone.number}`} value={phone.number || phone.id}>
                        {phone.number || "No number"} ({phone.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                Vapi API key is not configured on the backend, so assistants/numbers cannot be listed automatically.
              </p>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><Label>Vapi Agent ID</Label><Input value={agentId} onChange={(e) => setAgentId(e.target.value)} /></div>
              <div><Label>Vapi Phone Bridge (E164)</Label><Input value={vapiPhoneNumberId} onChange={(e) => setVapiPhoneNumberId(e.target.value)} /></div>
              <div><Label>Voice</Label><Input value={voice} onChange={(e) => setVoice(e.target.value)} /></div>
              <div><Label>Model</Label><Input value={model} onChange={(e) => setModel(e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>System Prompt</Label><Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} /></div>
            </div>
            <div className="mt-4 rounded-md border bg-muted/30 p-3">
              <h3 className="text-sm font-semibold">Urgent + Transfer Logic</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Urgent keywords (comma-separated)</Label>
                  <Input value={urgentKeywords} onChange={(e) => setUrgentKeywords(e.target.value)} />
                </div>
                <div>
                  <Label>Urgent transfer destination (E164)</Label>
                  <Input placeholder="+15165551234" value={urgentTransferTo} onChange={(e) => setUrgentTransferTo(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={alwaysNotifyManagerOnUrgent}
                      onChange={(e) => setAlwaysNotifyManagerOnUrgent(e.target.checked)}
                    />
                    Always notify manager on urgent calls
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <Label>Advanced transferRules JSON (optional override)</Label>
                  <Textarea
                    placeholder='{"urgentKeywords":["towing"],"urgentTransferTo":"+1516...","alwaysNotifyManagerOnUrgent":true}'
                    value={transferRulesJson}
                    onChange={(e) => setTransferRulesJson(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => void saveAiConfig().then(() => setStep("vapi_agent_configured", "DONE"))}>Save AI config</Button>
              <Button variant="outline" onClick={() => void setStep("webhooks_verified", "DONE")}>Mark webhooks verified</Button>
            </div>
            <div className="mt-3 rounded border p-3">
              <p className="text-sm font-medium">AI Config Versions</p>
              <div className="mt-2 space-y-2">
                {aiConfigVersions.slice(0, 8).map((versionRow) => (
                  <div key={versionRow.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-muted/20 px-2 py-1 text-xs">
                    <span>
                      v{versionRow.version} | {new Date(versionRow.createdAt).toLocaleString()}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void revertAdminAiConfigVersion(id, versionRow.id).then(async () => {
                          showToast({ title: `AI config reverted to snapshot v${versionRow.version}` });
                          await load();
                        })
                      }
                    >
                      Revert
                    </Button>
                  </div>
                ))}
                {!aiConfigVersions.length ? (
                  <p className="text-xs text-muted-foreground">No AI config versions found yet.</p>
                ) : null}
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Label>Test completion notes</Label>
              <Textarea value={testNotes} onChange={(e) => setTestNotes(e.target.value)} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => void completeOrgTesting(id, testNotes).then(load)}>
                  Mark test completed
                </Button>
                <Button variant="outline" onClick={() => void setStep("notifications_verified", "DONE")}>
                  Mark notifications verified
                </Button>
                <Button
                  disabled={!readiness?.canGoLive}
                  onClick={() => void goLiveOrg(id).then(() => setStep("go_live", "DONE").then(load))}
                >
                  Go Live
                </Button>
                <Button variant="outline" onClick={() => void pauseOrg(id).then(load)}>Pause</Button>
              </div>
              {!readiness?.canGoLive ? (
                <p className="mt-2 text-xs text-amber-700">Go Live is disabled until all readiness checks pass.</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-lg font-semibold">Organization Users</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Passwords cannot be viewed. You can set a new password for any client user.
            </p>
            <div className="mt-4 grid gap-3">
              {(org?.users || []).map((user) => (
                <div key={user.id} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{user.email}</p>
                  <p className="text-xs text-muted-foreground">{user.role}</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="password"
                      placeholder="New password (min 8 chars)"
                      value={passwordDrafts[user.id] || ""}
                      onChange={(e) =>
                        setPasswordDrafts((current) => ({ ...current, [user.id]: e.target.value }))
                      }
                    />
                    <Button onClick={() => void resetUserPassword(user.id)}>Set new password</Button>
                  </div>
                </div>
              ))}
              {!org?.users?.length ? <p className="text-sm text-muted-foreground">No users found.</p> : null}
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-lg font-semibold">Messaging Threads (Pro)</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Admin visibility into SMS thread history for this organization.
            </p>
            <div className="mt-4 grid gap-3">
              {(org?.messageThreads || []).map((thread) => (
                <div key={thread.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{thread.contactName || "Unknown contact"} | {thread.contactPhone}</p>
                    <p className="text-xs text-muted-foreground">Last: {new Date(thread.lastMessageAt).toLocaleString()}</p>
                  </div>
                  <div className="mt-2 space-y-1">
                    {(thread.messages || []).slice(0, 4).map((message) => (
                      <div key={message.id} className="rounded border bg-muted/20 px-2 py-1 text-xs">
                        <span className="font-medium">{message.direction}</span> | {message.status} | {new Date(message.createdAt).toLocaleTimeString()}
                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{message.body}</p>
                      </div>
                    ))}
                    {!thread.messages?.length ? <p className="text-xs text-muted-foreground">No messages yet.</p> : null}
                  </div>
                </div>
              ))}
              {!org?.messageThreads?.length ? (
                <p className="text-sm text-muted-foreground">No messaging threads found for this organization.</p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </AdminGuard>
  );
}
