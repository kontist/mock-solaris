import type { Response } from "express";

import generateID from "../../helpers/id";
import { saveBusiness, savePerson } from "../../db";
import uuid from "node-uuid";
import {
  LegalRepresentative,
  LegalRepresentativeType,
  LegalRepresentativeRepresentationType,
} from "../../helpers/types";
import {
  RequestWithBusiness,
  RequestWithPerson,
} from "../../helpers/middlewares";

export const createLegalRepresentative = async (
  req: RequestWithBusiness & RequestWithPerson,
  res: Response
) => {
  const { business, person } = req;

  try {
    const legalRepresentative: LegalRepresentative = {
      id: generateID(),
      legal_representative_id: req.body.legal_representative_id,
      business_id: business.id,
      valid_until: null,
      legal_representative_type: LegalRepresentativeType.PERSON,
      power_of_attorney_confirmed_at:
        req.body.power_of_attorney_confirmed_at || null,
      type_of_representation: LegalRepresentativeRepresentationType.ALONE,
    };

    if (!business.legalRepresentatives) {
      business.legalRepresentatives = [{ ...legalRepresentative }];
    } else {
      business.legalRepresentatives.push({ ...legalRepresentative });
    }

    person.businessId = business.id;

    await savePerson(person);
    await saveBusiness(business);

    return res.status(201).send(legalRepresentative);
  } catch (error) {
    return res.status(500).send({
      errors: [
        {
          id: uuid.v4(),
          status: 500,
        },
      ],
    });
  }
};
