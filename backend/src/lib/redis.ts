import { Redis } from "ioredis";

function normalizeRedisUrl(raw: string | undefined) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).trim();
  }
  return value;
}

const REDIS_URL = normalizeRedisUrl(process.env.REDIS_URL);
const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.SECURITY_MODE === "production";
const DEFAULT_REDIS_URL = IS_PRODUCTION ? "" : "redis://localhost:6379";
const resolvedRedisUrl = REDIS_URL || DEFAULT_REDIS_URL;

if (IS_PRODUCTION && !resolvedRedisUrl) {
  throw new Error("REDIS_URL is required in production for queue/webhook reliability.");
}

if (resolvedRedisUrl) {
  process.env.REDIS_URL = resolvedRedisUrl;
}

let lastRedisErrorAt = 0;
let redisErrorSuppressed = 0;
const REDIS_ERROR_LOG_COOLDOWN_MS = 30_000;

export const redis = new Redis(resolvedRedisUrl || "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  connectTimeout: 10_000,
  retryStrategy: (attempt) => Math.min(attempt * 250, 5_000),
  lazyConnect: false
});

export function isRedisConfigured() {
  return Boolean(resolvedRedisUrl);
}

redis.on("error", (err) => {
  const now = Date.now();
  const shouldLog = now - lastRedisErrorAt > REDIS_ERROR_LOG_COOLDOWN_MS;
  if (shouldLog) {
    if (redisErrorSuppressed > 0) {
      console.error(`Redis connection errors suppressed: ${redisErrorSuppressed}`);
      redisErrorSuppressed = 0;
    }
    console.error("Redis connection error:", err);
    lastRedisErrorAt = now;
  } else {
    redisErrorSuppressed += 1;
  }
});
