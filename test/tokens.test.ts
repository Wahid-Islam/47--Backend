import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';

import { bearerToken, signSessionToken, verifySessionToken } from '../src/auth/tokens.ts';

describe('session tokens', () => {
  before(() => {
    process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-32';
    process.env.JWT_EXPIRES_IN = '1h';
  });

  it('round-trips the user id and email', async () => {
    const token = await signSessionToken({ userId: 'user-1', email: 'a@b.com' });

    assert.deepEqual(await verifySessionToken(token), { userId: 'user-1', email: 'a@b.com' });
  });

  it('rejects a tampered payload', async () => {
    const token = await signSessionToken({ userId: 'user-1', email: 'a@b.com' });
    const [header, payload, signature] = token.split('.');

    // Re-encode the payload with a different subject, keeping the original
    // signature. This is the attack the signature check exists to stop.
    const forged = Buffer.from(
      JSON.stringify({ sub: 'user-2', email: 'a@b.com' }),
      'utf8',
    ).toString('base64url');

    assert.equal(await verifySessionToken(`${header}.${forged}.${signature}`), null);
    assert.equal(await verifySessionToken(`${header}.${payload}.abc`), null);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signSessionToken({ userId: 'user-1', email: 'a@b.com' });
    process.env.JWT_SECRET = 'a-completely-different-secret-32-chars-long';

    assert.equal(await verifySessionToken(token), null);

    process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-32';
  });

  it('rejects an expired token', async () => {
    process.env.JWT_EXPIRES_IN = '-1s';
    const token = await signSessionToken({ userId: 'user-1', email: 'a@b.com' });
    process.env.JWT_EXPIRES_IN = '1h';

    assert.equal(await verifySessionToken(token), null);
  });

  it('rejects garbage', async () => {
    assert.equal(await verifySessionToken(''), null);
    assert.equal(await verifySessionToken('not.a.jwt'), null);
  });

  it('parses bearer headers and ignores anything else', () => {
    assert.equal(bearerToken('Bearer abc123'), 'abc123');
    assert.equal(bearerToken('bearer abc123'), 'abc123');
    assert.equal(bearerToken(undefined), null);
    assert.equal(bearerToken('Basic abc123'), null);
    assert.equal(bearerToken('abc123'), null);
  });
});
