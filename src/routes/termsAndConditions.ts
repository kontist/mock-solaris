import { getPerson } from "../db";
import generateID from "../helpers/id";

const EVENT_TYPES = ["APPROVED", "REJECTED"];

export const createTermsAndConditionsEvent = async (req, res) => {
  const {
    body: {
      document_id: documentId,
      signed_by: personId,
      event_type: eventType,
      event_timestamp: eventTimestamp,
      product_name: productName,
    },
  } = req;

  if (!documentId) {
    return res.status(400).send({
      id: generateID(),
      status: 400,
      code: "validation_error",
      title: "Validation Error",
      detail: "document_id is missing",
      source: {
        message: "is missing",
        field: "document_id",
      },
    });
  }

  if (!eventTimestamp) {
    return res.status(400).send({
      id: generateID(),
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

  if (!productName) {
    return res.status(400).send({
      id: generateID(),
      status: 400,
      code: "validation_error",
      title: "Validation Error",
      detail: "product_name is missing",
      source: {
        message: "is missing",
        field: "product_name",
      },
    });
  }

  if (!EVENT_TYPES.includes(eventType)) {
    return res.status(400).send({
      id: generateID(),
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

  const person = await getPerson(personId);

  if (!person) {
    return res.status(400).send({
      id: generateID(),
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

  return res.status(201).send({
    id: generateID(),
    ...req.body,
  });
};
