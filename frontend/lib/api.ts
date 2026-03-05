import { siteConfig } from "@/lib/config";
import type {
  AIConfig,
  AiAgentConfigVersion,
  AdminMessageThread,
  AdminUserRecord,
  AuditEvent,
  AdminCallRecord,
  AuthUser,
  BusinessSettings,
  CallRecord,
  Client,
  ConfigPackage,
  ConfigPackageVersion,
  DemoConfig,
  DemoCallLog,
  Lead,
  LeadPayload,
  OnboardingSubmission,
  Prospect,
  ReadinessReport,
  Organization,
  OrgCallRecord,
  CustomerBaseRecord,
  OrgMessageThread,
  BillingStatusPayload,
  BillingDiagnosticsPayload,
  OrgAnalytics,
  OrgFeatureFlags,
  OrgDataQuality,
  OrgHealth,
  OrgKnowledgeFile,
  OrgMessagingReadiness,
  PublicSystemStatus,
  AdminScaleGate,
  AdminSystemDashboard,
  AdminSystemReadiness,
  AdminRevenueSummary,
  AuthSecurityStatus,
  PhoneLine,
  Setting,
  TestScenario,
  TeamMembersResponse,
  Appointment,
  CalendarConnection,
  OrgCalendarEvent,
  OrgNotification
} from "@/lib/types";
import type { LeadUpdateInput } from "@/lib/validation";

type ApiResponse<T> = {
  ok: boolean;
  message?: string;
  data?: T;
};

const REQUEST_TIMEOUT_MS = 20_000;

function redirectToLoginIfUnauthorized() {
  if (typeof window === "undefined") return;
  const currentPath = window.location.pathname || "";
  if (currentPath.startsWith("/auth/login")) return;
  const next = `${window.location.pathname}${window.location.search || ""}`;
  const target = `/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  window.location.replace(target);
}

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const source = `; ${document.cookie || ""}`;
  const parts = source.split(`; ${name}=`);
  if (parts.length < 2) return "";
  return decodeURIComponent(parts.pop()?.split(";").shift() || "");
}

function isMutatingMethod(method: string | undefined) {
  const normalized = String(method || "GET").toUpperCase();
  return normalized === "POST" || normalized === "PATCH" || normalized === "PUT" || normalized === "DELETE";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!siteConfig.apiBase) {
    throw new Error("API base URL is not configured. Set NEXT_PUBLIC_API_BASE in your frontend environment.");
  }

  let csrfToken = "";
  if (isMutatingMethod(init?.method) && path !== "/api/auth/csrf-token") {
    csrfToken = readCookie("kas_csrf_token");
    if (!csrfToken && typeof window !== "undefined") {
      try {
        const csrfResponse = await fetch(`${siteConfig.apiBase}/api/auth/csrf-token`, {
          method: "GET",
          credentials: "include",
          cache: "no-store"
        });
        if (csrfResponse.ok) {
          const payload = (await csrfResponse.json()) as { data?: { csrfToken?: string } };
          csrfToken = String(payload?.data?.csrfToken || readCookie("kas_csrf_token") || "");
        }
      } catch {
        // Ignore; backend will reject with explicit CSRF error if still missing.
      }
    }
  }

  let response: Response;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    response = await fetch(`${siteConfig.apiBase}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        ...(init?.headers || {})
      },
      signal: controller.signal,
      credentials: "include",
      cache: "no-store"
    });
  } catch (error) {
    clearTimeout(timeoutHandle);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    const isProdBrowser = typeof window !== "undefined" && window.location.hostname.includes("vercel.app");
    if (isProdBrowser && !siteConfig.apiBase.includes("ai-auto-apply.onrender.com")) {
      throw new Error("API misconfigured: NEXT_PUBLIC_API_BASE is not pointing at the hosted backend.");
    }

    throw new Error(
      error instanceof Error
        ? `Could not reach API (${siteConfig.apiBase}). ${error.message}`
        : `Could not reach API (${siteConfig.apiBase}).`
      );
  }
  clearTimeout(timeoutHandle);

  const contentType = response.headers.get("content-type") || "";
  let payload: ApiResponse<T> | null = null;
  let rawText = "";
  if (contentType.includes("application/json")) {
    payload = (await response.json()) as ApiResponse<T>;
  } else {
    rawText = await response.text().catch(() => "");
  }

  if (!response.ok || !payload?.ok) {
    if (response.status === 401) {
      redirectToLoginIfUnauthorized();
      throw new Error("Session expired. Please log in again.");
    }
    if (payload?.message) {
      throw new Error(payload.message);
    }
    if (rawText.trim()) {
      throw new Error(`Request failed (${response.status}): ${rawText.slice(0, 240)}`);
    }
    throw new Error(`Request failed (${response.status}).`);
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

export async function requestPasswordReset(email: string) {
  return request<{ sent: true; message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export async function resetPasswordWithToken(token: string, password: string) {
  return request<{ reset: true }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password })
  });
}

export async function fetchAuthSecurityStatus() {
  return request<AuthSecurityStatus>("/api/auth/security-status");
}

export async function sendAuthTestOtpEmail() {
  return request<{ sent: boolean }>("/api/auth/security/send-test-otp", {
    method: "POST",
    body: JSON.stringify({})
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

export async function createStripeCheckoutSession(plan: "starter" | "pro" | "founding") {
  return request<{ url: string }>("/api/billing/create-checkout-session", {
    method: "POST",
    body: JSON.stringify({ plan })
  });
}

export async function changeStripePlan(plan: "starter" | "pro") {
  return request<{ changed: boolean; message?: string }>("/api/billing/change-plan", {
    method: "POST",
    body: JSON.stringify({ plan })
  });
}

export async function createPlanChangeSession(payload: { targetPlan: "starter" | "pro"; effective: "immediate" | "period_end" }) {
  return request<{ url?: string; changed?: boolean; message?: string; code?: string; fixHint?: string }>("/api/billing/create-plan-change-session", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function scheduleDowngrade(payload: { targetPlan: "starter" }) {
  return request<{ scheduled: boolean; effectiveAt: string }>("/api/billing/schedule-downgrade", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getBillingStatus() {
  return request<BillingStatusPayload>("/api/billing/status");
}

export async function getBillingDiagnostics() {
  return request<BillingDiagnosticsPayload>("/api/billing/diagnostics");
}

export async function createCustomerPortalSession() {
  return request<{ url: string }>("/api/billing/customer-portal", {
    method: "POST"
  });
}

export async function fetchLeads(query: string) {
  return request<{ leads: Lead[]; total: number }>(`/api/admin/leads${query}`);
}

export async function fetchAdminCalls(query: string) {
  return request<{ calls: AdminCallRecord[]; total: number }>(`/api/admin/calls${query}`);
}

export async function fetchAdminMessages(query = "") {
  return request<{ threads: AdminMessageThread[] }>(`/api/admin/messages${query}`);
}

export async function fetchAdminUsers(query = "") {
  return request<{ users: AdminUserRecord[] }>(`/api/admin/users${query}`);
}

export async function updateAdminUser(id: string, payload: { role?: AdminUserRecord["role"] }) {
  return request<{ user: AdminUserRecord }>(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminRevenue() {
  return request<AdminRevenueSummary>("/api/admin/revenue");
}

export async function fetchTeamMembers() {
  return request<TeamMembersResponse>("/api/team");
}

export async function inviteTeamMember(payload: { email: string; role: "admin" | "manager" | "viewer" }) {
  return request<{ invited: boolean; membershipId: string }>("/api/team/invite", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function resendTeamInvite(membershipId: string) {
  return request<{ resent: boolean }>("/api/team/resend", {
    method: "POST",
    body: JSON.stringify({ membershipId })
  });
}

export async function acceptTeamInvite(payload: { token: string; password: string }) {
  return request<{ accepted: boolean; orgName: string }>("/api/team/accept", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateTeamMemberRole(payload: { membershipId: string; role: "admin" | "manager" | "viewer" }) {
  return request<{ updated: boolean }>("/api/team/role", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function removeTeamMember(membershipId: string) {
  return request<{ removed: boolean }>("/api/team/member", {
    method: "DELETE",
    body: JSON.stringify({ membershipId })
  });
}

export async function deleteAdminCall(id: string, password: string) {
  return request<{ id: string }>(`/api/admin/calls/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ password })
  });
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

export async function deleteLead(id: string, password: string) {
  return request<{ id: string }>(`/api/admin/leads/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ password })
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
  return request<{
    organization: Organization;
    assignedPhoneNumber: string | null;
    assignedNumberProvider: "TWILIO" | "VAPI" | null;
    features?: OrgFeatureFlags;
  }>("/api/org/profile");
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

export async function fetchOrgConfigPackage() {
  return request<{ configPackage: ConfigPackage | null }>("/api/org/config-package");
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
  return request<{ leads: Lead[]; pipelineFeatureEnabled?: boolean }>("/api/org/leads");
}

export async function fetchOrgCalls() {
  return request<{
    calls: OrgCallRecord[];
    assignedPhoneNumber: string | null;
    assignedNumberProvider: "TWILIO" | "VAPI" | null;
  }>("/api/org/calls");
}

export async function fetchCustomerBase() {
  return request<{
    customers: CustomerBaseRecord[];
    summary: { total: number; vip: number; withLead: number; repeatCallers: number };
  }>("/api/org/customer-base");
}

export async function importCustomerBase(rows: Array<Record<string, unknown>>, sourceFileName?: string) {
  return request<{
    imported: number;
    skipped: number;
    updatedProfiles: number;
    updatedLeads: number;
  }>("/api/org/customer-base/import", {
    method: "POST",
    body: JSON.stringify({ rows, sourceFileName })
  });
}

export async function fetchOrgAnalytics(params: { range?: "7d" | "30d" | "custom"; start?: string; end?: string }) {
  const query = new URLSearchParams();
  if (params.range) query.set("range", params.range);
  if (params.start) query.set("start", params.start);
  if (params.end) query.set("end", params.end);
  return request<OrgAnalytics>(`/api/org/analytics${query.toString() ? `?${query.toString()}` : ""}`);
}

export async function fetchOrgDataQuality() {
  return request<OrgDataQuality>("/api/org/data-quality");
}

export async function fetchOrgMessagingReadiness() {
  return request<OrgMessagingReadiness>("/api/org/messaging-readiness");
}

export async function fetchOrgHealth() {
  return request<OrgHealth>("/api/org/health");
}

export async function fetchOrgMessages() {
  return request<{
    threads: OrgMessageThread[];
    assignedPhoneNumber: string | null;
    assignedNumberProvider: "TWILIO" | "VAPI" | null;
  }>("/api/org/messages");
}

export async function sendOrgMessage(payload: { to: string; body: string; leadId?: string }) {
  return request<{ threadId: string; message: Record<string, unknown> }>("/api/org/messages/send", {
    method: "POST",
    body: JSON.stringify(payload)
  });
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

export async function fetchOrgAppointments(params: { from?: string; to?: string; status?: Appointment["status"] }) {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.status) query.set("status", params.status);
  return request<{ appointments: Appointment[] }>(`/api/org/appointments${query.toString() ? `?${query.toString()}` : ""}`);
}

export async function createOrgAppointment(payload: {
  leadId?: string;
  callLogId?: string;
  customerName: string;
  customerPhone: string;
  issueSummary: string;
  assignedTechnician?: string;
  startAt: string;
  endAt: string;
  timezone: string;
  calendarProvider?: "GOOGLE" | "OUTLOOK" | "INTERNAL";
  idempotencyKey?: string;
}) {
  return request<{ appointment: Appointment }>("/api/org/appointments", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function patchOrgAppointment(id: string, payload: {
  assignedTechnician?: string | null;
  issueSummary?: string;
  status?: Appointment["status"];
}) {
  return request<{ appointment: Appointment }>(`/api/org/appointments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function cancelOrgAppointment(id: string) {
  return request<{ appointment: Appointment }>(`/api/org/appointments/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function completeOrgAppointment(id: string) {
  return request<{ appointment: Appointment }>(`/api/org/appointments/${id}/complete`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function fetchAppointmentAvailability(payload: {
  from?: string;
  to?: string;
}) {
  if (!siteConfig.apiBase) {
    throw new Error("API base URL is not configured. Set NEXT_PUBLIC_API_BASE in your frontend environment.");
  }
  let csrfToken = readCookie("kas_csrf_token");
  if (!csrfToken) {
    await fetch(`${siteConfig.apiBase}/api/auth/csrf-token`, {
      method: "GET",
      credentials: "include",
      cache: "no-store"
    });
    csrfToken = readCookie("kas_csrf_token");
  }
  const response = await fetch(`${siteConfig.apiBase}/api/org/appointments/availability`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {})
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        const payload = (await response.json()) as { ok?: boolean; message?: string };
        if (payload?.message) {
          throw new Error(payload.message);
        }
      } catch {
        // fall through to generic status message
      }
    }
    throw new Error(`Request failed (${response.status}).`);
  }
  const raw = (await response.json()) as { slots?: Array<{ startAt: string; endAt: string }> };
  return { slots: Array.isArray(raw.slots) ? raw.slots : [] };
}

export async function fetchCalendarProviders() {
  return request<{ providers: CalendarConnection[] }>("/api/org/calendar/providers");
}

export async function connectGoogleCalendar() {
  return request<{ url: string }>("/api/org/calendar/google/connect", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function connectOutlookCalendar() {
  return request<{ url: string }>("/api/org/calendar/outlook/connect", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function disconnectCalendar(payload: { connectionId?: string; provider?: "GOOGLE" | "OUTLOOK"; accountEmail?: string }) {
  return request<{ disconnected: number }>("/api/org/calendar/disconnect", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function runCalendarSyncTest(payload: { provider?: "GOOGLE" | "OUTLOOK" }) {
  return request<{ success: boolean; message: string }>("/api/org/calendar/sync-test", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function selectPrimaryCalendar(payload: { connectionId: string; selectedCalendarId?: string }) {
  return request<{ provider: CalendarConnection }>("/api/org/calendar/select-primary", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchCalendarEvents(payload: {
  from: string;
  to: string;
  provider?: "GOOGLE" | "OUTLOOK";
}) {
  const search = new URLSearchParams({
    from: payload.from,
    to: payload.to,
    ...(payload.provider ? { provider: payload.provider } : {})
  });
  return request<{ events: OrgCalendarEvent[] }>(`/api/org/calendar/events?${search.toString()}`);
}

export async function fetchOrgNotifications() {
  return request<{ notifications: OrgNotification[] }>("/api/org/notifications");
}

export async function markOrgNotificationRead(id: string) {
  return request<{ notification: OrgNotification }>(`/api/org/notifications/${id}/read`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function markAllOrgNotificationsRead() {
  return request<{ updated: number }>("/api/org/notifications/read-all", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function updateLeadPipelineStage(leadId: string, pipelineStage: "NEW_LEAD" | "QUOTED" | "NEEDS_SCHEDULING" | "SCHEDULED" | "COMPLETED") {
  return request<{ lead: Lead }>(`/api/org/leads/${leadId}/pipeline`, {
    method: "PATCH",
    body: JSON.stringify({ pipelineStage })
  });
}

export async function fetchOrgKnowledgeFiles() {
  return request<{ files: OrgKnowledgeFile[] }>("/api/org/knowledge-files");
}

export async function uploadOrgKnowledgeFile(payload: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentText: string;
}) {
  return request<{ file: OrgKnowledgeFile }>("/api/org/knowledge-files", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function deleteOrgKnowledgeFile(fileId: string) {
  return request<{ id: string }>(`/api/org/knowledge-files/${fileId}`, {
    method: "DELETE"
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

export async function fetchAdminOrgMessages(id: string) {
  return request<{ threads: OrgMessageThread[] }>(`/api/admin/orgs/${id}/messages`);
}

export async function fetchAdminOrgReadiness(id: string) {
  return request<ReadinessReport>(`/api/admin/orgs/${id}/readiness`);
}

export async function fetchAdminOrgHealth(id: string) {
  return request<OrgHealth>(`/api/admin/orgs/${id}/health`);
}

export async function generateAdminConfigPackage(id: string) {
  return request<{ configPackage: ConfigPackage }>(`/api/admin/orgs/${id}/config-package/generate`, {
    method: "POST"
  });
}

export async function fetchAdminConfigPackage(id: string) {
  return request<{ configPackage: ConfigPackage | null }>(`/api/admin/orgs/${id}/config-package`);
}

export async function fetchAdminConfigPackageVersions(id: string) {
  return request<{ versions: ConfigPackageVersion[] }>(`/api/admin/orgs/${id}/config-package/versions`);
}

export async function revertAdminConfigPackageVersion(id: string, versionId: string) {
  return request<{ configPackage: ConfigPackage }>(
    `/api/admin/orgs/${id}/config-package/versions/${versionId}/revert`,
    { method: "POST" }
  );
}

export async function fetchAdminTesting(id: string) {
  return request<{
    scenarios: TestScenario[];
    summary: { totalPassed: number; hasAfterHoursPass: boolean; hasTransferPass: boolean };
  }>(`/api/admin/orgs/${id}/testing`);
}

export async function createAdminTestRun(
  id: string,
  payload: { scenarioId: string; status: "PASS" | "FAIL"; notes?: string; providerCallId?: string }
) {
  return request<{ run: Record<string, unknown> }>(`/api/admin/orgs/${id}/testing/run`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
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

export async function fetchAdminAiConfigVersions(id: string) {
  return request<{ versions: AiAgentConfigVersion[] }>(`/api/admin/orgs/${id}/ai-config/versions`);
}

export async function revertAdminAiConfigVersion(id: string, versionId: string) {
  return request<{ ai: Record<string, unknown> }>(`/api/admin/orgs/${id}/ai-config/versions/${versionId}/revert`, {
    method: "POST"
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

export async function syncBusinessSettingsFromOnboarding(orgId: string) {
  return request<{ settings: BusinessSettings }>(`/api/admin/orgs/${orgId}/provisioning/sync-business-settings`, {
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

export async function fetchAdminSystemDashboard() {
  return request<AdminSystemDashboard>("/api/admin/system/dashboard");
}

export async function fetchAdminSystemReadiness() {
  return request<AdminSystemReadiness>("/api/admin/system/readiness");
}

export async function fetchAdminSystemScaleGate() {
  return request<AdminScaleGate>("/api/admin/system/scale-gate");
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

export async function deleteProspect(id: string, password: string) {
  return request<{ id: string }>(`/api/admin/prospects/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ password })
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

export async function fetchAdminEvents(query: string) {
  return request<{ events: AuditEvent[] }>(`/api/admin/events${query}`);
}

export async function fetchAdminDemoConfig() {
  return request<DemoConfig>("/api/admin/settings/demo");
}

export async function updateAdminDemoConfig(payload: DemoConfig) {
  return request<DemoConfig>("/api/admin/settings/demo", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function fetchPublicDemoConfig() {
  return request<{
    demoNumber: string | null;
    demoVapiAssistantId: string | null;
    demoVapiPhoneNumberId: string | null;
    demoTitle: string | null;
    demoSubtitle: string | null;
    demoQuestions: string[];
  }>("/api/public/demo-config");
}

export async function fetchPublicStatus() {
  return request<PublicSystemStatus>("/api/status");
}

export async function fetchAdminDemoCalls(limit = 100) {
  return request<{ calls: DemoCallLog[] }>(`/api/admin/settings/demo/calls?limit=${Math.max(1, Math.min(limit, 300))}`);
}
