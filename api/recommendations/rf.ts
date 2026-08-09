import { HttpError, requireUser, withRoute } from '../../src/http.ts';
import { findInsights } from '../../src/repositories/insights.ts';
import { findProfile } from '../../src/repositories/profiles.ts';
import type { ProfileContext } from '../../src/services/profileContext.ts';
import {
  habitMeta,
  reasonForHabit,
  recommendHabitsWithRandomForest,
} from '../../src/services/randomForestRecommendations.ts';

/**
 * GET /api/recommendations/rf
 * Personalised daily habits from the on-device Random Forest model.
 */
export default withRoute(['GET'], async (request) => {
  const { userId } = await requireUser(request);
  const profile = await findProfile(userId);
  if (profile === null) throw new HttpError(404, 'Profile not found');

  const insights = await findInsights(userId);
  const payloadInsights = insights?.payload;
  const context: ProfileContext = {
    age: profile.age,
    gender: profile.gender,
    activityLevel: profile.activity_level,
    dietHabit: profile.diet_habit,
    smoking: profile.smoking,
    bmi: Number(profile.bmi),
    alcohol: profile.alcohol,
    sleepHours: Number(profile.sleep_hours),
    highBloodPressure: profile.high_blood_pressure,
  };
  if (typeof payloadInsights?.healthAge === 'number') {
    context.healthAge = payloadInsights.healthAge;
  }

  const rf = recommendHabitsWithRandomForest(context, 4);
  const habits = rf.habits.map((h) => {
    const meta = habitMeta(h.id);
    const reason = reasonForHabit(h.id, context);
    return {
      id: h.id,
      title: meta.title,
      title_bm: meta.title_bm,
      category: meta.category,
      score: h.score,
      reason: reason.en,
      reason_bm: reason.bm,
    };
  });

  return {
    habits,
    coach_note: 'Your 4 actions are personalised from your questionnaire answers and health profile.',
    coach_note_bm:
      '4 tindakan anda diperibadikan daripada jawapan soal selidik dan profil kesihatan anda.',
  };
});
