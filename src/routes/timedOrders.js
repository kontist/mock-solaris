import uuid from "node-uuid";
import HttpStatusCodes from "http-status";
import moment from "moment";

import { getPerson, savePerson } from "../db";
import { triggerBookingsWebhook } from "./backoffice";
import { triggerWebhook } from "../helpers/webhooks";
import { BOOKING_TYPES } from "./transactions";

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

const mapTimedOrderToTransaction = timedOrder => {
  const {
    id: timedOrderId,
    executed_at: executedAt,
    scheduled_transaction: {
      id,
      reference,
      description,
      end_to_end_id: e2eId,
      recipient_iban: recipientIBAN,
      recipient_name: recipientName,
      recipient_bic: recipientBIC,
      amount
    }
  } = timedOrder;

  return {
    id,
    description,
    e2eId,
    reference,
    name: recipientName,
    amount: {
      ...amount,
      value: -amount.value
    },
    valuta_date: executedAt,
    booking_date: executedAt,
    recipient_iban: recipientIBAN,
    recipient_name: recipientName,
    recipient_bic: recipientBIC,
    transaction_id: timedOrderId,
    status: "accepted",
    booking_type: BOOKING_TYPES.SEPA_CREDIT_TRANSFER
  };
};

const shouldProcessTimedOrder = timedOrder =>
  timedOrder.status === SOLARIS_TIMED_ORDER_STATUSES.SCHEDULED &&
  !timedOrder.executed_at &&
  moment(timedOrder.execute_at).isSameOrBefore(moment(), "day");

const processTimedOrder = async (person, timedOrder) => {
  const timedOrderValue = Math.abs(
    timedOrder.scheduled_transaction.amount.value
  );

  timedOrder.executed_at = new Date().toISOString();
  // if user has less money on account than timed order value, timed order fails
  if (person.account.balance.value < timedOrderValue) {
    timedOrder.status = SOLARIS_TIMED_ORDER_STATUSES.FAILED;
  } else {
    person.account.balance.value -= timedOrderValue;
    person.account.available_balance.value = person.account.balance.value;
    person.transactions.push(mapTimedOrderToTransaction(timedOrder));
    timedOrder.status = SOLARIS_TIMED_ORDER_STATUSES.EXECUTED;
  }

  const itemIndex = person.timedOrders.findIndex(to => to.id === timedOrder.id);
  person.timedOrders[itemIndex] = timedOrder;
  const updatedPerson = await savePerson(person);

  await triggerTimedOrderWebhook(person, timedOrder);
  if (timedOrder.status === SOLARIS_TIMED_ORDER_STATUSES.EXECUTED) {
    await triggerBookingsWebhook(person.account.id);
  }

  return updatedPerson;
};

export const triggerTimedOrder = async (personId, timedOrderId) => {
  const person = await getPerson(personId);
  const timedOrder = person.timedOrders.find(({ id }) => id === timedOrderId);
  await processTimedOrder(person, timedOrder);
};

export const processTimedOrders = async personId => {
  const person = await getPerson(personId);
  for (const timedOrder of person.timedOrders) {
    if (!shouldProcessTimedOrder(timedOrder)) {
      continue;
    }

    await processTimedOrder(person, timedOrder);
  }
};

export const createTimedOrder = async (req, res) => {
  const { body } = req;
  const { person_id: personId } = req.params;
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

  res.status(HttpStatusCodes.CREATED).send(timedOrder);
};

export const authorizeTimedOrder = async (req, res) => {
  const { person_id: personId, id } = req.params;
  const { delivery_method: deliveryMethod } = req.body;

  if (deliveryMethod !== "mobile_number") {
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send({
      errors: [
        {
          id: uuid.v4(),
          status: 500,
          code: "generic_error",
          title: "Generic Error",
          detail: "There was an error."
        }
      ]
    });
  }

  const person = await getPerson(personId);
  const timedOrder = person.timedOrders.find(
    order => order.id === req.params.id
  );
  timedOrder.status = SOLARIS_TIMED_ORDER_STATUSES.CONFIRMATION_REQUIRED;

  person.changeRequest = {
    id,
    method: TIMED_ORDER_CREATE,
    token: new Date()
      .getTime()
      .toString()
      .slice(-6)
  };

  await savePerson(person);

  res.status(HttpStatusCodes.CREATED).send(timedOrder);
};

export const confirmTimedOrder = async (req, res) => {
  const { person_id: personId, id } = req.params;
  const { authorization_token: token } = req.body;
  const person = await getPerson(personId);
  const changeRequest = person.changeRequest || {};

  if (id !== changeRequest.id) {
    return res.status(HttpStatusCodes.NOT_FOUND).send({
      errors: [
        {
          id: uuid.v4(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::TimedOrder' for id '${id}'.`
        }
      ]
    });
  }

  if (token !== changeRequest.token) {
    return res.status(HttpStatusCodes.FORBIDDEN).send({
      errors: [
        {
          id: uuid.v4(),
          status: 403,
          code: "invalid_tan",
          title: "Invalid TAN",
          detail: `Invalid or expired TAN for Solaris::TimedOrder with uid: '${id}'`
        }
      ]
    });
  }

  const timedOrder = person.timedOrders.find(
    order => order.id === req.params.id
  );
  timedOrder.status = SOLARIS_TIMED_ORDER_STATUSES.SCHEDULED;
  person.changeRequest = null;

  await savePerson(person);

  res.status(HttpStatusCodes.CREATED).send(timedOrder);
};

export const fetchTimedOrders = async (req, res) => {
  const person = await getPerson(req.params.person_id);
  res.send(person.timedOrders);
};

export const fetchTimedOrder = async (req, res) => {
  const person = await getPerson(req.params.person_id);
  const timedOrderId = req.params.id;
  const timedOrder = person.timedOrders.find(
    order => order.id === timedOrderId
  );

  if (!timedOrder) {
    res.status(404).send({
      errors: [
        {
          id: uuid.v4(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::TimedOrder' for id '${timedOrderId}'.`
        }
      ]
    });
  }

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
    status: SOLARIS_TIMED_ORDER_STATUSES.AUTHORIZATION_REQUIRED,
    scheduled_transaction: {
      id: uuid.v4(),
      status: "scheduled",
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

const triggerTimedOrderWebhook = async (person, timedOrder) => {
  const {
    id,
    status,
    scheduled_transaction: { reference }
  } = timedOrder;

  const payload = {
    id,
    reference,
    status,
    account_id: person.account.id,
    processed_at: new Date().toISOString()
  };

  await triggerWebhook("SEPA_TIMED_ORDER", payload);
};
