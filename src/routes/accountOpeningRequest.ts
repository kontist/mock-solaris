import type { Request, Response } from "express";
import HttpStatusCodes from "http-status";
import moment from "moment";

import {
  getPerson,
  savePerson,
  getCustomerIdByAccountOpeningRequest,
  redlock,
  getBusiness,
  saveBusiness,
  saveAccountOpeningRequestToBusinessId,
  saveAccountOpeningRequestToEntityId,
} from "../db";
import {
  AccountOpeningRequest,
  AccountOpeningRequestStatus,
  AccountType,
  CustomerType,
  MockBusiness,
  MockPerson,
  PersonWebhookEvent,
} from "../helpers/types";
import { triggerWebhook } from "../helpers/webhooks";
import generateID from "../helpers/id";
import { createAccount } from "../routes/accounts";

const getHandlers = (customerType: CustomerType) => {
  switch (customerType) {
    case CustomerType.PERSON:
      return {
        getEntity: getPerson,
        saveEntity: savePerson,
        accountType: AccountType.CHECKING_SOLE_PROPRIETOR,
      };
    case CustomerType.BUSINESS:
      return {
        getEntity: getBusiness,
        saveEntity: saveBusiness,
        accountType: AccountType.CHECKING_BUSINESS,
      };

    default:
      throw new Error(`Invalid customer type: ${customerType}`);
  }
};

export const createAccountOpeningRequest = async (
  req: Request,
  res: Response
) => {
  const data = req.body;
  const entityId = data.customer_id;
  const customerType = data.customer_type as CustomerType;
  const { getEntity, saveEntity, accountType } = getHandlers(customerType);

  const accountOpeningRequest = {
    customer_id: entityId,
    customer_type: customerType,
    product_name: data.product_name,
    account_type: data.account_type,
    account_bic: data.account_bic,
    account_currency: data.account_currency,
    account_purpose: data.account_purpose,
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

  const entityKey = `reslock:${
    process.env.MOCKSOLARIS_REDIS_PREFIX
  }:${customerType.toLowerCase()}:${entityId}`;
  let entity: MockPerson | MockBusiness;
  await redlock.using([entityKey], 5000, async (signal) => {
    if (signal.aborted) {
      throw signal.error;
    }
    entity = await getEntity(entityId);
    entity.accountOpeningRequests = entity.accountOpeningRequests || [];
    entity.accountOpeningRequests.push(accountOpeningRequest);
    await saveEntity(entity);
  });
  await saveAccountOpeningRequestToEntityId(
    accountOpeningRequest.id,
    entityId,
    customerType
  );

  res.status(HttpStatusCodes.CREATED).send(accountOpeningRequest);

  const account = await createAccount(
    entityId,
    { type: accountType },
    customerType
  );

  const completedRequest = {
    ...accountOpeningRequest,
    status: AccountOpeningRequestStatus.COMPLETED,
    account_id: account.id,
    iban: account.iban,
  };

  await redlock.using([entityKey], 5000, async (signal) => {
    if (signal.aborted) {
      throw signal.error;
    }
    entity = await getEntity(entityId);
    entity.accountOpeningRequests = [
      ...entity.accountOpeningRequests.filter(
        (request) => request.id !== accountOpeningRequest.id
      ),
      completedRequest,
    ];
    await saveEntity(entity);
  });

  await triggerWebhook({
    type: PersonWebhookEvent.ACCOUNT_OPENING_REQUEST,
    payload: {
      account_opening_request_id: completedRequest.id,
      customer_id: completedRequest.customer_id,
      status: completedRequest.status,
      account_id: completedRequest.account_id,
      updated_at: completedRequest.updated_at,
      error: null,
    },
  });
};

export const retrieveAccountOpeningRequest = async (
  req: Request,
  res: Response
) => {
  const { id: accountOpeningRequestId } = req.params;
  let accountOpeningRequest: AccountOpeningRequest;

  try {
    let customerType = CustomerType.PERSON;
    let entityId: string;
    let entity: MockPerson | MockBusiness;

    entityId = await getCustomerIdByAccountOpeningRequest(
      accountOpeningRequestId,
      customerType
    );

    if (entityId) {
      entity = await getHandlers(customerType).getEntity(entityId);
    } else {
      customerType = CustomerType.BUSINESS;
      entityId = await getCustomerIdByAccountOpeningRequest(
        accountOpeningRequestId,
        customerType
      );
      entity = await getHandlers(customerType).getEntity(entityId);
    }

    if (!entity) {
      throw new Error("Entity not found");
    }

    accountOpeningRequest = entity?.accountOpeningRequests.find(
      (request) => request.id === accountOpeningRequestId
    );
  } catch (err) {
    res.status(HttpStatusCodes.NOT_FOUND).send({
      id: generateID(),
      status: HttpStatusCodes.NOT_FOUND,
      code: "not_found",
      title: "Not Found",
      detail: `Account Opening Request with id: ${accountOpeningRequestId} not found`,
      source: {
        message: `Account Opening Request with id: ${accountOpeningRequestId} not found`,
        field: "id",
      },
    });
    return;
  }

  res.status(HttpStatusCodes.OK).send(accountOpeningRequest);
};
