import { SignJWT, jwtVerify } from 'jose';

import { env } from '../env';

export interface SessionClaims {
  userId: string;
  email: string;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.jwtSecret);
}

const ISSUER = 'mysihat-api';
const AUDIENCE = 'mysihat-app';

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

export function bearerToken(header: string | undefined): string | null {
  if (header === undefined) return null;
  const match = /^Bearer (.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}
