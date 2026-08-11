import { jsonBody, requireUser, withRoute } from '../http';
import { saveQuestionnaireAndProfile } from '../services/questionnaireToProfile';
import { requireObject } from '../validation';

/** POST /api/questionnaire — validates answers, upserts profile, and audits in one DB write. */
export default withRoute(['POST'], async (request, response) => {
  const { userId, email } = await requireUser(request);
  const answers = requireObject(jsonBody(request), 'answers');

  const result = await saveQuestionnaireAndProfile(userId, email, answers);

  response.status(201).json({
    id: result.questionnaireId,
    user_id: userId,
    submitted_at: result.submittedAt,
  });
});
