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
import {
  processBusinessQueuedBooking,
  processQueuedBooking,
} from "./backoffice";
import {
  EXECUTION_SCHEDULE,
  SCHEDULED_TRANSFER_STATUS,
  ScheduledTransfer,
  TransactionWebhookEvent,
} from "../helpers/types";
import generateID from "../helpers/id";
import { getAccountFromEntity } from "../helpers";
import { isVerificationOfPayeeRequired } from "../helpers/verificationOfPayee";

export const SCHEDULED_TRANSFER_CREATE_METHOD = "scheduled_transfer:create";
export const SCHEDULED_TRANSFER_CANCEL_METHOD = "scheduled_transfer:cancel";

export const getScheduledTransferRequestHandler = async (req, res) => {
  const { account_id: accountId, id: scheduledTransferId } = req.params;

  const { scheduledTransfer } = await getScheduledTransfer(
    accountId,
    scheduledTransferId
  );

  res.status(200).send(scheduledTransfer);
};

export const listScheduledTransfersRequestHandler = async (req, res) => {
  const { account_id: accountId } = req.params;

  const person = await findPersonByAccount({ id: accountId });
  const business = await findBusinessByAccount({ id: accountId });

  if (!person && !business) {
    log.error(`Account not found for id: ${accountId}`);
    throw new Error(`Couldn't find 'Solaris::Account' for id '${accountId}'.`);
  }

  const entity = person || business;
  const account = getAccountFromEntity(entity, accountId);

  res.status(200).send(account.scheduledTransfers || []);
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

    const response = {
      id,
      change_request: {
        id,
        status: "AUTHORIZATION_REQUIRED",
        updated_at: createdAt,
        url: ":env/v1/change_requests/:id/authorize",
      },
    };

    return res.status(202).send(response);
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
    next_execution_date: moment(activeFrom).format("YYYY-MM-DD"),
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

  const person = await findPersonByAccount({ id: accountId });
  const business = await findBusinessByAccount({ id: accountId });

  if (!person && !business) {
    log.error(`Account not found for id: ${accountId}`);
    throw new Error(`Couldn't find 'Solaris::Account' for id '${accountId}'.`);
  }

  const entity = person || business;
  const account = getAccountFromEntity(entity, accountId);

  const declinedReason = await checkScheduledTransferPreconditions(
    account,
    scheduledTransferId
  );

  let booking;

  if (!declinedReason) {
    booking = !!person
      ? processQueuedBooking(accountId, scheduledTransferId, false, true)
      : processBusinessQueuedBooking(
          accountId,
          scheduledTransferId,
          false,
          true
        );
  }

  // We need to update next execution date and call webhook in all cases, even when a scheduled transfer is declined
  await updateScheduledTransferNextExecutionDateAndStatus(
    person,
    business,
    account,
    scheduledTransferId
  );

  await triggerSepaScheduledTransactionWebhook({
    person,
    scheduledTransferId,
  });

  res.redirect("back");
};

const checkScheduledTransferPreconditions = async (
  account,
  scheduledTransferId
) => {
  const { locking_status: accountLockingStatus } = account;

  if (!["NO_BLOCK", "CREDIT_BLOCK"].includes(accountLockingStatus)) {
    return `Expected the status for 'Solaris::Account' to be 'NO_BLOCK, CREDIT_BLOCK' but was '${accountLockingStatus}'`;
  }

  if (
    !(await hasFundsToExecuteScheduledTransfer(account, scheduledTransferId))
  ) {
    return "There were insufficient funds to complete this action.";
  }

  // All checks have been passed. Standing order is good to go!
  return null;
};

const updateScheduledTransferNextExecutionDateAndStatus = async (
  person,
  business,
  account,
  scheduledTransferId
) => {
  const { scheduledTransfer } = await getScheduledTransfer(
    account.id,
    scheduledTransferId
  );

  const nextExecutionDate = getNextExecutionDate(
    moment(scheduledTransfer.next_execution_date),
    scheduledTransfer.execution_schedule
  );

  if (
    scheduledTransfer.active_to &&
    nextExecutionDate.isAfter(scheduledTransfer.active_to)
  ) {
    scheduledTransfer.next_execution_date = null;
    scheduledTransfer.status = SCHEDULED_TRANSFER_STATUS.CONCLUDED;
  } else {
    scheduledTransfer.next_execution_date =
      nextExecutionDate.format("YYYY-MM-DD");
  }

  if (person) {
    person.account = account;
    await savePerson(person);
  } else {
    business.account = account;
    await saveBusiness(business);
  }
};

export const getNextExecutionDate = (
  lastDate: Moment,
  executionSchedule: EXECUTION_SCHEDULE
) => {
  switch (executionSchedule) {
    case EXECUTION_SCHEDULE["ONE-TIME"]:
      return lastDate;
    case EXECUTION_SCHEDULE.WEEKLY:
      return lastDate.add(1, "week");
    case EXECUTION_SCHEDULE.EVERY_TWO_WEEKS:
      return lastDate.add(2, "weeks");
    case EXECUTION_SCHEDULE.MONTHLY:
      return lastDate.add(1, "months");
    case EXECUTION_SCHEDULE.QUARTERLY:
      return lastDate.add(3, "months");
    case EXECUTION_SCHEDULE.EVERY_SIX_MONTHS:
      return lastDate.add(6, "months");
    case EXECUTION_SCHEDULE.YEARLY:
      return lastDate.add(1, "years");
    default:
      throw new Error(
        `Unexpected standing order reoccurrence: ${executionSchedule}`
      );
  }
};

export const confirmScheduledTransferCreation = async (
  person,
  changeRequestId
) => {
  person.scheduledTransfers = person.scheduledTransfers || [];

  const { scheduledTransfer, index } = findUnconfirmedScheduledTransfer(
    person,
    changeRequestId
  );

  person.account.unconfirmedScheduledTransfers.splice(index, 1);

  scheduledTransfer.status = SCHEDULED_TRANSFER_STATUS.ACTIVE;
  scheduledTransfer.next_execution_date = scheduledTransfer.active_from;

  person.account.scheduledTransfers = person.account.scheduledTransfers || [];
  person.account.scheduledTransfers.push(scheduledTransfer);

  await savePerson(person);

  return scheduledTransfer;
};

const findUnconfirmedScheduledTransfer = (person, chgRequestId) => {
  let result = null;
  person.account.unconfirmedScheduledTransfers.forEach(
    ({ scheduledTransfer, changeRequestId }, index) => {
      if (chgRequestId === changeRequestId) {
        result = { scheduledTransfer, index };
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

export const cancelScheduledTransferRequestHandler = async (req, res) => {
  const { account_id: accountId, id: scheduledTransferId } = req.params;

  log.info("cancelScheduledTransferRequestHandler()", {
    reqParams: req.params,
  });

  const changeRequestId = await cancelScheduledTransfer(
    accountId,
    scheduledTransferId
  );

  const response = {
    id: changeRequestId,
    change_request: {
      id: changeRequestId,
      status: "AUTHORIZATION_REQUIRED",
      updated_at: new Date().toISOString(),
      url: `:env/v1/change_requests/${changeRequestId}/authorize`,
    },
  };

  return res.status(202).send(response);
};

export const cancelScheduledTransfer = async (
  accountId,
  scheduledTransferId
) => {
  const person = await findPersonByAccount({ id: accountId });

  const changeRequestId = Date.now().toString();
  person.changeRequest = {
    id: changeRequestId,
    method: SCHEDULED_TRANSFER_CANCEL_METHOD,
    scheduledTransferId,
  };
  await savePerson(person);
  return changeRequestId;
};

export const confirmScheduledTransferCancelation = async (person) => {
  const scheduledTransferId = person.changeRequest.scheduledTransferId;
  const [scheduledTransfer] = person.account.scheduledTransfers.filter(
    (item) => item.id === scheduledTransferId
  );
  scheduledTransfer.status = SCHEDULED_TRANSFER_STATUS.CANCELED;
  await savePerson(person);
  return scheduledTransfer;
};

const hasFundsToExecuteScheduledTransfer = async (
  account,
  scheduledTransferId
) => {
  const scheduledTransfer = account.scheduledTransfers.find(
    (so) => so.id === scheduledTransferId
  );

  return account.balance.value >= scheduledTransfer.amount.value;
};

const triggerSepaScheduledTransactionWebhook = async ({
  person,
  scheduledTransferId,
}) => {
  const { scheduledTransfer } = await getScheduledTransfer(
    person.account.id,
    scheduledTransferId
  );

  const payload = {
    id: scheduledTransferId,
    account_id: person.account.id,
    status: scheduledTransfer.status,
  };

  await triggerWebhook({
    type: TransactionWebhookEvent.SCHEDULED_TRANSFER_STATUS_CHANGED,
    payload,
  });
};

const getScheduledTransfer = async (
  accountId: string,
  scheduledTransferId: string
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
