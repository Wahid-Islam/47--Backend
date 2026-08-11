import { jsonBody, requireUser, withRoute } from '../http';
import { insertQuestionnaireResponse } from '../repositories/questionnaire';
import { upsertProfileFromQuestionnaire } from '../services/questionnaireToProfile';
import { requireObject } from '../validation';

/** POST /api/questionnaire — updates the profile, then stores answers as an audit row. */
export default withRoute(['POST'], async (request, response) => {
  const { userId, email } = await requireUser(request);
  const answers = requireObject(jsonBody(request), 'answers');

  await upsertProfileFromQuestionnaire(userId, email, answers);
  const row = await insertQuestionnaireResponse(userId, answers);

  response.status(201).json(row);
});
