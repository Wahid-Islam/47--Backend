import { badRequest } from '../http';
import { requireObject } from '../validation';

function requireBoundedInt(
  payload: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): number {
  const value = payload[field];
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw badRequest(`payload."${field}" must be a whole number`);
  }
  if (parsed < min || parsed > max) {
    throw badRequest(`payload."${field}" must be between ${min} and ${max}`);
  }
  return parsed;
}

const ALLOWED_KEYS = new Set([
  'disclaimer',
  'disclaimerBm',
  'disclaimerZh',
  'actualAge',
  'healthAge',
  'lifeExpectancy',
  'overallRiskLevel',
  'overallRiskScore',
  'topRisk',
  'risks',
  'factors',
  'peerComparison',
  'peerComparisonBm',
  'peerComparisonZh',
  'topActions',
  'habits',
  'generatedAt',
  'peerAverageHealthAge',
  'healthAgeDelta',
  'projectedHealthAgeFollowPlan',
  'projectedHealthAgeNoChange',
  'nationalComparisonHeadline',
  'nationalComparisonHeadlineBm',
  'nationalComparisonHeadlineZh',
]);

/** Allowlisted insights payload. Unknown fields are dropped; ages are bounded. */
export function parseInsightsPayload(body: Record<string, unknown>): Record<string, unknown> {
  const payload = requireObject(body, 'payload');
  const healthAge = requireBoundedInt(payload, 'healthAge', 18, 100);
  const actualAge = requireBoundedInt(payload, 'actualAge', 18, 100);
  const derivedDelta = Math.max(-10, Math.min(15, healthAge - actualAge));

  const out: Record<string, unknown> = {
    healthAge,
    actualAge,
    healthAgeDelta: derivedDelta,
  };

  for (const [key, value] of Object.entries(payload)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (key === 'healthAge' || key === 'actualAge' || key === 'healthAgeDelta') continue;
    out[key] = value;
  }

  return out;
}
