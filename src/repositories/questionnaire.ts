import { sqlOne } from '../db.ts';

export interface QuestionnaireResponseRow {
  id: string;
  user_id: string;
  submitted_at: string;
}

/**
 * Appends one questionnaire snapshot. Insert-only by design -- there is no
 * update or delete for this table, because it is the audit trail of what the
 * user actually answered each time.
 */
export async function insertQuestionnaireResponse(
  userId: string,
  answers: Record<string, unknown>,
): Promise<QuestionnaireResponseRow> {
  const row = await sqlOne<QuestionnaireResponseRow>`
    INSERT INTO questionnaire_responses (user_id, answers)
    VALUES (${userId}, ${JSON.stringify(answers)}::jsonb)
    RETURNING id, user_id, submitted_at
  `;
  if (row === null) throw new Error('Failed to record questionnaire response');
  return row;
}
