import _ from "lodash";
import generateIban from "iban-generator";
import uuid from "uuid";
import { getPerson, savePerson, findPersonByAccountId } from "../db";

const ACCOUNT_SNAPSHOT_SOURCE = "SOLARISBANK";

const DEFAULT_ACCOUNT = {
  id: "df478cbe801e30550f7cea9340783e6bcacc",
  iban: "DE87110101001000022513",
  bic: "SOBKDEBBXXX",
  type: "CHECKING_PERSONAL",
  balance: {
    value: 0,
    unit: "cents",
    currency: "EUR"
  },
  available_balance: {
    value: 0,
    unit: "cents",
    currency: "EUR"
  },
  locking_status: "NO_BLOCK",
  locking_reasons: [],
  account_limit: {
    value: 0,
    unit: "cents",
    currency: "EUR"
  },
  person_id: "66a692fdddc32c05ebe1c1f1c3145a3bcper",
  status: "ACTIVE",
  closure_reasons: null
};

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
  "closure_reasons"
];

export const showAccountBookings = async (req, res) => {
  const {
    page: { size, number },
    filter: {
      booking_date: { min, max }
    }
  } = req.query;
  const { account_id: accountId } = req.params;

  const person = await findPersonByAccountId(accountId);
  const minBookingDate = new Date(min);
  const maxBookingDate = new Date(max);

  const transactions = _.get(person, "transactions", [])
    .filter(booking => {
      const bookingDate = new Date(booking.booking_date);
      return bookingDate >= minBookingDate && bookingDate <= maxBookingDate;
    })
    .slice((number - 1) * size, number * size);

  res.status(200).send(transactions);
};

export const showAccountReservations = async (req, res) => {
  const {
    page: { size, number },
    filter: {
      expires_at: { min, max },
      reservation_type: reservationType
    }
  } = req.query;

  const { account_id: accountId } = req.params;
  const person = await findPersonByAccountId(accountId);

  const minExpiresAtDate = new Date(min);
  const maxExpiresAtDate = new Date(max);

  const reservations = _.get(person.account, "reservations", [])
    .filter(reservation => {
      const expiresAtDate = new Date(reservation.expires_at);
      return (
        expiresAtDate >= minExpiresAtDate &&
        expiresAtDate <= maxExpiresAtDate &&
        reservation.reservation_type === reservationType
      );
    })
    .slice((number - 1) * size, number * size);

  res.status(200).send(reservations);
};

export const showPersonAccount = async (req, res) => {
  const { person_id: personId } = req.params;

  const person = await getPerson(personId);
  const account = {
    ..._.pick(person.account, requestAccountFields),
    balance: null,
    available_balance: null
  };

  res.status(200).send(account);
};

export const showPersonAccounts = async (req, res) => {
  const { person_id: personId } = req.params;
  const person = await getPerson(personId);

  const accounts = person.account
    ? [
        {
          ..._.pick(person.account, requestAccountFields),
          balance: null,
          available_balance: null
        }
      ]
    : [];
  res.status(200).send(accounts);
};

let counter = 0;

export const createAccount = async (personId, data) => {
  const person = await getPerson(personId);
  person.account = {
    ...DEFAULT_ACCOUNT,
    ...person.account,
    ...data
  };

  await savePerson(person);

  person.account = {
    ...person.account,
    balance: null,
    available_balance: null
  };

  return person.account;
};

export const createAccountRequestHandler = async (req, res) => {
  const { person_id: personId } = req.params;

  counter++;

  const accountId = personId
    .split("")
    .reverse()
    .join("");

  const iban = generateIban.doIban(
    generateIban.fixCCC(generateIban.randomNumber())
  );

  const account = await createAccount(personId, {
    ...DEFAULT_ACCOUNT,
    id: accountId,
    iban,
    type: "CHECKING_BUSINESS",
    person_id: personId,
    balance: {
      value: 0 // new accounts have no money
    },
    available_balance: {
      value: 0 // new accounts have no money
    },
    sender_name: `bank-mock-${counter}`,
    locking_status: "NO_BLOCK"
  });

  res.status(201).send(account);
};

export const showAccountBalance = async (req, res) => {
  const { account_id: accountId } = req.params;
  const person = await findPersonByAccountId(accountId);
  const balance = _.pick(person.account, ["balance", "available_balance"]);

  res.status(200).send(balance);
};

export const createAccountSnapshot = async (req, res) => {
  const {
    body: { account_id: accountId, source }
  } = req;

  const person = await findPersonByAccountId(accountId);

  if (!person) {
    return res.status(404).send({
      id: uuid.v4(),
      status: 404,
      code: "not_found",
      title: "Not Found",
      detail: `Value: ${accountId} for field: 'account_id' not found`,
      source: {
        message: "not found",
        field: "account_id"
      }
    });
  }

  if (source !== ACCOUNT_SNAPSHOT_SOURCE) {
    return res.status(400).send({
      id: uuid.v4(),
      status: 400,
      code: "bad_request",
      title: "Bad Request",
      detail: `/source: Invalid value for enum`,
      source: {
        message: "Invalid value for enum",
        field: "/source"
      }
    });
  }

  const snapshot = {
    status: "available",
    provider: ACCOUNT_SNAPSHOT_SOURCE,
    id: uuid.v4(),
    iban: person.account.iban,
    account_id: accountId
  };

  person.account.snapshot = snapshot;
  await savePerson(person);

  return res.status(201).send({
    id: snapshot.id,
    account_id: accountId
  });
};
