import type { VercelRequest } from '@vercel/node';

import { HttpError } from './http';

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

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

/** Best-effort in-memory sliding window (per serverless instance). */
export function assertRateLimit(
  request: VercelRequest,
  scope: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): void {
  const key = clientKey(request, scope);
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= limit) {
    throw new HttpError(429, 'Too many requests. Please try again shortly.');
  }
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
}
