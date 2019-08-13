import uuid from "node-uuid";
import HttpStatusCodes from "http-status";

import { createChangeRequest } from "./changeRequest";
import { getPerson, savePerson } from "../db";

const SOLARIS_TIMED_ORDER_STATUSES = {
  CREATED: "CREATED",
  AUTHORIZATION_REQUIRED: "AUTHORIZATION_REQUIRED",
  CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
  EXECUTED: "EXECUTED",
  FAILED: "FAILED",
  SCHEDULED: "SCHEDULED",
  CANCELED: "CANCELED"
};

export const TIMED_ORDER_CREATE = "timed_orders:create";

export const confirmTimedOrder = async person => {
  const id = person.changeRequest.delta.id;
  const timedOrder = person.timedOrders.find(order => order.id === id);
  timedOrder.status = SOLARIS_TIMED_ORDER_STATUSES.SCHEDULED;
  await savePerson(person);

  return timedOrder;
};

export const createTimedOrder = async (req, res) => {
  const { body } = req;
  const { person_id: personId, account_id: accountId } = req.params;
  const person = await getPerson(personId);

  const {
    execute_at: executeAt,
    transaction: {
      recipient_name: recipientName,
      recipient_iban: recipientIban,
      reference,
      amount
    }
  } = body;

  const isDataMissing = ![
    executeAt,
    recipientName,
    recipientIban,
    reference,
    amount.value,
    amount.unit,
    amount.currency
  ].every(value => value);

  if (isDataMissing) {
    return res.status(HttpStatusCodes.BAD_REQUEST).send({
      errors: [
        {
          id: Date.now().toString(),
          status: HttpStatusCodes.BAD_REQUEST,
          code: "invalid_model",
          title: "Invalid Model",
          detail: "missing fields"
        }
      ]
    });
  }

  const timedOrder = generateTimedOrder(body);
  person.timedOrders.push(timedOrder);
  await savePerson(person);

  return createChangeRequest(req, res, person, TIMED_ORDER_CREATE, {
    accountId,
    id: timedOrder.id
  });
};

export const fetchTimedOrders = async (req, res) => {
  const person = await getPerson(req.params.person_id);
  res.send(person.timedOrders);
};

export const fetchTimedOrder = async (req, res) => {
  const person = await getPerson(req.params.person_id);
  const timedOrder = person.timedOrders.find(
    order => order.id === req.params.id
  );

  res.send(timedOrder);
};

export const cancelTimedOrder = async (req, res) => {
  const person = await getPerson(req.params.person_id);
  const timedOrder = person.timedOrders.find(
    order => order.id === req.params.id
  );
  timedOrder.status = SOLARIS_TIMED_ORDER_STATUSES.CANCELED;
  timedOrder.scheduled_transaction.status = "canceled";

  await savePerson(person);

  res.send(timedOrder);
};

export const generateTimedOrder = data => {
  const {
    execute_at: executeAt,
    transaction: {
      recipient_name: recipientName,
      recipient_iban: recipientIban,
      recipient_bic: recipientBIC,
      reference,
      description,
      end_to_end_id: e2eId,
      amount: { value, currency, unit }
    }
  } = data;

  const template = {
    id: uuid.v4(),
    execute_at: executeAt,
    executed_at: null,
    status: SOLARIS_TIMED_ORDER_STATUSES.CREATED,
    scheduled_transaction: {
      id: uuid.v4(),
      status: "created",
      reference,
      description,
      recipient_iban: recipientIban,
      recipient_name: recipientName,
      recipient_bic: recipientBIC,
      end_to_end_id: e2eId,
      batch_id: null,
      created_at: new Date().toISOString(),
      amount: {
        value,
        currency,
        unit
      }
    }
  };

  return template;
};
