import _ from "lodash";
import HttpStatusCodes from "http-status";

import {
  getPerson,
  savePerson,
  findPersonByAccount,
  saveAccountToPersonId,
  redlock,
} from "../db";
import { IBAN, CountryCode } from "ibankit";
import generateID from "../helpers/id";
import { getLogger } from "../logger";
import { AccountType } from "../helpers/types";

const ACCOUNT_SNAPSHOT_SOURCE = "SOLARISBANK";

const log = getLogger("accounts");

const getDefaultAccount = (personId: string, data = {}) => ({
  id: personId.split("").reverse().join(""),
  iban: IBAN.random(CountryCode.DE).toString(),
  bic: process.env.SOLARIS_BIC,
  type: AccountType.CHECKING_SOLE_PROPRIETOR,
  balance: {
    value: 0,
    unit: "cents",
    currency: "EUR",
  },
  available_balance: {
    value: 0,
    unit: "cents",
    currency: "EUR",
  },
  locking_status: "NO_BLOCK",
  locking_reasons: [],
  account_limit: {
    value: 0,
    unit: "cents",
    currency: "EUR",
  },
  person_id: personId,
  status: "ACTIVE",
  closure_reasons: null,
  seizure_protection: null,
  ...data,
});

const requestAccountFields = [
  "id",
  "iban",
  "bic",
  "type",
  "balance",
  "available_balance",
  "locking_status",
  "locking_reasons",
  "account_limit",
  "person_id",
  "status",
  "closure_reasons",
];

export const showAccountBookings = async (req, res) => {
  const {
    page: { size, number },
    filter: {
      booking_date: { min, max },
    },
  } = req.query;
  const { account_id: accountId } = req.params;

  const person = await findPersonByAccount({ id: accountId });
  const minBookingDate = new Date(min);
  const maxBookingDate = new Date(max);

  const transactions = _.get(person, "transactions", [])
    .filter((booking) => {
      const bookingDate = new Date(booking.booking_date);
      return bookingDate >= minBookingDate && bookingDate <= maxBookingDate;
    })
    .slice((number - 1) * size, number * size);

  res.status(200).send(transactions);
};

export const showAccountReservations = async (req, res) => {
  const {
    page: { size, number },
    filter: { reservation_type: reservationType },
  } = req.query;

  const { account_id: accountId } = req.params;
  const person = await findPersonByAccount({ id: accountId });

  const reservations = _.get(person.account, "reservations", [])
    .filter((reservation) => reservation.reservation_type === reservationType)
    .slice((number - 1) * size, number * size);

  res.status(200).send(reservations);
};

export const showPersonAccount = async (req, res) => {
  const { person_id: personId } = req.params;

  const person = await getPerson(personId);
  const account = _.pick(person.account, requestAccountFields);

  res.status(200).send(account);
};

export const showPersonAccounts = async (req, res) => {
  const { person_id: personId } = req.params;
  const person = await getPerson(personId);

  const accounts = person.account
    ? [_.pick(person.account, requestAccountFields)]
    : [];
  res.status(200).send(accounts);
};

export const createAccount = async (personId: string, data = {}) => {
  let person;
  const personLockKey = `redlock:${process.env.MOCKSOLARIS_REDIS_PREFIX}:person:${personId}`;
  await redlock.using([personLockKey], 5000, async (signal) => {
    if (signal.aborted) {
      throw signal.error;
    }
    person = await getPerson(personId);
    person.account = getDefaultAccount(personId, data);
    await savePerson(person);
    await saveAccountToPersonId(person.account, personId);
  });

  return person.account;
};

export const createAccountRequestHandler = async (req, res) => {
  const { person_id: personId } = req.params;

  const account = await createAccount(personId);

  res.status(201).send(account);
};

export const createAccountSnapshot = async (req, res) => {
  const {
    body: { account_id: accountId, source },
  } = req;

  const person = await findPersonByAccount({ id: accountId });

  if (!person) {
    return res.status(404).send({
      id: generateID(),
      status: 404,
      code: "not_found",
      title: "Not Found",
      detail: `Value: ${accountId} for field: 'account_id' not found`,
      source: {
        message: "not found",
        field: "account_id",
      },
    });
  }

  if (source !== ACCOUNT_SNAPSHOT_SOURCE) {
    return res.status(400).send({
      id: generateID(),
      status: 400,
      code: "bad_request",
      title: "Bad Request",
      detail: `/source: Invalid value for enum`,
      source: {
        message: "Invalid value for enum",
        field: "/source",
      },
    });
  }

  const snapshot = {
    status: "available",
    provider: ACCOUNT_SNAPSHOT_SOURCE,
    id: generateID(),
    iban: person.account.iban,
    account_id: accountId,
  };

  person.account.snapshot = snapshot;
  await savePerson(person);

  return res.status(201).send({
    id: snapshot.id,
    account_id: accountId,
  });
};

export const showAccountBalance = async (req, res) => {
  const { account_id: accountId } = req.params;
  const person = await findPersonByAccount({ id: accountId });

  if (!person) {
    log.error(`Account not found for id: ${accountId}`);
    return res.status(HttpStatusCodes.NOT_FOUND).send({
      errors: [
        {
          id: generateID(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::Account' for id '${accountId}'.`,
        },
      ],
    });
  }

  const balance = _.pick(person.account, [
    "balance",
    "available_balance",
    "seizure_protection",
  ]);

  res.status(200).send(balance);
};

export const showAverageDailyAccountBalance = async (req, res) => {
  const { account_id: accountId } = req.params;
  const { start_date, end_date } = req.query;

  if (!start_date || !end_date) {
    log.error("Missing start_date or end_date", {
      accountId,
      start_date,
      end_date,
    });
    return res.status(HttpStatusCodes.BAD_REQUEST).send({
      errors: [
        {
          id: generateID(),
          status: 400,
          code: "bad_request",
          title: "Bad Request",
          detail: "Missing start_date or end_date",
        },
      ],
    });
  }

  const person = await findPersonByAccount({ id: accountId });

  if (!person) {
    log.error(`Account not found for id: ${accountId}`);
    return res.status(HttpStatusCodes.NOT_FOUND).send({
      errors: [
        {
          id: generateID(),
          status: 404,
          code: "model_not_found",
          title: "Model Not Found",
          detail: `Couldn't find 'Solaris::Account' for id '${accountId}'.`,
        },
      ],
    });
  }

  res.send({
    account_id: person.account.id,
    average_daily_balance: {
      value: person.account.balance.value,
      unit: "cents",
      currency: "EUR",
    },
  });
};
