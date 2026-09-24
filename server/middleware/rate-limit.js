import { rateLimits } from "../db/client.js";
import { ApiError } from "../lib/errors.js";

/**
 * Fixed-window attempt counter stored in Postgres (app.rate_limits), so limits survive restarts
 * and are shared by every instance. `name` namespaces the keys of one limiter.
 */
export function createLimiter({ name, windowMs, max }) {
  const windowSeconds = Math.ceil(windowMs / 1000);
  const k = (key) => `${name}:${key}`;
  return {
    /** Throws 429 when `key` has used up its attempts for this window. */
    async check(key) {
      const { count, retryAfter } = await rateLimits.peek(k(key));
      if (count >= max) {
        const err = new ApiError(429, "Too many attempts. Please wait a few minutes and try again.", "rate_limited");
        err.retryAfter = Math.max(retryAfter, 1);
        throw err;
      }
    },
    async exceeded(key) {
      return (await rateLimits.peek(k(key))).count >= max;
    },
    hit: (key) => rateLimits.hit(k(key), windowSeconds),
    reset: (key) => rateLimits.reset(k(key)),
  };
}

/**
 * The visitor's address, as seen by our own proxy. Railway's edge appends the address it received
 * the connection from to X-Forwarded-For, so the LAST entry is the one a caller can't forge; any
 * entries before it are whatever the caller chose to send. Pages call the API in-process and pass
 * the address along in x-lasan-client-ip (which /api strips from outside requests).
 */
export function clientIp(c) {
  return (
    c.req.header("x-lasan-client-ip") ||
    lastForwarded(c.req.header("x-forwarded-for")) ||
    c.env?.incoming?.socket?.remoteAddress ||
    "unknown"
  );
}

export function lastForwarded(header) {
  const hops = (header ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return hops.at(-1) ?? null;
}
