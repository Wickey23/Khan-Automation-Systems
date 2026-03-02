import { siteConfig } from "@/lib/config";
import type {
  AIConfig,
  AdminCallRecord,
  AuthUser,
  BusinessSettings,
  CallRecord,
  Client,
  Lead,
  LeadPayload,
  OnboardingSubmission,
  Prospect,
  Organization,
  OrgCallRecord,
  OrgSubscription,
  PhoneLine,
  Setting
} from "@/lib/types";
import type { LeadUpdateInput } from "@/lib/validation";

type ApiResponse<T> = {
  ok: boolean;
  message?: string;
  data?: T;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!siteConfig.apiBase) {
    throw new Error("API base URL is not configured. Set NEXT_PUBLIC_API_BASE in your frontend environment.");
  }

  let response: Response;
  try {
    response = await fetch(`${siteConfig.apiBase}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {})
      },
      credentials: "include",
      cache: "no-store"
    });
  } catch (error) {
    const isProdBrowser =
      typeof window !== "undefined" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1";

    if (isProdBrowser && siteConfig.apiBase.includes("localhost")) {
      throw new Error("API misconfigured: NEXT_PUBLIC_API_BASE points to localhost in production.");
    }

    throw new Error(
      error instanceof Error
        ? `Could not reach API (${siteConfig.apiBase}). ${error.message}`
        : `Could not reach API (${siteConfig.apiBase}).`
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as ApiResponse<T>)
    : null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "Request failed.");
  }

  return payload.data as T;
}

export async function submitLead(body: LeadPayload) {
  return request<{ leadId: string }>("/api/leads", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export async function authLogin(email: string, password: string) {
  return request<
    | { requiresTwoFactor: true; challengeId: string; email: string }
    | { requiresTwoFactor: false; token: string; user: AuthUser }
  >("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function authVerifyLoginOtp(email: string, challengeId: string, code: string) {
  return request<{ token: string; user: AuthUser }>("/api/auth/login/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, challengeId, code })
  });
}

export async function authResendLoginOtp(email: string, challengeId: string) {
  return request<{ challengeId: string; email: string }>("/api/auth/login/resend-otp", {
    method: "POST",
    body: JSON.stringify({ email, challengeId })
  });
}

export async function authSignup(body: {
  name: string;
  businessName: string;
  email: string;
  password: string;
  industry?: string;
}) {
  return request<{ token: string; user: AuthUser }>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export async function authLogout() {
  return request<Record<string, never>>("/api/auth/logout", {
    method: "POST"
  });
}

export async function getMe() {
  return request<{ user: AuthUser; org: Organization | null }>("/api/auth/me");
}

export async function createStripeCheckoutSession(plan: "starter" | "pro") {
  return request<{ url: string }>("/api/billing/create-checkout-session", {
    method: "POST",
    body: JSON.stringify({ plan })
  });
}

export async function getBillingStatus() {
  return request<{ subscription: OrgSubscription | null }>("/api/billing/status");
}

export async function createCustomerPortalSession() {
  return request<{ url: string }>("/api/stripe/customer-portal", {
    method: "POST"
  });
}

export async function fetchLeads(query: string) {
  return request<{ leads: Lead[]; total: number }>(`/api/admin/leads${query}`);
}

export async function fetchAdminCalls(query: string) {
  return request<{ calls: AdminCallRecord[]; total: number }>(`/api/admin/calls${query}`);
}

export async function fetchLeadById(id: string) {
  return request<{ lead: Lead }>(`/api/admin/leads/${id}`);
}

export async function updateLead(id: string, body: LeadUpdateInput) {
  return request<{ lead: Lead }>(`/api/admin/leads/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export async function deleteLead(id: string) {
  return request<{ id: string }>(`/api/admin/leads/${id}`, {
    method: "DELETE"
  });
}

export async function fetchAdminClients() {
  return request<{ clients: Client[] }>("/api/admin/clients");
}

export async function fetchAdminClientById(id: string) {
  return request<{ client: Client }>(`/api/admin/clients/${id}`);
}

export async function updateAdminClientStatus(id: string, status: Client["status"]) {
  return request<{ client: Client }>(`/api/admin/clients/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export async function assignClientNumber(id: string, payload: { areaCode?: string; sms?: boolean }) {
  return request<{ phoneLine: PhoneLine }>(`/api/admin/clients/${id}/twilio/assign-number`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function replaceClientNumber(id: string, payload: { areaCode?: string; sms?: boolean }) {
  return request<{ phoneLine: PhoneLine }>(`/api/admin/clients/${id}/twilio/replace-number`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getClientPhoneLine(id: string) {
  return request<{ phoneLine: PhoneLine | null }>(`/api/admin/clients/${id}/phone-line`);
}

export async function getClientAiConfig(id: string) {
  return request<{ aiConfig: AIConfig | null }>(`/api/admin/clients/${id}/ai-config`);
}

export async function updateClientAiConfig(id: string, body: Partial<AIConfig>) {
  return request<{ aiConfig: AIConfig }>(`/api/admin/clients/${id}/ai-config`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export async function fetchAdminClientLeads(id: string) {
  return request<{ leads: Lead[] }>(`/api/admin/clients/${id}/leads`);
}

export async function fetchAdminClientCalls(id: string) {
  return request<{ calls: CallRecord[] }>(`/api/admin/clients/${id}/calls`);
}

export async function fetchClientWorkspace() {
  return request<{ client: Client }>("/api/client/me");
}

export async function fetchClientCalls() {
  return request<{ calls: CallRecord[] }>("/api/client/calls");
}

export async function fetchClientLeads() {
  return request<{ leads: Lead[] }>("/api/client/leads");
}

export async function updateClientSettings(body: Partial<Setting> & { name?: string }) {
  return request<{ setting: Setting }>("/api/client/settings", {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export async function sendSupportMessage(subject: string, message: string) {
  return request<Record<string, never>>("/api/client/support", {
    method: "POST",
    body: JSON.stringify({ subject, message })
  });
}

export async function fetchOrgProfile() {
  return request<{ organization: Organization }>("/api/org/profile");
}

export async function updateOrgProfile(body: { name?: string; industry?: string | null }) {
  return request<{ organization: Organization }>("/api/org/profile", {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export async function fetchOrgOnboarding() {
  return request<{ submission: OnboardingSubmission | null }>("/api/org/onboarding");
}

export async function saveOrgOnboarding(answers: Record<string, unknown>) {
  return request<{ submission: OnboardingSubmission }>("/api/org/onboarding", {
    method: "PUT",
    body: JSON.stringify({ answers })
  });
}

export async function previewOrgOnboarding(answers: Record<string, unknown>) {
  return request<{ configPackage: Record<string, unknown> }>("/api/org/onboarding/preview", {
    method: "POST",
    body: JSON.stringify({ answers })
  });
}

export async function submitOrgOnboarding(answers?: Record<string, unknown>) {
  return request<{ submission: OnboardingSubmission }>("/api/org/onboarding/submit", {
    method: "POST",
    body: JSON.stringify({ answers })
  });
}

export async function fetchOrgLeads() {
  return request<{ leads: Lead[] }>("/api/org/leads");
}

export async function fetchOrgCalls() {
  return request<{ calls: OrgCallRecord[] }>("/api/org/calls");
}

export async function repopulateOrgCalls() {
  return request<{ scanned: number; resolved: number; skipped: number }>("/api/org/calls/repopulate", {
    method: "POST"
  });
}

export async function fetchOrgSettings() {
  return request<{ settings: BusinessSettings }>("/api/org/settings");
}

export async function updateOrgSettings(body: Partial<BusinessSettings>) {
  return request<{ settings: BusinessSettings }>("/api/org/settings", {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export async function fetchAdminOrgs() {
  return request<{ orgs: Array<Organization & Record<string, unknown>> }>("/api/admin/orgs");
}

export async function fetchAdminVapiResources() {
  return request<{
    configured: boolean;
    assistants: Array<{ id: string; name: string }>;
    phoneNumbers: Array<{ id: string; number: string; provider: string }>;
  }>("/api/admin/vapi/resources");
}

export async function fetchAdminOrgById(id: string) {
  return request<{ org: Organization & Record<string, unknown> }>(`/api/admin/orgs/${id}`);
}

export async function updateAdminOrgStatus(id: string, status: Organization["status"]) {
  return request<{ org: Organization }>(`/api/admin/orgs/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export async function saveAdminOrgNotes(id: string, notes: string, status: "NEEDS_CHANGES" | "APPROVED") {
  return request<{ submission: OnboardingSubmission }>(`/api/admin/orgs/${id}/notes`, {
    method: "POST",
    body: JSON.stringify({ notes, status })
  });
}

export async function assignOrgTwilioNumber(
  id: string,
  payload: {
    provider?: "TWILIO" | "VAPI";
    e164Number?: string;
    twilioPhoneSid?: string;
    friendlyName?: string;
    autoPurchase?: boolean;
    areaCode?: string;
  }
) {
  return request<{ phoneNumber: Record<string, unknown> }>(`/api/admin/orgs/${id}/twilio/assign-number`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateOrgAiConfig(id: string, body: Record<string, unknown>) {
  return request<{ ai: Record<string, unknown> }>(`/api/admin/orgs/${id}/ai/config`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export async function goLiveOrg(id: string) {
  return request<{ org: Organization }>(`/api/admin/orgs/${id}/go-live`, { method: "POST" });
}

export async function pauseOrg(id: string) {
  return request<{ org: Organization }>(`/api/admin/orgs/${id}/pause`, { method: "POST" });
}

export async function updateProvisioningStep(
  orgId: string,
  stepKey: string,
  status: "TODO" | "DONE" | "BLOCKED",
  notes?: string
) {
  return request<{ checklist: Record<string, unknown> }>(`/api/admin/orgs/${orgId}/provisioning/checklist-step`, {
    method: "POST",
    body: JSON.stringify({ stepKey, status, notes })
  });
}

export async function approveOnboarding(orgId: string) {
  return request<Record<string, never>>(`/api/admin/orgs/${orgId}/provisioning/approve-onboarding`, { method: "POST" });
}

export async function generateAiConfigFromPackage(orgId: string) {
  return request<{ ai: Record<string, unknown> }>(`/api/admin/orgs/${orgId}/provisioning/generate-ai-config`, {
    method: "POST"
  });
}

export async function setOrgTesting(orgId: string) {
  return request<{ org: Organization }>(`/api/admin/orgs/${orgId}/provisioning/testing`, { method: "POST" });
}

export async function completeOrgTesting(orgId: string, notes: string) {
  return request<Record<string, never>>(`/api/admin/orgs/${orgId}/provisioning/test-complete`, {
    method: "POST",
    body: JSON.stringify({ notes })
  });
}

export async function resetOrgUserPassword(orgId: string, userId: string, password: string) {
  return request<{ user: { id: string; email: string; role: string } }>(
    `/api/admin/orgs/${orgId}/users/${userId}/reset-password`,
    {
      method: "POST",
      body: JSON.stringify({ password })
    }
  );
}

export async function clearAllSystemData(password: string, confirmationText: string) {
  return request<{
    deleted: {
      callLogs: number;
      calls: number;
      leads: number;
      organizations: number;
      clients: number;
      subscriptions: number;
      users: number;
    };
  }>("/api/admin/system/clear-data", {
    method: "POST",
    body: JSON.stringify({ password, confirmationText })
  });
}

export async function backfillMissedVapiCalls() {
  return request<{ scanned: number; resolved: number; skipped: number }>("/api/admin/system/backfill-vapi-calls", {
    method: "POST"
  });
}

export async function fetchProspects(query: string) {
  return request<{ prospects: Prospect[]; total: number }>(`/api/admin/prospects${query}`);
}

export async function createProspect(body: {
  orgId?: string | null;
  name: string;
  business: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  tags?: string;
  notes?: string | null;
}) {
  return request<{ prospect: Prospect }>("/api/admin/prospects", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export async function updateProspect(id: string, body: Partial<Prospect>) {
  return request<{ prospect: Prospect }>(`/api/admin/prospects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export async function importProspectsCsv(csv: string, orgId?: string | null) {
  return request<{ createdCount: number }>("/api/admin/prospects/import-csv", {
    method: "POST",
    body: JSON.stringify({ csv, orgId: orgId || null })
  });
}

export async function discoverProspects(input: {
  location: string;
  keywords?: string[];
  limit?: number;
  orgId?: string | null;
}) {
  return request<{ createdCount: number; imported: Array<{ id: string; business: string }> }>("/api/admin/prospects/discover", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function scoreProspect(id: string) {
  return request<{ prospect: Prospect }>(`/api/admin/prospects/${id}/score`, {
    method: "POST"
  });
}

export async function convertProspectToLead(id: string) {
  return request<{ lead: { id: string }; prospect: Prospect }>(`/api/admin/prospects/${id}/convert-to-lead`, {
    method: "POST"
  });
}
