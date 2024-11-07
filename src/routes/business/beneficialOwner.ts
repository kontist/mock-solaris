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

    const beneficialOwners = business.beneficialOwners || [];

    beneficialOwners.push({ ...beneficialOwner });
    business.beneficialOwners = beneficialOwners;

    await saveBusiness(business);

    return res.status(201).send(beneficialOwner);
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
