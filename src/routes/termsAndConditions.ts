import uuid from "node-uuid";
import { generateEntityNotFoundPayload } from "../helpers/overdraft";
import { getPerson } from "../db";

export const createTermsAndConditionsEvent = async (req, res) => {
  const {
    body: { signed_by: personId },
  } = req;

  const person = await getPerson(personId);

  if (!person) {
    return res
      .status(404)
      .send(generateEntityNotFoundPayload("person_id", personId));
  }

  return res.status(201).send({
    id: uuid.v4(),
    ...req.body,
  });
};
