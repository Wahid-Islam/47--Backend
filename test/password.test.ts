import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { hashPassword, verifyPassword } from '../src/auth/password.ts';

describe('password hashing', () => {
  it('accepts the correct password', async () => {
    const hash = await hashPassword('demo1234');

    assert.equal(await verifyPassword('demo1234', hash), true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('demo1234');

    assert.equal(await verifyPassword('demo12345', hash), false);
    assert.equal(await verifyPassword('', hash), false);
  });

  it('salts every hash, so identical passwords do not collide', async () => {
    const first = await hashPassword('same-password');
    const second = await hashPassword('same-password');

    assert.notEqual(first, second);
    assert.equal(await verifyPassword('same-password', first), true);
    assert.equal(await verifyPassword('same-password', second), true);
  });

  it('records its parameters so they can be raised later', async () => {
    const hash = await hashPassword('demo1234');

    const [algorithm, n, r, p] = hash.split('$');
    assert.equal(algorithm, 'scrypt');
    assert.equal(n, '32768');
    assert.equal(r, '8');
    assert.equal(p, '1');
  });

  it('returns false for a malformed hash instead of throwing', async () => {
    // A corrupt row must fail the login, not return a 500 that confirms the
    // account exists.
    assert.equal(await verifyPassword('demo1234', ''), false);
    assert.equal(await verifyPassword('demo1234', 'not-a-hash'), false);
    assert.equal(await verifyPassword('demo1234', 'bcrypt$1$2$3$4$5'), false);
    assert.equal(await verifyPassword('demo1234', 'scrypt$x$8$1$c2FsdA$aGFzaA'), false);
  });
});
