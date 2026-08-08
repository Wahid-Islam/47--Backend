import type { VercelRequest, VercelResponse } from '@vercel/node';

import { env } from './env.ts';
import { bearerToken, verifySessionToken, type SessionClaims } from './auth/tokens.ts';

/**
 * An error with an HTTP status attached, so handlers can `throw` for any
 * failure and `withRoute` turns it into the right response.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly details: unknown;

  // Written out rather than using constructor parameter properties, which
  // Node's --experimental-strip-types rejects: it only erases types, and
  // parameter properties would need real code generated.
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const unauthorized = (message = 'Authentication required') => new HttpError(401, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

/**
 * Applies CORS headers for an allow-listed origin.
 *
 * A Flutter web app is a browser client on a different origin to the API, so
 * without this every request fails preflight. The allow-list comes from
 * config rather than being `*`, because `*` cannot be combined with
 * credentials and would let any site call the API with a user's token.
 */
function isLocalDevOrigin(origin: string): boolean {
  // Flutter web picks a random localhost port every run. In non-production
  // we accept any http://localhost / 127.0.0.1 origin so local development
  // works without constantly editing CORS_ALLOWED_ORIGINS.
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function applyCors(request: VercelRequest, response: VercelResponse): void {
  const origin = request.headers.origin;
  const allowed = env.corsAllowedOrigins;

  if (typeof origin === 'string') {
    const permitted =
      allowed.includes(origin) || (!env.isProduction && isLocalDevOrigin(origin));
    if (permitted) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
    }
  }

  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Max-Age', '86400');
}

type Handler = (request: VercelRequest, response: VercelResponse) => Promise<unknown>;

/**
 * Wraps a handler with CORS, preflight handling, method allow-listing and
 * error translation, so no individual route repeats any of it.
 *
 * A handler either returns a value (serialised as JSON with 200) or throws
 * an `HttpError`.
 */
export function withRoute(methods: string[], handler: Handler) {
  return async (request: VercelRequest, response: VercelResponse): Promise<void> => {
    applyCors(request, response);

    if (request.method === 'OPTIONS') {
      response.status(204).end();
      return;
    }

    if (request.method === undefined || !methods.includes(request.method)) {
      response.setHeader('Allow', methods.join(', '));
      response.status(405).json({ error: `Method ${request.method ?? 'unknown'} not allowed` });
      return;
    }

    try {
      const result = await handler(request, response);
      if (response.writableEnded) return;
      response.status(200).json(result ?? null);
    } catch (error) {
      if (error instanceof HttpError) {
        response.status(error.status).json({
          error: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        });
        return;
      }

      // Unexpected failure. Log the real reason for the operator, but never
      // return it -- stack traces and driver errors leak schema details.
      console.error('Unhandled error in API handler:', error);
      response.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Requires a valid session and returns its claims.
 *
 * This is the replacement for Supabase's Row Level Security. The returned
 * `userId` is the *only* acceptable source of identity for a query -- a
 * user id read from the request body or a query parameter would let any
 * caller read or overwrite another user's data.
 */
export async function requireUser(request: VercelRequest): Promise<SessionClaims> {
  const token = bearerToken(request.headers.authorization);
  if (token === null) throw unauthorized('Missing bearer token');

  const claims = await verifySessionToken(token);
  if (claims === null) throw unauthorized('Invalid or expired token');

  return claims;
}

/** Parses a JSON body, tolerating Vercel having already parsed it. */
export function jsonBody(request: VercelRequest): Record<string, unknown> {
  const body = request.body;

  if (body === undefined || body === null || body === '') return {};

  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw badRequest('Request body must be a JSON object');
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw badRequest('Request body is not valid JSON');
    }
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Request body must be a JSON object');
  }

  return body as Record<string, unknown>;
}
