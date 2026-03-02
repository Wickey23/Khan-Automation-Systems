export type PlanName = "NONE" | "STARTER" | "PRO";

export type PlanFeatureAccess = {
  plan: PlanName;
  isActive: boolean;
  proEnabled: boolean;
  messaging: boolean;
  analytics: boolean;
  automationTools: boolean;
};

function normalizePlan(value?: string | null): PlanName {
  const plan = String(value || "").toUpperCase();
  if (plan === "STARTER") return "STARTER";
  if (plan === "PRO") return "PRO";
  return "NONE";
}

function isActiveStatus(value?: string | null) {
  const status = String(value || "").toLowerCase();
  return status === "active" || status === "trialing";
}

export function resolvePlanFeatures(input: { plan?: string | null; status?: string | null }): PlanFeatureAccess {
  const plan = normalizePlan(input.plan);
  const isActive = isActiveStatus(input.status);
  const proEnabled = plan === "PRO" && isActive;

  return {
    plan,
    isActive,
    proEnabled,
    messaging: proEnabled,
    analytics: proEnabled,
    automationTools: proEnabled
  };
}
