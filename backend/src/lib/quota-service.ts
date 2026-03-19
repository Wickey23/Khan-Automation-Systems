import { prisma } from "./prisma";
import { assertSystemEnabled } from "./system-flags";
import { redis } from "./redis";

/**
 * Hardened Outbound Safety Limits & Quotas using Redis.
 * Uses atomic increments to avoid race conditions.
 */

async function getDailyKey(prefix: string, orgId: string) {
  const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `quota:${prefix}:${orgId}:${dateStr}`;
}

export async function checkOrgMessagingQuota(orgId: string) {
  // Always check kill switch first
  await assertSystemEnabled("disableMessaging");

  const key = await getDailyKey("messages", orgId);
  const currentCount = await redis.get(key).then(v => parseInt(v || "0", 10));

  // Fetch limit from DB (cached or optimized in future)
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { maxMessagesPerDay: true }
  });

  if (!org) return { allowed: false, reason: "Org not found" };

  if (currentCount >= org.maxMessagesPerDay) {
    return { allowed: false, reason: "Daily message quota exceeded" };
  }

  return { allowed: true };
}

export async function incrementOrgMessageCount(orgId: string) {
  const key = await getDailyKey("messages", orgId);
  await redis.incr(key);
  // Set expiry to 48 hours to ensure cleanup but coverage for overlaps
  await redis.expire(key, 172800).catch(() => null); 

  // Async sync to DB for persistency/analytics (don't block)
  prisma.organization.update({
    where: { id: orgId },
    data: { messagesSentToday: { increment: 1 } }
  }).catch(err => console.error(`[Quota] Failed to sync message count to DB:`, err));
}

export async function checkOrgCallQuota(orgId: string) {
  const key = await getDailyKey("calls", orgId);
  const currentCount = await redis.get(key).then(v => parseInt(v || "0", 10));

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { maxCallsPerDay: true }
  });

  if (!org) return { allowed: false, reason: "Org not found" };

  if (currentCount >= org.maxCallsPerDay) {
    return { allowed: false, reason: "Daily call quota exceeded" };
  }

  return { allowed: true };
}

export async function incrementOrgCallCount(orgId: string) {
  const key = await getDailyKey("calls", orgId);
  await redis.incr(key);
  await redis.expire(key, 172800).catch(() => null);

  prisma.organization.update({
    where: { id: orgId },
    data: { callsHandledToday: { increment: 1 } }
  }).catch(err => console.error(`[Quota] Failed to sync call count to DB:`, err));
}
