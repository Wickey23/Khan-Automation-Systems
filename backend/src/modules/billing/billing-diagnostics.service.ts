import { UserRole, type PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { env } from "../../config/env";

export type BillingDiagnosticStatus = "PASS" | "WARN" | "FAIL";

export type BillingDiagnosticCheck = {
  key: string;
  status: BillingDiagnosticStatus;
  message: string;
  fixHint?: string;
  reasonCode?: string;
  maskedRef?: string;
};

export type BillingDiagnosticSummary = {
  overall: "HEALTHY" | "NEEDS_ACTION" | "BLOCKED";
  checkoutReady: boolean;
  changePlanReady: boolean;
  customerPortalReady: boolean;
  topIssues: string[];
};

type BillingDiagnosticChecks = {
  config: BillingDiagnosticCheck[];
  stripe: BillingDiagnosticCheck[];
  orgLinkage: BillingDiagnosticCheck[];
};

type BillingDiagnosticsPayloadBase = {
  summary: BillingDiagnosticSummary;
  evaluatedAt: string;
  detailed: boolean;
};

export type BillingDiagnosticsPayload =
  | (BillingDiagnosticsPayloadBase & { checks: BillingDiagnosticChecks })
  | BillingDiagnosticsPayloadBase;

type ComputeInput = {
  prisma: PrismaClient;
  stripe: Stripe;
  auth: {
    userId: string;
    orgId?: string | null;
    role: UserRole;
  };
  now?: Date;
  detailed: boolean;
  stripeTimeoutMs?: number;
};

type StripeFailureClass = "AUTH_OR_NETWORK" | "RESOURCE_MISSING" | "OTHER";

const CACHE_TTL_MS = 45_000;
const LIMIT_WINDOW_MS = 60_000;
const LIMIT_MAX = 6;

const diagnosticsCache = new Map<string, { value: BillingDiagnosticsPayload; expiresAt: number }>();
const limiterState = new Map<string, { windowStart: number; count: number }>();

function boolText(value: boolean) {
  return value ? "configured" : "missing";
}

function isAdminDetailedRole(role: UserRole) {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

function validUrl(value: string | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function maskStripeRef(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length <= 8) return `***${raw.slice(-2)}`;
  return `${raw.slice(0, 4)}***${raw.slice(-4)}`;
}

export function isPlaceholder(value: string | undefined): boolean {
  const raw = String(value || "").trim();
  if (!raw) return true;
  const normalized = raw.toLowerCase();
  const markers = ["changeme", "replace", "your_", "test_", "xxx", "replace_me", "placeholder"];
  return markers.some((marker) => normalized.includes(marker));
}

function cacheKey(orgId: string | null, detailed: boolean) {
  return `${orgId || "no-org"}:${detailed ? "detailed" : "summary"}`;
}

function limiterKey(input: { orgId: string | null; userId: string; detailed: boolean }) {
  return `${input.orgId || "no-org"}:${input.userId}:${input.detailed ? "detailed" : "summary"}`;
}

function getCached(key: string, nowMs: number) {
  const hit = diagnosticsCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= nowMs) {
    diagnosticsCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key: string, value: BillingDiagnosticsPayload, nowMs: number) {
  diagnosticsCache.set(key, { value, expiresAt: nowMs + CACHE_TTL_MS });
}

function shouldRateLimit(key: string, nowMs: number) {
  const state = limiterState.get(key);
  if (!state) {
    limiterState.set(key, { windowStart: nowMs, count: 1 });
    return false;
  }
  if (nowMs - state.windowStart >= LIMIT_WINDOW_MS) {
    limiterState.set(key, { windowStart: nowMs, count: 1 });
    return false;
  }
  state.count += 1;
  limiterState.set(key, state);
  return state.count > LIMIT_MAX;
}

type MappedStripeError = {
  reasonCode: string;
  fixHint: string;
  failureClass: StripeFailureClass;
};

export function mapStripeErrorToDiagnostic(error: unknown): MappedStripeError {
  if (error && typeof error === "object" && "reasonCode" in error && (error as { reasonCode?: unknown }).reasonCode === "STRIPE_PING_TIMEOUT") {
    return {
      reasonCode: "STRIPE_PING_TIMEOUT",
      fixHint: "Stripe diagnostics ping timed out. Check outbound network access and Stripe status.",
      failureClass: "AUTH_OR_NETWORK"
    };
  }

  const asAny = error as { code?: unknown; type?: unknown; statusCode?: unknown; message?: unknown } | undefined;
  if (error instanceof Stripe.errors.StripeError || asAny) {
    const code = String(asAny?.code || (error instanceof Stripe.errors.StripeError ? error.code : "") || "").toLowerCase();
    const type = String(asAny?.type || (error instanceof Stripe.errors.StripeError ? error.type : "") || "").toLowerCase();
    const statusCode = Number(asAny?.statusCode || (error instanceof Stripe.errors.StripeError ? error.statusCode : 0) || 0);
    const message = String(asAny?.message || (error instanceof Stripe.errors.StripeError ? error.message : "") || "").toLowerCase();

    const isResourceMissing = code === "resource_missing" || message.includes("no such price");
    if (isResourceMissing) {
      return {
        reasonCode: "STRIPE_PRICE_NOT_FOUND",
        fixHint: "Stripe price ID does not exist. Verify STRIPE_STARTER_PRICE_ID / STRIPE_PRO_PRICE_ID.",
        failureClass: "RESOURCE_MISSING"
      };
    }

    const authOrNetwork =
      type === "authentication_error" ||
      type === "api_connection_error" ||
      type === "rate_limit_error" ||
      statusCode === 401 ||
      statusCode === 403;

    if (authOrNetwork) {
      return {
        reasonCode: "STRIPE_AUTH_OR_NETWORK_ERROR",
        fixHint: "Check STRIPE_SECRET_KEY permissions and network connectivity to Stripe.",
        failureClass: "AUTH_OR_NETWORK"
      };
    }

    return {
      reasonCode: "STRIPE_UNKNOWN_ERROR",
      fixHint: "Stripe returned an unexpected error. Retry and review backend logs.",
      failureClass: "OTHER"
    };
  }

  return {
    reasonCode: "STRIPE_UNKNOWN_ERROR",
    fixHint: "Stripe diagnostics failed unexpectedly. Retry and review backend logs.",
    failureClass: "OTHER"
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject({ reasonCode: "STRIPE_PING_TIMEOUT" });
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function makeRateLimitedFallback(now: Date): BillingDiagnosticsPayload {
  return {
    detailed: false,
    evaluatedAt: now.toISOString(),
    summary: {
      overall: "NEEDS_ACTION",
      checkoutReady: false,
      changePlanReady: false,
      customerPortalReady: false,
      topIssues: ["diagnostics_rate_limited_try_again"]
    }
  };
}

function flattenIssues(checks: BillingDiagnosticChecks) {
  return [...checks.config, ...checks.stripe, ...checks.orgLinkage]
    .filter((check) => check.status !== "PASS")
    .map((check) => check.reasonCode || check.key)
    .slice(0, 6);
}

export function computeOverallStatus(checks: BillingDiagnosticChecks): BillingDiagnosticSummary["overall"] {
  const hasConfigFail = checks.config.some((check) => check.status === "FAIL");
  const stripeReachabilityFail = checks.stripe.some((check) => check.key === "stripeApiReachable" && check.status === "FAIL");
  if (hasConfigFail || stripeReachabilityFail) return "BLOCKED";

  const hasLinkageWarn = checks.orgLinkage.some((check) => check.status === "WARN");
  if (hasLinkageWarn) return "NEEDS_ACTION";
  return "HEALTHY";
}

function buildConfigChecks(detailed: boolean): BillingDiagnosticCheck[] {
  const rawSecret = String(env.STRIPE_SECRET_KEY || "").trim();
  const isSandboxSecret = rawSecret.startsWith("sk_test_");
  const stripeSecretConfigured = !isPlaceholder(rawSecret) || (env.SECURITY_MODE !== "production" && isSandboxSecret);
  const starterConfigured = !isPlaceholder(env.STRIPE_STARTER_PRICE_ID);
  const proConfigured = !isPlaceholder(env.STRIPE_PRO_PRICE_ID);
  const successCancelValid = validUrl(env.STRIPE_SUCCESS_URL) && validUrl(env.STRIPE_CANCEL_URL);
  const portalReturnValid = !env.STRIPE_PORTAL_RETURN_URL || validUrl(env.STRIPE_PORTAL_RETURN_URL);

  const checks: BillingDiagnosticCheck[] = [
    {
      key: "stripeSecretConfigured",
      status: stripeSecretConfigured ? "PASS" : "FAIL",
      message:
        stripeSecretConfigured && isSandboxSecret
          ? "Stripe test secret key configured (sandbox mode)."
          : `Stripe secret key ${boolText(stripeSecretConfigured)}.`,
      fixHint: stripeSecretConfigured ? undefined : "Set STRIPE_SECRET_KEY to a valid non-placeholder key."
    },
    {
      key: "starterPriceConfigured",
      status: starterConfigured ? "PASS" : "FAIL",
      message: `Starter price ID ${boolText(starterConfigured)}.`,
      fixHint: starterConfigured ? undefined : "Set STRIPE_STARTER_PRICE_ID to your Stripe starter price ID.",
      maskedRef: detailed && starterConfigured ? maskStripeRef(env.STRIPE_STARTER_PRICE_ID) : undefined
    },
    {
      key: "proPriceConfigured",
      status: proConfigured ? "PASS" : "FAIL",
      message: `Pro price ID ${boolText(proConfigured)}.`,
      fixHint: proConfigured ? undefined : "Set STRIPE_PRO_PRICE_ID to your Stripe pro price ID.",
      maskedRef: detailed && proConfigured ? maskStripeRef(env.STRIPE_PRO_PRICE_ID) : undefined
    },
    {
      key: "successCancelUrlsConfigured",
      status: successCancelValid ? "PASS" : "FAIL",
      message: successCancelValid ? "Checkout success/cancel URLs are valid." : "Checkout success/cancel URLs are invalid.",
      fixHint: successCancelValid ? undefined : "Set STRIPE_SUCCESS_URL and STRIPE_CANCEL_URL to valid HTTPS URLs."
    },
    {
      key: "portalReturnUrlConfigured",
      status: portalReturnValid ? "PASS" : "WARN",
      message: portalReturnValid
        ? "Portal return URL is valid (or using default app billing URL)."
        : "Portal return URL is invalid. Default fallback will be used.",
      fixHint: portalReturnValid ? undefined : "Set STRIPE_PORTAL_RETURN_URL to a valid HTTPS URL or unset it."
    }
  ];

  return checks;
}

async function resolveOrgContext(prisma: PrismaClient, auth: ComputeInput["auth"]) {
  let orgId = auth.orgId || null;
  if (!orgId) {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { orgId: true }
    });
    orgId = user?.orgId || null;
  }
  if (!orgId) {
    return {
      orgId: null,
      org: null,
      subscription: null
    };
  }

  const [org, subscription] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, stripeCustomerId: true, subscriptionStatus: true }
    }),
    prisma.subscription.findFirst({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: { status: true, stripeCustomerId: true, stripeSubscriptionId: true }
    })
  ]);

  return { orgId, org, subscription };
}

async function buildStripeChecks(input: {
  stripe: Stripe;
  detailed: boolean;
  timeoutMs: number;
}): Promise<BillingDiagnosticCheck[]> {
  const checks: BillingDiagnosticCheck[] = [];
  const starterId = env.STRIPE_STARTER_PRICE_ID;
  const proId = env.STRIPE_PRO_PRICE_ID;

  const checkPro = input.detailed;
  const priceChecks: Array<{ key: "starterPriceResolvable" | "proPriceResolvable"; priceId: string }> = [
    { key: "starterPriceResolvable", priceId: starterId }
  ];
  if (checkPro) priceChecks.push({ key: "proPriceResolvable", priceId: proId });

  const outcomes: Array<{ ok: boolean; failureClass?: StripeFailureClass }> = [];
  for (const spec of priceChecks) {
    if (isPlaceholder(spec.priceId)) {
      checks.push({
        key: spec.key,
        status: "FAIL",
        message: "Price ID is placeholder or missing.",
        fixHint: `Set ${spec.key === "starterPriceResolvable" ? "STRIPE_STARTER_PRICE_ID" : "STRIPE_PRO_PRICE_ID"} to a real Stripe price ID.`,
        reasonCode: "STRIPE_PRICE_ID_PLACEHOLDER"
      });
      outcomes.push({ ok: false, failureClass: "OTHER" });
      continue;
    }

    try {
      const price = await withTimeout(input.stripe.prices.retrieve(spec.priceId), input.timeoutMs);
      checks.push({
        key: spec.key,
        status: "PASS",
        message: `Stripe price resolved (${price.active ? "active" : "inactive"}).`,
        maskedRef: maskStripeRef(spec.priceId)
      });
      outcomes.push({ ok: true });
    } catch (error) {
      const mapped = mapStripeErrorToDiagnostic(error);
      checks.push({
        key: spec.key,
        status: "FAIL",
        message: "Stripe price could not be resolved.",
        fixHint: mapped.fixHint,
        reasonCode: mapped.reasonCode,
        maskedRef: maskStripeRef(spec.priceId)
      });
      outcomes.push({ ok: false, failureClass: mapped.failureClass });
    }
  }

  const anySuccess = outcomes.some((entry) => entry.ok);
  const allFailures = outcomes.length > 0 && outcomes.every((entry) => !entry.ok);
  const allResourceMissing =
    outcomes.length > 0 &&
    outcomes.every((entry) => !entry.ok && entry.failureClass === "RESOURCE_MISSING");
  const allAuthOrNetwork =
    outcomes.length > 0 &&
    outcomes.every((entry) => !entry.ok && entry.failureClass === "AUTH_OR_NETWORK");

  let reachability: BillingDiagnosticCheck;
  if (anySuccess) {
    reachability = {
      key: "stripeApiReachable",
      status: "PASS",
      message: "Stripe API reachable."
    };
  } else if (allFailures && allResourceMissing) {
    reachability = {
      key: "stripeApiReachable",
      status: "PASS",
      message: "Stripe API reachable, but configured price IDs are invalid.",
      reasonCode: "STRIPE_REACHABLE_PRICE_RESOURCE_MISSING",
      fixHint: "Update Stripe price IDs to existing resources."
    };
  } else if (input.detailed && allFailures && allAuthOrNetwork) {
    reachability = {
      key: "stripeApiReachable",
      status: "FAIL",
      message: "Stripe API unreachable for diagnostics checks.",
      reasonCode: "STRIPE_API_UNREACHABLE",
      fixHint: "Check STRIPE_SECRET_KEY permissions, network egress, and Stripe status."
    };
  } else if (allFailures) {
    reachability = {
      key: "stripeApiReachable",
      status: "WARN",
      message: "Stripe API reachability is inconclusive in summary mode.",
      reasonCode: "STRIPE_REACHABILITY_INCONCLUSIVE",
      fixHint: "Retry diagnostics or open with an admin account for full checks."
    };
  } else {
    reachability = {
      key: "stripeApiReachable",
      status: "PASS",
      message: "Stripe API reachable."
    };
  }

  checks.push(reachability);
  return checks;
}

function buildOrgLinkageChecks(input: {
  orgId: string | null;
  org: { id: string; stripeCustomerId: string | null; subscriptionStatus: string | null } | null;
  subscription: { status: string; stripeCustomerId: string; stripeSubscriptionId: string } | null;
}): BillingDiagnosticCheck[] {
  const orgResolved = Boolean(input.orgId && input.org);
  const stripeCustomerLinked = Boolean(input.org?.stripeCustomerId);
  const subscriptionPresent = Boolean(input.subscription);
  const subscriptionStripeIdsPresent = Boolean(input.subscription?.stripeCustomerId && input.subscription?.stripeSubscriptionId);
  const status = String(input.subscription?.status || "").toLowerCase();
  const statusActionablePass = status === "active" || status === "trialing";

  const checks: BillingDiagnosticCheck[] = [
    {
      key: "orgContextResolved",
      status: orgResolved ? "PASS" : "WARN",
      message: orgResolved ? "Organization context resolved." : "Organization context not resolved for this user.",
      fixHint: orgResolved ? undefined : "Complete org onboarding or re-authenticate with an organization-linked account."
    },
    {
      key: "stripeCustomerLinked",
      status: stripeCustomerLinked ? "PASS" : "WARN",
      message: stripeCustomerLinked ? "Stripe customer linked to organization." : "No Stripe customer linked yet.",
      fixHint: stripeCustomerLinked ? undefined : "Start checkout to create and link a Stripe customer."
    },
    {
      key: "subscriptionRecordPresent",
      status: subscriptionPresent ? "PASS" : "WARN",
      message: subscriptionPresent ? "Subscription record present." : "No subscription record found.",
      fixHint: subscriptionPresent ? undefined : "Start checkout to create subscription."
    },
    {
      key: "subscriptionStripeIdsPresent",
      status: subscriptionStripeIdsPresent ? "PASS" : "WARN",
      message: subscriptionStripeIdsPresent ? "Subscription Stripe IDs present." : "Subscription Stripe IDs missing.",
      fixHint: subscriptionStripeIdsPresent ? undefined : "Re-run checkout or sync Stripe webhook records."
    },
    {
      key: "subscriptionStatusActionable",
      status: subscriptionPresent ? (statusActionablePass ? "PASS" : "WARN") : "WARN",
      message: subscriptionPresent
        ? statusActionablePass
          ? "Subscription status allows plan changes."
          : `Subscription status is ${status || "inactive"}.`
        : "Subscription status unavailable.",
      fixHint: subscriptionPresent
        ? statusActionablePass
          ? undefined
          : "Reactivate subscription from checkout or billing portal."
        : "Activate a paid plan to enable runtime billing actions."
    }
  ];

  return checks;
}

function buildSummary(checks: BillingDiagnosticChecks): BillingDiagnosticSummary {
  const overall = computeOverallStatus(checks);
  const hasConfigFail = checks.config.some((check) => check.status === "FAIL");
  const stripeReachFail = checks.stripe.some((check) => check.key === "stripeApiReachable" && check.status === "FAIL");
  const stripeCustomerLinked = checks.orgLinkage.find((check) => check.key === "stripeCustomerLinked")?.status === "PASS";
  const subscriptionPresent = checks.orgLinkage.find((check) => check.key === "subscriptionRecordPresent")?.status === "PASS";
  const subscriptionIdsPresent = checks.orgLinkage.find((check) => check.key === "subscriptionStripeIdsPresent")?.status === "PASS";
  const subscriptionStatusActionable = checks.orgLinkage.find((check) => check.key === "subscriptionStatusActionable")?.status === "PASS";

  return {
    overall,
    checkoutReady: !hasConfigFail && !stripeReachFail,
    changePlanReady: !hasConfigFail && !stripeReachFail && subscriptionPresent && subscriptionIdsPresent && subscriptionStatusActionable,
    customerPortalReady: !hasConfigFail && !stripeReachFail && stripeCustomerLinked,
    topIssues: flattenIssues(checks)
  };
}

export async function computeBillingDiagnostics(input: ComputeInput): Promise<BillingDiagnosticsPayload> {
  const now = input.now || new Date();
  const nowMs = now.getTime();
  const requestedDetailed = input.detailed && isAdminDetailedRole(input.auth.role);
  const timeoutMs = Number.isFinite(input.stripeTimeoutMs) ? Number(input.stripeTimeoutMs) : 2500;

  const context = await resolveOrgContext(input.prisma, input.auth);
  const cacheKeyValue = cacheKey(context.orgId, requestedDetailed);
  const limiterKeyValue = limiterKey({
    orgId: context.orgId,
    userId: input.auth.userId,
    detailed: requestedDetailed
  });

  const cached = getCached(cacheKeyValue, nowMs);
  if (cached) return cached;

  if (shouldRateLimit(limiterKeyValue, nowMs)) {
    const cacheFallback = getCached(cacheKeyValue, nowMs);
    if (cacheFallback) return cacheFallback;
    return makeRateLimitedFallback(now);
  }

  const config = buildConfigChecks(requestedDetailed);
  const stripe = await buildStripeChecks({
    stripe: input.stripe,
    detailed: requestedDetailed,
    timeoutMs
  });
  const orgLinkage = buildOrgLinkageChecks(context);
  const checks: BillingDiagnosticChecks = { config, stripe, orgLinkage };
  const summary = buildSummary(checks);

  const payload: BillingDiagnosticsPayload = requestedDetailed
    ? {
        summary,
        evaluatedAt: now.toISOString(),
        detailed: true,
        checks
      }
    : {
        summary,
        evaluatedAt: now.toISOString(),
        detailed: false
      };

  setCached(cacheKeyValue, payload, nowMs);
  return payload;
}
