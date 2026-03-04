import { env } from "../../config/env";

function parseAllowlist(value: string | undefined) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function baseFlagEnabled(value: string | undefined) {
  return String(value || "").toLowerCase() === "true";
}

export function isFeatureEnabledForOrg(
  featureFlagValue: string | undefined,
  orgId?: string | null,
  allowlistRaw: string | undefined = env.FEATURE_PHASE1_ORG_ALLOWLIST
) {
  if (!baseFlagEnabled(featureFlagValue)) return false;
  const allowlist = parseAllowlist(allowlistRaw);
  if (!allowlist.length) return true;
  if (!orgId) return false;
  if (allowlist.includes("*") || allowlist.map((item) => item.toLowerCase()).includes("all")) return true;
  return allowlist.includes(orgId);
}

