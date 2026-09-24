import { ApiError } from "../lib/errors.js";

/**
 * Fixed-window in-memory failure counter. Good enough for a single instance;
 * swap the Map for Redis when running more than one replica.
 */
export function createLimiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs).unref();

  return {
    /** Throws 429 when `key` has used up its attempts for this window. */
    check(key) {
      const entry = hits.get(key);
      const now = Date.now();
      if (entry && entry.reset > now && entry.count >= max) {
        const err = new ApiError(429, "Too many attempts. Please wait a few minutes and try again.", "rate_limited");
        err.retryAfter = Math.ceil((entry.reset - now) / 1000);
        throw err;
      }
    },
    hit(key) {
      const entry = hits.get(key);
      const now = Date.now();
      if (!entry || entry.reset <= now) hits.set(key, { count: 1, reset: now + windowMs });
      else entry.count++;
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

/**
 * The browser never calls the API directly — the Next.js server does — so the
 * socket address is the web server's. It forwards the visitor's IP in
 * x-lasan-client-ip; fall back to proxy headers for direct callers.
 */
export function clientIp(c) {
  return (
    c.req.header("x-lasan-client-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0].trim() ||
    c.req.header("x-real-ip") ||
    c.env?.incoming?.socket?.remoteAddress ||
    "unknown"
  );
}
