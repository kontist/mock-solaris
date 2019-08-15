import crypto from "crypto";
import assert from "assert";
import moment from "moment";
import uuid from "uuid";
import fetch from "node-fetch";
import _ from "lodash";

import { getPerson, savePerson, getWebhookByType } from "../db";
import * as log from "../logger";
import { findPersonByIdOrEmail, processQueuedBooking } from "./backoffice";

const STANDING_ORDER_PAYMENT_FREQUENCY = {
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  EVERYSIXMONTHS: "EVERY_SIX_MONTHS",
  YEARLY: "ANNUALLY"
};

const STANDING_ORDER_PAYMENT_STATUSES = {
  EXECUTED: "EXECUTED",
  DECLINED: "DECLINED"
};

export const STANDING_ORDER_CREATE_METHOD = "standing_order:create";
export const STANDING_ORDER_UPDATE_METHOD = "standing_order:update";
export const STANDING_ORDER_CANCEL_METHOD = "standing_order:cancel";

const STANDING_ORDER_EDITABLE_ATTRIBUTES = [
  "amount",
  "description",
  "end_to_end_id",
  "last_execution_date",
  "reoccurrence"
];

export const showStandingOrderRequestHandler = async (req, res) => {
  const { person_id: personId, id: standingOrderId } = req.params;

  const { standingOrder } = await getPersonWithStandingOrder(
    personId,
    standingOrderId
  );

  res.status(200).send(standingOrder);
};

export const createStandingOrderRequestHandler = async (req, res) => {
  const { person_id: personId } = req.params;

  log.info("createStandingOrderRequestHandler()", {
    reqBody: req.body,
    reqParams: req.params
  });

  const {
    recipient_name: recipient,
    recipient_iban: iban,
    amount,
    description,
    end_to_end_id: endToEndId,
    first_execution_date: firstExecutionDate,
    last_execution_date: lastExecutionDate,
    reoccurrence
  } = req.body;

  try {
    const { id, createdAt } = await createStandingOrder({
      personId,
      recipient,
      iban,
      amount,
      description,
      endToEndId,
      firstExecutionDate,
      lastExecutionDate,
      reoccurrence
    });

    return res.status(202).send({
      id,
      status: "AUTHORIZATION_REQUIRED",
      updated_at: createdAt,
      url: ":env/v1/change_requests/:id/authorize"
    });
  } catch (err) {
    log.error(
      "createStandingOrderRequestHandler() Creating Standing Order failed",
      err
    );
    res.status(500).send({
      reason: err.message,
      status: "Creating Standing Order failed!"
    });
  }
};

/**
 * Saves the standing order to the Person's StandingOrders array.
 * Returns the standing order.
 * @param {Object} standingOrderData
 */
export const createStandingOrder = async standingOrderData => {
  const {
    personId,
    recipient,
    iban,
    amount,
    description,
    endToEndId,
    firstExecutionDate,
    lastExecutionDate,
    reoccurrence
  } = standingOrderData;

  if (!recipient || !iban || !amount || !firstExecutionDate || !reoccurrence) {
    log.error("createStandingOrder - field/s missing");
    throw new Error("createStandingOrder - field/s missing");
  }

  const standingOrder = generateStandingOrderForPerson({
    personId,
    recipient,
    iban,
    amount,
    description,
    endToEndId,
    firstExecutionDate,
    lastExecutionDate,
    reoccurrence
  });

  const person = await findPersonByIdOrEmail(personId);

  person.changeRequest = {
    method: STANDING_ORDER_CREATE_METHOD,
    id: crypto.randomBytes(16).toString("hex"),
    createdAt: new Date().toISOString()
  };

  person.unconfirmedStandingOrders = person.unconfirmedStandingOrders || [];
  person.unconfirmedStandingOrders.push({
    standingOrder,
    changeRequestId: person.changeRequest.id
  });

  await savePerson(person);
  return person.changeRequest;
};

export const generateStandingOrderForPerson = standingOrderData => {
  const {
    personId,
    description,
    amount,
    recipient,
    iban,
    endToEndId,
    reoccurrence,
    firstExecutionDate,
    lastExecutionDate
  } = standingOrderData;

  const amountValue = Math.max(0, Math.min(10000000, amount.value));

  return {
    id: uuid.v4(),
    reference: personId,
    recipient_name: recipient,
    recipient_iban: iban,
    amount: {
      value: amountValue,
      unit: "cents",
      currency: "EUR"
    },
    description,
    end_to_end_id: endToEndId,
    first_execution_date: moment(firstExecutionDate).format("YYYY-MM-DD"),
    last_execution_date: lastExecutionDate
      ? moment(lastExecutionDate).format("YYYY-MM-DD")
      : null,
    month_end_execution: false,
    reoccurrence
  };
};

/**
 * Triggers the standing order to process as a normal booking.
 */
export const triggerStandingOrderRequestHandler = async (req, res) => {
  const { personId, standingOrderId } = req.params;

  let booking;
  if (await hasFundsToExecuteStandingOrder(personId, standingOrderId)) {
    booking = await processQueuedBooking(personId, standingOrderId, true);
  }

  // We need to update next occurence and call webhook in all cases, even when a standing order is declined
  await updateStandingOrderNextOccurrenceDateAndStatus(
    personId,
    standingOrderId
  );
  await sendSepaScheduledTransactionWebhook(personId, standingOrderId, booking);

  res.redirect("back");
};

const updateStandingOrderNextOccurrenceDateAndStatus = async (
  personId,
  standingOrderId
) => {
  const { person, standingOrder } = await getPersonWithStandingOrder(
    personId,
    standingOrderId
  );

  const nextOccurence = getNextOccurrenceDate(
    moment(standingOrder.next_occurrence),
    standingOrder.reoccurrence
  );

  if (
    standingOrder.last_execution_date &&
    nextOccurence.isAfter(standingOrder.last_execution_date)
  ) {
    standingOrder.next_occurrence = null;
    standingOrder.status = "INACTIVE";
  } else {
    standingOrder.next_occurrence = nextOccurence.format("YYYY-MM-DD");
  }

  await savePerson(person);
};

const getNextOccurrenceDate = (lastDate, reoccurrence) => {
  switch (reoccurrence) {
    case STANDING_ORDER_PAYMENT_FREQUENCY.MONTHLY:
      return lastDate.add(1, "months");
    case STANDING_ORDER_PAYMENT_FREQUENCY.QUARTERLY:
      return lastDate.add(3, "months");
    case STANDING_ORDER_PAYMENT_FREQUENCY.EVERYSIXMONTHS:
      return lastDate.add(6, "months");
    case STANDING_ORDER_PAYMENT_FREQUENCY.YEARLY:
      return lastDate.add(1, "years");
    default:
      throw new Error(
        `Unexpected standing order reoccurrence: ${reoccurrence}`
      );
  }
};

export const confirmStandingOrderCreation = async (person, changeRequestId) => {
  person.standingOrders = person.standingOrders || [];

  const { standingOrder, index } = findUnconfirmedStandingOrder(
    person,
    changeRequestId
  );

  person.unconfirmedStandingOrders.splice(index, 1);

  standingOrder.status = "ACTIVE";
  standingOrder.next_occurrence = standingOrder.first_execution_date;

  person.standingOrders.push(standingOrder);

  await savePerson(person);

  return standingOrder;
};

const findUnconfirmedStandingOrder = (person, chgRequestId) => {
  let result = null;
  person.unconfirmedStandingOrders.forEach(
    ({ standingOrder, changeRequestId }, index) => {
      if (chgRequestId === changeRequestId) {
        result = { standingOrder, index };
        return;
      }
    }
  );
  assert(
    result !== null,
    `Could not find a standing order for the given change request id: '${chgRequestId}'`
  );
  return result;
};

export const updateStandingOrderRequestHandler = async (req, res) => {
  const { person_id: personId, id: standingOrderId } = req.params;
  const attributesToUpdate = _.pick(
    req.body,
    STANDING_ORDER_EDITABLE_ATTRIBUTES
  );

  log.info("updateStandingOrderRequestHandler()", {
    reqParams: req.params,
    reqBody: req.body,
    attributesToUpdate
  });

  const changeRequestId = await updateStandingOrder(
    personId,
    standingOrderId,
    attributesToUpdate
  );

  return res.status(202).send({
    id: changeRequestId,
    status: "AUTHORIZATION_REQUIRED",
    updated_at: new Date().toISOString(),
    url: `:env/v1/change_requests/${changeRequestId}/authorize`
  });
};

export const updateStandingOrder = async (
  personId,
  standingOrderId,
  attributesToUpdate
) => {
  const person = await findPersonByIdOrEmail(personId);

  const changeRequestId = Date.now().toString();
  person.changeRequest = {
    id: changeRequestId,
    method: STANDING_ORDER_UPDATE_METHOD,
    standingOrderId,
    attributesToUpdate
  };
  await savePerson(person);
  return changeRequestId;
};

export const confirmStandingOrderUpdate = async person => {
  const { standingOrderId, attributesToUpdate } = person.changeRequest;
  const [standingOrder] = person.standingOrders.filter(
    item => item.id === standingOrderId
  );
  _.merge(standingOrder, attributesToUpdate);
  await savePerson(person);
  return standingOrder;
};

export const cancelStandingOrderRequestHandler = async (req, res) => {
  const { person_id: personId, id: standingOrderId } = req.params;

  log.info("cancelStandingOrderRequestHandler()", { reqParams: req.params });

  const changeRequestId = await cancelStandingOrder(personId, standingOrderId);

  return res.status(202).send({
    id: changeRequestId,
    status: "AUTHORIZATION_REQUIRED",
    updated_at: new Date().toISOString(),
    url: `:env/v1/change_requests/${changeRequestId}/authorize`
  });
};

export const cancelStandingOrder = async (personId, standingOrderId) => {
  const person = await findPersonByIdOrEmail(personId);

  const changeRequestId = Date.now().toString();
  person.changeRequest = {
    id: changeRequestId,
    method: STANDING_ORDER_CANCEL_METHOD,
    standingOrderId
  };
  await savePerson(person);
  return changeRequestId;
};

export const confirmStandingOrderCancelation = async person => {
  const standingOrderId = person.changeRequest.standingOrderId;
  const [standingOrder] = person.standingOrders.filter(
    item => item.id === standingOrderId
  );
  standingOrder.status = "CANCELED";
  await savePerson(person);
  return standingOrder;
};

const hasFundsToExecuteStandingOrder = async (personId, standingOrderId) => {
  const { person, standingOrder } = await getPersonWithStandingOrder(
    personId,
    standingOrderId
  );

  return person.account.balance.value >= standingOrder.amount.value;
};

const sendSepaScheduledTransactionWebhook = async (
  personId,
  standingOrderId,
  booking
) => {
  const webhook = await getWebhookByType("SEPA_SCHEDULED_TRANSACTION");

  if (!webhook) {
    log.error("(sendSepaScheduledTransactionWebhook) Webhook does not exist");
    return;
  }
  const { person, standingOrder } = await getPersonWithStandingOrder(
    personId,
    standingOrderId
  );

  const payload = {
    id: standingOrder.id,
    account_id: person.account.id,
    processed_at: moment().toISOString(),
    reference: standingOrder.reference,
    source: "standing_order",
    source_id: standingOrder.id,
    status: booking
      ? STANDING_ORDER_PAYMENT_STATUSES.EXECUTED
      : STANDING_ORDER_PAYMENT_STATUSES.DECLINED,
    decline_reason: booking
      ? null
      : "There were insufficient funds to complete this action.",
    transaction_id: booking ? booking.transaction_id : null
  };

  await fetch(webhook.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
};

const getPersonWithStandingOrder = async (personId, standingOrderId) => {
  const person = await getPerson(personId);

  const standingOrder = person.standingOrders.find(
    standingOrder => standingOrder.id === standingOrderId
  );

  if (!standingOrder) {
    throw new Error(
      `Person doesn't have standing order with id: ${standingOrderId}`
    );
  }

  return { person, standingOrder };
};
