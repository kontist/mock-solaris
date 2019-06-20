import crypto from "crypto";
import assert from "assert";
import { savePerson } from "../db";
import moment from "moment";
import uuid from "uuid";

import { findPersonByIdOrEmail, processQueuedBooking } from "./backoffice";

import * as log from "../logger";

const STANDING_ORDER_PAYMENT_FREQUENCY = {
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  EVERYSIXMONTHS: "EVERY_SIX_MONTHS",
  YEARLY: "ANNUALLY"
};

export const STANDING_ORDER_CREATE_METHOD = "standing_order:create";
export const STANDING_ORDER_CANCEL_METHOD = "standing_order:cancel";

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
    firstExecutionDate
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
    month_end_execution: false,
    reoccurrence
  };
};

/**
 * Triggers the standing order to process as a normal booking.
 */
export const triggerStandingOrderRequestHandler = async (req, res) => {
  const { personIdOrEmail, id } = req.params;

  await processQueuedBooking(personIdOrEmail, id, true);

  res.redirect("back");
};

const getNextOccurrenceDate = (firstExecutionDate, reoccurrence) => {
  if (new Date(firstExecutionDate) > new Date()) {
    return firstExecutionDate;
  }
  switch (reoccurrence) {
    case STANDING_ORDER_PAYMENT_FREQUENCY.MONTHLY:
      return moment(firstExecutionDate).add(1, "months");
    case STANDING_ORDER_PAYMENT_FREQUENCY.QUARTERLY:
      return moment(firstExecutionDate).add(3, "months");
    case STANDING_ORDER_PAYMENT_FREQUENCY.EVERYSIXMONTHS:
      return moment(firstExecutionDate).add(6, "months");
    case STANDING_ORDER_PAYMENT_FREQUENCY.YEARLY:
      return moment(firstExecutionDate).add(1, "years");
    default:
      return firstExecutionDate;
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
  standingOrder.next_occurrence = getNextOccurrenceDate(
    standingOrder.first_execution_date,
    standingOrder.reoccurrence
  );

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
