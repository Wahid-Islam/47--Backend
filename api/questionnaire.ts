import { jsonBody, requireUser, withRoute } from '../src/http';
import { insertQuestionnaireResponse } from '../src/repositories/questionnaire';
import { requireObject } from '../src/validation';

/**
 * POST /api/questionnaire
 * Body: { answers: { ... } }
 *
 * Appends one immutable snapshot of a questionnaire submission (US 1.1).
 * There is no update or delete: the whole point of the table is that
 * historical answers are never overwritten, unlike the mutable profile row.
 */
export default withRoute(['POST'], async (request, response) => {
  const { userId } = await requireUser(request);
  const answers = requireObject(jsonBody(request), 'answers');

  const row = await insertQuestionnaireResponse(userId, answers);

  response.status(201).json(row);
});
