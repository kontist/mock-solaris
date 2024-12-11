import type { Response } from "express";
import _ from "lodash";

import { RequestWithBusiness } from "../../helpers/middlewares";
import { saveBusiness, getPerson, getBusiness } from "../../db";
import generateID from "../../helpers/id";
import {
  BusinessIdentification,
  LegalIdentificationStatus,
  BusinessIdentificationStatus,
  LegalRepresentative,
  LegalRepresentativeIdentificationResponse,
  BusinessWebhookEvent,
  ComplianceQuestion,
  COMPLIANCE_QUESTIONS,
} from "../../helpers/types";
import {
  createIdentification,
  generatePendingIdentitfication,
} from "../identifications";
import { triggerWebhook } from "../../helpers/webhooks";
import { fetchRandomQuestion } from "../../helpers/questionsAndAnswers";

const mapLegalRepresentative = async (
  legalRepresentative: LegalRepresentative
): Promise<LegalRepresentativeIdentificationResponse> => {
  let person = await getPerson(legalRepresentative.legal_representative_id);
  const identification = await createIdentification(person);
  await generatePendingIdentitfication(person, identification.id);
  person = await getPerson(person.id);

  return {
    identifications: Object.values(person.identifications),
    person_id: person.id,
  };
};

export const createBusinessIdentification = async (
  req: RequestWithBusiness,
  res: Response
) => {
  const { business } = req;

  const { legalRepresentatives } = business;

  const identification: BusinessIdentification = {
    id: generateID(),
    method: "idnow",
    business_id: business.id,
    reference: "ABC",
    completed_at: null,
    status: BusinessIdentificationStatus.CREATED,
    legal_identification_missing_information_details: null,
    legal_identification_missing_information: [],
    legal_identification_status: LegalIdentificationStatus.CREATED,
    legal_identification_reason: null,
    legal_representatives: await Promise.all(
      legalRepresentatives.map(mapLegalRepresentative)
    ),
  };

  if (!business.identifications) {
    business.identifications = [identification];
  } else {
    business.identifications.push(identification);
  }

  await saveBusiness(business);

  replyWithIdentification(res, identification, 201);
};

export const retrieveBusinessIdentification = async (
  req: RequestWithBusiness,
  res: Response
) => {
  const { business } = req;
  const { identification_id: identificationId } = req.params;

  const identification = business.identifications.find(
    (ident) => ident.id === identificationId
  );

  if (!identification) {
    const resp = {
      errors: [
        {
          id: generateID(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::BusinessIdentification' for id '${identificationId}'.`,
        },
      ],
    };

    res.status(404).send(resp);
    return;
  }

  replyWithIdentification(res, identification, 200);
};

const replyWithIdentification = (
  res: Response,
  identification: BusinessIdentification,
  status: number
) => res.status(status).send(_.omit(identification, "meta"));

export const changeBusinessIdentificationStatus = async (
  businessId,
  identificationId,
  status
) => {
  const business = await getBusiness(businessId);
  const identification = business.identifications.find(
    (ident) => ident.id === identificationId
  );

  if (!identification) {
    return null;
  }

  identification.status = status;
  await saveBusiness(business);

  await triggerWebhook({
    type: BusinessWebhookEvent.BUSINESS_IDENTIFICATION,
    payload: { id: identification.id, business_id: business.id },
  });

  return identification;
};

export const addBusinessMissingInformation = async (
  businessId,
  identificationId,
  complianceQuestions,
  documents
) => {
  const business = await getBusiness(businessId);
  const identification = business.identifications.find(
    (ident) => ident.id === identificationId
  );

  if (!identification) {
    return null;
  }

  identification.legal_identification_missing_information =
    identification.legal_identification_missing_information || [];

  if (complianceQuestions) {
    const questions: ComplianceQuestion[] = await Promise.all(
      Array.from({ length: 2 }).map(async () => {
        const question = await fetchRandomQuestion();

        return {
          question_id: generateID(),
          question_text: question,
          legal_identification_id: generateID(),
          business_identification_id: identificationId,
          business_id: business.id,
          asked_at: new Date().toISOString(),
          answer_id: null,
          answer_text: null,
          answered_at: null,
        };
      })
    );

    identification.legal_identification_missing_information.push(
      COMPLIANCE_QUESTIONS
    );
    identification.meta = identification.meta || {};
    identification.meta.complianceQuestions = questions;
  }

  if (documents) {
    identification.legal_identification_missing_information.push(
      "FOUNDATION_DOCUMENT",
      "ANNUAL_FINANCIAL_STATEMENT"
    );
  }

  await saveBusiness(business);

  return identification;
};
