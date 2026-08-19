import { NextFunction, Request, Response } from "express";
import { logEvent } from "../lib/logging";

interface RateLimitOptions {
    name: string;
    windowMs: number;
    max: number;
}

interface RateLimitBucket {
    count: number;
    resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

export function createRateLimit(options: RateLimitOptions) {
    return (req: Request, res: Response, next: NextFunction) => {
        const now = Date.now();
        const identity = req.ip || req.socket.remoteAddress || "unknown";
        const key = `${options.name}:${identity}`;
        const current = buckets.get(key);
        const bucket = !current || current.resetAt <= now
            ? { count: 0, resetAt: now + options.windowMs }
            : current;

        bucket.count += 1;
        buckets.set(key, bucket);

        res.setHeader("RateLimit-Limit", String(options.max));
        res.setHeader("RateLimit-Remaining", String(Math.max(0, options.max - bucket.count)));
        res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

        if (bucket.count > options.max) {
            const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
            res.setHeader("Retry-After", String(retryAfterSeconds));
            logEvent("warn", "rate_limit_exceeded", {
                limiter: options.name,
                method: req.method,
                path: req.path,
                ip: identity,
            });
            return res.status(429).json({ ok: false, error: "TOO_MANY_REQUESTS" });
        }

        if (buckets.size > 10_000) {
            for (const [bucketKey, value] of buckets) {
                if (value.resetAt <= now) buckets.delete(bucketKey);
            }
        }

        next();
    };
}
