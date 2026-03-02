import { type PrismaClient } from "@prisma/client";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export function isActiveSubscriptionStatus(status: string | null | undefined) {
  return ACTIVE_STATUSES.has(String(status || "").toLowerCase());
}

export async function hasProMessaging(prisma: PrismaClient, orgId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    select: { plan: true, status: true }
  });
  if (!subscription) return false;
  return subscription.plan === "PRO" && isActiveSubscriptionStatus(subscription.status);
}
