import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseActionIds, parseHabitIds } from '../src/catalog/ids';
import { HttpError } from '../src/http';
import { parseProfileInput } from '../src/profileInput';
import { parseInsightsPayload } from '../src/services/insightsPayload';
import {
  answersToProfileBody,
  assertQuestionnaireComplete,
} from '../src/services/questionnaireToProfile';
import { profileToFeatures } from '../src/services/randomForestRecommendations';
import { todayInAppTz } from '../src/time';
import { requireDateKey, requireEmail, requirePassword } from '../src/validation';

const validProfile = {
  full_name: 'Lim Wei Jian',
  age: 48,
  gender: 'male',
  state: 'Wilayah Persekutuan Kuala Lumpur',
  activity_level: 'low',
  diet_habit: 'unhealthy',
  smoking: true,
  height_cm: 170,
  weight_kg: 79.2,
  bmi: 59,
  alcohol: 'occasional',
  sleep_hours: 5.5,
  high_blood_pressure: true,
  diabetes: false,
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
    assert.ok(parsed.bmi > 27 && parsed.bmi < 28);
    assert.equal(parsed.heightCm, 170);
    assert.equal(parsed.alcohol, 'occasional');
    assert.equal(parsed.sleepHours, 5.5);
    assert.equal(parsed.email, 'fallback@example.com');
    assert.equal(parsed.diabetes, false);
    assert.deepEqual(parsed.activeActionIds, ['walk_20']);
  });

  it('always derives BMI from height and weight (ignores client bmi)', () => {
    const parsed = parseProfileInput({ ...validProfile, bmi: 59 }, null);
    assert.ok(parsed.bmi > 27 && parsed.bmi < 28);
    assert.notEqual(parsed.bmi, 59);
  });

  it('requires high_blood_pressure and diabetes', () => {
    const { high_blood_pressure: _h, ...withoutBp } = validProfile;
    rejects(withoutBp, 'high_blood_pressure');
    const { diabetes: _d, ...withoutDiabetes } = validProfile;
    rejects(withoutDiabetes, 'diabetes');
  });

  it('preserves existing action ids when the field is omitted', () => {
    const { active_action_ids: _omit, ...withoutActions } = validProfile;
    const parsed = parseProfileInput(withoutActions, null, {
      existingActionIds: ['bp_screening', 'hydrate'],
    });
    assert.deepEqual(parsed.activeActionIds, ['bp_screening', 'hydrate']);
  });

  it('enforces age and body-measure bounds', () => {
    rejects({ ...validProfile, age: 17 }, 'age');
    rejects({ ...validProfile, age: 91 }, 'age');
    rejects({ ...validProfile, height_cm: 90 }, 'height_cm');
    rejects({ ...validProfile, weight_kg: 20 }, 'weight_kg');
    rejects({ ...validProfile, sleep_hours: 2 }, 'sleep_hours');
  });

  it('rejects values outside the allowed enums', () => {
    rejects({ ...validProfile, gender: 'unknown' }, 'gender');
    rejects({ ...validProfile, activity_level: 'extreme' }, 'activity_level');
    rejects({ ...validProfile, diet_habit: 'keto' }, 'diet_habit');
    rejects({ ...validProfile, alcohol: 'daily' }, 'alcohol');
    rejects({ ...validProfile, locale: 'fr' }, 'locale');
  });

  it('accepts zh locale', () => {
    const parsed = parseProfileInput({ ...validProfile, locale: 'zh' }, null);
    assert.equal(parsed.locale, 'zh');
  });

  it('requires the mandatory fields', () => {
    const { full_name: _omitted, ...withoutName } = validProfile;
    rejects(withoutName, 'full_name');
  });

  it('ignores a caller-supplied profile email (auth email wins)', () => {
    const parsed = parseProfileInput(
      { ...validProfile, email: 'spoof@evil.example' },
      'real@example.com',
    );
    assert.equal(parsed.email, 'real@example.com');
  });

  it('ignores a caller-supplied id, so it cannot target another user', () => {
    const parsed = parseProfileInput({ ...validProfile, id: 'someone-else' }, null);

    assert.equal('id' in parsed, false);
  });
});

describe('questionnaire completeness', () => {
  it('rejects an empty answers object', () => {
    assert.throws(() => assertQuestionnaireComplete({}), HttpError);
    assert.throws(() => answersToProfileBody({}, null), HttpError);
  });

  it('accepts a complete camelCase answers payload', () => {
    const body = answersToProfileBody(
      {
        age: 48,
        sex: 'male',
        smoking: true,
        heightCm: 170,
        weightKg: 79.2,
        activityLevel: 'low',
        diet: 'unhealthy',
        alcohol: 'occasional',
        sleepHours: 5.5,
        highBloodPressure: true,
        diabetes: false,
      },
      null,
    );
    assert.equal(body.onboarding_complete, true);
    assert.equal(body.age, 48);
    assert.equal(body.gender, 'male');
  });
});

describe('insights payload', () => {
  it('keeps allowlisted fields and drops unknown ones', () => {
    const parsed = parseInsightsPayload({
      payload: {
        healthAge: 55,
        actualAge: 48,
        disclaimer: 'ok',
        evilField: 'drop-me',
      },
    });
    assert.equal(parsed.healthAge, 55);
    assert.equal(parsed.actualAge, 48);
    assert.equal(parsed.healthAgeDelta, 7);
    assert.equal(parsed.disclaimer, 'ok');
    assert.equal('evilField' in parsed, false);
  });
});

describe('id allowlists', () => {
  it('rejects unknown habit and action identifiers', () => {
    assert.throws(() => parseHabitIds(['not_a_habit']), HttpError);
    assert.throws(() => parseActionIds(['not_an_action']), HttpError);
    assert.deepEqual(parseHabitIds(['walk_20', 'walk_20']), ['walk_20']);
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

  it('defaults a missing date to Malaysia local today and rejects invalid calendar dates', () => {
    assert.equal(requireDateKey(undefined), todayInAppTz());
    assert.equal(requireDateKey('2026-08-08'), '2026-08-08');
    assert.throws(() => requireDateKey('08/08/2026'), HttpError);
    assert.throws(() => requireDateKey('2026-13-45'), HttpError);
    assert.throws(() => requireDateKey('2026-02-30'), HttpError);
  });
});

describe('gender feature encoding', () => {
  it('encodes other separately from male', () => {
    const names = [
      'gender_male',
      'gender_female',
      'gender_other',
    ];
    const other = profileToFeatures(
      {
        age: 40,
        gender: 'other',
        activityLevel: 'moderate',
        dietHabit: 'average',
        smoking: false,
        bmi: 24,
        alcohol: 'none',
        sleepHours: 7,
        highBloodPressure: false,
        diabetes: false,
      },
      names,
    );
    assert.deepEqual(other, [0, 0, 1]);
  });
});
