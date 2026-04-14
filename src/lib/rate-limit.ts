import { NextRequest } from "next/server";

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  /** Unix timestamp (ms) when the window resets */
  resetAt: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Unix timestamp (ms) when the window resets */
  resetAt: number;
  /** Seconds until reset (for Retry-After header) */
  retryAfterSeconds: number;
}

// Module-level store. One entry per "<prefix>:<ip>" key.
// The Map is capped at MAX_ENTRIES to bound memory usage.
const MAX_ENTRIES = 10_000;
const store = new Map<string, RateLimitEntry>();

function evictExpired(now: number): void {
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}

/**
 * Check and increment the rate limit for a given key.
 * Returns whether the request is allowed and metadata for response headers.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();

  // Periodically evict expired entries to bound memory usage.
  if (store.size >= MAX_ENTRIES) {
    evictExpired(now);
  }

  const existing = store.get(key);

  if (existing && now < existing.resetAt) {
    // Active window
    if (existing.count >= config.limit) {
      return {
        success: false,
        limit: config.limit,
        remaining: 0,
        resetAt: existing.resetAt,
        retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
      };
    }
    existing.count += 1;
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - existing.count,
      resetAt: existing.resetAt,
      retryAfterSeconds: 0,
    };
  }

  // New window (either first request or previous window expired)
  const resetAt = now + config.windowMs;
  store.set(key, { count: 1, resetAt });
  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - 1,
    resetAt,
    retryAfterSeconds: 0,
  };
}

/**
 * Extract the client IP from a Next.js request.
 * Falls back to "unknown" if the IP cannot be determined.
 */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// Pre-configured limiters for each auth endpoint

/** Login / mobile auth: 5 attempts per 15 minutes */
export const loginLimiter: RateLimitConfig = {
  limit: 5,
  windowMs: 15 * 60 * 1000,
};

/** Registration: 10 attempts per hour */
export const registerLimiter: RateLimitConfig = {
  limit: 10,
  windowMs: 60 * 60 * 1000,
};

/** Token refresh: 20 attempts per 15 minutes */
export const refreshLimiter: RateLimitConfig = {
  limit: 20,
  windowMs: 15 * 60 * 1000,
};
