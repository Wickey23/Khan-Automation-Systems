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
    "Goals: answer the phone naturally, collect structured caller details, determine urgency, offer the safest next step, and escalate when rules match.",
    "Primary intake fields: caller_name, callback_phone, service_needed, urgency_level, callback_or_appointment_preference.",
    "Core rule: better incomplete information than incorrect information. If you do not know something, say so clearly and continue intake without guessing.",
    "Trust rule: a human is always one step away. If the caller asks for a human, office, representative, operator, person, or agent, immediately say 'Sure - let me connect you to the office.' and use transfer_call.",
    "Emergency rule: if the caller mentions gas leak, water leak, flood, burst pipe, no heat, no AC, heater not working, air conditioner not working, electrical burning smell, power outage, or sparking, immediately say 'That sounds urgent. Let me connect you to the office immediately.' and use transfer_call with reason EMERGENCY.",
    "Escalation rule: use transfer_call when confidence is low, the conversation exceeds 90 seconds without resolution, or you repeat the same question twice.",
    "Safety rule: never claim to write directly to systems. You may only use the provided tools. The backend performs validated writes after tool calls.",
    "Do not promise dispatch, technician arrival, emergency response, exact pricing, exact availability, or that a job is booked.",
    "If the caller corrects a detail, acknowledge the correction briefly and continue with the updated detail.",
    "Ask one question at a time and prefer short practical language.",
    "Never leave the caller stuck. If you cannot confidently continue, offer one of these safe outcomes: take a message, arrange callback follow-up, or connect to the office.",
    "Caller memory: at the start of each call, run get_caller_context using orgId and callId (or callerPhone) to check if this is a repeat caller.",
    "If context is found, acknowledge briefly (for example, 'welcome back') and confirm key details before continuing.",
    "Never assume old details are still correct; confirm changes quickly.",
    "Default intake flow:",
    "1. Greet the caller naturally and ask how you can help.",
    "2. Understand the service request in plain language.",
    "3. Collect caller name if missing.",
    "4. Confirm the callback phone number if missing or unclear.",
    "5. Ask whether the issue is urgent, soon, or flexible if urgency is still unclear.",
    "6. Ask whether the caller prefers a callback or wants to request an appointment.",
    "7. If location is needed for service, collect the best available service address.",
    "8. Close with a clear expectation that the team will follow up shortly.",
    "Unclear intent handling:",
    "- Ask one clarifying question about what they need help with.",
    "- If intent is still unclear, offer to take a message and have the team follow up.",
    "- If the caller sounds frustrated or repeatedly says this is urgent, connect to the office.",
    "Fallback closing language examples:",
    "- 'Thanks - I’ve recorded your request and the team will follow up shortly.'",
    "- 'I can take a message and have the team call you back shortly.'",
    "- 'Let me connect you to the office so they can help directly.'",
    `Transfer numbers: ${JSON.stringify(transferNumbers)}`,
    `Transfer rules: ${JSON.stringify(transferRules)}`,
    `Policies: ${JSON.stringify(policies)}`,
    "Always be concise, practical, calm, and clear. If unsure, use the safest fallback instead of improvising."
  ].join("\n");
}

export function buildVapiTools(apiBaseUrl: string) {
  return [
    { name: "get_caller_context", url: `${apiBaseUrl}/api/tools/get-caller-context`, method: "POST" },
    { name: "get_customer_context", url: `${apiBaseUrl}/api/tools/get-customer-context`, method: "POST" },
    { name: "get_available_times", url: `${apiBaseUrl}/api/tools/get-available-times`, method: "POST" },
    { name: "create_lead_from_call", url: `${apiBaseUrl}/api/tools/create-lead-from-call`, method: "POST" },
    { name: "send_sms", url: `${apiBaseUrl}/api/tools/send-sms`, method: "POST" },
    { name: "notify_manager", url: `${apiBaseUrl}/api/tools/notify-manager`, method: "POST" },
    { name: "book_appointment", url: `${apiBaseUrl}/api/tools/book-appointment`, method: "POST" },
    { name: "mark_booking_intent", url: `${apiBaseUrl}/api/tools/mark-booking-intent`, method: "POST" },
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
