import uuid from "node-uuid";
import HttpStatusCodes from "http-status";

import { createChangeRequest } from "./changeRequest";
import { getPerson, getTimedOrders, saveTimedOrders } from "../db";

export const TIMED_ORDER_CREATE = "timed_orders:create";

export const confirmTimedOrder = async person => {
  const id = person.changeRequest.delta.id;
  const accountId = person.changeRequest.delta.accountId;
  const timedOrders = await getTimedOrders(person.id, accountId);
  const timedOrder = timedOrders.find(order => order.id === id);
  timedOrder.status = "SCHEDULED";

  await saveTimedOrders(person.id, accountId, timedOrders);

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
  const timedOrders = await getTimedOrders(personId, accountId);
  timedOrders.push(timedOrder);
  await saveTimedOrders(personId, accountId, timedOrders);

  return createChangeRequest(req, res, person, TIMED_ORDER_CREATE, {
    accountId,
    id: timedOrder.id
  });
};

export const fetchTimedOrders = async (req, res) => {
  const { person_id: personId, account_id: accountId } = req.params;
  const timedOrders = await getTimedOrders(personId, accountId);

  res.send(timedOrders);
};

export const fetchTimedOrder = async (req, res) => {
  const { person_id: personId, account_id: accountId, id } = req.params;
  const timedOrders = await getTimedOrders(personId, accountId);
  const timedOrder = timedOrders.find(order => order.id === id);

  res.send(timedOrder);
};

export const cancelTimedOrder = async (req, res) => {
  const { person_id: personId, account_id: accountId, id } = req.params;
  const timedOrders = await getTimedOrders(personId, accountId);
  const timedOrder = timedOrders.find(order => order.id === id);
  timedOrder.status = "CANCELED";
  timedOrder.scheduled_transaction.status = "canceled";

  await saveTimedOrders(personId, accountId, timedOrders);

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
    status: "CREATED",
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
