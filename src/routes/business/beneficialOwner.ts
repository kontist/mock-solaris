import type { Response } from "express";

import generateID from "../../helpers/id";
import { saveBusiness } from "../../db";
import uuid from "node-uuid";
import { BeneficialOwner } from "../../helpers/types";
import { RequestWithBusiness } from "../../helpers/middlewares";

export const createBeneficialOwner = async (
  req: RequestWithBusiness,
  res: Response
) => {
  const { business } = req;

  try {
    const beneficialOwner: BeneficialOwner = {
      id: generateID(),
      beneficial_owner_id: generateID(),
      person_id: req.body.person_id,
      voting_share: req.body.voting_share,
      business_id: business.id,
      fictitious: req.body.fictitious,
      relationship_to_business: req.body.relationship_to_business,
      valid_until: null,
    };

    if (!business.beneficialOwners) {
      business.beneficialOwners = [{ ...beneficialOwner }];
    } else {
      business.beneficialOwners.push({ ...beneficialOwner });
    }

    await saveBusiness(business);

    return res.status(201).send(beneficialOwner);
  } catch (err) {
    if (
      err.message ===
      `Business which has businessId: ${business.id} was not found in redis`
    ) {
      const resp = {
        errors: [
          {
            id: uuid.v4(),
            status: 404,
            code: "model_not_found",
            title: "Model Not Found",
            detail: `Couldn't find 'Solaris::Business' for id '${business}'.`,
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
