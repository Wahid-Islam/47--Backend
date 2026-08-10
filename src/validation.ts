import { badRequest } from './http';

export function requireString(
  body: Record<string, unknown>,
  field: string,
  { min = 1, max = 500 }: { min?: number; max?: number } = {},
): string {
  const value = body[field];
  if (typeof value !== 'string') throw badRequest(`"${field}" must be a string`);

  const trimmed = value.trim();
  if (trimmed.length < min) throw badRequest(`"${field}" is required`);
  if (trimmed.length > max) throw badRequest(`"${field}" must be at most ${max} characters`);

  return trimmed;
}

export function optionalString(body: Record<string, unknown>, field: string): string | undefined {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw badRequest(`"${field}" must be a string`);
  return value.trim();
}

export function requireEmail(body: Record<string, unknown>, field = 'email'): string {
  const value = requireString(body, field, { max: 320 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    throw badRequest('"email" must be a valid email address');
  }
  return value.toLowerCase();
}

export function requirePassword(body: Record<string, unknown>, field = 'password'): string {
  const value = body[field];
  if (typeof value !== 'string') throw badRequest('"password" must be a string');
  if (value.length < 6) throw badRequest('"password" must be at least 6 characters');
  if (value.length > 200) throw badRequest('"password" must be at most 200 characters');
  return value;
}

export function requireInt(
  body: Record<string, unknown>,
  field: string,
  { min, max }: { min: number; max: number },
): number {
  const value = body[field];
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isInteger(parsed)) {
    throw badRequest(`"${field}" must be a whole number`);
  }
  if (parsed < min || parsed > max) throw badRequest(`"${field}" must be between ${min} and ${max}`);
  return parsed;
}

export function requireNumber(
  body: Record<string, unknown>,
  field: string,
  { min, max }: { min: number; max: number },
): number {
  const value = body[field];
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
    throw badRequest(`"${field}" must be a number`);
  }
  if (parsed < min || parsed > max) throw badRequest(`"${field}" must be between ${min} and ${max}`);
  return parsed;
}

export function requireBoolean(body: Record<string, unknown>, field: string): boolean {
  const value = body[field];
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw badRequest(`"${field}" must be a boolean`);
}

export function requireEnum<const T extends readonly string[]>(
  body: Record<string, unknown>,
  field: string,
  allowed: T,
): T[number] {
  const value = body[field];
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw badRequest(`"${field}" must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

export function requireStringArray(body: Record<string, unknown>, field: string): string[] {
  const value = body[field];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw badRequest(`"${field}" must be an array of strings`);
  if (!value.every((item): item is string => typeof item === 'string')) {
    throw badRequest(`"${field}" must contain only strings`);
  }
  return value;
}

export function requireObject(body: Record<string, unknown>, field: string): Record<string, unknown> {
  const value = body[field];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw badRequest(`"${field}" must be an object`);
  }
  return value as Record<string, unknown>;
}

/** Validates a `YYYY-MM-DD` date, defaulting to today in UTC. */
export function requireDateKey(value: unknown, field = 'date'): string {
  if (value === undefined || value === null || value === '') {
    return new Date().toISOString().slice(0, 10);
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest(`"${field}" must be a date formatted YYYY-MM-DD`);
  }
  if (Number.isNaN(Date.parse(value))) throw badRequest(`"${field}" is not a real date`);
  return value;
}
