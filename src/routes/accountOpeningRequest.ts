import type { Request, Response } from "express";
import HttpStatusCodes from "http-status";
import moment from "moment";

import { getPerson, savePerson } from "../db";
import {
  AccountOpeningRequestStatus,
  AccountOpeningRequest,
  PersonWebhookEvent,
} from "../helpers/types";
import { triggerWebhook } from "../helpers/webhooks";
import generateID from "../helpers/id";
import { createAccount } from "../routes/accounts";

export const createAccountOpeningRequest = async (
  req: Request,
  res: Response
) => {
  const { body }: { body: AccountOpeningRequest } = req;

  const personId = body.customer_id;

  const person = await getPerson(personId);

  const accountOpeningRequest = {
    ...body,
    id: generateID(),
    status: AccountOpeningRequestStatus.INITIATED,
    account_id: null,
    iban: null,
    created_at: moment().format("YYYY-MM-DD"),
    updated_at: moment().format("YYYY-MM-DD"),
    rejection_reason: {
      failed_validation: null,
      details: null,
    },
  };

  res.status(HttpStatusCodes.CREATED).send(accountOpeningRequest);

  person.accountOpeningRequests = (person.accountOpeningRequests || []).push(
    accountOpeningRequest
  );

  await savePerson(person);

  const account = await createAccount(personId);

  person.accountOpeningRequests = [
    ...person.accountOpeningRequests.filter(
      (request) => request.id !== accountOpeningRequest.id
    ),
    {
      ...accountOpeningRequest,
      status: AccountOpeningRequestStatus.COMPLETED,
      account_id: account.id,
      iban: account.iban,
    },
  ];

  await savePerson(person);

  await triggerWebhook({
    type: PersonWebhookEvent.ACCOUNT_OPENING_REQUEST,
    payload: accountOpeningRequest,
  });
};
