import type { Request } from "express";

const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;

function clientKey(req: Request, scope: string) {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim();
  const ip = forwardedIp || req.ip || req.socket.remoteAddress || "unknown";
  return `${scope}:${ip}`;
}

export function consumeLeadRateLimit(req: Request, scope: "chat" | "form") {
  const key = clientKey(req, scope);
  const now = Date.now();
  const current = buckets.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + WINDOW_MS }
    : current;

  entry.count += 1;
  buckets.set(key, entry);

  return {
    allowed: entry.count <= MAX_REQUESTS,
    retryAfterSeconds: Math.ceil(Math.max(0, entry.resetAt - now) / 1000),
  };
}

export function isSubmissionTooFast(startedAt?: number) {
  return typeof startedAt === "number" && Date.now() - startedAt < 1200;
}

export function resetLeadRateLimitForTests() {
  buckets.clear();
}
