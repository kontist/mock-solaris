import type { Request, Response } from "express";
import { IBAN, CountryCode } from "ibankit";
import HttpStatusCodes from "http-status";
import moment from "moment";
import crypto from "crypto";

import { getLogger } from "../logger";
import { findPersonByAccount, savePerson } from "../db";
import generateID from "../helpers/id";
import {
  ChangeRequestStatus,
  InstantCreditTransferStatus,
  BookingType,
} from "../helpers/types";
import { triggerBookingsWebhook } from "./backoffice";

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

  person.instantCreditTransfers = person.instantCreditTransfers || [];
  person.instantCreditTransfers.push(instantCreditTransfer);

  person.changeRequest = {
    method: INSTANT_CREDIT_TRANSFER_CREATE,
    id: crypto.randomBytes(16).toString("hex"),
    createdAt: new Date().toISOString(),
    instantCreditTransfer,
  };

  const response = {
    change_request: {
      id: person.changeRequest.id,
      status: ChangeRequestStatus.AUTHORIZATION_REQUIRED,
      updated_at: person.changeRequest.createdAt,
      url: `:env/v1/change_requests/${person.changeRequest.id}/authorize`,
    },
  };

  await savePerson(person);

  res.status(HttpStatusCodes.ACCEPTED).send(response);
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

export const confirmInstantCreditTransfer = async (person) => {
  const instantCreditTransferId = person.changeRequest.instantCreditTransfer.id;
  const instantCreditTransfer = person.instantCreditTransfers.find(
    (item) => item.id === instantCreditTransferId
  );

  const transaction = mapInstantTransferToTransaction(instantCreditTransfer);
  person.transactions.push(transaction);

  const itemIndex = person.instantCreditTransfers.findIndex(
    (tr) => tr.id === instantCreditTransfer.id
  );
  person.instantCreditTransfers[itemIndex] = {
    ...instantCreditTransfer,
    status: InstantCreditTransferStatus.CLEARED,
  };

  await savePerson(person);
  await triggerBookingsWebhook(person, transaction);

  return instantCreditTransfer;
};
