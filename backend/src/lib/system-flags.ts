import { prisma } from "./prisma";
import { redis } from "./redis";

export class SystemDisabledError extends Error {
  constructor(public flagName: string) {
    super(`System process '${flagName}' is currently disabled for maintenance.`);
    this.name = "SystemDisabledError";
  }
}
export async function isSystemDisabled(flagName: string): Promise<boolean> {
  const cacheKey = `system_flag:${flagName}`;
  
  // 1. Try Redis cache
  const cached = await redis.get(cacheKey);
  if (cached !== null) {
    return cached === "true";
  }

  // 2. Fetch from DB (Singleton)
  const config = await prisma.systemFlag.findUnique({
    where: { id: "singleton" }
  });

  const value = config ? (config as any)[flagName] === true : false;

  // 3. Cache for 10 seconds to reduce DB load
  await redis.set(cacheKey, String(value), "EX", 10).catch(() => null);

  return value;
}

export async function assertSystemEnabled(flagName: string): Promise<void> {
  const disabled = await isSystemDisabled(flagName);
  if (disabled) {
    throw new SystemDisabledError(flagName);
  }
}
