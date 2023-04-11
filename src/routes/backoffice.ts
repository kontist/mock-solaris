import _ from "lodash";
import moment from "moment";
import uuid from "node-uuid";
import HttpStatusCodes from "http-status";
import {
  getPerson,
  savePerson,
  getAllPersons,
  getAllIdentifications,
  getTaxIdentifications,
  getMobileNumber,
  saveMobileNumber,
  deleteMobileNumber,
  saveSepaDirectDebitReturn,
  getDevicesByPersonId,
  saveTaxIdentifications,
  getPersonOrigin,
  setPersonOrigin,
  getDeviceConsents,
  getDeviceActivities,
  getWebhooks,
} from "../db";
import {
  createSepaDirectDebitReturn,
  triggerSepaDirectDebitReturnWebhook,
} from "../helpers/sepaDirectDebitReturn";
import { shouldReturnJSON } from "../helpers";
import { triggerWebhook } from "../helpers/webhooks";
import { SEIZURE_STATUSES } from "./seizures";

import * as log from "../logger";
import { changeCardStatus, upsertProvisioningToken } from "../helpers/cards";
import { createReservation, updateReservation } from "../helpers/reservations";
import { createCreditPresentment } from "../helpers/creditPresentment";
import {
  TransactionType,
  BookingType,
  CardStatus,
  PersonWebhookEvent,
  AccountWebhookEvent,
  TransactionWebhookEvent,
  IdentificationStatus,
  ScreeningProgress,
  RiskClarificationStatus,
  CustomerVettingStatus,
  MockPerson,
} from "../helpers/types";
import {
  changeOverdraftApplicationStatus,
  issueInterestAccruedBooking,
} from "../helpers/overdraft";

const triggerIdentificationWebhook = (payload, personId?: string) =>
  triggerWebhook({
    type: PersonWebhookEvent.IDENTIFICATION,
    payload,
    personId,
  });

const triggerAccountBlockWebhook = async (person: MockPerson) => {
  const { iban, id: accountId, locking_status: lockingStatus } = person.account;

  const payload = {
    account_id: accountId,
    person_id: person.id,
    business_id: null,
    locking_status: lockingStatus,
    updated_at: new Date().toISOString(),
    iban,
  };

  await triggerWebhook({
    type: AccountWebhookEvent.ACCOUNT_BLOCK,
    payload,
    personId: person.id,
  });
};

export const triggerBookingsWebhook = async (person: MockPerson) => {
  const payload = { account_id: person.account.id };
  await triggerWebhook({
    type: TransactionWebhookEvent.BOOKING,
    payload,
    personId: person.id,
  });
};

export const addAccountSeizureProtectionHandler = async (req, res) => {
  const { email } = req.params;

  const {
    currentBlockedAmount,
    protectedAmount,
    protectedAmountExpiring,
    protectedAmountExpiringDate,
  } = req.body;

  const persons = await getAllPersons();
  const person = persons.find((item) => item.email === email);

  if (!person?.account) return null;

  person.account = {
    ...person.account,
    seizure_protection: {
      current_blocked_amount: {
        value: currentBlockedAmount,
        currency: "EUR",
        unit: "cents",
      },
      protected_amount: {
        value: protectedAmount,
        currency: "EUR",
        unit: "cents",
      },
      protected_amount_expiring: {
        value: protectedAmountExpiring,
        currency: "EUR",
        unit: "cents",
      },
      protected_amount_expiring_date: protectedAmountExpiringDate,
    },
  };

  await savePerson(person);

  if (shouldReturnJSON(req)) {
    res.status(200).send(person.account);
  } else {
    res.redirect("back");
  }
};

export const deleteAccountSeizureProtectionHandler = async (req, res) => {
  const { email } = req.params;

  const persons = await getAllPersons();
  const person = persons.find((item) => item.email === email);

  if (!person?.account) return null;

  person.account = {
    ...person.account,
    seizure_protection: null,
  };

  await savePerson(person);

  if (shouldReturnJSON(req)) {
    res.status(204).send();
  } else {
    res.redirect("back");
  }
};

/**
 * Handles changes on the provisioning token and redirects back to refresh data.
 * Reads the personId and cardId from the url params and the status (if sent) from the body.
 * @param req {Express.Request}
 * @param res {Express.Response}
 */
export const provisioningTokenHandler = async (req, res) => {
  const { personId, cardId } = req.params;
  const { status } = req.body;
  await upsertProvisioningToken(personId, cardId, status);
  res.redirect("back");
};

const filterAndSortIdentifications = (identifications, method) => {
  const idents = identifications
    .filter((identification) => identification.identificationLinkCreatedAt)
    .sort(
      (id1, id2) =>
        new Date(id2.identificationLinkCreatedAt).getTime() -
        new Date(id1.identificationLinkCreatedAt).getTime()
    );

  if (method) {
    return idents.filter((identification) => identification.method === method);
  }

  return idents;
};

export const findIdentificationByEmail = (email, method) => {
  return getAllIdentifications().then((identifications) => {
    const userIdentifications = identifications.filter(
      (identification) => identification.email === email
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

export const listWebhooks = async (req, res) => {
  const webhooks = await getWebhooks();
  res.json(webhooks);
};

export const listPersonsCards = async (req, res) => {
  const person = await getPerson(req.params.id);
  res.render("cards", { person });
};

export const getPersonHandler = async (req, res) => {
  const person = await getPerson(req.params.id);

  if (!person) {
    return res.status(HttpStatusCodes.NOT_FOUND).send({
      message: "Couldn't find person",
      details: req.params,
    });
  }

  const jsonResponse = shouldReturnJSON(req);
  const id = person.id;

  const [
    mobileNumber,
    taxIdentifications,
    devices,
    origin,
    deviceMonitoringActivities,
    deviceMonitoringConsents,
  ] = await Promise.all([
    getMobileNumber(id),
    getTaxIdentifications(id),
    getDevicesByPersonId(id),
    getPersonOrigin(id),
    !jsonResponse && getDeviceActivities(id),
    !jsonResponse && getDeviceConsents(id),
  ]);

  if (jsonResponse) {
    res.send(person);
  } else {
    res.render("person", {
      person,
      mobileNumber,
      taxIdentifications,
      devices,
      identifications: person.identifications,
      SEIZURE_STATUSES,
      origin,
      deviceMonitoringActivities,
      deviceMonitoringConsents,
    });
  }
};

export const updateOrigin = async (req, res) => {
  log.info(`Updating person "${req.params.id} origin"`, req.body);

  const person = await getPerson(req.params.id);

  if (req.body.origin) {
    if (!/http(s)?:\/\//.test(req.body.origin)) {
      throw new Error(`Invalid origin provided: ${req.body.origin}`);
    }
  }

  await setPersonOrigin(req.params.id, req.body.origin);

  res.redirect(`/__BACKOFFICE__/person/${person.id}`);
};

export const updatePersonHandler = async (req, res) => {
  const person = await getPerson(req.params.id);

  Object.keys(req.body).forEach((key) => {
    person[key] = req.body[key];
  });

  person.address = person.address || {};
  person.address.line_1 = req.body.line_1;
  person.address.line_2 = req.body.line_2;
  person.address.postal_code = req.body.postal_code;
  person.address.city = req.body.city;
  person.address.country = req.body.country;
  person.screening_progress = req.body.screeningProgress;
  person.risk_classification_status = req.body.riskClassificationStatus;
  person.customer_vetting_status = req.body.customerVettingStatus;

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

  await triggerWebhook({
    type: PersonWebhookEvent.PERSON_CHANGED,
    payload: {},
    extraHeaders: { "solaris-entity-id": req.params.id },
    personId: person.id,
  });

  res.redirect(`/__BACKOFFICE__/person/${person.id}`);
};

const shouldMarkMobileNumberAsVerified = (identification) =>
  [
    IdentificationStatus.PENDING_SUCCESSFUL,
    IdentificationStatus.SUCCESSFUL,
  ].includes(identification.status) && identification.method === "idnow";

export const setIdentification = async (req, res) => {
  const identification = req.body;
  const { skipSettingScreeningValues } = req.body;
  const personSolarisId = req.params.id;
  const person = await getPerson(personSolarisId);
  person.identifications[identification.id] = identification;

  // TODO: assign these values manually from the backend tests and remove this
  if (
    !(skipSettingScreeningValues === "true") &&
    [
      IdentificationStatus.SUCCESSFUL,
      IdentificationStatus.PENDING_SUCCESSFUL,
    ].includes(identification.status)
  ) {
    person.screening_progress = ScreeningProgress.SCREENED_ACCEPTED;
    person.risk_classification_status = RiskClarificationStatus.RISK_ACCEPTED;
    person.customer_vetting_status = CustomerVettingStatus.RISK_ACCEPTED;
  }

  await savePerson(person);

  if (shouldMarkMobileNumberAsVerified(identification)) {
    const mobileNumber = await getMobileNumber(identification.person_id);
    if (mobileNumber) {
      mobileNumber.verified = true;
      await saveMobileNumber(identification.person_id, mobileNumber);
    }
  }

  await triggerIdentificationWebhook(
    {
      id: identification.id,
      url: identification.url,
      person_id: identification.person_id,
      completed_at: identification.completed_at,
      reference: identification.reference,
      status: identification.status,
      method: "idnow",
    },
    person.id
  );

  res.status(204).send();
};

/*
 * Set customer screening values which are set by solarisbank
 * @see @link {https://docs.solarisbank.com/guides/get-started/digital-banking/onboard-person/#customer-due-diligence-cdd}
 */
export const setScreening = async (req, res) => {
  const {
    screening_progress,
    risk_classification_status,
    customer_vetting_status,
  } = req.body;

  const person = (await getAllPersons()).find(
    (item) => item.email === req.params.email
  );
  log.info(`setScreening person:`, person);

  person.screening_progress = screening_progress;
  person.risk_classification_status = risk_classification_status;
  person.customer_vetting_status = customer_vetting_status;

  await savePerson(person);
  await triggerWebhook({
    type: PersonWebhookEvent.PERSON_CHANGED,
    payload: {},
    extraHeaders: { "solaris-entity-id": person.id },
    personId: person.id,
  });
  res.status(204).send();
};

export const setIdentificationState = async (req, res) => {
  const { status, skipSettingScreeningValues } = req.body;

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
  identification.status = status;
  person.identifications[identification.id] = identification;

  // screening will not always be accepted.
  if (
    !(skipSettingScreeningValues === "true") &&
    [
      IdentificationStatus.SUCCESSFUL,
      IdentificationStatus.PENDING_SUCCESSFUL,
    ].includes(identification.status)
  ) {
    // TODO: assign these values manually from the backend tests and remove this
    person.screening_progress = ScreeningProgress.SCREENED_ACCEPTED;
    person.risk_classification_status = RiskClarificationStatus.RISK_ACCEPTED;
    person.customer_vetting_status = CustomerVettingStatus.RISK_ACCEPTED;
  }

  await savePerson(person);

  if (shouldMarkMobileNumberAsVerified(identification)) {
    const mobileNumber = await getMobileNumber(identification.person_id);
    if (mobileNumber) {
      mobileNumber.verified = true;
      await saveMobileNumber(identification.person_id, mobileNumber);
    }
  }

  await triggerIdentificationWebhook(
    {
      id: identification.id,
      url: identification.url,
      person_id: identification.person_id,
      completed_at: identification.completed_at,
      reference: identification.reference,
      method,
      status,
    },
    person.id
  );

  res.redirect(`/__BACKOFFICE__/person/${person.id}#identifications`);
};

export const displayBackofficeOverview = (req, res) => {
  getAllPersons().then((persons) => {
    res.render("overview", { persons });
  });
};

export const processQueuedBookingHandler = async (req, res) => {
  const { personId, id } = req.params;

  await processQueuedBooking(personId, id);
  res.redirect("back");
};

const generateBookingFromStandingOrder = (standingOrder) => {
  return {
    ...standingOrder,
    id: uuid.v4(),
    valuta_date: moment().format("YYYY-MM-DD"),
    booking_date: moment().format("YYYY-MM-DD"),
    booking_type: BookingType.SEPA_CREDIT_TRANSFER,
    amount: {
      value: -Math.abs(standingOrder.amount.value),
    },
  };
};

/**
 * Processes either a normal booking or a Standing Order.
 * @param {string} personIdOrEmail
 * @param {number} id Booking ID
 * @param {Boolean} isStandingOrder (Optional) True if is of type standing order.
 */
export const processQueuedBooking = async (
  personId,
  id,
  isStandingOrder = false
) => {
  const person = await getPerson(personId);
  person.transactions = person.transactions || [];

  let bookings;
  bookings = isStandingOrder
    ? person.standingOrders || []
    : person.queuedBookings;

  let booking;
  if (id) {
    const findQueuedBooking = (queuedBooking) => queuedBooking.id === id;
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

  const isDirectDebit = [
    BookingType.DIRECT_DEBIT,
    BookingType.SEPA_DIRECT_DEBIT,
  ].includes(booking.booking_type);

  const wouldOverdraw =
    person.account.available_balance.value < booking.amount.value;

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
        id: booking.id.split("-").reverse().join("-"),
        transaction_id: null,
        return_transaction_id: booking.transaction_id,
        booking_type: BookingType.SEPA_DIRECT_DEBIT_RETURN,
        amount: {
          value: booking.amount.value,
          unit: "cents",
          currency: "EUR",
        },
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
  }

  await savePerson(person);
  await triggerBookingsWebhook(person);

  if (sepaDirectDebitReturn) {
    await triggerSepaDirectDebitReturnWebhook(sepaDirectDebitReturn, person);
  }

  return booking;
};

export const generateBookingForPerson = (bookingData) => {
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
    valutaDate,
    status,
  } = bookingData;

  const recipientName = `${person.salutation} ${person.first_name} ${person.last_name}`;
  const recipientIBAN = person.account.iban;
  const recipientBIC = person.account.bic;

  const senderIBAN = iban || "ES3183888553310516236778";
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
    transaction_id: transactionId || uuid.v4(),
    return_transaction_id: null,
    status,
  };
};

export const queueBookingRequestHandler = async (req, res) => {
  const { personId } = req.params;

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
    valutaDate,
    status,
  } = req.body;

  senderName = senderName || "mocksolaris";
  purpose = purpose || "";
  amount = amount ? parseInt(amount, 10) : Math.round(Math.random() * 10000);

  const person = await getPerson(personId);
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
    valutaDate,
    status,
  });

  person.queuedBookings.push(queuedBooking);

  await savePerson(person);

  if (shouldReturnJSON(req)) {
    res.status(201).send(queuedBooking);
  } else {
    res.redirect("back");
  }
};

export const createDirectDebitReturnHandler = async (req, res) => {
  const { personId, id } = req.params;

  await createDirectDebitReturn(personId, id);
  res.redirect("back");
};

export const createDirectDebitReturn = async (personId, id) => {
  const person = await getPerson(personId);
  const directDebit = person.transactions.find(
    (transaction) => transaction.id === id
  );
  const directDebitReturnId = directDebit.id.split("-").reverse().join("-");

  if (
    person.transactions.some(
      (transaction) =>
        transaction.id === directDebitReturnId &&
        transaction.booking_type === BookingType.SEPA_DIRECT_DEBIT_RETURN
    )
  ) {
    throw new Error("Direct debit return already exists");
  }

  const today = moment().format("YYYY-MM-DD");

  const directDebitReturn = {
    ...directDebit,
    sender_iban: directDebit.recipient_iban,
    recipient_iban: directDebit.sender_iban,
    sender_name: directDebit.recipient_name,
    recipient_name: directDebit.sender_name,
    sender_bic: directDebit.recipient_bic,
    recipient_bic: directDebit.sender_bic,
    id: directDebitReturnId,
    transaction_id: null,
    return_transaction_id: directDebit.transaction_id,
    booking_type: BookingType.SEPA_DIRECT_DEBIT_RETURN,
    amount: {
      value: -directDebit.amount.value,
      unit: "cents",
      currency: "EUR",
    },
    booking_date: today,
    valuta_date: today,
  };

  person.transactions.push(directDebitReturn);

  await savePerson(person);

  const sepaDirectDebitReturn = createSepaDirectDebitReturn(
    person,
    directDebitReturn
  );
  await saveSepaDirectDebitReturn(sepaDirectDebitReturn);
  await triggerSepaDirectDebitReturnWebhook(sepaDirectDebitReturn, person);
};

export const updateAccountLockingStatus = async (personId, lockingStatus) => {
  const person = await getPerson(personId);

  person.account = person.account || {};

  const previousLockingStatus = person.account.locking_status;

  person.account = {
    ...person.account,
    locking_status: lockingStatus,
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

const changeCardStatusAllowed = async (personId, cardId, newCardStatus) => {
  const person = await getPerson(personId);
  const cardData = person.account.cards.find(({ card }) => card.id === cardId);

  const {
    card: { status: currentCardStatus, type },
  } = cardData;

  if (
    type.includes("VIRTUAL") &&
    newCardStatus === CardStatus.ACTIVE &&
    [CardStatus.INACTIVE, CardStatus.PROCESSING].includes(currentCardStatus)
  ) {
    return;
  }

  if (
    newCardStatus === CardStatus.INACTIVE &&
    currentCardStatus !== CardStatus.PROCESSING
  ) {
    throw new Error(`Allowed to change only from PROCESSING status`);
  }

  if (
    newCardStatus === CardStatus.ACTIVE &&
    [
      CardStatus.INACTIVE,
      CardStatus.PROCESSING,
      CardStatus.CLOSED,
      CardStatus.CLOSED_BY_SOLARIS,
    ].includes(cardData.card.status)
  ) {
    throw new Error(
      `Can't change card status to active from current status ${cardData.card.status}`
    );
  }
};

export const changeCardStatusHandler = async (req, res) => {
  const { personId, accountId, cardId, status } = req.body;

  await changeCardStatusAllowed(personId, cardId, status);
  await changeCardStatus({ personId, accountId }, cardId, status);

  res.redirect("back");
};

export const createReservationHandler = async (req, res) => {
  const { person_id: personId } = req.params;
  const {
    cardId,
    amount,
    currency,
    type,
    recipient,
    declineReason,
    posEntryMode,
  } = req.body;

  if (!personId) {
    throw new Error("You have to provide personId");
  }

  if (!cardId) {
    throw new Error("You have to provide cardId");
  }

  const payload = {
    personId,
    cardId,
    amount,
    currency,
    type,
    recipient,
    declineReason,
    posEntryMode,
  };

  const reservation = await (type === TransactionType.CREDIT_PRESENTMENT
    ? createCreditPresentment(payload)
    : createReservation(payload));

  if (shouldReturnJSON(req)) {
    res.status(201).send(reservation);
  } else {
    res.redirect("back");
  }
};

export const updateReservationHandler = async (req, res) => {
  const { person_id: personId, id: reservationId } = req.params;
  const { action, increaseAmount } = req.body;

  if (!personId) {
    throw new Error("You have to provide personId");
  }

  if (!reservationId) {
    throw new Error("You have to provide reservationId");
  }

  await updateReservation({
    personId,
    reservationId,
    action,
    increaseAmount,
  });

  res.redirect("back");
};

export const changeOverdraftApplicationStatusHandler = async (req, res) => {
  const { personId, applicationId, status } = req.body;

  await changeOverdraftApplicationStatus({ personId, applicationId, status });

  res.redirect("back");
};

export const issueInterestAccruedBookingHandler = async (req, res) => {
  const { person_id: personId } = req.params;

  await issueInterestAccruedBooking({ personId });

  res.redirect("back");
};

export const saveTaxIdentificationsHandler = async (req, res) => {
  if (!Array.isArray(req.body)) {
    res
      .status(400)
      .send({ message: "body needs to be an array of tax identifications" });
    return;
  }

  await saveTaxIdentifications(req.params.personId, req.body);
  res.status(201).send();
};
