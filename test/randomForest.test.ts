import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  profileToFeatures,
  recommendHabitsWithRandomForest,
} from '../src/services/randomForestRecommendations';

const base = {
  age: 48,
  gender: 'male',
  activityLevel: 'low',
  dietHabit: 'unhealthy',
  smoking: true,
  bmi: 29,
  alcohol: 'occasional',
  sleepHours: 5.5,
  highBloodPressure: true,
  diabetes: false,
} as const;

describe('recommendHabitsWithRandomForest', () => {
  it('returns 4 habits and ranks smoke-free highly for smokers', () => {
    const result = recommendHabitsWithRandomForest({ ...base });

    assert.equal(result.habits.length, 4);
    assert.ok((result.scores.smoke_free_day ?? 0) > 0.4);
    assert.ok(result.habits.some((h) => h.id === 'smoke_free_day' || h.id === 'walk_20'));
  });

  it('does not prefer smoke-free for non-smokers', () => {
    const result = recommendHabitsWithRandomForest({
      age: 42,
      gender: 'female',
      activityLevel: 'high',
      dietHabit: 'healthy',
      smoking: false,
      bmi: 22,
      alcohol: 'none',
      sleepHours: 8,
      highBloodPressure: false,
      diabetes: false,
    });

    assert.equal(result.habits[0]?.id === 'smoke_free_day', false);
  });

  it('raises diabetes-related habit scores when diabetes is true', () => {
    const without = recommendHabitsWithRandomForest({ ...base, smoking: false, diabetes: false });
    const withDiabetes = recommendHabitsWithRandomForest({ ...base, smoking: false, diabetes: true });

    assert.ok((withDiabetes.scores.no_sugary_drink ?? 0) > (without.scores.no_sugary_drink ?? 0));
    assert.ok((withDiabetes.scores.brown_rice_meal ?? 0) > (without.scores.brown_rice_meal ?? 0));
  });

  it('does not encode gender other as male', () => {
    const features = profileToFeatures(
      {
        ...base,
        gender: 'other',
        smoking: false,
        diabetes: false,
      },
      ['gender_male', 'gender_female', 'gender_other', 'diabetes'],
    );
    assert.deepEqual(features, [0, 0, 1, 0]);
  });
});
