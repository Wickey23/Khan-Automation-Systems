import { siteConfig } from "@/lib/config";
import type { AIConfig, AuthUser, CallRecord, Client, Lead, LeadPayload, PhoneLine, Setting } from "@/lib/types";
import type { LeadUpdateInput } from "@/lib/validation";

type ApiResponse<T> = {
  ok: boolean;
  message?: string;
  data?: T;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${siteConfig.apiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    },
    credentials: "include",
    cache: "no-store"
  });

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
  return request<{ token: string; user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function authSignup(body: {
  name: string;
  business: string;
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
  return request<{ user: AuthUser }>("/api/auth/me");
}

export async function createStripeCheckoutSession(plan: "starter" | "pro") {
  return request<{ url: string }>("/api/stripe/create-checkout-session", {
    method: "POST",
    body: JSON.stringify({ plan })
  });
}

export async function createCustomerPortalSession() {
  return request<{ url: string }>("/api/stripe/customer-portal", {
    method: "POST"
  });
}

export async function fetchLeads(query: string) {
  return request<{ leads: Lead[]; total: number }>(`/api/admin/leads${query}`);
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
