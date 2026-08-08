/**
 * Environment access, validated once at module load.
 *
 * Reading `process.env` inline all over the codebase means a missing
 * variable shows up as a confusing runtime failure deep in a request.
 * Requiring it here turns that into a clear error on first import.
 */

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        'Run `vercel env pull .env.development.local`, or see .env.example.',
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value;
}

export const env = {
  get databaseUrl(): string {
    return required('DATABASE_URL');
  },

  /** Direct (non-pooled) connection, for DDL in migrations. */
  get databaseUrlUnpooled(): string {
    return optional('DATABASE_URL_UNPOOLED', required('DATABASE_URL'));
  },

  get jwtSecret(): string {
    const secret = required('JWT_SECRET');
    // 32 bytes is the minimum sensible key length for HS256. A short
    // secret is brute-forceable, which would let anyone mint valid
    // sessions for any user.
    if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long.');
    }
    return secret;
  },

  get jwtExpiresIn(): string {
    return optional('JWT_EXPIRES_IN', '7d');
  },

  get corsAllowedOrigins(): string[] {
    return optional('CORS_ALLOWED_ORIGINS', '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== '');
  },

  get isProduction(): boolean {
    return process.env.VERCEL_ENV === 'production';
  },
};
