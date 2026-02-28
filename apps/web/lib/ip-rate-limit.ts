import { NextRequest } from "next/server";

type Bucket = { resetAt: number; count: number };

const globalForRateLimit = globalThis as unknown as {
  __aflIpRateLimit?: Map<string, Bucket>;
};

function store(): Map<string, Bucket> {
  if (!globalForRateLimit.__aflIpRateLimit) globalForRateLimit.__aflIpRateLimit = new Map();
  return globalForRateLimit.__aflIpRateLimit;
}

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  const ip = xff?.split(",")[0]?.trim();
  if (ip) return ip;
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

export function enforceIpRateLimit(req: NextRequest, input: { key: string; limit: number; windowMs: number }) {
  const now = Date.now();
  const ip = getClientIp(req);
  const bucketKey = `${ip}:${input.key}`;
  const map = store();
  const existing = map.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    map.set(bucketKey, { resetAt: now + input.windowMs, count: 1 });
    return { ok: true as const, remaining: input.limit - 1, resetAt: now + input.windowMs };
  }
  existing.count += 1;
  map.set(bucketKey, existing);
  if (existing.count > input.limit) {
    return { ok: false as const, remaining: 0, resetAt: existing.resetAt };
  }
  return { ok: true as const, remaining: Math.max(0, input.limit - existing.count), resetAt: existing.resetAt };
}

