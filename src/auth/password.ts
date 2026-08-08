import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Promise wrapper around `scrypt`.
 *
 * Hand-written rather than `promisify(scrypt)`, whose type overloads drop
 * the options argument and so reject the cost parameters below.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

/**
 * Password hashing with scrypt from Node's standard library.
 *
 * scrypt is deliberately chosen over bcrypt: it is memory-hard, it is a
 * built-in (so there is no native module to compile in a serverless build),
 * and it is the recommendation in Node's own crypto docs for password
 * storage.
 */

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// Cost parameters. N=2^15 keeps a single hash around 100ms on typical
// serverless hardware -- slow enough to make offline brute force expensive,
// fast enough not to blow a function's time budget. `maxmem` must be raised
// above the 32MB default because N*r*128 exceeds it.
const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 } as const;

/**
 * Hashes a plaintext password into a self-describing string:
 * `scrypt$N$r$p$<salt-base64url>$<hash-base64url>`
 *
 * The parameters are stored alongside the hash so they can be raised later
 * without invalidating existing passwords.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  const { N, r, p } = SCRYPT_PARAMS;
  return [
    'scrypt',
    N,
    r,
    p,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

/**
 * Verifies a password against a stored hash.
 *
 * Returns false rather than throwing on a malformed hash, so a corrupt row
 * fails the login instead of returning a 500 that tells an attacker the
 * account exists.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const expected = parts[5];
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (salt === undefined || expected === undefined) return false;

  const expectedBuffer = Buffer.from(expected, 'base64url');
  const derived = await scryptAsync(password, Buffer.from(salt, 'base64url'), expectedBuffer.length, {
    N,
    r,
    p,
    maxmem: 128 * 1024 * 1024,
  });

  // Constant-time comparison: a byte-by-byte `===` leaks how many leading
  // bytes matched through response timing.
  if (derived.length !== expectedBuffer.length) return false;
  return timingSafeEqual(derived, expectedBuffer);
}
