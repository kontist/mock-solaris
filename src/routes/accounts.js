import _ from 'lodash';
import generateIban from 'iban-generator';
import {
  getPerson,
  savePerson,
  findPersonByAccountId
} from '../db';

const DEFAULT_ACCOUNT = {
  'id': 'df478cbe801e30550f7cea9340783e6bcacc',
  'iban': 'DE87110101001000022513',
  'bic': 'SOBKDEBBXXX',
  'type': 'CHECKING_PERSONAL',
  'balance': {
    'value': 0,
    'unit': 'cents',
    'currency': 'EUR'
  },
  'available_balance': {
    'value': 0,
    'unit': 'cents',
    'currency': 'EUR'
  },
  'locking_status': 'NO_BLOCK',
  'locking_reasons': [],
  'account_limit': {
    'value': 0,
    'unit': 'cents',
    'currency': 'EUR'
  },
  'person_id': '66a692fdddc32c05ebe1c1f1c3145a3bcper',
  'status': 'ACTIVE',
  'closure_reasons': null
};

export const showAccountBookings = async (req, res) => {
  const {
    page: { size, number },
    filter: { booking_date: { min, max } }
  } = req.query;
  const { account_id: accountId } = req.params;

  const person = await findPersonByAccountId(accountId);
  const minBookingDate = new Date(min);
  const maxBookingDate = new Date(max);

  const transactions = _.get(person, 'transactions', [])
    .filter((booking) => {
      const bookingDate = new Date(booking.booking_date);
      return bookingDate >= minBookingDate && bookingDate <= maxBookingDate;
    })
    .slice((number - 1) * size, number * size);

  res.status(200).send(transactions);
};

export const showPersonAccount = async (req, res) => {
  const { person_id: personId } = req.params;

  const person = await getPerson(personId);

  res.status(200).send(person.account);
};

export const showPersonAccounts = async (req, res) => {
  const { person_id: personId } = req.params;
  const person = await getPerson(personId);

  const accounts = person.account ? [person.account] : [];
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

  return person.account;
};

export const createAccountRequestHandler = async (req, res) => {
  const { person_id: personId } = req.params;

  counter++;

  const accountId = personId.split('').reverse().join('');

  const iban = generateIban.doIban(generateIban.fixCCC(generateIban.randomNumber()));

  const account = await createAccount(personId, {
    ...DEFAULT_ACCOUNT,
    id: accountId,
    iban,
    type: 'CHECKING_BUSINESS',
    person_id: personId,
    balance: {
      value: 0 // new accounts have no money
    },
    available_balance: {
      value: 0 // new accounts have no money
    },
    sender_name: `bank-mock-${counter}`,
    locking_status: 'NO_BLOCK'
  });

  res.status(201).send(account);
};
