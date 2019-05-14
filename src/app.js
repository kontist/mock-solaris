import express, { Router } from 'express';
import 'express-async-errors';
import bodyParser from 'body-parser';
import swig from 'swig';
import path from 'path';

import * as log from './logger';
import * as oauthAPI from './routes/oauth';
import * as personsAPI from './routes/persons';
import * as standingOrdersAPI from './routes/standingOrders';
import * as accountsAPI from './routes/accounts';
import * as identificationsAPI from './routes/identifications';
import * as taxIdentificationsAPI from './routes/taxIdentifications';
import * as transactionsAPI from './routes/transactions';
import * as webhooksAPI from './routes/webhooks';
import * as backofficeAPI from './routes/backoffice';
import * as accountStatementsAPI from './routes/accountStatements';
import * as bankStatementsAPI from './routes/bankStatements';
import * as mobileNumberAPI from './routes/mobileNumber';
import * as changeRequestAPI from './routes/changeRequest';
import * as returnNotificationsAPI from './routes/sepaDirectDebitReturns';

import { migrate } from './db';

import { oauthTokenAuthenticationMiddleware } from './helpers/oauth';

const app = express();

function logResponseBody (req, res, next) {
  const oldWrite = res.write;
  const oldEnd = res.end;

  var chunks = [];

  res.write = function (chunk) {
    chunks.push(Buffer.from(chunk));

    oldWrite.apply(res, arguments);
  };

  res.end = function (chunk) {
    if (chunk) {
      chunks.push(Buffer.from(chunk));
    }

    var body = Buffer.concat(chunks).toString('utf8');

    if ((res.get('content-type') || '').startsWith('text/html')) {
      body = `${body.slice(0, 14)}...`;
    }

    console.log('---> ', req.path, '>>', body, '<<');

    oldEnd.apply(res, arguments);
  };

  next();
}

const router = new Router();

app.use(logResponseBody);

app.engine('html', swig.renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'templates'));
app.set('view cache', false);
swig.setDefaults({ cache: false });

app.use(log.getExpressLogger());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(errorHandler);
app.use('/v1', router);
app.post('/oauth/token', oauthAPI.generateToken);

function errorHandler (err, req, res, next) {
  log.error(err);
  res.status(500);
  res.render('error', { error: err });
}

const { REQUIRE_HOST_HEADER } = process.env;

const checkRequestHostHeader = (req, res, next) => {
  if (REQUIRE_HOST_HEADER && !req.headers.host.includes(REQUIRE_HOST_HEADER)) {
    log.error(`(checkRequestHostHeader()) Tried to connect from ${req.headers.host}`);

    return res.status(403).send('You should not connect to staging mocksolaris from local machine');
  }

  next();
};

router.use(oauthTokenAuthenticationMiddleware);

// PERSONS
router.post('/persons', personsAPI.createPerson);
router.get('/persons/:person_id', personsAPI.showPerson);
router.get('/persons', personsAPI.showPersons);
router.patch('/persons/:person_id', personsAPI.updatePerson);

// ACCOUNTS
router.get('/accounts/:account_id/bookings', accountsAPI.showAccountBookings);
router.get('/persons/:person_id/accounts/:id', accountsAPI.showPersonAccount);
router.get('/persons/:person_id/accounts', accountsAPI.showPersonAccounts);
router.post('/persons/:person_id/accounts', accountsAPI.createAccountRequestHandler);

// SEPA_DIRECT_DEBIT_RETURNS
router.get('/sepa_direct_debit_returns', returnNotificationsAPI.listReturnNotificationsHandler);

// IDENTIFICATIONS
router.get('/persons/:person_id/identifications', identificationsAPI.showPersonIdentifications);
router.post('/persons/:person_id/identifications', identificationsAPI.requireIdentification);
router.patch('/persons/:person_id/identifications/:id/request', identificationsAPI.patchIdentification);

// TAX INFORMATION
router.get('/persons/:person_id/tax_identifications', taxIdentificationsAPI.listTaxIdentifications);
router.post('/persons/:person_id/tax_identifications', taxIdentificationsAPI.submitTaxIdentification);
router.get('/persons/:person_id/tax_identifications/:id', taxIdentificationsAPI.showTaxIdentification);

// TRANSACTIONS
router.post('/persons/:person_id/accounts/:account_id/transactions/sepa_credit_transfer', transactionsAPI.createSepaCreditTransfer);
router.post('/persons/:person_id/accounts/:account_id/transactions/sepa_credit_transfer/:transfer_id/authorize', transactionsAPI.authorizeTransaction);
router.post('/persons/:person_id/accounts/:account_id/transactions/sepa_credit_transfer/:transfer_id/confirm', transactionsAPI.confirmTransaction);

router.post('/accounts/:account_id/transactions/sepa_direct_debit', transactionsAPI.createSepaDirectDebit);

// STANDING ORDERS
router.post('/persons/:person_id/accounts/:account_id/standing_orders', standingOrdersAPI.createStandingOrderRequestHandler);
router.patch('/persons/:person_id/accounts/:account_id/standing_orders/:id/cancel', standingOrdersAPI.cancelStandingOrderRequestHandler);

// ACCOUNT STATEMENTS
router.post('/accounts/:account_id/statement_of_accounts', accountStatementsAPI.createAccountStatement);
router.get('/accounts/:account_id/statement_of_accounts/:statement_of_account_id/bookings', accountStatementsAPI.showAccountStatementBookings);

// BANK STATEMENTS
router.post('/accounts/:account_id/bank_statements', bankStatementsAPI.createBankStatement);
router.get('/accounts/:account_id/bank_statements/:bank_statement_id/bookings', bankStatementsAPI.showBankStatementBookings);

// MOBILE NUMBER
router.get('/persons/:person_id/mobile_number', mobileNumberAPI.showMobileNumber);
router.post('/persons/:person_id/mobile_number', mobileNumberAPI.createMobileNumber);
router.post('/persons/:person_id/mobile_number/authorize', mobileNumberAPI.authorizeMobileNumber);
router.post('/persons/:person_id/mobile_number/confirm', mobileNumberAPI.confirmMobileNumber);
router.delete('/persons/:person_id/mobile_number', mobileNumberAPI.removeMobileNumber);

// CHANGE REQUEST
router.post('/change_requests/:change_request_id/authorize', changeRequestAPI.authorizeChangeRequest);
router.post('/change_requests/:change_request_id/confirm', changeRequestAPI.confirmChangeRequest);

// BACKOFFICE
app.get('/__BACKOFFICE__', backofficeAPI.listPersons);
app.post('/__BACKOFFICE__/setIdentificationState/:email', backofficeAPI.setIdentificationState);

app.get('/__BACKOFFICE__/person/:email', backofficeAPI.getPersonHandler);
app.post('/__BACKOFFICE__/person/:email', backofficeAPI.updatePersonHandler);

app.post('/__BACKOFFICE__/queueBooking/:accountIdOrEmail', backofficeAPI.queueBookingRequestHandler);
app.post('/__BACKOFFICE__/processQueuedBooking/:personIdOrEmail', backofficeAPI.processQueuedBookingHandler);
app.post('/__BACKOFFICE__/processQueuedBooking/:personIdOrEmail/:id', backofficeAPI.processQueuedBookingHandler);
app.post('/__BACKOFFICE__/updateAccountLockingStatus/:personId', backofficeAPI.updateAccountLockingStatusHandler);
app.post('/__BACKOFFICE__/triggerBackendTransactionsUpdateJob', backofficeAPI.triggerBackendTransactionsUpdateJobHandler);

// BACKOFFICE - STANDING ORDERS
app.post('/__BACKOFFICE__/triggerStandingOrder/:personIdOrEmail/:id', standingOrdersAPI.triggerStandingOrderRequestHandler);

// WEBHOOKS
router.get('/webhooks', checkRequestHostHeader, webhooksAPI.indexWebhooks);
router.post('/webhooks', checkRequestHostHeader, webhooksAPI.createWebhook);

// HEALTH CHECK
app.get('/health', (req, res) => {
  res.status(200).send('there is no piwo tracker!');
});

// REST
app.get('*', (req, res) => {
  res.status(404).send('Not found');
});

export default app;

export const serve = (port) => {
  return new Promise(async (resolve, reject) => {
    await migrate();
    app.listen(port, () => {
      console.log(`mocksolaris listening on http://localhost:${port}/!`);
      resolve();
    });
  });
};
