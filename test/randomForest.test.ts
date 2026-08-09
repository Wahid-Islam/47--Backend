import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  recommendHabitsWithRandomForest,
} from '../src/services/randomForestRecommendations.ts';

describe('recommendHabitsWithRandomForest', () => {
  it('returns 4 habits and ranks smoke-free highly for smokers', () => {
    const result = recommendHabitsWithRandomForest({
      age: 48,
      gender: 'male',
      activityLevel: 'low',
      dietHabit: 'unhealthy',
      smoking: true,
      bmi: 29,
      alcohol: 'occasional',
      sleepHours: 5.5,
      highBloodPressure: true,
      healthAge: 55,
    });

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
      healthAge: 40,
    });

    assert.equal(result.habits[0]?.id === 'smoke_free_day', false);
  });
});
