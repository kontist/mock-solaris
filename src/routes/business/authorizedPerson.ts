import type { Response } from "express";

import generateID from "../../helpers/id";
import uuid from "node-uuid";
import { AuthorizedPerson } from "../../helpers/types";
import { saveBusiness, getBusinessIdByAccount } from "../../db";
import { RequestWithBusinessAndAccount } from "../../helpers/middlewares";

export const createAuthorizedPerson = async (
  req: RequestWithBusinessAndAccount,
  res: Response
) => {
  const { business } = req;
  const { account_id } = req.params;

  const authorizedPersonId = req.body.authorized_person_id;
  if (!authorizedPersonId) {
    return res.status(400).send({
      errors: [
        {
          id: uuid.v4(),
          status: 400,
          code: "missing_field",
          title: "Missing Field",
          detail: "Invalid request.",
        },
      ],
    });
  }

  const businessId = await getBusinessIdByAccount({ id: account_id });
  if (businessId !== business.id) {
    return res.status(403).send({
      errors: [
        {
          id: uuid.v4(),
          status: 403,
          code: "forbidden",
          title: "Forbidden",
          detail: "You are not authorized to perform this action.",
        },
      ],
    });
  }

  try {
    const authorizedPerson: AuthorizedPerson = {
      id: generateID(),
      authorized_person_id: authorizedPersonId,
      valid_from: new Date().toISOString().split("T")[0],
      valid_until: new Date(
        new Date().setFullYear(new Date().getFullYear() + 10)
      )
        .toISOString()
        .split("T")[0],
    };

    const authorizedPersons = business.authorizedPersons || [];

    authorizedPersons.push({ ...authorizedPerson });
    business.authorizedPersons = authorizedPersons;

    await saveBusiness(business);

    return res.status(201).send(authorizedPerson);
  } catch (error) {
    return res.status(500).send({
      errors: [
        {
          id: uuid.v4(),
          status: 500,
          detail: "Internal server error",
        },
      ],
    });
  }
};
