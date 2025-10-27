import uuid from "node-uuid";
import assert from "assert";
import HttpStatusCodes from "http-status";

import * as log from "../logger";
import { creteBookingFromSepaCreditTransfer } from "./transactions";
import { mapInstantTransferToTransaction } from "./instantCreditTransfer";
import { findPersonByAccount, getPerson, savePerson } from "../db";

export const BATCH_TRANSFER_CREATE_METHOD = "batch_transfer:create";

const validateTransfers = (transfers) => {
  const references = [];
  const shouldRequireVoP = !!transfers[0].verifications_of_payee_id;

  if (
    shouldRequireVoP &&
    !transfers.every((t) => t.verifications_of_payee_id)
  ) {
    log.error(
      "validateTransfers - verifications_of_payee_id must be present in all transfers"
    );
    throw new Error(
      "validateTransfers - verifications_of_payee_id must be present in all transfers"
    );
  }

  for (const transfer of transfers) {
    const { creditor_name, creditor_iban, amount, reference } = transfer;
    if (references.includes(reference)) {
      log.error("validateTransfers - reference not unique");
      throw new Error("validateTransfers - reference not unique");
    }
    references.push(reference);
    if (!creditor_name || !creditor_iban || !amount || !amount.value) {
      log.error("validateTransfers - field/s missing");
      throw new Error("validateTransfers - field/s missing");
    }
  }
};

export const saveBatchTransfer = async (
  personId,
  transfers,
  transferType,
  reference,
  description
) => {
  const person = await getPerson(personId);

  person.changeRequest = {
    method: BATCH_TRANSFER_CREATE_METHOD,
    id: uuid.v4(),
    createdAt: new Date().toISOString(),
  };

  const batchId = uuid.v4();

  person.unconfirmedBatchTransfers = person.unconfirmedBatchTransfers || [];
  person.unconfirmedBatchTransfers.push({
    id: batchId,
    transfers: transfers.map((transfer) => ({
      ...transfer,
      type: transferType,
      batch_id: batchId,
    })),
    description,
    reference,
    changeRequestId: person.changeRequest.id,
  });

  await savePerson(person);
  return { ...person.changeRequest, batchId };
};

export const createBatchTransfer = async (req, res) => {
  const {
    transfers,
    reference,
    transfer_type: transferType,
    description,
  } = req.body;
  const { account_id: accountId } = req.params;

  const person = await findPersonByAccount({ id: accountId });

  validateTransfers(transfers);

  const { id, createdAt, batchId } = await saveBatchTransfer(
    person.id,
    transfers,
    transferType,
    reference,
    description
  );

  res.status(HttpStatusCodes.ACCEPTED).send({
    id: batchId,
    change_request: {
      id,
      status: "CONFIRMATION_REQUIRED",
      updated_at: createdAt,
      url: ":env/v1/change_requests/:id/authorize",
    },
  });
};

const findUnconfirmedBatchTransfer = (person, changeRequestId) => {
  const index = person.unconfirmedBatchTransfers.findIndex(
    (unconfirmedBatchTransfer) =>
      unconfirmedBatchTransfer.changeRequestId === changeRequestId
  );

  assert(
    index !== -1,
    `Could not find a batch transfer for the given change request id: '${changeRequestId}'`
  );

  const { id, transfers, description, transfer_type } =
    person.unconfirmedBatchTransfers[index];

  return {
    index,
    id,
    transfers,
    description,
    transferType: transfer_type,
  };
};

export const confirmBatchTransfer = async (person, changeRequestId) => {
  const { id, transfers, description, transferType, index } =
    findUnconfirmedBatchTransfer(person, changeRequestId);

  person.unconfirmedBatchTransfers.splice(index, 1);

  const acceptedTransfers = transfers.map((transfer) => ({
    ...transfer,
    id: uuid.v4(),
    status: "accepted",
  }));

  for (const transfer of acceptedTransfers) {
    if (transferType === "SCT_INSTANT") {
      const transaction = mapInstantTransferToTransaction(transfer);
      person.transactions.push(transaction);
    } else {
      const booking = creteBookingFromSepaCreditTransfer(transfer);
      person.queuedBookings.push(booking);
    }
  }

  await savePerson(person);

  return {
    id,
    account_id: person.accounts[0].id,
    status: "ACCEPTED",
    transfer_type: transferType,
    description,
    total_amount: acceptedTransfers.reduce(
      (sum, transfer) => sum + transfer.amount.value,
      0
    ),
    transfers_summary: {
      executed: acceptedTransfers.length,
      failed: 0,
    },
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};

export const listBatchTransferTransactions = async (req, res) => {
  const { account_id: accountId, batch_transfer_id: batchTransferId } =
    req.params;

  const person = await findPersonByAccount({ id: accountId });
  const bookings = person.queuedBookings.filter(
    (booking) => booking.batch_id === batchTransferId
  );
  const transfers = person.transactions.filter(
    (transaction) => transaction.batch_id === batchTransferId
  );

  res.status(HttpStatusCodes.OK).send([...bookings, ...transfers]);
};
