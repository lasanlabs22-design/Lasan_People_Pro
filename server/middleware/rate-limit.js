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

/**
 * The block an address belongs to, for rate-limit keys: IPv4 /24 and IPv6 /64. One visitor's
 * address often rotates inside such a block (carrier NAT, a phone moving between towers), and an
 * IPv6 user controls an entire /64, so per-address limits keyed on the exact address would be
 * trivial to walk around.
 */
export function addressBlock(ip) {
  const v4 = ip.match(/^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/i);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  if (ip.includes(":")) {
    // Expand "::" to the zero groups it stands for, then keep the first four groups.
    const [head, tail] = ip.toLowerCase().split("::");
    const left = head ? head.split(":") : [];
    const right = tail ? tail.split(":") : [];
    const groups = tail === undefined ? left : [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
    return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
  }
  return ip;
}
