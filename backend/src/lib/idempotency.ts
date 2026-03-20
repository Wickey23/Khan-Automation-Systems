import { redis } from "./redis";

interface ExecuteOnceOptions<T> {
  key: string;
  ttlMs: number;
  handler: () => Promise<T>;
}

/**
 * Hardened Idempotency Layer using Redis.
 * Uses SET NX to ensure atomicity across instances.
 */
export async function executeOnce<T>({ key, ttlMs, handler }: ExecuteOnceOptions<T>): Promise<T | void> {
  const fullKey = `idempotency:${key}`;
  let acquired: string | null = null;
  try {
    // 1. Atomically try to acquire the lock/key
    // NX = Only set if not exists
    // PX = Set expiration in milliseconds
    acquired = await redis.set(fullKey, "processing", "PX", ttlMs, "NX");
  } catch (error) {
    // Fail open so Redis instability does not drop inbound webhooks.
    console.error(`[Idempotency] Redis unavailable for key ${key}, continuing without dedupe.`, error);
    return handler();
  }

  if (!acquired) {
    console.log(`[Idempotency] Key ${key} already exists or is processing, skipping.`);
    return;
  }

  try {
    // 2. Execute the handler
    const result = await handler();
    
    // 3. Update key to 'completed' but preserve expiry window.
    // Not all Redis versions support KEEPTTL; fall back to explicit PX.
    try {
      await redis.set(fullKey, "completed", "KEEPTTL");
    } catch {
      await redis.set(fullKey, "completed", "PX", ttlMs).catch(() => null);
    }
    
    return result;
  } catch (error) {
    // 4. If execution fails, delete the key so it can be retried immediately
    await redis.del(fullKey).catch(() => null);
    throw error;
  }
}

/**
 * Placeholder for cleanup. 
 * Note: Redis automatically cleanups keys via TTL, so manual deleteMany is no longer needed.
 */
export async function cleanupExpiredIdempotencyKeys() {
  // No-op for Redis
  return Promise.resolve();
}
