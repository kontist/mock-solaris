import uuid from 'uuid';
import moment from 'moment';
import * as log from '../logger';
import {
  getPerson,
  savePerson,
  findPersonByAccountIBAN,
  getTechnicalUserPerson
} from '../db';

export const createSepaDirectDebit = async (req, res) => {
  log.debug('params', req.params);
  log.debug('body', req.body);

  const {
    amount,
    description,
    // eslint-disable-next-line camelcase
    collection_date,
    mandate,
    end_to_end_id: e2eId
  } = req.body;

  log.info(`createSepaDirectDebit - req.body\n${JSON.stringify(req.body, null, 2)}`);

  const { debtor_iban: iban } = mandate;

  const person = await findPersonByAccountIBAN(iban);
  const technicalPerson = await getTechnicalUserPerson();

  const queuedBooking = {
    amount: {
      ...amount,
      value: amount.value,
      currency: amount.currency || 'EUR'
    },
    'description': description,
    'collection_date': collection_date,
    'end_to_end_id': e2eId || null,
    'id': uuid.v4(),
    mandate,
    booking_type: 'DIRECT_DEBIT',
    sender_iban: description.includes('Neuversuch') ? process.env.KONTIST_IBAN : process.env.KONTIST_DD_BILLING_IBAN,
    // for simplicity we set it to current date so we don't have to wait 3+ days for DD to be visible on account statements
    booking_date: moment().format('YYYY-MM-DD'),
    valuta_date: moment().format('YYYY-MM-DD'),
    recipient_iban: mandate.debtor_iban,
    sender_name: 'Kontist GmbH',
    recipient_name: mandate.debtor_name
  };

  person.queuedBookings.push(queuedBooking);
  technicalPerson.transactions.push(queuedBooking);

  person.account.balance.value -= Math.abs(amount.value);
  person.account.available_balance = person.account.available_balance || {};
  person.account.available_balance.value = person.account.balance.value;

  log.info(`Person amount after update: ${person.account.balance.value}, booking amount: ${Math.abs(amount.value)}`);

  if (person.account.balance.value < 0) {
    const directDebitReturn = {
      ...queuedBooking,
      booking_type: 'SEPA_DIRECT_DEBIT_RETURN'
    };
    person.queuedBookings.push(directDebitReturn);
    technicalPerson.transactions.push(directDebitReturn);
  }

  log.info(`createSepaDirectDebit - transaction\n${JSON.stringify(queuedBooking, null, 2)}`);

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
  log.debug('params', req.params);
  log.debug('body', req.body);

  const { person_id: personId, account_id: accountId } = req.params;

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

  if (description === 'timeout') {
    log.debug('timeout here');
    return;
  }

  if (description === 'fail') {
    const value = parseInt(String(amount).slice(0, 3), 10);
    log.debug('error', value, 'here');
    res.setHeader('Content-Type', 'application/json');
    res.status(value).send({ 'errors': [{
      id: 'a71a242a3550f0b38de423b68c451914ex',
      status: value,
      code: 'invalid_model',
      title: 'Invalid Model',
      detail: 'Invalid or expired Model for Solaris::SepaCreditTransaction with uid: "mockmockmock"'
    }] });
    return;
  }

  if (description === 'insufficientfunds') {
    log.debug('There were insufficient funds to complete this action.');
    res.setHeader('Content-Type', 'application/json');
    res.status(400).send({
      errors: [{
        id: 'fake-transfer-id',
        status: 400,
        code: 'insufficient_funds',
        title: 'Insufficient Funds',
        detail: 'There were insufficient funds to complete this action.'
      }]
    });
    return;
  }

  log.info(`createSepaCreditTransfer - req.body\n${JSON.stringify(req.body, null, 2)}`);

  const person = await getPerson(personId) || {
    transactions: [],
    transfers: [],
    identifications: {},
    account: {
      id: accountId
    }
  };

  person.queuedBookings = (person.queuedBookings || []);

  const queuedBooking = {
    booking_type: 'SEPA_CREDIT_TRANSFER',
    amount: {
      ...amount,
      value: -amount.value,
      currency: amount.currency || 'EUR'
    },
    description: description,
    end_to_end_id: e2eId || null,
    id: uuid.v4(),
    recipient_bic: null,
    recipient_iban: recipient_iban,
    recipient_name: recipient_name,
    reference: reference,
    status: 'authorization_required'
  };

  person.queuedBookings.push(queuedBooking);

  log.info(`createSepaCreditTransfer - transaction\n${JSON.stringify(queuedBooking, null, 2)}`);

  await savePerson(person);

  res.status(200).send({
    ...queuedBooking,
    amount: {
      ...queuedBooking.amount,
      value: Math.abs(queuedBooking.amount.value),
      currency: queuedBooking.amount.currency || 'EUR'
    }
  });
};

export const authorizeTransaction = async (req, res) => {
  log.info('authorizeTransaction - req.params', req.params);
  log.info('authorizeTransaction - req.body', req.body);

  const {
    person_id: personId,
    transfer_id: transferId
  } = req.params;

  log.info(`authorizeTransaction - req.body\n${JSON.stringify(req.body, null, 2)}`);

  const person = await getPerson(personId);
  const transfer = (person.queuedBookings || [])
    .find((queuedBooking) => queuedBooking.id === transferId);

  transfer['status'] = 'confirmation_required';

  log.info(`authorizeTransaction - transaction\n${JSON.stringify(transfer, null, 2)}`);

  await savePerson(person);

  res.status(200).send(transfer);
};

export const confirmTransaction = async (req, res) => {
  log.info('params', req.params);
  log.info('body', req.body);

  const {
    person_id: personId,
    transfer_id: transferId
  } = req.params;

  // eslint-disable-next-line camelcase
  const { authorization_token } = req.body;

  if (authorization_token.startsWith('0000')) {
    log.debug('timeout here');
    return;
  }

  if (authorization_token[0] === '0') {
    const value = parseInt(authorization_token.slice(1, 4), 10);
    log.debug('error', value, 'here');
    res.setHeader('Content-Type', 'application/json');
    res.status(value).send({ 'errors': [{
      'id': 'a71a242a3550f0b38de423b68c451914ex',
      'status': value,
      'code': 'invalid_tan',
      'title': 'Invalid TAN',
      'detail': 'Invalid or expired TAN for Solaris::SepaCreditTransaction with uid: "mockmockmock"'
    }] });
    return;
  }

  log.info(`confirmTransaction - req.body\n${JSON.stringify(req.body, null, 2)}`);

  const person = await getPerson(personId);
  const transfer = (person.queuedBookings || [])
    .find((queuedBooking) => queuedBooking.id === transferId);

  const today = moment().format('YYYY-MM-DD');

  Object.assign(transfer, {
    transaction_id: transfer.id,
    booking_date: today,
    valuta_date: today,
    name: `bank-mock-transaction-${Math.random()}`,
    'status': 'accepted'
  });

  log.info(`confirmTransaction - transaction\n${JSON.stringify(transfer, null, 2)}`);

  await savePerson(person);

  res.status(200).send(transfer);
};
