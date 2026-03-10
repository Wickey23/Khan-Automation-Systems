import { normalizePhoneE164 } from "./caller-profile.service";

export type NormalizedPhone = {
  raw: string;
  normalized: string;
  last10: string;
};

export function normalizePhoneForLookup(input: unknown): NormalizedPhone {
  const raw = String(input || "").trim();
  const normalized = normalizePhoneE164(raw);
  const last10 = normalized.replace(/\D/g, "").slice(-10);
  return { raw, normalized, last10 };
}
