/* eslint-disable camelcase */
import crypto from "crypto";
import assert from "assert";
import HttpStatusCodes from "http-status";
import * as log from "../logger";
import { findPersonByIdOrEmail } from "./backoffice";
import { creteBookingFromSepaCreditTransfer } from "./transactions";
import { savePerson } from "../db";

export const BATCH_TRANSFER_CREATE_METHOD = "batch_transfer:create";

const validateTransfers = transfers => {
  const references = [];
  for (const transfer of transfers) {
    const { recipient_name, recipient_iban, amount, reference } = transfer;
    if (references.includes(reference)) {
      log.error("validateTransfers - reference not unique");
      throw new Error("validateTransfers - reference not unique");
    }
    references.push(reference);
    if (!recipient_name || !recipient_iban || !amount || !amount.value) {
      log.error("validateTransfers - field/s missing");
      throw new Error("validateTransfers - field/s missing");
    }
  }
};

export const saveBatchTransfer = async (personId, transfers) => {
  const person = await findPersonByIdOrEmail(personId);

  person.changeRequest = {
    method: BATCH_TRANSFER_CREATE_METHOD,
    id: crypto.randomBytes(16).toString("hex"),
    createdAt: new Date().toISOString()
  };

  person.unconfirmedBatchTransfers = person.unconfirmedBatchTransfers || [];
  person.unconfirmedBatchTransfers.push({
    transfers,
    changeRequestId: person.changeRequest.id
  });

  await savePerson(person);
  return person.changeRequest;
};

export const createBatchTransfer = async (req, res) => {
  const { transactions: transfers } = req.body;
  const { person_id: personId } = req.params;

  validateTransfers(transfers);

  const { id, createdAt } = await saveBatchTransfer(personId, transfers);

  res.status(HttpStatusCodes.ACCEPTED).send({
    id,
    status: "AUTHORIZATION_REQUIRED",
    updated_at: createdAt,
    url: ":env/v1/change_requests/:id/authorize"
  });
};

const findUnconfirmedBatchTransfer = (person, changeRequestId) => {
  const index = person.unconfirmedBatchTransfers.findIndex(
    unconfirmedBatchTransfer =>
      unconfirmedBatchTransfer.changeRequestId === changeRequestId
  );

  assert(
    index !== -1,
    `Could not find a batch transfer for the given change request id: '${changeRequestId}'`
  );

  const { transfers } = person.unconfirmedBatchTransfers[index];

  return {
    index,
    transfers
  };
};

export const confirmBatchTransfer = async (person, changeRequestId) => {
  const { transfers, index } = findUnconfirmedBatchTransfer(
    person,
    changeRequestId
  );

  person.unconfirmedBatchTransfers.splice(index, 1);

  const acceptedTransfers = transfers.map(transfer => ({
    ...transfer,
    id: crypto.randomBytes(16).toString("hex"),
    status: "accepted"
  }));

  for (const transfer of acceptedTransfers) {
    const booking = creteBookingFromSepaCreditTransfer(transfer);
    person.queuedBookings.push(booking);
  }

  await savePerson(person);

  return {
    id: crypto.randomBytes(16).toString("hex"),
    status: "ACCEPTED",
    sepa_credit_transfers: acceptedTransfers
  };
};
