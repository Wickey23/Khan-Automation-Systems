function parsePoliciesJson(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function normalizeWhitespace(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function ensureStopFooter(body: string) {
  if (/reply\s+stop\s+to\s+(?:unsubscribe|opt out)/i.test(body)) return body;
  return `${body}\n\nReply STOP to unsubscribe.`;
}

function replaceTokens(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, token: string) => values[token] || "");
}

export function getSmsTemplatesFromPolicies(policiesJson: string | null | undefined) {
  const policies = parsePoliciesJson(policiesJson);
  return {
    missedCallRecovery: String(policies.smsMissedCallRecoveryTemplate || "").trim(),
    newLeadAcknowledgement: String(policies.smsNewLeadAcknowledgementTemplate || "").trim(),
    appointmentConfirmation: String(policies.smsAppointmentConfirmationTemplate || "").trim()
  };
}

export function buildMissedCallRecoveryFallback(input: {
  businessName: string;
  customerName?: string | null;
}) {
  const greetingName = String(input.customerName || "").trim() || "there";
  return `Hi ${greetingName}, ${input.businessName} missed your call. Reply with what you need help with and the team will follow up shortly.`;
}

export function buildNewLeadAcknowledgementFallback(input: {
  businessName: string;
  customerName?: string | null;
  serviceAddress?: string | null;
  needsAddress?: boolean;
}) {
  const customerName = String(input.customerName || "").trim() || "there";
  const serviceAddress = String(input.serviceAddress || "").trim();
  if (input.needsAddress && !serviceAddress) {
    return `Thanks ${customerName} - ${input.businessName} received your request. Please reply with the service address so the team can follow up.`;
  }
  if (serviceAddress) {
    return `Thanks ${customerName} - ${input.businessName} received your service request at ${serviceAddress}. Our team will follow up shortly.`;
  }
  return `Thanks ${customerName} - ${input.businessName} received your request. Our team will follow up shortly.`;
}

export function renderOperationalSmsTemplate(input: {
  template?: string | null;
  fallback: string;
  values: Record<string, string | null | undefined>;
  includeStopFooter?: boolean;
}) {
  const base = normalizeWhitespace(String(input.template || "").trim() || input.fallback);
  const mappedValues = Object.fromEntries(
    Object.entries(input.values).map(([key, value]) => [key, String(value || "").trim()])
  );
  const rendered = normalizeWhitespace(replaceTokens(base, mappedValues));
  return input.includeStopFooter === false ? rendered : ensureStopFooter(rendered);
}
