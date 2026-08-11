import type { VercelRequest } from '@vercel/node';

import { HttpError } from './http';

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5_000;

function clientKey(request: VercelRequest, scope: string): string {
  const forwarded = request.headers['x-forwarded-for'];
  const realIp = request.headers['x-real-ip'];
  const ip =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0]?.trim()
      : Array.isArray(forwarded)
        ? forwarded[0]
        : typeof realIp === 'string'
          ? realIp
          : 'unknown';
  return `${scope}:${ip || 'unknown'}`;
}

function pruneExpired(bucket: Bucket, now: number, windowMs: number): void {
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
}

/** Best-effort in-memory sliding window (per serverless instance). */
export function assertRateLimit(
  request: VercelRequest,
  scope: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): void {
  const key = clientKey(request, scope);
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  pruneExpired(bucket, now, windowMs);

  if (bucket.timestamps.length >= limit) {
    buckets.set(key, bucket);
    throw new HttpError(429, 'Too many requests. Please try again shortly.');
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);

  // Bound memory: drop oldest idle keys when the map grows large.
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) {
      pruneExpired(b, now, windowMs);
      if (b.timestamps.length === 0) buckets.delete(k);
      if (buckets.size <= MAX_KEYS * 0.8) break;
    }
  }
}
