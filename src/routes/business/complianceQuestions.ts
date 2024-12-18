import type { Response } from "express";
import generateID from "../../helpers/id";
import { RequestWithBusinessIdentification } from "../../helpers/middlewares";
import { LegalIdentificationStatus } from "../../helpers/types";
import { saveBusiness } from "../../db";

export const listComplianceQuestions = async (
  req: RequestWithBusinessIdentification,
  res: Response
) => {
  const { businessIdentification } = req;

  res.status(200).send(businessIdentification.meta?.complianceQuestions || []);
};

export const answerComplianceQuestion = async (
  req: RequestWithBusinessIdentification,
  res: Response
) => {
  const { question_id: questionId } = req.params;
  const { business, businessIdentification } = req;
  const { text: answerText } = req.body;

  const question = businessIdentification.meta?.complianceQuestions?.find(
    (q) => q.question_id === questionId
  );

  if (!question) {
    res.status(404).send({
      errors: [
        {
          id: generateID(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'ComplianceQuestion' for id '${questionId}'.`,
        },
      ],
    });
    return;
  }

  question.answer_id = generateID();
  question.answer_text = answerText;
  question.answered_at = new Date().toISOString();

  await saveBusiness(business);

  res.status(201).send(question);
};

export const markLegalIdentificationAsReady = async (
  req: RequestWithBusinessIdentification,
  res: Response
) => {
  const { businessIdentification, business } = req;

  const complianceQuestions =
    businessIdentification.meta?.complianceQuestions || [];

  const allQuestionsAnswered =
    complianceQuestions.length === 0 ||
    complianceQuestions.every((question) => question.answer_id);

  if (!allQuestionsAnswered) {
    res.status(400).send({
      errors: [
        {
          id: generateID(),
          status: 400,
          code: "missing_answers",
          title: "Missing Answers",
          detail: "Not all compliance questions are answered.",
        },
      ],
    });
    return;
  }

  businessIdentification.legal_identification_missing_information_details =
    null;
  businessIdentification.legal_identification_missing_information = [];
  businessIdentification.legal_identification_status =
    LegalIdentificationStatus.PENDING;

  await saveBusiness(business);

  const response = {
    id: generateID(),
    status: businessIdentification.status,
    identification_id: businessIdentification.id,
    business_id: business.id,
    reason: null,
    missing_information:
      businessIdentification.legal_identification_missing_information,
    missing_information_details:
      businessIdentification.legal_identification_missing_information_details,
  };

  res.status(200).send(response);
};
