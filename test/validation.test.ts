import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HttpError } from '../src/http.ts';
import { parseProfileInput } from '../src/profileInput.ts';
import { requireDateKey, requireEmail, requirePassword } from '../src/validation.ts';

const validProfile = {
  full_name: 'Lim Wei Jian',
  age: 48,
  gender: 'male',
  state: 'Wilayah Persekutuan Kuala Lumpur',
  activity_level: 'low',
  diet_habit: 'unhealthy',
  smoking: true,
  bmi: 27.4,
  high_blood_pressure: true,
  onboarding_complete: true,
  locale: 'en',
  active_action_ids: ['walk_20'],
};

function rejects(body: Record<string, unknown>, expectedFragment: string): void {
  assert.throws(
    () => parseProfileInput(body, null),
    (error: unknown) => {
      assert.ok(error instanceof HttpError, 'expected an HttpError');
      assert.equal(error.status, 400);
      assert.match(error.message, new RegExp(expectedFragment));
      return true;
    },
  );
}

describe('profile validation', () => {
  it('accepts a valid questionnaire submission', () => {
    const parsed = parseProfileInput({ ...validProfile }, 'fallback@example.com');

    assert.equal(parsed.fullName, 'Lim Wei Jian');
    assert.equal(parsed.age, 48);
    assert.equal(parsed.bmi, 27.4);
    assert.equal(parsed.email, 'fallback@example.com');
    assert.deepEqual(parsed.activeActionIds, ['walk_20']);
  });

  it('enforces the same age and BMI bounds as the Flutter form', () => {
    rejects({ ...validProfile, age: 17 }, 'age');
    rejects({ ...validProfile, age: 91 }, 'age');
    rejects({ ...validProfile, bmi: 9 }, 'bmi');
    rejects({ ...validProfile, bmi: 61 }, 'bmi');
  });

  it('rejects values outside the allowed enums', () => {
    rejects({ ...validProfile, gender: 'unknown' }, 'gender');
    rejects({ ...validProfile, activity_level: 'extreme' }, 'activity_level');
    rejects({ ...validProfile, diet_habit: 'keto' }, 'diet_habit');
    rejects({ ...validProfile, locale: 'fr' }, 'locale');
  });

  it('requires the mandatory fields', () => {
    const { full_name: _omitted, ...withoutName } = validProfile;
    rejects(withoutName, 'full_name');
  });

  it('ignores a caller-supplied id, so it cannot target another user', () => {
    const parsed = parseProfileInput({ ...validProfile, id: 'someone-else' }, null);

    assert.equal('id' in parsed, false);
  });
});

describe('field validators', () => {
  it('normalises email case', () => {
    assert.equal(requireEmail({ email: '  Lim@Example.COM ' }), 'lim@example.com');
  });

  it('rejects malformed email', () => {
    assert.throws(() => requireEmail({ email: 'not-an-email' }), HttpError);
    assert.throws(() => requireEmail({ email: 'a@b' }), HttpError);
  });

  it('enforces password length at both ends', () => {
    assert.equal(requirePassword({ password: 'demo1234' }), 'demo1234');
    assert.throws(() => requirePassword({ password: 'short' }), HttpError);
    assert.throws(() => requirePassword({ password: 'x'.repeat(201) }), HttpError);
  });

  it('defaults a missing date to today and rejects bad formats', () => {
    assert.match(requireDateKey(undefined), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(requireDateKey('2026-08-08'), '2026-08-08');
    assert.throws(() => requireDateKey('08/08/2026'), HttpError);
    assert.throws(() => requireDateKey('2026-13-45'), HttpError);
  });
});
