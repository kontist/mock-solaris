import _ from "lodash";
import fetch from "node-fetch";
import moment from "moment";
import uuid from "uuid";
import {
  getPerson,
  savePerson,
  getAllPersons,
  getAllIdentifications,
  getTaxIdentifications,
  findPersonByAccountId,
  findPersonByEmail,
  getMobileNumber,
  saveMobileNumber,
  deleteMobileNumber,
  saveSepaDirectDebitReturn,
  getDevicesByPersonId
} from "../db";
import {
  createSepaDirectDebitReturn,
  triggerSepaDirectDebitReturnWebhook
} from "../helpers/sepaDirectDebitReturn";
import { shouldReturnJSON } from "../helpers";
import { triggerWebhook } from "../helpers/webhooks";
import { SEIZURE_STATUSES } from "./seizures";

import * as log from "../logger";

const triggerIdentificationWebhook = payload =>
  triggerWebhook("IDENTIFICATION", payload);

const triggerAccountBlockWebhook = async person => {
  const { iban, id: accountId, locking_status: lockingStatus } = person.account;

  const payload = {
    account_id: accountId,
    person_id: person.id,
    business_id: null,
    locking_status: lockingStatus,
    updated_at: new Date().toISOString(),
    iban
  };

  await triggerWebhook("ACCOUNT_BLOCK", payload);
};

export const triggerBookingsWebhook = async solarisAccountId => {
  const payload = { account_id: solarisAccountId };
  await triggerWebhook("BOOKING", payload);
};

const filterAndSortIdentifications = (identifications, method) => {
  const idents = identifications
    .filter(identification => identification.identificationLinkCreatedAt)
    .sort(
      (id1, id2) =>
        new Date(id2.identificationLinkCreatedAt).getTime() -
        new Date(id1.identificationLinkCreatedAt).getTime()
    );

  if (method) {
    return idents.filter(identification => identification.method === method);
  }

  return idents;
};

export const findIdentificationByEmail = (email, method) => {
  return getAllIdentifications().then(identifications => {
    const userIdentifications = identifications.filter(
      identification => identification.email === email
    );
    const latestIdentification = filterAndSortIdentifications(
      userIdentifications,
      method
    )[0];
    log.info("latestIdentification", latestIdentification);
    return latestIdentification;
  });
};

export const listPersons = async (req, res) => {
  const persons = await getAllPersons();
  res.render("persons", { persons });
};

export const getPersonHandler = async (req, res) => {
  const person = await findPersonByEmail(req.params.email);
  const mobileNumber = await getMobileNumber(person.id);
  const taxIdentifications = await getTaxIdentifications(person.id);
  const devices = await getDevicesByPersonId(person.id);

  if (shouldReturnJSON(req)) {
    res.send(person);
  } else {
    res.render("person", {
      person,
      mobileNumber,
      taxIdentifications,
      devices,
      identifications: person.identifications,
      SEIZURE_STATUSES
    });
  }
};

export const updatePersonHandler = async (req, res) => {
  const person = await findPersonByEmail(req.params.email);

  Object.keys(req.body).forEach(key => {
    person[key] = req.body[key];
  });

  person.address = person.address || {};
  person.address.line_1 = req.body.line_1;
  person.address.line_2 = req.body.line_2;
  person.address.postal_code = req.body.postal_code;
  person.address.city = req.body.city;
  person.address.country = req.body.country;

  if (person.fatca_relevant === "null") {
    person.fatca_relevant = null;
  } else if (person.fatca_relevant === "true") {
    person.fatca_relevant = true;
  } else if (person.fatca_relevant === "false") {
    person.fatca_relevant = false;
  }

  if (!req.body.mobile_number) {
    await deleteMobileNumber(person.id);
  }

  await savePerson(person);

  res.redirect(`/__BACKOFFICE__/person/${person.email}`);
};

export const setIdentificationState = async (req, res) => {
  const { status } = req.body;

  log.info("setIdentificationState body", req.body);
  log.info("setIdentificationState params", req.params);

  const { method = "idnow" } = req.query;

  const identification = await findIdentificationByEmail(
    req.params.email,
    method
  );

  if (!identification) {
    return res.status(404).send("Couldnt find identification");
  }

  const person = await getPerson(identification.person_id);
  person.identifications[identification.id].status = status;

  await savePerson(person);

  if (status === "successful" && identification.method === "idnow") {
    const mobileNumber = await getMobileNumber(identification.person_id);
    if (mobileNumber) {
      mobileNumber.verified = true;
      await saveMobileNumber(identification.person_id, mobileNumber);
    }
  }

  await triggerIdentificationWebhook({
    id: identification.id,
    url: identification.url,
    person_id: identification.person_id,
    completed_at: identification.completed_at,
    reference: identification.reference,
    method,
    status
  });

  res.redirect(`/__BACKOFFICE__/person/${req.params.email}#identifications`);
};

export const displayBackofficeOverview = (req, res) => {
  getAllPersons().then(persons => {
    res.render("overview", { persons });
  });
};

export const processQueuedBookingHandler = async (req, res) => {
  const { personIdOrEmail, id } = req.params;

  await processQueuedBooking(personIdOrEmail, id);
  res.redirect("back");
};

const generateBookingFromStandingOrder = standingOrder => {
  return {
    ...standingOrder,
    id: uuid.v4(),
    valuta_date: moment().format("YYYY-MM-DD"),
    booking_date: moment().format("YYYY-MM-DD"),
    booking_type: "SEPA_CREDIT_TRANSFER",
    amount: {
      value: -Math.abs(standingOrder.amount.value)
    }
  };
};

/**
 * Processes either a normal booking or a Standing Order.
 * @param {string} personIdOrEmail
 * @param {number} id Booking ID
 * @param {Boolean} isStandingOrder (Optional) True if is of type standing order.
 */
export const processQueuedBooking = async (
  personIdOrEmail,
  id,
  isStandingOrder = false
) => {
  let findPerson = () => getPerson(personIdOrEmail);

  if (personIdOrEmail.includes("@")) {
    findPerson = () => findPersonByEmail(personIdOrEmail);
  }

  const person = await findPerson();
  person.transactions = person.transactions || [];

  let bookings;
  if (isStandingOrder) {
    bookings = person.standingOrders || [];
  } else {
    bookings = person.queuedBookings || [];
  }

  let booking;
  if (id) {
    const findQueuedBooking = queuedBooking => queuedBooking.id === id;
    booking = bookings.find(findQueuedBooking);
    // Standing orders are not removed until cancelled or expired.
    if (!isStandingOrder) {
      _.remove(bookings, findQueuedBooking);
    }
  } else {
    booking = bookings.shift();
  }

  if (isStandingOrder) {
    booking = generateBookingFromStandingOrder(booking);
  }

  const allPersons = await getAllPersons();
  const receiver = allPersons
    .filter(dbPerson => dbPerson.account)
    .find(dbPerson => dbPerson.account.iban === booking.recipient_iban);

  const isDirectDebit = ["DIRECT_DEBIT", "SEPA_DIRECT_DEBIT"].includes(
    booking.booking_type
  );

  const wouldOverdraw = person.account.balance.value < booking.amount.value;

  let directDebitReturn;
  let sepaDirectDebitReturn;

  if (isDirectDebit) {
    if (wouldOverdraw) {
      directDebitReturn = {
        ...booking,
        sender_iban: booking.recipient_iban,
        recipient_iban: booking.sender_iban,
        sender_name: booking.recipient_name,
        recipient_name: booking.sender_name,
        sender_bic: booking.recipient_bic,
        recipient_bic: booking.sender_bic,
        id: booking.id
          .split("-")
          .reverse()
          .join("-"),
        booking_type: "SEPA_DIRECT_DEBIT_RETURN",
        amount: {
          value: booking.amount.value,
          unit: "cents",
          currency: "EUR"
        }
      };
    }

    // direct debits come with a negative value
    booking.amount.value = -Math.abs(booking.amount.value);
  }

  person.transactions.push(booking);
  if (directDebitReturn) {
    person.transactions.push(directDebitReturn);
    sepaDirectDebitReturn = createSepaDirectDebitReturn(
      person,
      directDebitReturn
    );
    await saveSepaDirectDebitReturn(sepaDirectDebitReturn);

    if (directDebitReturn.recipient_iban === process.env.WIRECARD_IBAN) {
      const issueDDRurl = `${process.env.MOCKWIRECARD_BASE_URL}/__BACKOFFICE__/customer/${person.email}/issue_ddr`;

      log.info(
        "processQueuedBooking() Creating Direct Debit Return on Wirecard",
        {
          issueDDRurl,
          amount: directDebitReturn.amount.value
        }
      );

      await fetch(issueDDRurl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `amount=${directDebitReturn.amount.value}`
      });
    }
  }

  if (receiver) {
    const receiverPerson = await getPerson(receiver.id);
    receiverPerson.transactions.push(booking);
    if (directDebitReturn) {
      receiverPerson.transactions.push(directDebitReturn);
    }
    await savePerson(receiverPerson);
  }

  await savePerson(person);
  await triggerBookingsWebhook(person.account.id);

  if (sepaDirectDebitReturn) {
    await triggerSepaDirectDebitReturnWebhook(sepaDirectDebitReturn);
  }

  return booking;
};

export const generateBookingForPerson = bookingData => {
  const {
    person,
    purpose,
    amount,
    senderName,
    endToEndId,
    bookingType,
    iban,
    transactionId,
    bookingDate,
    valutaDate
  } = bookingData;

  const recipientName = `${person.salutation} ${person.first_name} ${person.last_name}`;
  const recipientIBAN = person.account.iban;
  const recipientBIC = person.account.bic;

  const senderIBAN = iban;
  const senderBIC = process.env.SOLARIS_BIC;
  const today = moment().format("YYYY-MM-DD");

  return {
    id: uuid.v4(),
    amount: { value: parseInt(amount, 10) },
    valuta_date: valutaDate ? moment(valutaDate).format("YYYY-MM-DD") : today,
    description: purpose,
    booking_date: bookingDate
      ? moment(bookingDate).format("YYYY-MM-DD")
      : today,
    name: `mocksolaris-transaction-${purpose}`,
    recipient_bic: recipientBIC,
    recipient_iban: recipientIBAN,
    recipient_name: recipientName,
    sender_bic: senderBIC,
    sender_iban: senderIBAN,
    sender_name: senderName || "mocksolaris",
    end_to_end_id: endToEndId,
    booking_type: bookingType,
    transaction_id: transactionId
  };
};

/**
 * Returns a Person object by either person ID or email.
 * @param {String} personIdOrEmail
 */
export const findPersonByIdOrEmail = async personIdOrEmail => {
  let findPerson = () => getPerson(personIdOrEmail);

  if (personIdOrEmail.includes("@")) {
    findPerson = () => findPersonByEmail(personIdOrEmail);
  }

  return findPerson();
};

export const queueBookingRequestHandler = async (req, res) => {
  const { accountIdOrEmail } = req.params;

  let findPerson = () => findPersonByAccountId(accountIdOrEmail);

  if (accountIdOrEmail.includes("@")) {
    findPerson = () => findPersonByEmail(accountIdOrEmail);
  }

  log.info(
    "queueBookingRequestHandler()",
    "req.body",
    JSON.stringify(req.body),
    "req.params",
    JSON.stringify(req.params)
  );

  let { amount, purpose, senderName } = req.body;
  const {
    endToEndId,
    hasFutureValutaDate,
    bookingType,
    iban,
    transactionId,
    bookingDate,
    valutaDate
  } = req.body;

  senderName = senderName || "mocksolaris";
  purpose = purpose || "";
  amount = amount ? parseInt(amount, 10) : parseInt(Math.random() * 10000, 10);

  const person = await findPerson();

  person.queuedBookings = person.queuedBookings || [];

  const queuedBooking = generateBookingForPerson({
    person,
    purpose,
    amount,
    senderName,
    endToEndId,
    hasFutureValutaDate,
    bookingType,
    iban,
    transactionId,
    bookingDate,
    valutaDate
  });

  person.queuedBookings.push(queuedBooking);

  await savePerson(person);

  if (shouldReturnJSON(req)) {
    res.status(201).send(queuedBooking);
  } else {
    res.redirect("back");
  }
};

export const updateAccountLockingStatus = async (personId, lockingStatus) => {
  const person = await getPerson(personId);

  person.account = person.account || {};

  const previousLockingStatus = person.account.locking_status;

  person.account = {
    ...person.account,
    locking_status: lockingStatus
  };

  await savePerson(person);

  if (lockingStatus !== previousLockingStatus) {
    await triggerAccountBlockWebhook(person);
  }
};

export const updateAccountLockingStatusHandler = async (req, res) => {
  await updateAccountLockingStatus(req.params.personId, req.body.lockingStatus);
  res.redirect("back");
};
