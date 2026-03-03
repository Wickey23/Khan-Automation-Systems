type JsonMap = Record<string, unknown>;

function asObject(value: unknown): JsonMap {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonMap) : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

export function buildVapiSystemPrompt(configPackage: JsonMap, businessSettings: JsonMap) {
  const business = asObject(configPackage.business);
  const services = asStringArray(asObject(configPackage.services).offered);
  const transfer = asObject(configPackage.transfer);
  const transferRules = Array.isArray(transfer.rules) ? transfer.rules : [];
  const transferNumbers = transferRules
    .map((rule) => asObject(rule).toNumber)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const policies = asObject(configPackage.policies);
  const booking = asObject(configPackage.booking);
  const timezone = String((businessSettings.timezone as string) || "America/New_York");
  const businessName = String(business.name || "Service Shop");
  const industry = String((businessSettings.industry as string) || "Service");

  return [
    "You are the AI receptionist for a local service business.",
    `Business: ${businessName}`,
    `Industry: ${industry}`,
    `Timezone: ${timezone}`,
    `Services: ${services.join(", ") || "General service work"}`,
    `Booking app: ${String(booking.appName || "none")}`,
    `Booking mode: ${String(booking.mode || "staff_review")}`,
    `Booking link: ${String(booking.bookingLink || "")}`,
    "Goals: collect caller details, determine urgency, offer next steps, escalate when rules match.",
    "Caller memory: at the start of each call, run get_caller_context using orgId and callId (or callerPhone) to check if this is a repeat caller.",
    "If context is found, acknowledge briefly (for example, 'welcome back') and confirm key details before continuing.",
    "Never assume old details are still correct; confirm changes quickly.",
    `Transfer numbers: ${JSON.stringify(transferNumbers)}`,
    `Transfer rules: ${JSON.stringify(transferRules)}`,
    `Policies: ${JSON.stringify(policies)}`,
    "Always be concise, practical, and clear. If unsure, take a message and notify the manager."
  ].join("\n");
}

export function buildVapiTools(apiBaseUrl: string) {
  return [
    { name: "get_caller_context", url: `${apiBaseUrl}/api/tools/get-caller-context`, method: "POST" },
    { name: "create_lead_from_call", url: `${apiBaseUrl}/api/tools/create-lead-from-call`, method: "POST" },
    { name: "send_sms", url: `${apiBaseUrl}/api/tools/send-sms`, method: "POST" },
    { name: "notify_manager", url: `${apiBaseUrl}/api/tools/notify-manager`, method: "POST" },
    { name: "request_appointment", url: `${apiBaseUrl}/api/tools/request-appointment`, method: "POST" },
    { name: "transfer_call", url: `${apiBaseUrl}/api/tools/transfer-call`, method: "POST" }
  ];
}

export async function upsertVapiAgentIfConfigured(input: {
  apiKey?: string;
  agentId?: string | null;
  payload: Record<string, unknown>;
}) {
  if (!input.apiKey) return { skipped: true as const, reason: "VAPI_API_KEY not configured" };
  const baseUrl = input.agentId ? `https://api.vapi.ai/assistant/${input.agentId}` : "https://api.vapi.ai/assistant";
  const method = input.agentId ? "PATCH" : "POST";
  const response = await fetch(baseUrl, {
    method,
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input.payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Vapi API error (${response.status}): ${text}`);
  }

  return (await response.json()) as Record<string, unknown>;
}
