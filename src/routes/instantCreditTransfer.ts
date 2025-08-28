import type { Request, Response } from "express";
import { IBAN, CountryCode } from "ibankit";
import HttpStatusCodes from "http-status";
import moment from "moment";
import crypto from "crypto";

import { getLogger } from "../logger";
import {
  findBusinessByAccount,
  findPersonByAccount,
  getBusiness,
  saveBusiness,
  savePerson,
} from "../db";
import generateID from "../helpers/id";
import {
  ChangeRequestStatus,
  InstantCreditTransferStatus,
  BookingType,
  MockPerson,
  Booking,
} from "../helpers/types";
import { triggerBookingsWebhook } from "./backoffice";
import { createBusinessChangeRequest } from "./changeRequest";

export const INSTANT_CREDIT_TRANSFER_CREATE = "instant_credit_transfer:create";

const log = getLogger("instantCreditTransfer");

export const getInstantReachability = (req: Request, res: Response) => {
  const { iban } = req.params;

  log.info(`Checking instant reachability for iban ${iban}`);

  let result = true;

  if (!IBAN.isValid(iban)) {
    result = false;
  }

  // simulating unsuccessful result
  if (iban.includes(CountryCode.FR)) {
    result = false;
  }

  res.send({ sct_instant_reachability: result });
};

export const createInstantCreditTransfer = async (req, res) => {
  const { body } = req;
  const { accountId } = req.params;
  const person = await findPersonByAccount({ id: accountId });
  const business = await findBusinessByAccount({ id: accountId });
  const entity = business || person;

  const {
    creditor_iban: creditorIban,
    creditor_name: creditorName,
    idempotency_key: idempotencyKey,
    description,
    amount,
  } = body;

  const isDataMissing = ![
    creditorIban,
    creditorName,
    amount.value,
    amount.currency,
  ].every((value) => value);

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

  const instantCreditTransfer = {
    id: generateID(),
    valuta_date: moment().format("YYYY-MM-DD"),
    status: InstantCreditTransferStatus.INITIATED,
    amount,
    creditor_iban: creditorIban,
    creditor_name: creditorName,
    idempotency_key: idempotencyKey,
    description,
    end_to_end_id: body.end_to_end_id,
  };

  entity.instantCreditTransfers = entity.instantCreditTransfers || [];
  entity.instantCreditTransfers.push(instantCreditTransfer);

  const changeRequest = {
    method: INSTANT_CREDIT_TRANSFER_CREATE,
    id: crypto.randomBytes(16).toString("hex"),
    createdAt: new Date().toISOString(),
    instantCreditTransfer,
    businessId: business ? business.id : null,
    accountId,
  };

  if (person) {
    person.changeRequest = changeRequest;
    await savePerson(person);
    const response = {
      change_request: {
        id: changeRequest.id,
        status: ChangeRequestStatus.AUTHORIZATION_REQUIRED,
        updated_at: changeRequest.createdAt,
        url: `:env/v1/change_requests/${changeRequest.id}/authorize`,
      },
    };

    res.status(HttpStatusCodes.ACCEPTED).send(response);
    return;
  }

  await saveBusiness(business);
  return createBusinessChangeRequest(
    req,
    res,
    business,
    INSTANT_CREDIT_TRANSFER_CREATE,
    instantCreditTransfer
  );
};

const mapInstantTransferToTransaction = (instantCreditTransfer) => {
  const {
    amount,
    valuta_date: valutaDate,
    description,
    creditor_iban: creditorIban,
    creditor_name: creditorName,
    idempotency_key: idempotencyKey,
    end_to_end_id: e2eId,
  } = instantCreditTransfer;

  return {
    id: generateID(),
    description,
    amount: {
      ...amount,
      value: -amount.value,
    },
    valuta_date: valutaDate,
    booking_date: valutaDate,
    recipient_iban: creditorIban,
    recipient_name: creditorName,
    reference: idempotencyKey,
    created_at: new Date().toISOString(),
    status: "accepted",
    end_to_end_id: e2eId,
    booking_type: BookingType.SEPA_INSTANT_CREDIT_TRANSFER,
  };
};

export const confirmInstantCreditTransfer = async (person: MockPerson) => {
  const instantCreditTransfer =
    person.changeRequest.instantCreditTransfer || person.changeRequest.delta;
  const instantCreditTransferId = instantCreditTransfer.id;
  const business = person.changeRequest.businessId
    ? await getBusiness(person.changeRequest.businessId)
    : null;

  const entity = business || person;
  const save = business ? saveBusiness : savePerson;
  const ict = entity.instantCreditTransfers.find(
    (item) => item.id === instantCreditTransferId
  );

  const transaction = mapInstantTransferToTransaction(ict);
  entity.transactions.push(transaction as unknown as Booking);

  const itemIndex = entity.instantCreditTransfers.findIndex(
    (tr) => tr.id === instantCreditTransfer.id
  );
  entity.instantCreditTransfers[itemIndex] = {
    ...instantCreditTransfer,
    status: InstantCreditTransferStatus.CLEARED,
  };

  await save(entity);
  await triggerBookingsWebhook(entity, transaction);

  return instantCreditTransfer;
};

export const getInstantLimits = async (req, res) => {
  const { accountId } = req.params;
  const person = await findPersonByAccount({ id: accountId });
  const business = await findBusinessByAccount({ id: accountId });
  const entity = business || person;

  if (!entity) {
    throw new Error("Account not found");
  }

  return res.send({
    daily_limit: { value: 1000000, unit: "cents", currency: "EUR" },
    daily_used: { value: 350000, unit: "cents", currency: "EUR" },
    daily_remaining: { value: 650000, unit: "cents", currency: "EUR" },
    per_transaction_limit: {
      value: 500000,
      unit: "cents",
      currency: "EUR",
    },
  });
};

export const updateInstantLimits = async (req, res) => {
  const { accountId } = req.params;
  const { daily_limit, per_transaction_limit } = req.body;

  const person = await findPersonByAccount({ id: accountId });
  const business = await findBusinessByAccount({ id: accountId });
  const entity = business || person;

  if (!entity) {
    throw new Error("Account not found");
  }

  if (!daily_limit && !per_transaction_limit) {
    throw new Error("Daily limit or per transaction limit are required");
  }

  return res.send({
    daily_limit,
    daily_used: { value: 350000, unit: "cents", currency: "EUR" },
    daily_remaining: { value: 650000, unit: "cents", currency: "EUR" },
    per_transaction_limit,
  });
};
