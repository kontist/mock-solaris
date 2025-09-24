import crypto from "crypto";
import assert from "assert";
import moment, { Moment } from "moment";
import _ from "lodash";

import {
  findBusinessByAccount,
  findPersonByAccount,
  getPerson,
  saveBusiness,
  savePerson,
} from "../db";
import { triggerWebhook } from "../helpers/webhooks";
import * as log from "../logger";
import { processQueuedBooking } from "./backoffice";
import {
  SCHEDULED_TRANSFER_STATUS,
  ScheduledTransfer,
  TransactionWebhookEvent,
} from "../helpers/types";
import generateID from "../helpers/id";
import { getAccountFromEntity } from "../helpers";
import { isVerificationOfPayeeRequired } from "../helpers/verificationOfPayee";

export const SCHEDULED_TRANSFER_CREATE_METHOD = "scheduled_transfer:create";
export const SCHEDULED_TRANSFER_CANCEL_METHOD = "scheduled_transfer:cancel";

export const showScheduledTransferRequestHandler = async (req, res) => {
  const { account_id: accountId, id: scheduledTransferId } = req.params;

  const { scheduledTransfer } = await getScheduledTransfer(
    accountId,
    scheduledTransferId
  );

  res.status(200).send(scheduledTransfer);
};

export const createScheduledTransferRequestHandler = async (req, res) => {
  const { account_id: accountId } = req.params;

  log.info("createScheduledTransferRequestHandler()", {
    reqBody: req.body,
    reqParams: req.params,
  });

  const {
    transfer_type: transferType,
    initiator_reference: initiatorReference,
    creditor_iban: creditorIban,
    creditor_name: creditorName,
    creditor_bic: creditorBic,
    amount,
    description,
    end_to_end_id: endToEndId,
    execution_schedule: executionSchedule,
    active_from: activeFrom,
    active_to: activeTo,
    authorizer_id: authorizerId,
    verification_of_payee_id: verificationOfPayeeId,
  } = req.body;

  if (isVerificationOfPayeeRequired() && !verificationOfPayeeId) {
    return res.status(400).send({
      errors: [
        {
          id: generateID(),
          status: 400,
          code: "bad_request",
          title: "Bad Request",
          detail: `Verification of payee is required.`,
        },
      ],
    });
  }

  try {
    const { id, createdAt } = await createScheduledTransfer({
      accountId,
      transferType,
      initiatorReference,
      creditorIban,
      creditorName,
      creditorBic,
      amount,
      description,
      endToEndId,
      executionSchedule,
      activeFrom,
      activeTo,
      authorizerId,
      verificationOfPayeeId,
    });

    return res.status(202).send({
      id,
      status: "AUTHORIZATION_REQUIRED",
      updated_at: createdAt,
      url: ":env/v1/change_requests/:id/authorize",
    });
  } catch (err) {
    log.error(
      "createScheduledTransferRequestHandler() Creating Scheduled Transfer failed",
      err
    );
    res.status(500).send({
      reason: err.message,
      status: "Creating Scheduled Transfer failed!",
    });
  }
};

/**
 * Saves the scheduled transfer to the Accounts's ScheduledTransfers array.
 * Returns the change request.
 * @param {Object} scheduledTransferData
 */
export const createScheduledTransfer = async (scheduledTransferData) => {
  const {
    accountId,
    transferType,
    initiatorReference,
    creditorIban,
    creditorName,
    creditorBic,
    amount,
    description,
    endToEndId,
    executionSchedule,
    activeFrom,
    activeTo,
    authorizerId,
    verificationOfPayeeId,
  } = scheduledTransferData;

  if (
    !accountId ||
    !transferType ||
    !initiatorReference ||
    !creditorIban ||
    !creditorName ||
    !amount ||
    !executionSchedule ||
    !activeFrom ||
    !authorizerId
  ) {
    log.error("createScheduledTransfer - field/s missing");
    throw new Error("createScheduledTransfer - field/s missing");
  }

  const scheduledTransfer = generateScheduledTransferForAccount({
    accountId,
    transferType,
    creditorIban,
    creditorName,
    creditorBic,
    amount,
    description,
    endToEndId,
    executionSchedule,
    activeFrom,
    activeTo,
    authorizerId,
    verificationOfPayeeId,
  });

  const person = await findPersonByAccount({ id: accountId });
  const business = await findBusinessByAccount({ id: accountId });

  if (!person && !business) {
    log.error(`Account not found for id: ${accountId}`);
    throw new Error(`Couldn't find 'Solaris::Account' for id '${accountId}'.`);
  }

  const entity = person || business;
  const account = getAccountFromEntity(entity, accountId);

  if (person) {
    person.changeRequest = {
      method: SCHEDULED_TRANSFER_CREATE_METHOD,
      id: crypto.randomBytes(16).toString("hex"),
      createdAt: new Date().toISOString(),
    };

    account.unconfirmedScheduledTransfers =
      account.unconfirmedScheduledTransfers || [];
    account.unconfirmedScheduledTransfers.push({
      scheduledTransfer,
      changeRequestId: person.changeRequest.id,
    });

    person.account = account;

    await savePerson(person);

    return person.changeRequest;
  } else {
    const authorizer = await getPerson(authorizerId);
    authorizer.changeRequest = {
      method: SCHEDULED_TRANSFER_CREATE_METHOD,
      id: crypto.randomBytes(16).toString("hex"),
      createdAt: new Date().toISOString(),
    };

    account.unconfirmedScheduledTransfers =
      account.unconfirmedScheduledTransfers || [];
    account.unconfirmedScheduledTransfers.push({
      scheduledTransfer,
      changeRequestId: authorizer.changeRequest.id,
    });

    await savePerson(authorizer);

    business.account = account;
    await saveBusiness(business);

    return authorizer.changeRequest;
  }
};

export const generateScheduledTransferForAccount = (scheduledTransferData) => {
  const {
    accountId,
    transferType,
    creditorIban,
    creditorName,
    creditorBic,
    amount,
    description,
    executionSchedule,
    endToEndId,
    activeFrom,
    activeTo,
    authorizerId,
    verificationOfPayeeId,
  } = scheduledTransferData;

  const amountValue = Math.max(0, Math.min(10000000, amount.value));

  return {
    id: generateID(),
    account_id: accountId,
    status: SCHEDULED_TRANSFER_STATUS.AUTHORIZATION_REQUIRED,
    transfer_type: transferType,
    creditor_iban: creditorIban,
    creditor_name: creditorName,
    creditor_bic: creditorBic,
    amount: {
      value: amountValue,
      currency: amount.currency,
    },
    description,
    active_from: moment(activeFrom).format("YYYY-MM-DD"),
    active_to: activeTo
      ? moment(activeTo).format("YYYY-MM-DD")
      : moment(activeFrom).format("YYYY-MM-DD"),
    execution_schedule: executionSchedule,
    end_to_end_id: endToEndId,
    authorizer_id: authorizerId,
    verification_of_payee_id: verificationOfPayeeId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};

/**
 * Triggers the scheduled transfer to process as a normal booking.
 */
export const triggerScheduledTransferRequestHandler = async (req, res) => {
  const { accountId, scheduledTransferId } = req.params;

  const declinedReason = await checkScheduledTransferPreconditions(
    accountId,
    scheduledTransferId
  );

  let booking;
  if (!declinedReason) {
    booking = await processQueuedBooking(personId, standingOrderId, true);
  }

  // We need to update next occurence and call webhook in all cases, even when a standing order is declined
  await updateStandingOrderNextOccurrenceDateAndStatus(
    personId,
    standingOrderId
  );

  await triggerSepaScheduledTransactionWebhook({
    personId,
    standingOrderId,
    booking,
    declinedReason,
  });

  res.redirect("back");
};

const checkScheduledTransferPreconditions = async (
  accountId,
  scheduledTransferId
) => {
  const person = await getPerson(personId);
  const { locking_status: accountLockingStatus } = person.account;
  if (!["NO_BLOCK", "CREDIT_BLOCK"].includes(accountLockingStatus)) {
    return `Expected the status for 'Solaris::Account' to be 'NO_BLOCK, CREDIT_BLOCK' but was '${accountLockingStatus}'`;
  }

  if (!(await hasFundsToExecuteStandingOrder(personId, standingOrderId))) {
    return "There were insufficient funds to complete this action.";
  }

  // All checks have been passed. Standing order is good to go!
  return null;
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

export const getNextOccurrenceDate = (
  lastDate: Moment,
  reoccurrence: STANDING_ORDER_PAYMENT_FREQUENCY
) => {
  switch (reoccurrence) {
    case STANDING_ORDER_PAYMENT_FREQUENCY.MONTHLY:
      return lastDate.add(1, "months");
    case STANDING_ORDER_PAYMENT_FREQUENCY.QUARTERLY:
      return lastDate.add(3, "months");
    case STANDING_ORDER_PAYMENT_FREQUENCY.EVERY_SIX_MONTHS:
      return lastDate.add(6, "months");
    case STANDING_ORDER_PAYMENT_FREQUENCY.YEARLY:
      return lastDate.add(1, "years");
    case STANDING_ORDER_PAYMENT_FREQUENCY.WEEKLY:
      return lastDate.add(1, "week");
    case STANDING_ORDER_PAYMENT_FREQUENCY.BIWEEKLY:
      return lastDate.add(2, "weeks");
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

export const cancelStandingOrderRequestHandler = async (req, res) => {
  const { person_id: personId, id: standingOrderId } = req.params;

  log.info("cancelStandingOrderRequestHandler()", { reqParams: req.params });

  const changeRequestId = await cancelStandingOrder(personId, standingOrderId);

  return res.status(202).send({
    id: changeRequestId,
    status: "AUTHORIZATION_REQUIRED",
    updated_at: new Date().toISOString(),
    url: `:env/v1/change_requests/${changeRequestId}/authorize`,
  });
};

export const cancelStandingOrder = async (personId, standingOrderId) => {
  const person = await getPerson(personId);

  const changeRequestId = Date.now().toString();
  person.changeRequest = {
    id: changeRequestId,
    method: STANDING_ORDER_CANCEL_METHOD,
    standingOrderId,
  };
  await savePerson(person);
  return changeRequestId;
};

export const confirmStandingOrderCancelation = async (person) => {
  const standingOrderId = person.changeRequest.standingOrderId;
  const [standingOrder] = person.standingOrders.filter(
    (item) => item.id === standingOrderId
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

const triggerSepaScheduledTransactionWebhook = async ({
  personId,
  standingOrderId,
  booking,
  declinedReason,
}) => {
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
    status: declinedReason
      ? STANDING_ORDER_PAYMENT_STATUSES.DECLINED
      : STANDING_ORDER_PAYMENT_STATUSES.EXECUTED,
    declined_reason: declinedReason,
    transaction_id: booking ? booking.transaction_id : null,
  };

  await triggerWebhook({
    type: TransactionWebhookEvent.SEPA_SCHEDULED_TRANSACTION,
    payload,
  });
};

const getScheduledTransfer = async (
  accountId,
  scheduledTransferId
): Promise<{
  scheduledTransfer: ScheduledTransfer;
}> => {
  const person = await findPersonByAccount({ id: accountId });
  const business = await findBusinessByAccount({ id: accountId });

  if (!person && !business) {
    log.error(`Account not found for id: ${accountId}`);
    throw new Error(`Couldn't find 'Solaris::Account' for id '${accountId}'.`);
  }

  const entity = person || business;
  const account = getAccountFromEntity(entity, accountId);

  const scheduledTransfer = account.scheduledTransfers.find(
    (st) => st.id === scheduledTransferId
  );

  if (!scheduledTransfer) {
    throw new Error(
      `Account doesn't have scheduled transfer with id: ${scheduledTransferId}`
    );
  }

  return { scheduledTransfer };
};
