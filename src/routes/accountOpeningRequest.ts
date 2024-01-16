import type { Request, Response } from "express";
import HttpStatusCodes from "http-status";
import moment from "moment";

import {
  getPerson,
  savePerson,
  saveAccountOpeningRequestToPersonId,
  getPersonIdByAccountOpeningRequest,
} from "../db";
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

  person.accountOpeningRequests = person.accountOpeningRequests || [];
  person.accountOpeningRequests.push(accountOpeningRequest);

  await savePerson(person);

  await saveAccountOpeningRequestToPersonId(accountOpeningRequest.id, personId);

  res.status(HttpStatusCodes.CREATED).send(accountOpeningRequest);

  const account = await createAccount(personId);

  const completedRequest = {
    ...accountOpeningRequest,
    status: AccountOpeningRequestStatus.COMPLETED,
    account_id: account.id,
    iban: account.iban,
  };

  person.accountOpeningRequests = [
    ...person.accountOpeningRequests.filter(
      (request) => request.id !== accountOpeningRequest.id
    ),
    completedRequest,
  ];

  await savePerson(person);

  await triggerWebhook({
    type: PersonWebhookEvent.ACCOUNT_OPENING_REQUEST,
    payload: completedRequest,
  });
};

export const retrieveAccountOpeningRequest = async (
  req: Request,
  res: Response
) => {
  const { id: accountOpeningRequestId } = req.params;

  const personId = await getPersonIdByAccountOpeningRequest(
    accountOpeningRequestId
  );

  const person = await getPerson(personId);

  const accountOpeningRequest = person.accountOpeningRequests.find(
    (request) => request.id === accountOpeningRequestId
  );

  res.status(HttpStatusCodes.OK).send(accountOpeningRequest);
};
