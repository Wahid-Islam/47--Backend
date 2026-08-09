import { SignJWT, jwtVerify } from 'jose';

import { env } from '../env';

export interface SessionClaims {
  /** The user's id. Every user-scoped query filters on this. */
  userId: string;
  email: string;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.jwtSecret);
}

const ISSUER = 'mysihat-api';
const AUDIENCE = 'mysihat-app';

/** Signs a session token for a user. */
export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.jwtExpiresIn)
    .sign(secretKey());
}

/**
 * Verifies a session token and returns its claims, or null if the token is
 * missing, expired, tampered with, or issued for a different audience.
 *
 * `jwtVerify` checks the signature, `exp`, `iss` and `aud`. Pinning the
 * algorithm to HS256 matters: without it, a token could declare
 * `"alg": "none"` and skip signature verification entirely.
 */
export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    const userId = payload.sub;
    const email = payload.email;
    if (typeof userId !== 'string' || typeof email !== 'string') return null;

    return { userId, email };
  } catch {
    return null;
  }
}

/** Extracts a bearer token from an Authorization header value. */
export function bearerToken(header: string | undefined): string | null {
  if (header === undefined) return null;
  const match = /^Bearer (.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}
