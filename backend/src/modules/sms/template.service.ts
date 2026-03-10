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
