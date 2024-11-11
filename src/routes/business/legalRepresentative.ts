import type { Request, Response } from "express";
import moment from "moment";

import generateID from "../../helpers/id";
import { getBusiness, saveBusiness } from "../../db";
import uuid from "node-uuid";
import {
  LegalRepresentative,
  LegalRepresentativeType,
  LegalRepresentativeRepresentationType,
} from "../../helpers/types";

export const createLegalRepresentative = async (
  req: Request,
  res: Response
) => {
  const { business_id: businessId } = req.params;

  try {
    const business = await getBusiness(businessId);

    const legalRepresentative: LegalRepresentative = {
      id: generateID(),
      legal_representative_id: req.body.person_id,
      business_id: businessId,
      valid_until: null,
      legal_representative_type: LegalRepresentativeType.PERSON,
      power_of_attorney_confirmed_at: moment().toISOString(),
      type_of_representation: LegalRepresentativeRepresentationType.ALONE,
    };

    if (!business.legalRepresentatives) {
      business.legalRepresentatives = [{ ...legalRepresentative }];
    } else {
      business.legalRepresentatives.push({ ...legalRepresentative });
    }

    await saveBusiness(business);

    return res.status(201).send(legalRepresentative);
  } catch (err) {
    if (
      err.message ===
      `Business which has businessId: ${businessId} was not found in redis`
    ) {
      const resp = {
        errors: [
          {
            id: uuid.v4(),
            status: 404,
            code: "model_not_found",
            title: "Model Not Found",
            detail: `Couldn't find 'Solaris::Business' for id '${businessId}'.`,
          },
        ],
      };

      return res.status(404).send(resp);
    }

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
