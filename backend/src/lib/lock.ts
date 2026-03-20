import { redis } from "./redis";

/**
 * Distributed lock using Redis SET NX.
 * Returns true if lock acquired, false otherwise.
 */
export async function acquireLock(key: string, ttlMs: number): Promise<boolean> {
  const fullKey = `lock:${key}`;
  try {
    const result = await redis.set(fullKey, "locked", "PX", ttlMs, "NX");
    return result === "OK";
  } catch (error) {
    console.error(`[Lock] Failed to acquire lock ${key}`, error);
    return false;
  }
}

export async function releaseLock(key: string): Promise<void> {
  const fullKey = `lock:${key}`;
  try {
    await redis.del(fullKey);
  } catch (error) {
    console.error(`[Lock] Failed to release lock ${key}`, error);
  }
}
