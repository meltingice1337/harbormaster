import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitConfig = {
  name: string;
  windowMs: number;
  max: number;
  countOn?: (res: Response) => boolean;
  clearOn?: (res: Response) => boolean;
};

const defaultCountOn = (res: Response) => res.status === 401 || res.status === 403;
const defaultClearOn = (res: Response) => res.status >= 200 && res.status < 300;

export function withRateLimit<Args extends unknown[]>(
  handler: (req: Request, ...rest: Args) => Promise<Response> | Response,
  config: RateLimitConfig,
): (req: Request, ...rest: Args) => Promise<Response> {
  const countOn = config.countOn ?? defaultCountOn;
  const clearOn = config.clearOn ?? defaultClearOn;

  return async (req, ...rest) => {
    const key = `${config.name}:${clientIp(req)}`;
    const now = Date.now();
    const existing = buckets.get(key);

    if (existing && existing.resetAt > now && existing.count >= config.max) {
      const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
      return NextResponse.json(
        { ok: false, error: "too many attempts" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const res = await handler(req, ...rest);

    if (clearOn(res)) {
      buckets.delete(key);
    } else if (countOn(res)) {
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + config.windowMs });
      } else {
        bucket.count += 1;
      }
    }

    return res;
  };
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
