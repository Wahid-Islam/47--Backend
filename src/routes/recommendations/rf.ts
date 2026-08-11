import { HttpError, requireUser, withRoute } from '../../http';
import { findProfile } from '../../repositories/profiles';
import type { ProfileContext } from '../../services/profileContext';
import {
  habitMeta,
  reasonForHabit,
  recommendHabitsWithRandomForest,
} from '../../services/randomForestRecommendations';

/** GET /api/recommendations/rf (also aliased as /api/recommendations/llm — deprecated). */
export default withRoute(['GET'], async (request) => {
  const { userId } = await requireUser(request);
  const profile = await findProfile(userId);
  if (profile === null) throw new HttpError(404, 'Profile not found');

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
    diabetes: profile.diabetes,
  };

  const rf = recommendHabitsWithRandomForest(context, 4);
  const habits = rf.habits.map((h) => {
    const meta = habitMeta(h.id, context);
    const reason = reasonForHabit(h.id, context);
    return {
      id: h.id,
      title: meta.title,
      title_bm: meta.title_bm,
      title_zh: meta.title_zh,
      category: meta.category,
      score: h.score,
      reason: reason.en,
      reason_bm: reason.bm,
      reason_zh: reason.zh,
    };
  });

  return {
    habits,
    coach_note:
      'Your 4 actions are personalised from your saved health profile (questionnaire + onboarding answers).',
    coach_note_bm:
      '4 tindakan anda diperibadikan daripada profil kesihatan tersimpan (soal selidik + onboarding).',
    coach_note_zh: '您的 4 项行动根据已保存的健康资料（问卷与引导问答）个性化生成。',
    algorithm: rf.algorithm,
  };
});
