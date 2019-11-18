/* eslint-disable camelcase */
import uuid from "uuid";
import moment from "moment";
import * as log from "../logger";
import {
  getPerson,
  savePerson,
  findPersonByAccountIBAN,
  getTechnicalUserPerson
} from "../db";

const SOLARIS_CARDS_ACCOUNT = {
  NAME: "Visa_Solarisbank",
  IBAN: "DE95110101000018501000"
};

export const BOOKING_TYPES = {
  CANCELLATION_BOOKING: "CANCELLATION_BOOKING",
  CANCELLATION_DOUBLE_BOOKING: "CANCELLATION_DOUBLE_BOOKING",
  CREDIT_TRANSFER_CANCELLATION: "CREDIT_TRANSFER_CANCELLATION",
  CURRENCY_TRANSACTION_CANCELLATION: "CURRENCY_TRANSACTION_CANCELLATION",
  DIRECT_DEBIT: "DIRECT_DEBIT",
  FOREIGN_PAYMENT: "FOREIGN_PAYMENT",
  OTHER: "OTHER",
  SEPA_CREDIT_TRANSFER_RETURN: "SEPA_CREDIT_TRANSFER_RETURN",
  SEPA_CREDIT_TRANSFER: "SEPA_CREDIT_TRANSFER",
  SEPA_DIRECT_DEBIT_RETURN: "SEPA_DIRECT_DEBIT_RETURN",
  SEPA_DIRECT_DEBIT: "SEPA_DIRECT_DEBIT",
  TRANSFER: "TRANSFER",
  INTERNATIONAL_CREDIT_TRANSFER: "INTERNATIONAL_CREDIT_TRANSFER",
  CANCELLATION_SEPA_DIRECT_DEBIT_RETURN:
    "CANCELLATION_SEPA_DIRECT_DEBIT_RETURN",
  REBOOKING: "REBOOKING",
  CANCELLATION_DIRECT_DEBIT: "CANCELLATION_DIRECT_DEBIT",
  CANCELLATION_SEPA_CREDIT_TRANSFER_RETURN:
    "CANCELLATION_SEPA_CREDIT_TRANSFER_RETURN",
  CARD_TRANSACTION: "CARD_TRANSACTION"
};

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
    booking_type: BOOKING_TYPES.DIRECT_DEBIT,
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
      booking_type: BOOKING_TYPES.SEPA_DIRECT_DEBIT_RETURN
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
  const transfer = req.body;

  log.debug("createSepaCreditTransfer", {
    body: req.body,
    params: req.params
  });

  const person = await getPerson(personId);

  const queuedBooking = creteBookingFromSepaCreditTransfer(transfer);
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

export const creteBookingFromSepaCreditTransfer = ({
  id,
  amount,
  description = "",
  end_to_end_id = null,
  recipient_iban,
  recipient_name,
  reference
}) => ({
  id: uuid.v4(),
  booking_type: BOOKING_TYPES.SEPA_CREDIT_TRANSFER,
  amount: {
    ...amount,
    value: -amount.value,
    currency: amount.currency || "EUR"
  },
  description: description,
  end_to_end_id,
  recipient_bic: null,
  recipient_iban,
  recipient_name,
  reference,
  status: "authorization_required",
  transaction_id: id,
  booking_date: moment().format("YYYY-MM-DD"),
  valuta_date: moment().format("YYYY-MM-DD"),
  meta_info: null
});

const updateReservationMetaInfo = metaInfo => {
  const parsedMetaInfo = JSON.parse(metaInfo);

  return {
    cards: {
      ...parsedMetaInfo.cards,
      original_amount: {
        ...parsedMetaInfo.cards.original_amount,
        // value for booking should be negative
        value: -parsedMetaInfo.cards.original_amount.value
      }
    }
  };
};

export const creteBookingFromReservation = (person, reservation) => ({
  id: uuid.v4(),
  booking_type: BOOKING_TYPES.CARD_TRANSACTION,
  amount: {
    ...reservation.amount,
    value: -reservation.amount.value
  },
  description: reservation.description,
  recipient_bic: person.account.bic,
  recipient_iban: person.account.iban,
  recipient_name: `${person.first_name} ${person.last_name}`,
  sender_bic: "SOBKDEBBXXX",
  sender_name: SOLARIS_CARDS_ACCOUNT.NAME,
  sender_iban: SOLARIS_CARDS_ACCOUNT.IBAN,
  booking_date: moment().format("YYYY-MM-DD"),
  valuta_date: moment().format("YYYY-MM-DD"),
  meta_info: JSON.stringify(updateReservationMetaInfo(reservation.meta_info))
});
