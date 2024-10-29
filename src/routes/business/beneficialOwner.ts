import type { Request, Response } from "express";

import generateID from "../../helpers/id";
import * as log from "../../logger";
import { getBusiness } from "../../db";
import uuid from "node-uuid";

export const createBeneficialOwner = async (req: Request, res: Response) => {
  const { business_id: businessId } = req.params;

  try {
    const business = await getBusiness(businessId);

    const beneficialOwner: BeneficialOwner = {
      id: generateID(),
      beneficial_owner_id: generateID(),
      person_id: req.body.person_id,
      valid_until: "2021-01-01",
      voting_share: req.body.voting_share,
      business_id: businessId,
      fictitious: req.body.fictitious,
      relationship_to_business: req.body.relationship_to_business,
    };

    if (!business.beneficialOwners) {
      business.beneficialOwners = [{ ...beneficialOwner }];
    } else {
      business.beneficialOwners.push({ ...beneficialOwner });
    }
  } catch (err) {
    if (err.message === "did not find business") {
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
