import type { PrismaClient } from "@prisma/client";
import { isActiveSubscriptionStatus } from "../billing/plan-features";

export async function hasActiveBilling(prisma: PrismaClient, orgId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    select: { status: true }
  });
  return isActiveSubscriptionStatus(subscription?.status);
}
