import { jsonBody, requireUser, withRoute } from '../http';
import { insertQuestionnaireResponse } from '../repositories/questionnaire';
import { requireObject } from '../validation';

/** POST /api/questionnaire */
export default withRoute(['POST'], async (request, response) => {
  const { userId } = await requireUser(request);
  const answers = requireObject(jsonBody(request), 'answers');

  const row = await insertQuestionnaireResponse(userId, answers);

  response.status(201).json(row);
});
