import { env } from "../../config/env";

export function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (!digits) return input.trim();
  if (digits.length === 10) return `+1${digits}`;
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  if (input.trim().startsWith("+")) return input.trim();
  return `+${digits}`;
}

export function pickString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function classifySmsKeyword(input: string) {
  const normalized = input.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(normalized)) return "STOP";
  if (["START", "UNSTOP", "YES"].includes(normalized)) return "START";
  if (["HELP", "INFO"].includes(normalized)) return "HELP";
  return null;
}

export function phoneVariants(input: string) {
  const normalized = normalizePhone(input);
  const digits = normalized.replace(/\D/g, "");
  const variants = new Set<string>([normalized, input.trim()]);
  if (digits.length === 11 && digits.startsWith("1")) variants.add(digits.slice(1));
  variants.add(digits);
  return [...variants].filter(Boolean);
}

export function extractAssistantReply(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const root = payload as Record<string, unknown>;
  const direct = [root.output, root.message, root.text, root.reply];
  for (const value of direct) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const messages = Array.isArray(root.messages) ? root.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const role = String(record.role || "").toLowerCase();
    if (role !== "assistant") continue;
    const content = record.content;
    if (typeof content === "string" && content.trim()) return content.trim();
    if (Array.isArray(content)) {
      const joined = content
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object") {
            const text = (part as Record<string, unknown>).text;
            return typeof text === "string" ? text : "";
          }
          return "";
        })
        .join(" ")
        .trim();
      if (joined) return joined;
    }
  }
  return "";
}

export function parsePoliciesJson(value: string | null | undefined) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function buildFirstInboundIntro(input: {
  businessName: string;
  policiesJson?: string | null;
  smsConsentText?: string | null;
}) {
  const policies = parsePoliciesJson(input.policiesJson);
  const customWelcomeRaw = String(policies.smsWelcomeMessage || "").trim();
  const marketingEnabled = Boolean(policies.smsMarketingEnabled);
  const marketingBlurb = String(policies.smsMarketingBlurb || "").trim();
  const consent = String(input.smsConsentText || "").trim();

  const welcome =
    customWelcomeRaw.replace(/\{\{\s*businessName\s*\}\}/g, input.businessName) ||
    `Thanks for texting ${input.businessName}. You reached our service team.`;

  const lines = [welcome];
  if (marketingEnabled && marketingBlurb) lines.push(marketingBlurb);
  if (consent) lines.push(consent);
  lines.push("Reply STOP to opt out. Reply START to re-subscribe.");
  return lines.filter(Boolean).join(" ");
}

export async function getVapiSmsReply(input: {
  assistantId: string;
  orgId: string;
  orgName: string;
  fromNumber: string;
  toNumber: string;
  body: string;
  threadHistory: Array<{ direction: string; body: string }>;
}) {
  if (!env.VAPI_API_KEY) return "";
  const history = input.threadHistory
    .slice(-12)
    .reverse()
    .map((message) => `${message.direction === "INBOUND" ? "Customer" : "Agent"}: ${message.body}`)
    .join("\n");

  const conversationPrompt = [
    `Business: ${input.orgName}`,
    `Organization ID: ${input.orgId}`,
    `Inbound SMS from: ${input.fromNumber}`,
    `Business SMS number: ${input.toNumber}`,
    history ? `Recent thread:\n${history}` : "",
    `Latest customer message: ${input.body}`,
    "Respond as the business assistant over SMS in 1-3 short lines. Ask one relevant next question if details are missing."
  ]
    .filter(Boolean)
    .join("\n\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch("https://api.vapi.ai/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.VAPI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        assistantId: input.assistantId,
        input: conversationPrompt,
        metadata: {
          orgId: input.orgId,
          channel: "sms",
          fromNumber: input.fromNumber,
          toNumber: input.toNumber
        }
      }),
      signal: controller.signal
    });

    if (response.ok) {
      const payload = (await response.json()) as unknown;
      return extractAssistantReply(payload);
    }
    return "";
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}
