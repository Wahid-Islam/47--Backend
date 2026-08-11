import { badRequest } from '../http';

/** Frontend ActionCatalog IDs stored on profiles.active_action_ids */
export const ACTION_IDS = [
  'bp_screening',
  'walk_20',
  'swap_drinks',
  'brown_rice',
  'blood_sugar',
  'quit_support',
  'hydrate',
  'sleep_7',
] as const;

/** RF / habit-log IDs stored on habit_logs.completed_habit_ids */
export const HABIT_IDS = [
  'walk_20',
  'drink_water',
  'no_sugary_drink',
  'brown_rice_meal',
  'smoke_free_day',
  'sleep_7',
  'check_bp_reminder',
] as const;

const ACTION_SET = new Set<string>(ACTION_IDS);
const HABIT_SET = new Set<string>(HABIT_IDS);

const MAX_IDS = 20;

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function parseActionIds(raw: unknown, field = 'active_action_ids'): string[] {
  if (raw === undefined || raw === null) {
    throw badRequest(`"${field}" is required`);
  }
  if (!Array.isArray(raw)) throw badRequest(`"${field}" must be an array of strings`);
  if (!raw.every((item): item is string => typeof item === 'string')) {
    throw badRequest(`"${field}" must contain only strings`);
  }
  const ids = dedupe(raw.map((id) => id.trim()).filter((id) => id !== ''));
  if (ids.length > MAX_IDS) throw badRequest(`"${field}" must have at most ${MAX_IDS} entries`);
  for (const id of ids) {
    if (!ACTION_SET.has(id)) throw badRequest(`"${field}" contains unknown action id: ${id}`);
  }
  return ids;
}

/** Like parseActionIds, but missing/null means "leave unchanged" (caller supplies fallback). */
export function parseOptionalActionIds(
  raw: unknown,
  field = 'active_action_ids',
): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  return parseActionIds(raw, field);
}

export function parseHabitIds(raw: unknown, field = 'completed_habit_ids'): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw badRequest(`"${field}" must be an array of strings`);
  if (!raw.every((item): item is string => typeof item === 'string')) {
    throw badRequest(`"${field}" must contain only strings`);
  }
  const ids = dedupe(raw.map((id) => id.trim()).filter((id) => id !== ''));
  if (ids.length > MAX_IDS) throw badRequest(`"${field}" must have at most ${MAX_IDS} entries`);
  for (const id of ids) {
    if (!HABIT_SET.has(id)) throw badRequest(`"${field}" contains unknown habit id: ${id}`);
  }
  return ids;
}
