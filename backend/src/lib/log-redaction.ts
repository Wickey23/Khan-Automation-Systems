const SENSITIVE_KEYS = new Set([
  "jwt_secret",
  "refresh_token_secret",
  "stripe_secret_key",
  "twilio_auth_token",
  "vapi_api_key",
  "authorization",
  "cookie",
  "x-vapi-tool-secret",
  "stripe-signature"
]);

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (!value.trim()) return value;
    return "[REDACTED]";
  }
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") return redactObject(value as Record<string, unknown>);
  return value;
}

export function redactObject(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input || {})) {
    const normalized = key.trim().toLowerCase();
    out[key] = SENSITIVE_KEYS.has(normalized) ? "[REDACTED]" : redactValue(value);
  }
  return out;
}

