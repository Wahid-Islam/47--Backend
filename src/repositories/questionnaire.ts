import { sqlOne } from '../db';

export interface QuestionnaireResponseRow {
  id: string;
  user_id: string;
  submitted_at: string;
}

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
