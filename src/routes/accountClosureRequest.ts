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
  AccountWebhookEvent,
} from "../helpers/types";
import { triggerWebhook } from "../helpers/webhooks";
import generateID from "../helpers/id";
import { getAccountFromEntity } from "../helpers";

export const initiateAccountClosureRequest = async (req, res) => {
  const { account_id: accountId, closure_reason: closureReason } = req.body;

  const isDataMissing = ![accountId, closureReason].every((value) => value);

  if (isDataMissing) {
    return res.status(HttpStatusCodes.BAD_REQUEST).send({
      errors: [
        {
          id: generateID(),
          status: HttpStatusCodes.BAD_REQUEST,
          code: "validation_error",
          title: "Validation Error",
          detail: "missing required field",
        },
      ],
    });
  }

  // Mock Solaris only supports CUSTOMER_WISH as a closure reason.
  if (closureReason !== AccountClosureReason.CUSTOMER_WISH) {
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send({
      errors: [
        {
          id: generateID(),
          status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
          code: "validation_error",
          title: "Validation Error",
          detail: "invalid closure reason",
        },
      ],
    });
  }

  // Find account
  const person = await findPersonByAccount({ id: accountId });
  const entity = person
    ? person
    : await findBusinessByAccount({ id: accountId });
  const account = getAccountFromEntity(entity, accountId);
  const closureId = generateID();

  // If => `legal_closure_date` is already set, return 200
  if (account.legal_closure_date) {
    return res.status(HttpStatusCodes.OK).send({
      id: closureId,
      closure_reason: closureReason,
      status: AccountClosureStatus.COMPLETED,
      account_id: accountId,
      technical_closure_date: moment(account.legal_closure_date).format(
        "YYYY-MM-DD"
      ),
      legal_closure_date: moment(account.legal_closure_date).format(
        "YYYY-MM-DD"
      ),
      failure_reason: null,
      payout_allowed: "true",
      updated_at: account.legal_closure_date,
    });
  } else {
    // Else => set `legal_closure_date`, send 201
    const save = person ? savePerson : saveBusiness;

    account.legal_closure_date = new Date();
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
      updated_at: account.legal_closure_date,
    });
  }

  // Initiate closure request update webhook
  await triggerWebhook({
    type: AccountWebhookEvent.ACCOUNT_CLOSURE_REQUEST_UPDATE,
    payload: {
      id: closureId,
      closure_reason: closureReason,
      status: AccountClosureStatus.COMPLETED,
      account_id: accountId,
      technical_closure_date: moment(account.legal_closure_date).format(
        "YYYY-MM-DD"
      ),
      legal_closure_date: moment(account.legal_closure_date).format(
        "YYYY-MM-DD"
      ),
      failure_reason: null,
      payout_allowed: "true",
      updated_at: account.legal_closure_date,
    },
  });
};
