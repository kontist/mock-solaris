import type { Request, Response } from "express";

import * as db from "../db";
import {
  Answer,
  CustomerVettingStatus,
  PersonWebhookEvent,
  QuestionAnswerResponse,
  QuestionSet,
} from "../helpers/types";
import { triggerWebhook } from "../helpers/webhooks";

const getPersonAndQuestionSet = async (setId: string) => {
  const personId = await db.getPersonIdByQuestionSetId(setId);
  const person = await db.getPerson(personId);
  const set: QuestionSet = person.questionSets.find((s) => s.id === setId);
  if (!set) {
    throw new Error("Question set not found");
  }

  return { person, set };
};

export const listQuestions = async (req: Request, res: Response) => {
  const { question_set_id: setId } = req.params;
  const { set } = await getPersonAndQuestionSet(setId);
  res.json(set);
};

export const answerQuestion = async (req: Request, res: Response) => {
  const { question_set_id: setId } = req.params;
  const { response, partner_notes, attachments, ready_for_review } =
    req.body as Answer;
  const { person, set } = await getPersonAndQuestionSet(setId);
  const question = set.questions.find(
    (q) => q.id === req.body.question_id
  ) as QuestionAnswerResponse;

  if (!question) {
    throw new Error("Question not found");
  }

  question.answer = {
    response,
    partner_notes,
    attachments,
    ready_for_review,
  };

  const areAllQuestionsAnswered = set.questions.every(
    (q) => !!(q as QuestionAnswerResponse).answer?.ready_for_review
  );

  if (areAllQuestionsAnswered) {
    if (
      person.customer_vetting_status ===
      CustomerVettingStatus.INFORMATION_REQUESTED
    ) {
      person.customer_vetting_status =
        CustomerVettingStatus.INFORMATION_RECEIVED;
    } else if (
      person.risk_classification_status ===
      CustomerVettingStatus.INFORMATION_REQUESTED
    ) {
      person.risk_classification_status =
        CustomerVettingStatus.INFORMATION_RECEIVED;
    }
  }

  await db.savePerson(person);

  if (
    [
      person.customer_vetting_status,
      person.risk_classification_status,
    ].includes(CustomerVettingStatus.INFORMATION_RECEIVED)
  ) {
    triggerWebhook({
      type: PersonWebhookEvent.PERSON_CHANGED,
      payload: {},
      extraHeaders: { "solaris-entity-id": req.params.id },
      personId: person.id,
    });
  }

  res.json(question);
};
