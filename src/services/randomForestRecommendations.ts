import type { ProfileContext } from './profileContext';
import modelJson from '../data/random_forest_habits.json';

export type { ProfileContext } from './profileContext';

interface TreeJson {
  children_left: number[];
  children_right: number[];
  feature: number[];
  threshold: number[];
  value: number[];
}

interface ForestModelJson {
  version: number;
  algorithm: string;
  habit_ids: string[];
  feature_names: string[];
  metrics?: { mae?: number; top1_habit_agreement?: number };
  forests: TreeJson[][];
}

export interface RfHabitScore {
  id: string;
  score: number;
}

export interface RfRecommendationResult {
  habits: RfHabitScore[];
  scores: Record<string, number>;
  algorithm: string;
  metrics?: ForestModelJson['metrics'];
}

const HABIT_META: Record<string, { title: string; title_bm: string; category: string }> = {
  walk_20: { title: 'Walk 20 minutes', title_bm: 'Berjalan 20 minit', category: 'ACTIVITY' },
  drink_water: { title: 'Drink 8 glasses of water', title_bm: 'Minum 8 gelas air', category: 'DIET' },
  no_sugary_drink: { title: 'Skip sugary drinks', title_bm: 'Elak minuman bergula', category: 'DIET' },
  brown_rice_meal: { title: 'Choose brown rice once', title_bm: 'Pilih nasi perang sekali', category: 'DIET' },
  smoke_free_day: { title: 'Stay smoke-free today', title_bm: 'Kekal tanpa asap hari ini', category: 'SMOKING' },
  sleep_7: { title: 'Sleep at least 7 hours', title_bm: 'Tidur sekurang-kurangnya 7 jam', category: 'SLEEP' },
  check_bp_reminder: {
    title: 'Plan BP screening visit',
    title_bm: 'Rancang lawatan saringan BP',
    category: 'SCREENING',
  },
};

function loadModel(): ForestModelJson {
  return modelJson as ForestModelJson;
}

function predictTree(tree: TreeJson, features: number[]): number {
  let node = 0;
  while (tree.children_left[node] !== -1) {
    const featureIndex = tree.feature[node]!;
    const threshold = tree.threshold[node]!;
    node = features[featureIndex]! <= threshold ? tree.children_left[node]! : tree.children_right[node]!;
  }
  return tree.value[node]!;
}

function predictForest(trees: TreeJson[], features: number[]): number {
  if (trees.length === 0) return 0;
  let sum = 0;
  for (const tree of trees) sum += predictTree(tree, features);
  return sum / trees.length;
}

/** Encode a profile into the feature vector the forest was trained on. */
export function profileToFeatures(profile: ProfileContext, featureNames: string[]): number[] {
  const activity = profile.activityLevel;
  const diet = profile.dietHabit;
  const alcohol = profile.alcohol;
  const healthAgeDelta =
    typeof profile.healthAge === 'number' ? profile.healthAge - profile.age : 0;

  const values: Record<string, number> = {
    age: profile.age,
    gender_male: profile.gender === 'female' ? 0 : 1,
    activity_low: activity === 'low' ? 1 : 0,
    activity_moderate: activity === 'moderate' ? 1 : 0,
    activity_high: activity === 'high' ? 1 : 0,
    diet_unhealthy: diet === 'unhealthy' ? 1 : 0,
    diet_average: diet === 'average' ? 1 : 0,
    diet_healthy: diet === 'healthy' ? 1 : 0,
    smoking: profile.smoking ? 1 : 0,
    bmi: profile.bmi,
    alcohol_none: alcohol === 'none' ? 1 : 0,
    alcohol_occasional: alcohol === 'occasional' ? 1 : 0,
    alcohol_regular: alcohol === 'regular' ? 1 : 0,
    sleep_hours: profile.sleepHours,
    high_bp: profile.highBloodPressure ? 1 : 0,
    health_age_delta: healthAgeDelta,
  };

  return featureNames.map((name) => values[name] ?? 0);
}

/** Rank habits from the trained model and return the top 4. */
export function recommendHabitsWithRandomForest(
  profile: ProfileContext,
  limit = 4,
): RfRecommendationResult {
  const model = loadModel();
  const features = profileToFeatures(profile, model.feature_names);
  const scores: Record<string, number> = {};

  model.habit_ids.forEach((habitId, index) => {
    const forest = model.forests[index] ?? [];
    scores[habitId] = predictForest(forest, features);
  });

  // Soft constraint: never push smoke-free to non-smokers.
  if (!profile.smoking) {
    scores.smoke_free_day = (scores.smoke_free_day ?? 0) - 1;
  }

  const ranked = Object.entries(scores)
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    habits: ranked,
    scores,
    algorithm: model.algorithm,
    metrics: model.metrics,
  };
}

export function habitMeta(id: string): { title: string; title_bm: string; category: string } {
  return (
    HABIT_META[id] ?? {
      title: id,
      title_bm: id,
      category: 'HABIT',
    }
  );
}

/** User-facing reasons (no model names). */
export function reasonForHabit(id: string, profile: ProfileContext): { en: string; bm: string } {
  switch (id) {
    case 'walk_20':
      return {
        en: `Based on your ${profile.activityLevel} activity level, a daily walk is a strong next step.`,
        bm: `Berdasarkan tahap aktiviti ${profile.activityLevel} anda, berjalan harian ialah langkah seterusnya yang kuat.`,
      };
    case 'smoke_free_day':
      return {
        en: 'Your smoking profile makes a smoke-free day one of today’s top priorities.',
        bm: 'Profil merokok anda menjadikan hari tanpa asap salah satu keutamaan hari ini.',
      };
    case 'sleep_7':
      return {
        en: `Your sleep (${profile.sleepHours}h) suggests protecting a steady sleep window tonight.`,
        bm: `Tidur anda (${profile.sleepHours}j) mencadangkan melindungi jendela tidur yang konsisten malam ini.`,
      };
    case 'no_sugary_drink':
    case 'brown_rice_meal':
      return {
        en: `Your diet habit (${profile.dietHabit}) points to one healthier food choice today.`,
        bm: `Tabiat pemakanan anda (${profile.dietHabit}) mencadangkan satu pilihan makanan lebih sihat hari ini.`,
      };
    case 'check_bp_reminder':
      return {
        en: 'Your age and heart-risk context make blood-pressure awareness useful this week.',
        bm: 'Umur dan konteks risiko jantung anda menjadikan kesedaran tekanan darah berguna minggu ini.',
      };
    case 'drink_water':
      return {
        en: 'Steady hydration supports energy and helps replace sugary drinks.',
        bm: 'Penghidratan yang baik menyokong tenaga dan membantu mengganti minuman bergula.',
      };
    default:
      return {
        en: 'Selected from your questionnaire answers to personalise today’s plan.',
        bm: 'Dipilih daripada jawapan soal selidik anda untuk memperibadikan pelan hari ini.',
      };
  }
}
