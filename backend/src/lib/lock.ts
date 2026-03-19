import { redis } from "./redis";

/**
 * Distributed lock using Redis SET NX.
 * Returns true if lock acquired, false otherwise.
 */
export async function acquireLock(key: string, ttlMs: number): Promise<boolean> {
  const fullKey = `lock:${key}`;
  const result = await redis.set(fullKey, "locked", "PX", ttlMs, "NX");
  return result === "OK";
}

export async function releaseLock(key: string): Promise<void> {
  const fullKey = `lock:${key}`;
  await redis.del(fullKey);
}
