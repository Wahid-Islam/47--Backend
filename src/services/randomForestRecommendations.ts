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

const HABIT_META: Record<string, { title: string; title_bm: string; title_zh: string; category: string }> = {
  walk_20: {
    title: 'Walk 20 minutes',
    title_bm: 'Berjalan 20 minit',
    title_zh: '步行 20 分钟',
    category: 'ACTIVITY',
  },
  drink_water: {
    title: 'Drink 8 glasses of water',
    title_bm: 'Minum 8 gelas air',
    title_zh: '喝 8 杯水',
    category: 'DIET',
  },
  no_sugary_drink: {
    title: 'Skip sugary drinks',
    title_bm: 'Elak minuman bergula',
    title_zh: '今天不喝含糖饮料',
    category: 'DIET',
  },
  brown_rice_meal: {
    title: 'Choose brown rice once',
    title_bm: 'Pilih nasi perang sekali',
    title_zh: '选一次糙米饭',
    category: 'DIET',
  },
  smoke_free_day: {
    title: 'Stay smoke-free today',
    title_bm: 'Kekal tanpa asap hari ini',
    title_zh: '今天保持无烟',
    category: 'SMOKING',
  },
  sleep_7: {
    title: 'Aim for 7–8 hours of sleep',
    title_bm: 'Sasar 7–8 jam tidur',
    title_zh: '争取睡足 7–8 小时',
    category: 'SLEEP',
  },
  check_bp_reminder: {
    title: 'Plan BP screening visit',
    title_bm: 'Rancang lawatan saringan BP',
    title_zh: '计划血压筛查就诊',
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

export function habitMeta(
  id: string,
  profile?: ProfileContext,
): { title: string; title_bm: string; title_zh: string; category: string } {
  if (id === 'sleep_7' && profile !== undefined) {
    if (profile.sleepHours > 8) {
      return {
        title: 'Aim for 7–8 hours of sleep',
        title_bm: 'Sasar 7–8 jam tidur',
        title_zh: '争取睡足 7–8 小时',
        category: 'SLEEP',
      };
    }
    if (profile.sleepHours < 7) {
      return {
        title: 'Sleep at least 7 hours',
        title_bm: 'Tidur sekurang-kurangnya 7 jam',
        title_zh: '至少睡 7 小时',
        category: 'SLEEP',
      };
    }
    return {
      title: 'Keep a steady 7–8 hour sleep window',
      title_bm: 'Kekalkan jendela tidur 7–8 jam',
      title_zh: '保持稳定的 7–8 小时睡眠窗口',
      category: 'SLEEP',
    };
  }

  return (
    HABIT_META[id] ?? {
      title: id,
      title_bm: id,
      title_zh: id,
      category: 'HABIT',
    }
  );
}

export function reasonForHabit(id: string, profile: ProfileContext): { en: string; bm: string; zh: string } {
  switch (id) {
    case 'walk_20':
      return {
        en: `Based on your ${profile.activityLevel} activity level, a daily walk is a strong next step.`,
        bm: `Berdasarkan tahap aktiviti ${profile.activityLevel} anda, berjalan harian ialah langkah seterusnya yang kuat.`,
        zh: `根据您目前的活动水平（${profile.activityLevel}），每日步行是很合适的下一步。`,
      };
    case 'smoke_free_day':
      return {
        en: 'Your smoking profile makes a smoke-free day one of today’s top priorities.',
        bm: 'Profil merokok anda menjadikan hari tanpa asap salah satu keutamaan hari ini.',
        zh: '根据您的吸烟资料，无烟日是今天的优先事项之一。',
      };
    case 'sleep_7':
      if (profile.sleepHours > 8) {
        return {
          en: `You reported ${profile.sleepHours}h. Health Age risk is lowest around 7–8 hours, so aim a bit shorter tonight.`,
          bm: `Anda melaporkan ${profile.sleepHours}j. Risiko Umur Kesihatan paling rendah sekitar 7–8 jam, jadi sasarkan sedikit lebih pendek malam ini.`,
          zh: `您报告睡眠 ${profile.sleepHours} 小时。健康年龄相关风险在约 7–8 小时最低，今晚可略短一些。`,
        };
      }
      if (profile.sleepHours < 7) {
        return {
          en: `You reported ${profile.sleepHours}h. Aim for at least 7 hours tonight to support recovery.`,
          bm: `Anda melaporkan ${profile.sleepHours}j. Sasarkan sekurang-kurangnya 7 jam malam ini untuk pemulihan.`,
          zh: `您报告睡眠 ${profile.sleepHours} 小时。今晚争取至少 7 小时以支持恢复。`,
        };
      }
      return {
        en: `Your sleep (${profile.sleepHours}h) is in a healthier window — protect that consistency tonight.`,
        bm: `Tidur anda (${profile.sleepHours}j) dalam julat lebih sihat — lindungi konsistensi itu malam ini.`,
        zh: `您的睡眠（${profile.sleepHours} 小时）处于较健康区间 — 今晚继续保持。`,
      };
    case 'no_sugary_drink':
    case 'brown_rice_meal':
      return {
        en: `Your diet habit (${profile.dietHabit}) points to one healthier food choice today.`,
        bm: `Tabiat pemakanan anda (${profile.dietHabit}) mencadangkan satu pilihan makanan lebih sihat hari ini.`,
        zh: `根据您的饮食习惯（${profile.dietHabit}），今天做一次更健康的食物选择。`,
      };
    case 'check_bp_reminder':
      return {
        en: 'Your age and heart-risk context make blood-pressure awareness useful this week.',
        bm: 'Umur dan konteks risiko jantung anda menjadikan kesedaran tekanan darah berguna minggu ini.',
        zh: '结合您的年龄与心脏风险背景，本周关注血压很有帮助。',
      };
    case 'drink_water':
      return {
        en: 'Steady hydration supports energy and helps replace sugary drinks.',
        bm: 'Penghidratan yang baik menyokong tenaga dan membantu mengganti minuman bergula.',
        zh: '稳定补水有助于维持精力，并帮助替代含糖饮料。',
      };
    default:
      return {
        en: 'Selected from your questionnaire answers to personalise today’s plan.',
        bm: 'Dipilih daripada jawapan soal selidik anda untuk memperibadikan pelan hari ini.',
        zh: '根据您的问卷回答个性化选出，用于今天的计划。',
      };
  }
}
