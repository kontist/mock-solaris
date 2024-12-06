import type { Response } from "express";
import _ from "lodash";

import { RequestWithBusiness } from "../../helpers/middlewares";
import { saveBusiness, getPerson } from "../../db";
import generateID from "../../helpers/id";
import {
  BusinessIdentification,
  LegalIdentificationStatus,
  BusinessIdentificationStatus,
  LegalRepresentative,
  LegalRepresentativeIdentificationResponse,
} from "../../helpers/types";
import {
  createIdentification,
  generatePendingIdentitfication,
} from "../identifications";
import { getBusiness } from "../../db";

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

  return identification;
};
