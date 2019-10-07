import uuid from "uuid";
import moment from "moment";
import * as log from "../logger";
import {
  getPerson,
  savePerson,
  findPersonByAccountIBAN,
  getTechnicalUserPerson
} from "../db";

export const createSepaDirectDebit = async (req, res) => {
  const {
    amount,
    description,
    // eslint-disable-next-line camelcase
    collection_date,
    mandate,
    end_to_end_id: e2eId
  } = req.body;

  log.debug("createSepaDirectDebit", {
    body: req.body,
    params: req.params
  });

  const { debtor_iban: iban } = mandate;

  const person = await findPersonByAccountIBAN(iban);
  const technicalPerson = await getTechnicalUserPerson();

  const queuedBooking = {
    amount: {
      ...amount,
      value: amount.value,
      currency: amount.currency || "EUR"
    },
    description: description,
    collection_date: collection_date,
    end_to_end_id: e2eId || null,
    id: uuid.v4(),
    mandate,
    booking_type: "DIRECT_DEBIT",
    sender_iban: description.includes("Neuversuch")
      ? process.env.KONTIST_IBAN
      : process.env.KONTIST_DD_BILLING_IBAN,
    // for simplicity we set it to current date so we don't have to wait 3+ days for DD to be visible on account statements
    booking_date: moment().format("YYYY-MM-DD"),
    valuta_date: moment().format("YYYY-MM-DD"),
    recipient_iban: mandate.debtor_iban,
    sender_name: "Kontist GmbH",
    recipient_name: mandate.debtor_name
  };

  person.queuedBookings.push(queuedBooking);
  technicalPerson.transactions.push(queuedBooking);

  person.account.balance.value -= Math.abs(amount.value);
  person.account.available_balance = person.account.available_balance || {};
  person.account.available_balance.value = person.account.balance.value;

  log.debug("Person account balance after update", {
    balance: person.account.balance.value,
    bookingAmount: amount.value
  });

  if (person.account.balance.value < 0) {
    const directDebitReturn = {
      ...queuedBooking,
      booking_type: "SEPA_DIRECT_DEBIT_RETURN"
    };
    person.queuedBookings.push(directDebitReturn);
    technicalPerson.transactions.push(directDebitReturn);
  }

  await savePerson(person);
  await savePerson(technicalPerson);

  res.status(200).send({
    ...queuedBooking,
    amount: {
      ...queuedBooking.amount,
      value: Math.abs(queuedBooking.amount.value)
    }
  });
};

export const createSepaCreditTransfer = async (req, res) => {
  const { person_id: personId } = req.params;

  const {
    amount,
    description,
    // eslint-disable-next-line camelcase
    recipient_iban,
    // eslint-disable-next-line camelcase
    recipient_name,
    reference,
    end_to_end_id: e2eId
  } = req.body;

  log.debug("createSepaCreditTransfer", {
    body: req.body,
    params: req.params
  });

  const person = await getPerson(personId);
  const queuedBooking = {
    booking_type: "SEPA_CREDIT_TRANSFER",
    amount: {
      ...amount,
      value: -amount.value,
      currency: amount.currency || "EUR"
    },
    description: description,
    end_to_end_id: e2eId || null,
    id: uuid.v4(),
    recipient_bic: null,
    recipient_iban: recipient_iban,
    recipient_name: recipient_name,
    reference: reference,
    status: "authorization_required"
  };

  person.queuedBookings.push(queuedBooking);

  await savePerson(person);

  log.debug("booking pushed to list of pending transfers", { queuedBooking });

  res.status(200).send({
    ...queuedBooking,
    amount: {
      ...queuedBooking.amount,
      value: Math.abs(queuedBooking.amount.value),
      currency: queuedBooking.amount.currency || "EUR"
    }
  });
};

export const authorizeTransaction = async (req, res) => {
  const { person_id: personId, transfer_id: transferId } = req.params;

  log.debug("authorizeTransaction", {
    body: req.body,
    params: req.params
  });

  const person = await getPerson(personId);
  const transfer = person.queuedBookings.find(
    queuedBooking => queuedBooking.id === transferId
  );

  transfer.status = "confirmation_required";
  const token = new Date()
    .getTime()
    .toString()
    .slice(-6);
  person.changeRequest = {
    token,
    id: transferId,
    method: "wiretransfer"
  };

  await savePerson(person);

  log.info("authorized transfer", { transfer, token });

  res.status(200).send(transfer);
};

export const confirmTransaction = async (req, res) => {
  const { person_id: personId, transfer_id: transferId } = req.params;
  const { authorization_token: token } = req.body;

  const person = await getPerson(personId);
  const changeRequest = person.changeRequest || {};
  const transfer = person.queuedBookings.find(
    queuedBooking => queuedBooking.id === transferId
  );

  log.info("confirmTransaction", {
    body: req.body,
    params: req.params,
    changeRequest
  });

  if (transferId !== changeRequest.id || !transfer) {
    return res.status(404).send({
      errors: [
        {
          id: uuid.v4(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::WireTransfer' for id '${transferId}'.`
        }
      ]
    });
  }

  if (token !== changeRequest.token) {
    return res.status(403).send({
      errors: [
        {
          id: uuid.v4(),
          status: 403,
          code: "invalid_tan",
          title: "Invalid TAN",
          detail: `Invalid or expired TAN for Solaris::WireTransfer with id: '${transferId}'`
        }
      ]
    });
  }

  const today = moment().format("YYYY-MM-DD");

  Object.assign(transfer, {
    transaction_id: transfer.id,
    booking_date: today,
    valuta_date: today,
    name: `bank-mock-transaction-${Math.random()}`,
    status: "accepted"
  });

  person.changeRequest = null;

  await savePerson(person);

  log.debug("transfer confirmed", { transfer });

  res.status(200).send(transfer);
};
