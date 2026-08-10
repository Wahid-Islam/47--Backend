import type { VercelRequest, VercelResponse } from '@vercel/node';

import { env } from './env';
import { bearerToken, verifySessionToken, type SessionClaims } from './auth/tokens';

export class HttpError extends Error {
  readonly status: number;
  readonly details: unknown;

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

function isLocalDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function isAllowedFrontendOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname;
    if (host === 'mysihat-47.vercel.app' || host === '47-frontend.vercel.app') return true;
    // Vercel preview deployments for the frontend project.
    return host.endsWith('.vercel.app') && host.includes('47-frontend');
  } catch {
    return false;
  }
}

function applyCors(request: VercelRequest, response: VercelResponse): void {
  const origin = request.headers.origin;
  const allowed = env.corsAllowedOrigins;

  if (typeof origin === 'string') {
    const permitted =
      allowed.includes(origin) ||
      isAllowedFrontendOrigin(origin) ||
      (!env.isProduction && isLocalDevOrigin(origin));
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

      console.error('Unhandled error in API handler:', error);
      response.status(500).json({ error: 'Internal server error' });
    }
  };
}

export async function requireUser(request: VercelRequest): Promise<SessionClaims> {
  const token = bearerToken(request.headers.authorization);
  if (token === null) throw unauthorized('Missing bearer token');

  const claims = await verifySessionToken(token);
  if (claims === null) throw unauthorized('Invalid or expired token');

  return claims;
}

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
