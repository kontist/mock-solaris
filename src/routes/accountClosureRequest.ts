import HttpStatusCodes from "http-status";
import moment from "moment";

import {
  savePerson,
  saveBusiness,
  findPersonByAccount,
  findBusinessByAccount,
} from "../db";
import {
  AccountClosureReason,
  AccountClosureStatus,
  AccountStatus,
  AccountWebhookEvent,
  LockingStatus,
} from "../helpers/types";
import { triggerWebhook } from "../helpers/webhooks";
import generateID from "../helpers/id";
import { getAccountFromEntity } from "../helpers";

export const initiateAccountClosureRequest = async (req, res) => {
  const { account_id: accountId, closure_reason: closureReason } = req.body;

  // Check missing data
  const isDataMissing = ![accountId, closureReason].every((value) => value);

  if (isDataMissing) {
    return res.status(HttpStatusCodes.BAD_REQUEST).send({
      id: generateID(),
      status: HttpStatusCodes.BAD_REQUEST,
      code: "validation_error",
      title: "Validation Error",
      detail: "missing required field",
    });
  }

  // Find account
  const person = await findPersonByAccount({ id: accountId });
  const entity = person
    ? person
    : await findBusinessByAccount({ id: accountId });

  if (!entity) {
    return res.status(HttpStatusCodes.NOT_FOUND).send({
      id: generateID(),
      status: HttpStatusCodes.NOT_FOUND,
      code: "not_found",
      title: "Not Found",
      detail: `Account with id: ${accountId} not found`,
    });
  }

  const account = getAccountFromEntity(entity, accountId);

  if (!account) {
    return res.status(HttpStatusCodes.NOT_FOUND).send({
      id: generateID(),
      status: HttpStatusCodes.NOT_FOUND,
      code: "not_found",
      title: "Not Found",
      detail: `Account with id: ${accountId} not found`,
    });
  }

  const closureId = generateID();

  // Check if account is already inactive
  if (account.status === AccountStatus.INACTIVE) {
    return res.status(HttpStatusCodes.OK).send({
      id: closureId,
      closure_reason: closureReason,
      status: AccountClosureStatus.COMPLETED,
      account_id: accountId,
      technical_closure_date: moment().format("YYYY-MM-DD"),
      legal_closure_date: moment().format("YYYY-MM-DD"),
      failure_reason: null,
      payout_allowed: "true",
      updated_at: new Date(),
    });
  } else {
    // Update account status
    const save = person ? savePerson : saveBusiness;

    account.status = AccountStatus.INACTIVE;
    account.locking_status = LockingStatus.BLOCK;

    await save(entity, {
      accounts: [
        ...entity.accounts.filter((acc) => acc.id !== accountId),
        account,
        entity.account,
      ],
    });

    res.status(HttpStatusCodes.CREATED).send({
      id: closureId,
      closure_reason: closureReason,
      status: AccountClosureStatus.INITIATED,
      account_id: accountId,
      technical_closure_date: null,
      legal_closure_date: null,
      failure_reason: null,
      payout_allowed: "true",
      updated_at: new Date(),
    });
  }

  // Trigger webhooks
  await triggerWebhook({
    type: AccountWebhookEvent.ACCOUNT_CLOSURE_REQUEST_UPDATE,
    payload: {
      id: closureId,
      closure_reason: closureReason,
      status: AccountClosureStatus.COMPLETED,
      account_id: accountId,
      technical_closure_date: moment().format("YYYY-MM-DD"),
      legal_closure_date: moment().format("YYYY-MM-DD"),
      failure_reason: null,
      payout_allowed: "true",
      updated_at: new Date(),
    },
  });
  await triggerWebhook({
    type: AccountWebhookEvent.ACCOUNT_CLOSURE,
    payload: {
      account_id: accountId,
      iban: account.iban,
      person_id: person ? person.id : null,
      business_id: person ? null : entity.id,
    },
  });
};
