import { SubscriptionPlan } from "@prisma/client";

export function isTeamFeatureAvailableForSubscription(input: {
  plan: SubscriptionPlan | null | undefined;
  status: string | null | undefined;
}) {
  const normalizedStatus = String(input.status || "").toLowerCase();
  const active = normalizedStatus === "active" || normalizedStatus === "trialing";
  return input.plan === SubscriptionPlan.PRO && active;
}

