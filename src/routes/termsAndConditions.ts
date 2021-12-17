import uuid from "node-uuid";
import { getPerson } from "../db";

const EVENT_TYPES = ["APPROVED", "REJECTED"];

export const createTermsAndConditionsEvent = async (req, res) => {
  const {
    body: {
      signed_by: personId,
      event_type: eventType,
      event_timestamp: eventTimestamp,
    },
  } = req;

  const person = await getPerson(personId);

  if (!person) {
    return res.status(400).send({
      id: uuid.v4(),
      status: 400,
      code: "validation_error",
      title: "Validation Error",
      detail: "signed_by is invalid",
      source: {
        message: "is invalid",
        field: "signed_by",
      },
    });
  }

  if (!eventTimestamp) {
    return res.status(400).send({
      id: uuid.v4(),
      status: 400,
      code: "validation_error",
      title: "Validation Error",
      detail: "event_timestamp is missing",
      source: {
        message: "is missing",
        field: "event_timestamp",
      },
    });
  }

  if (!EVENT_TYPES.includes(eventType)) {
    return res.status(400).send({
      id: uuid.v4(),
      status: 400,
      code: "validation_error",
      title: "Validation Error",
      detail: "event_type does not have a valid value",
      source: {
        message: "does not have a valid value",
        field: "event_type",
      },
    });
  }

  return res.status(201).send({
    id: uuid.v4(),
    ...req.body,
  });
};
